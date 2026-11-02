export type ApiFailureKind = 'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'server' | 'network' | 'unknown';

export class ApiError extends Error {
  constructor(public readonly kind: ApiFailureKind, public readonly status?: number, public readonly code?: string) {
    super(kind);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;
let csrfRefreshRequest: Promise<string> | null = null;
let csrfGeneration = 0;

async function requestCsrfToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) return refreshCsrfToken();
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    const generation = csrfGeneration;
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    const request = fetch(`${base}/api/v1/auth/csrf`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw await toApiError(response);
        const body = await response.json() as { csrfToken: string };
        if (typeof body.csrfToken !== 'string' || body.csrfToken.length === 0) {
          throw new ApiError('unknown');
        }
        if (generation === csrfGeneration) csrfToken = body.csrfToken;
        return body.csrfToken;
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError) throw error;
        throw new ApiError('network');
      });
    csrfRequest = request;
    void request.finally(() => { if (csrfRequest === request) csrfRequest = null; }).catch(() => undefined);
  }
  return csrfRequest;
}

/** Clear and fetch a new token after login, email confirmation, invitation, or logout. */
export async function refreshCsrfToken(): Promise<string> {
  if (csrfRefreshRequest) return csrfRefreshRequest;
  const previous = csrfRequest;
  csrfGeneration += 1;
  csrfToken = null;
  csrfRequest = null;
  const refresh = (async () => {
    if (previous) await previous.catch(() => undefined);
    return requestCsrfToken();
  })();
  csrfRefreshRequest = refresh;
  try { return await refresh; }
  finally { if (csrfRefreshRequest === refresh) csrfRefreshRequest = null; }
}

export function clearCsrfToken(): void {
  csrfGeneration += 1;
  csrfToken = null;
  csrfRequest = null;
  csrfRefreshRequest = null;
}

function failureForStatus(status: number): ApiFailureKind {
  switch (status) {
    case 401: return 'unauthorized';
    case 403: return 'forbidden';
    case 404: return 'notFound';
    case 409: return 'conflict';
    default: return status >= 500 ? 'server' : 'unknown';
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code: string | undefined;
  try {
    const body = await response.clone().json() as { code?: unknown; error?: { code?: unknown } };
    const candidate = body.code ?? body.error?.code;
    if (typeof candidate === 'string' && /^[a-z0-9_-]{1,80}$/i.test(candidate)) code = candidate;
  } catch { /* Error responses may have no JSON body. */ }
  return new ApiError(failureForStatus(response.status), response.status, code);
}

/** Send requests through the same-origin API and attach CSRF to every mutation. */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  const method = (options.method ?? 'GET').toUpperCase();
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !headers.has('X-CSRF-Token')) {
    headers.set('X-CSRF-Token', await requestCsrfToken());
  }
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { credentials: 'same-origin', ...options, method, headers });
  } catch {
    throw new ApiError('network');
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
