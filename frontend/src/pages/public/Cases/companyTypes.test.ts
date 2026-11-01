import { describe, expect, it } from 'vitest';
import { getSafeWebsiteUrl } from './companyTypes';

describe('getSafeWebsiteUrl', () => {
  it('allows HTTP and HTTPS URLs', () => {
    expect(getSafeWebsiteUrl('https://example.com')).toBe('https://example.com/');
    expect(getSafeWebsiteUrl('http://example.com/path')).toBe('http://example.com/path');
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'file:///etc/passwd',
    '/relative/path'
  ])('rejects unsafe or non-absolute URL %s', (value) => {
    expect(getSafeWebsiteUrl(value)).toBeUndefined();
  });
});
