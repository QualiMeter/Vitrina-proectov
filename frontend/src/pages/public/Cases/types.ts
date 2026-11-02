/** Mirrors CaseStatus in docs/api/openapi.yaml; regenerate shared API types when codegen is adopted. */
export const caseStatuses = [
  'DRAFT', 'MODERATION', 'REVISION', 'REJECTED', 'APPROVED',
  'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'EXECUTING', 'FINAL_CLOSED',
  'EVALUATING', 'COMPLETED', 'CANCELED'
] as const;
export type CaseStatus = (typeof caseStatuses)[number];

export type PublicCaseStatus = Extract<CaseStatus,
  'APPROVED' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'EXECUTING' |
  'FINAL_CLOSED' | 'EVALUATING' | 'COMPLETED' | 'CANCELED'>;
export const publicCaseStatuses: readonly PublicCaseStatus[] = [
  'APPROVED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'EXECUTING',
  'FINAL_CLOSED', 'EVALUATING', 'COMPLETED', 'CANCELED'
];

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

/** Public fields from CasePublicDetails; excludes private moderation/submission data. */
export interface CasePublicDetails extends CasePublicSummary {
  description: string;
  publicTaskDescription?: string;
  minTeamSize?: number;
  maxTeamSize?: number;
  maxAdmittedTeams?: number | null;
}

/** List response DTO returned by the future paginated API. */
export interface CasePublicListResponse {
  items: CasePublicSummary[];
  page: number;
  pageSize: number;
  total: number;
}
