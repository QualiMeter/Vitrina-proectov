export type ApiFailureKind = 'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'server' | 'network' | 'unknown';

export class ApiError extends Error {
  constructor(public readonly kind: ApiFailureKind, public readonly status?: number) {
    super(kind);
    this.name = 'ApiError';
  }
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

/** Pass only paths documented by the future backend contract. No endpoint is assumed here. */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = import.meta.env.VITE_API_BASE_URL ?? '';
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, { credentials: 'same-origin', ...options });
  } catch {
    throw new ApiError('network');
  }
  if (!response.ok) throw new ApiError(failureForStatus(response.status), response.status);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
