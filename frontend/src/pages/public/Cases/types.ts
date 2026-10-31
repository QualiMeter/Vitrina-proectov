export type CaseStatus =
  | 'DRAFT'
  | 'MODERATION'
  | 'REVISION'
  | 'REJECTED'
  | 'APPROVED'
  | 'REGISTRATION_OPEN'
  | 'REGISTRATION_CLOSED'
  | 'EXECUTING'
  | 'EVALUATING'
  | 'COMPLETED'
  | 'CANCELED';

export type CaseParticipationFormat = 'SOLO' | 'TEAM' | 'BOTH';
export type CaseAdmissionMode = 'OPEN' | 'SELECTIVE';

/** Public fields from CasePublicSummary in docs/api/openapi.yaml. */
export interface CasePublicSummary {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  status: CaseStatus;
  participationFormat: CaseParticipationFormat;
  admissionMode: CaseAdmissionMode;
  registrationDeadline: string;
  directionIds: string[];
  technologyIds: string[];
  rewardTerms?: string;
  minCourse?: number;
  maxCourse?: number;
}

export interface CasePublicListResponse {
  items: CasePublicSummary[];
  page: number;
  pageSize: number;
  total: number;
}
