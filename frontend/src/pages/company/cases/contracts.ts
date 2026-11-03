/** Supported day-2 fields from OpenAPI 0.1.5-draft. No network implementation yet. */
export const statuses = ['DRAFT', 'MODERATION', 'REVISION', 'REJECTED', 'APPROVED',
  'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'EXECUTING', 'FINAL_CLOSED',
  'EVALUATING', 'COMPLETED', 'CANCELED'] as const;
export type CaseStatus = typeof statuses[number];
export type ParticipationFormat = 'SOLO' | 'TEAM' | 'BOTH';
export interface DraftFields {
  title: string;
  description?: string;
  publicTaskDescription?: string;
  directionIds?: string[];
  technologyIds?: string[];
  participationFormat?: ParticipationFormat;
  admissionMode?: 'OPEN' | 'SELECTIVE';
  registrationDeadline?: string;
  minCourse?: number;
  maxCourse?: number;
  minTeamSize?: number;
  maxTeamSize?: number;
  maxAdmittedTeams?: number | null;
  maxAdmittedSolo?: number | null;
  rewardTerms?: string;
  resultRightsTerms?: string;
}
export interface CaseDraft extends DraftFields {
  id: string;
  companyId: string;
  createdByUserId: string;
  status: CaseStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  allowedActions: string[];
}
export type CreateCaseDraftRequest = Pick<DraftFields, 'title'>;
export type UpdateCaseDraftRequest = Partial<DraftFields> & { expectedVersion: number };
export interface CasePrivateListResponse {
  items: CaseDraft[];
  page: number;
  pageSize: number;
  total: number;
}
export interface CompanyCasesRepository {
  list(companyId: string): Promise<CasePrivateListResponse>;
  get(companyId: string, id: string): Promise<CaseDraft>;
  create(companyId: string, request: CreateCaseDraftRequest): Promise<CaseDraft>;
  update(companyId: string, id: string, request: UpdateCaseDraftRequest): Promise<CaseDraft>;
}
