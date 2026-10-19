const FALLBACK_API_BASE_URL = 'http://localhost:8000';
const TOKEN_STORAGE_KEY = 'officemessenger.access_token';

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

function normalizeBaseUrl(value: string | undefined): string {
  const candidate = value?.trim();
  if (!candidate || candidate.includes('${')) {
    return FALLBACK_API_BASE_URL;
  }
  return candidate.replace(/\/+$/, '');
}

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    return;
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ErrorResponseBody {
  error?: {
    code?: string;
    title_de?: string;
    message?: string;
  };
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method: HttpMethod;
  body?: unknown;
}

async function readApiError(response: Response): Promise<ApiError> {
  let code = 'http_error';
  let message = 'Die Anfrage ist fehlgeschlagen.';

  try {
    const body = (await response.json()) as ErrorResponseBody;
    if (body.error?.code) {
      code = body.error.code;
    }
    if (body.error?.title_de) {
      message = body.error.title_de;
    } else if (body.error?.message) {
      message = body.error.message;
    }
  } catch {
    code = 'http_error';
  }

  return new ApiError(response.status, code, message);
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), {
      method: options.method,
      headers,
      body,
    });
  } catch {
    throw new ApiError(0, 'network_error', 'Die Verbindung zum Server ist fehlgeschlagen.');
  }

  if (!response.ok) {
    throw await readApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, 'invalid_response', 'Die Antwort des Servers konnte nicht gelesen werden.');
  }
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'GET' });
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body });
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', body });
  },

  del<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },

  upload<T>(path: string, file: File, fields?: Record<string, string>): Promise<T> {
    const form = new FormData();
    form.append('file', file);
    if (fields) {
      for (const [name, value] of Object.entries(fields)) {
        form.append(name, value);
      }
    }
    return request<T>(path, { method: 'POST', body: form });
  },
};
