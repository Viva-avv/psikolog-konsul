export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export type Role = 'USER' | 'PSYCHOLOGIST' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  psychologistProfile: { id: string; verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' } | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
  }
}

// Access token lives only in memory; the refresh token is an httpOnly cookie.
let accessToken: string | null = null;
export const setAccessToken = (token: string | null) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

let refreshPromise: Promise<AuthResponse | null> | null = null;

/** Deduplicated so parallel callers share a single refresh request. */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshPromise ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const data = (await res.json()) as AuthResponse;
      accessToken = data.accessToken;
      return data;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  retry?: boolean;
}

export async function api<T>(path: string, { method = 'GET', body, retry = true }: RequestOptions = {}): Promise<T> {
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = {};
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, { method, body, retry: false });
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new ApiError(res.status, err.code ?? 'UNKNOWN', err.message ?? 'Terjadi kesalahan', err.details);
  }
  return data as T;
}

export async function apiBlob(path: string, retry = true): Promise<Blob> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    credentials: 'include',
  });
  if (res.status === 401 && retry && (await refreshSession())) return apiBlob(path, false);
  if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Gagal mengunduh file');
  return res.blob();
}

export const homePathFor = (role: Role) =>
  role === 'ADMIN' ? '/admin' : role === 'PSYCHOLOGIST' ? '/psychologist/dashboard' : '/dashboard';
