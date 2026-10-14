import { neon } from '@neondatabase/serverless';

// Postgres over HTTP (Neon). Use `rows('... $1', [value])`: always pass values as
// parameters, never build SQL from user input.
let client: ReturnType<typeof neon> | null = null;

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Database is not configured (DATABASE_URL is missing).');
  client ??= neon(url);
  return client;
}

// Runs a query and returns its rows.
export async function rows<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db().query(text, params)) as T[];
}

// Runs several statements as one transaction: either all of them apply or none do.
export async function transaction(queries: [text: string, params?: unknown[]][]): Promise<void> {
  const sql = db();
  await sql.transaction(queries.map(([text, params]) => sql.query(text, params ?? [])));
}
