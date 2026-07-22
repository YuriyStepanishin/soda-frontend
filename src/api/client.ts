import { API_BASE_URL, AUTH_TOKEN_KEY } from './config';

type QueryValue = string | number | boolean | undefined | null;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, API_BASE_URL);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  const payload = isJson && raw ? (JSON.parse(raw) as unknown) : null;

  if (!response.ok) {
    const messageFromPayload =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof (payload as Record<string, unknown>).message === 'string'
        ? ((payload as Record<string, unknown>).message as string)
        : null;

    throw new ApiError(
      messageFromPayload || `HTTP ${response.status}`,
      response.status
    );
  }

  return payload as T;
}

export async function apiGet<T>(
  path: string,
  options?: {
    query?: Record<string, QueryValue>;
    authenticated?: boolean;
    signal?: AbortSignal;
  }
): Promise<T> {
  const headers = new Headers();

  if (options?.authenticated) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path, options?.query), {
    method: 'GET',
    headers,
    signal: options?.signal,
  });

  return parseResponse<T>(response);
}

export async function apiPostJson<TResponse, TBody>(
  path: string,
  body: TBody,
  options?: { authenticated?: boolean }
): Promise<TResponse> {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (options?.authenticated) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return parseResponse<TResponse>(response);
}

export async function apiPostFormData<TResponse>(
  path: string,
  body: FormData,
  options?: { authenticated?: boolean }
): Promise<TResponse> {
  const headers = new Headers();

  if (options?.authenticated) {
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(buildUrl(path), {
    method: 'POST',
    headers,
    body,
  });

  return parseResponse<TResponse>(response);
}
