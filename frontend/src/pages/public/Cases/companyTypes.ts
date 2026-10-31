/** Mirrors CompanyPublic from docs/api/openapi.yaml. Private contacts are intentionally excluded. */
export interface CompanyPublic {
  id: string;
  name: string;
  description: string;
  website?: string;
  logoFileId?: string;
  directionIds: string[];
}
