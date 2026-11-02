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
});
