export type ApiFailureKind = 'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'server' | 'network' | 'unknown';

export class ApiError extends Error {
  constructor(public readonly kind: ApiFailureKind, public readonly status?: number) {
    super(kind);
    this.name = 'ApiError';
  }
}

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

async function requestCsrfToken(forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    csrfToken = null;
    csrfRequest = null;
  }
  if (csrfToken) return csrfToken;
  if (!csrfRequest) {
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    csrfRequest = fetch(`${base}/api/v1/auth/csrf`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new ApiError(failureForStatus(response.status), response.status);
        const body = await response.json() as { csrfToken: string };
        if (typeof body.csrfToken !== 'string' || body.csrfToken.length === 0) {
          throw new ApiError('unknown');
        }
        csrfToken = body.csrfToken;
        return body.csrfToken;
      })
      .catch((error: unknown) => {
        csrfRequest = null;
        if (error instanceof ApiError) throw error;
        throw new ApiError('network');
      });
  }
  return csrfRequest;
}

/** Clear and fetch a new token after login, email confirmation, invitation, or logout. */
export async function refreshCsrfToken(): Promise<string> {
  return requestCsrfToken(true);
}

export function clearCsrfToken(): void {
  csrfToken = null;
  csrfRequest = null;
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
  if (!response.ok) throw new ApiError(failureForStatus(response.status), response.status);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
