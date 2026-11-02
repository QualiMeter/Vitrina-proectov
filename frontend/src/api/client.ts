export type ApiFailureKind = 'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'rateLimited' | 'server' | 'network' | 'unknown';

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

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function requestCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken;
  }

  if (!csrfRequest) {
    const generation = csrfGeneration;
    const base = import.meta.env.VITE_API_BASE_URL ?? '';
    const request = fetch(`${base}/api/v1/auth/csrf`, { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) {
          throw await toApiError(response);
        }

        const body = await response.json() as { csrfToken: string };

        if (typeof body.csrfToken !== 'string' || body.csrfToken.length === 0) {
          throw new ApiError('unknown');
        }

        if (generation === csrfGeneration) {
          csrfToken = body.csrfToken;
        }

        return body.csrfToken;
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError) {
          throw error;
        }

        throw new ApiError('network');
      });

    csrfRequest = request;
    void request.finally(() => {
      if (csrfRequest === request) {
        csrfRequest = null;
      }
    }).catch(() => undefined);
  }

  return csrfRequest;
}

/** Fetch one fresh CSRF token. Concurrent callers share the same refresh operation. */
export async function refreshCsrfToken(): Promise<string> {
  if (csrfRefreshRequest) {
    return csrfRefreshRequest;
  }

  const previousRequest = csrfRequest;
  csrfGeneration += 1;
  csrfToken = null;
  csrfRequest = null;

  const refresh = (async () => {
    if (previousRequest) {
      await previousRequest.catch(() => undefined);
    }

    return requestCsrfToken();
  })();

  csrfRefreshRequest = refresh;

  try {
    return await refresh;
  } finally {
    if (csrfRefreshRequest === refresh) {
      csrfRefreshRequest = null;
    }
  }
}

export function clearCsrfToken(): void {
  csrfGeneration += 1;
  csrfToken = null;
  csrfRequest = null;
  csrfRefreshRequest = null;
}

function invalidateCsrfTokenIfCurrent(token: string): void {
  if (csrfToken !== token) {
    return;
  }

  csrfGeneration += 1;
  csrfToken = null;
  csrfRequest = null;
}

async function refreshRejectedCsrfToken(rejectedToken: string): Promise<string> {
  if (csrfToken && csrfToken !== rejectedToken) {
    return csrfToken;
  }

  return refreshCsrfToken();
}

function failureForStatus(status: number): ApiFailureKind {
  switch (status) {
    case 401:
      return 'unauthorized';
    case 403:
      return 'forbidden';
    case 404:
      return 'notFound';
    case 409:
      return 'conflict';
    case 429:
      return 'rateLimited';
    default:
      return status >= 500 ? 'server' : 'unknown';
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code: string | undefined;

  try {
    const body = await response.clone().json() as { code?: unknown; error?: { code?: unknown } };
    const candidate = body.code ?? body.error?.code;

    if (typeof candidate === 'string' && /^[a-z0-9_-]{1,80}$/i.test(candidate)) {
      code = candidate;
    }
  } catch {
    // Error responses may have no JSON body.
  }

  return new ApiError(failureForStatus(response.status), response.status, code);
}

function canReplayBody(body: BodyInit | null | undefined): boolean {
  if (body === null || body === undefined || typeof body === 'string') {
    return true;
  }

  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    return true;
  }

  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    return true;
  }

  if (typeof Blob !== 'undefined' && body instanceof Blob) {
    return true;
  }

  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
    return true;
  }

  return false;
}

function notifySessionExpired(path: string): void {
  const normalizedPath = path.split('?')[0];

  if (normalizedPath.endsWith('/auth/login') || normalizedPath.endsWith('/auth/register')) {
    return;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('vitrina:session-expired'));
  }
}

async function sendRequest(path: string, base: string, options: RequestInit, headers: Headers): Promise<Response> {
  try {
    return await fetch(`${base}${path}`, {
      ...options,
      credentials: options.credentials ?? 'same-origin',
      method: (options.method ?? 'GET').toUpperCase(),
      headers,
    });
  } catch {
    throw new ApiError('network');
  }
}

/** Send requests through the same-origin API and attach CSRF to every mutation. */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  const method = (options.method ?? 'GET').toUpperCase();
  const isMutation = mutationMethods.has(method);
  const headers = new Headers(options.headers);
  const hasManualCsrfToken = headers.has('X-CSRF-Token');
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let usedCsrfToken: string | null = null;

  if (isMutation && !hasManualCsrfToken) {
    usedCsrfToken = await requestCsrfToken();
    headers.set('X-CSRF-Token', usedCsrfToken);
  }

  let response = await sendRequest(path, base, options, headers);

  if (response.status === 403 && isMutation && usedCsrfToken) {
    const csrfError = await toApiError(response);

    if (csrfError.code === 'csrf_invalid') {
      const refreshedToken = await refreshRejectedCsrfToken(usedCsrfToken);

      if (!canReplayBody(options.body)) {
        throw csrfError;
      }

      const retryHeaders = new Headers(headers);
      retryHeaders.set('X-CSRF-Token', refreshedToken);
      response = await sendRequest(path, base, options, retryHeaders);

      if (response.status === 403) {
        const retryError = await toApiError(response);

        if (retryError.code === 'csrf_invalid') {
          invalidateCsrfTokenIfCurrent(refreshedToken);
        }

        throw retryError;
      }
    } else {
      throw csrfError;
    }
  }

  if (!response.ok) {
    const error = await toApiError(response);

    if (response.status === 401) {
      notifySessionExpired(path);
    }

    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
