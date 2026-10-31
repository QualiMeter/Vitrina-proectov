/** Mirrors CompanyPublic from docs/api/openapi.yaml. Private contacts are intentionally excluded. */
export interface CompanyPublic {
  id: string;
  name: string;
  description: string;
  website?: string;
  logoFileId?: string;
  directionIds: string[];
}

export function getSafeWebsiteUrl(value?: string): string | undefined {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
