import type { IncomingHttpHeaders } from 'node:http';

// Minimal request/response shapes shared by Vercel's Node functions and the Vite dev adapter.
export interface ApiRequest {
  method?: string;
  headers: IncomingHttpHeaders;
  query: Record<string, string | string[] | undefined>;
  body?: unknown; // parsed JSON for application/json requests
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): void;
  send(body: Buffer | string): void;
}

export function queryParam(req: ApiRequest, name: string): string | undefined {
  const value = req.query[name];
  return Array.isArray(value) ? value[0] : value;
}

// The JSON body as a plain object ({} when missing or not an object).
export function bodyObject(req: ApiRequest): Record<string, unknown> {
  const body = req.body;
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
