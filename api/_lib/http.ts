import type { IncomingHttpHeaders } from 'node:http';

// Minimal request/response shapes shared by Vercel's Node functions and the Vite dev adapter.
export interface ApiRequest {
  method?: string;
  headers: IncomingHttpHeaders;
  query: Record<string, string | string[] | undefined>;
}

export interface ApiResponse {
  status(code: number): ApiResponse;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): void;
}

export function queryParam(req: ApiRequest, name: string): string | undefined {
  const value = req.query[name];
  return Array.isArray(value) ? value[0] : value;
}
