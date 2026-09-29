import type { ApiEnvelope } from './types';

const TOKEN_KEY = 'zhixu-web-token';

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

const BASE: string = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080/api';

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json; charset=utf-8';
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError('NETWORK', `服务暂不可用（HTTP ${response.status}）`, response.status);
  }
  if (envelope.code !== 0) {
    if (envelope.code === 'AUTH_REQUIRED' || response.status === 401) clearToken();
    throw new ApiError(String(envelope.code), envelope.message, response.status);
  }
  return envelope.data as T;
}
