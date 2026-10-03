import { API_BASE_URL, AUTH_TOKEN_KEY } from './config';

type QueryValue = string | number | boolean | undefined | null;

// Unified API transport error with HTTP status for UI-specific handling.
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function getToken(): string | null {
  // SSR guard: localStorage is only available in browser runtime.
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, API_BASE_URL);

  if (query) {
    // Skip empty values so backend receives only active filters.
    for (const [key, value] of Object.entries(query)) {
      if (value == null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

async function parseResponse<T>(response: Response): Promise<T> {
  // Parse text first to gracefully handle both JSON and non-JSON backend responses.
  const raw = await response.text();
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  const payload = isJson && raw ? (JSON.parse(raw) as unknown) : null;

  if (!response.ok) {
    // Prefer backend-provided message, fallback to generic HTTP code.
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
  // Thin GET wrapper with optional auth header and query serialization.
  const headers = new Headers();

  if (options?.authenticated) {
    // Attach JWT only for protected endpoints.
    const token = getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const url = buildUrl(path, options?.query);

  if (import.meta.env.DEV && path.startsWith('/api/sales')) {
    console.debug('[sales-api:get]', url, options?.query ?? {});
  }

  const response = await fetch(url, {
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
  // JSON POST used by auth and structured payload endpoints.
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  if (options?.authenticated) {
    // Reuse the same auth mechanism as GET requests.
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
  // FormData POST used by photo uploads and multipart endpoints.
  const headers = new Headers();

  if (options?.authenticated) {
    // Do not set Content-Type manually for FormData; browser sets boundary.
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
