import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Runs the tests that talk to the real database named by DATABASE_URL in .env.local.
// They only touch rows they create themselves (fake gym ids and test_ user ids) and delete them afterwards.
export default defineConfig(({ mode }) => ({
  test: {
    include: ['api/**/*.db.test.ts'],
    env: loadEnv(mode, process.cwd(), ''),
    testTimeout: 30_000,
    fileParallelism: false,
  },
}));
