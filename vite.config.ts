import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// Serves the Vercel-style functions in /api during `vite dev` so no Vercel CLI is needed.
function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const match = /^\/api\/([a-z-]+)$/.exec(url.pathname);
        if (!match) return next();

        const query: Record<string, string | string[]> = {};
        url.searchParams.forEach((value, key) => {
          const prev = query[key];
          query[key] = prev === undefined ? value : ([] as string[]).concat(prev, value);
        });

        const send = (status: number, body: unknown) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };

        try {
          const mod = await server.ssrLoadModule(`/api/${match[1]}.ts`);
          let status = 200;
          const apiRes = {
            status(code: number) { status = code; return apiRes; },
            setHeader(name: string, value: string) { res.setHeader(name, value); return apiRes; },
            json(body: unknown) { send(status, body); },
          };
          await mod.default({ method: req.method, headers: req.headers, query }, apiRes);
        } catch (err) {
          const notFound = err instanceof Error && /Failed to load url|Cannot find/.test(err.message);
          send(notFound ? 404 : 500, { error: notFound ? 'Not found.' : 'Internal error.' });
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Expose non-VITE_ vars (e.g. CLERK_SECRET_KEY) to the dev-only API functions.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));

  return {
    plugins: [react(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
