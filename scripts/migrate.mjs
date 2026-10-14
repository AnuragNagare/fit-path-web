// Applies db/migrations/*.sql in order and records each in schema_migrations.
// Usage: npm run db:migrate   (reads DATABASE_URL from the environment or .env.local)

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

function loadEnvLocal() {
  if (!existsSync('.env.local')) return;
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0 && /^[A-Z_]+$/.test(line.slice(0, i)) && !(line.slice(0, i) in process.env)) {
      process.env[line.slice(0, i)] = line.slice(i + 1);
    }
  }
}

loadEnvLocal();
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to .env.local.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
const applied = new Set((await sql`SELECT name FROM schema_migrations`).map(r => r.name));

const files = readdirSync('db/migrations').filter(f => f.endsWith('.sql')).sort();
for (const file of files) {
  if (applied.has(file)) continue;
  const statements = readFileSync(`db/migrations/${file}`, 'utf8')
    .split(/;[ \t]*\r?\n/)
    .map(s => s.replace(/^(\s*--.*\r?\n)+/gm, '').trim())
    .filter(Boolean);
  // One transaction per file: either every statement applies or none do.
  await sql.transaction([
    ...statements.map(s => sql.query(s)),
    sql.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]),
  ]);
  console.log(`applied ${file} (${statements.length} statements)`);
}
console.log('database is up to date');
