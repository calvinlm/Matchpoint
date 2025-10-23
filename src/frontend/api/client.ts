export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
}

const defaultHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '')
).replace(/\/$/, '');

const resolveUrl = (url: string) => {
  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (!API_BASE_URL) {
    return url;
  }

  return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

async function request<T>(url: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> {
  const response = await fetch(resolveUrl(url), {
    method,
    headers: defaultHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const fallbackMessage = Array.isArray(payload?.errors)
      ? payload.errors.join(', ')
      : undefined;
    const message = payload?.error || payload?.message || fallbackMessage || response.statusText;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');

  if (contentType && contentType.toLowerCase().includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as unknown as T;
}

export const apiClient = {
  get<T>(url: string, token?: string) {
    return request<T>(url, { method: 'GET', token });
  },
  post<T>(url: string, body: unknown, token?: string) {
    return request<T>(url, { method: 'POST', body, token });
  },
  patch<T>(url: string, body: unknown, token?: string) {
    return request<T>(url, { method: 'PATCH', body, token });
  },
  delete<T>(url: string, token?: string) {
    return request<T>(url, { method: 'DELETE', token });
  },
};
