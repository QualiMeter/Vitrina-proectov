import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest, clearCsrfToken, refreshCsrfToken } from './client';

describe('CSRF request coordination', () => {
  afterEach(() => { clearCsrfToken(); vi.unstubAllGlobals(); });

  it('shares a concurrent refresh and shares its token between simultaneous mutations', async () => {
    clearCsrfToken();
    let csrfCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/csrf')) {
        csrfCalls += 1;
        await new Promise(resolve => setTimeout(resolve, 10));
        return new Response(JSON.stringify({ csrfToken: 'csrf-current' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    }));
    const [first, second] = await Promise.all([refreshCsrfToken(), refreshCsrfToken()]);
    expect(first).toBe('csrf-current');
    expect(second).toBe('csrf-current');
    await Promise.all([apiRequest('/one', { method: 'POST', body: '{}' }), apiRequest('/two', { method: 'POST', body: '{}' })]);
    expect(csrfCalls).toBe(1);
    const mutations = vi.mocked(fetch).mock.calls.filter(([input]) => !String(input).endsWith('/auth/csrf'));
    expect(mutations.map(([, init]) => new Headers(init?.headers).get('X-CSRF-Token'))).toEqual(['csrf-current', 'csrf-current']);
  });

  it('preserves safe server error codes and does not retry a mutation with an invalid token', async () => {
    clearCsrfToken();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/auth/csrf')
      ? new Response(JSON.stringify({ csrfToken: 'csrf-invalid' }), { status: 200 })
      : new Response(JSON.stringify({ code: 'csrf_invalid', message: 'technical details hidden' }), { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(apiRequest('/mutate', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 403, code: 'csrf_invalid', kind: 'forbidden' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    try { await apiRequest('/mutate', { method: 'POST', body: '{}' }); } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).message).toBe('forbidden');
    }
  });

  it('clears the cached token after a failed refresh so the next mutation can fetch again', async () => {
    clearCsrfToken();
    let csrfCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/csrf')) {
        csrfCalls += 1;
        return csrfCalls === 1 ? new Response('{}', { status: 503 }) : new Response(JSON.stringify({ csrfToken: 'csrf-recovered' }), { status: 200 });
      }
      return new Response(null, { status: 204 });
    }));
    await expect(refreshCsrfToken()).rejects.toMatchObject({ status: 503 });
    await apiRequest('/mutate', { method: 'POST' });
    expect(csrfCalls).toBe(2);
  });

  it('retries a rejected CSRF mutation exactly once with a fresh token', async () => {
    clearCsrfToken();
    let csrfCalls = 0;
    let mutationAttempts = 0;
    let successfulMutations = 0;

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (String(input).endsWith('/auth/csrf')) {
        csrfCalls += 1;
        return new Response(JSON.stringify({ csrfToken: csrfCalls === 1 ? 'csrf-old' : 'csrf-new' }), { status: 200 });
      }

      mutationAttempts += 1;
      const token = new Headers(init.headers).get('X-CSRF-Token');

      if (token === 'csrf-old') {
        return new Response(JSON.stringify({ code: 'csrf_invalid' }), { status: 403 });
      }

      successfulMutations += 1;
      return new Response(null, { status: 204 });
    }));

    await apiRequest('/mutate', { method: 'POST', body: JSON.stringify({ value: 1 }) });

    expect(csrfCalls).toBe(2);
    expect(mutationAttempts).toBe(2);
    expect(successfulMutations).toBe(1);
  });

  it('shares CSRF recovery between parallel mutations rejected with the same stale token', async () => {
    clearCsrfToken();
    let csrfCalls = 0;
    let oldTokenAttempts = 0;
    let successfulMutations = 0;

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (String(input).endsWith('/auth/csrf')) {
        csrfCalls += 1;
        return new Response(JSON.stringify({ csrfToken: csrfCalls === 1 ? 'csrf-old' : 'csrf-new' }), { status: 200 });
      }

      const token = new Headers(init.headers).get('X-CSRF-Token');

      if (token === 'csrf-old') {
        oldTokenAttempts += 1;
        return new Response(JSON.stringify({ code: 'csrf_invalid' }), { status: 403 });
      }

      successfulMutations += 1;
      return new Response(null, { status: 204 });
    }));

    await Promise.all([
      apiRequest('/first', { method: 'POST', body: '{}' }),
      apiRequest('/second', { method: 'POST', body: '{}' }),
    ]);

    expect(csrfCalls).toBe(2);
    expect(oldTokenAttempts).toBe(2);
    expect(successfulMutations).toBe(2);
  });

  it('notifies AuthProvider after protected API 401 but not after a failed login', async () => {
    clearCsrfToken();
    const expired = vi.fn();
    window.addEventListener('vitrina:session-expired', expired);

    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/auth/csrf')) {
        return new Response(JSON.stringify({ csrfToken: 'csrf-login' }), { status: 200 });
      }

      return new Response('{}', { status: 401 });
    }));

    await expect(apiRequest('/api/v1/private')).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);

    await expect(apiRequest('/api/v1/auth/login', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);

    window.removeEventListener('vitrina:session-expired', expired);
  });

  it('classifies 429 as a rate-limited API error', async () => {
    clearCsrfToken();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })));

    await expect(apiRequest('/api/v1/private')).rejects.toMatchObject({
      status: 429,
      kind: 'rateLimited',
    });
  });

});
