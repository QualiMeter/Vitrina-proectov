import type {
  ApplicationExecutionStatus, ApplicationReview, AwardsDraft, CaseContestRules,
  CaseExecutionCommand, CaseExecutionDashboard, CheckpointCloseRequest, CompleteSelectionRequest,
  ExcludeTeamRequest, ReviewDraftRequest, SaveAwardsDraftRequest, SubmissionVersionList, TeamExclusionResult,
} from '../workflow/contracts.generated';

export const executionCaseId = 'd4000000-0000-4000-8000-000000000001';
export const evaluationCaseId = 'd4000000-0000-4000-8000-000000000002';

/** UI projection, not an additional API DTO. Aggregate mapping still needs backend alignment. */
export interface ExecutionParticipant {
  applicationId: string;
  teamId?: string;
  name: string;
  format: 'TEAM' | 'SOLO';
  status: ApplicationExecutionStatus;
  exclusion?: TeamExclusionResult;
}
export interface ExecutionSnapshot {
  title: string;
  dashboard: CaseExecutionDashboard;
  participants: ExecutionParticipant[];
  rules: CaseContestRules;
  reviews: ApplicationReview[];
  awards: AwardsDraft;
  canManage: boolean;
}
export interface ExecutionRepository {
  snapshot(companyId: string, caseId: string): Promise<ExecutionSnapshot>;
  versions(companyId: string, caseId: string, checkpointId: string, applicationId: string): Promise<SubmissionVersionList>;
  file(companyId: string, caseId: string, fileId: string): Promise<Blob>;
  closeCheckpoint(companyId: string, caseId: string, checkpointId: string, request: CheckpointCloseRequest, key: string): Promise<void>;
  select(companyId: string, caseId: string, checkpointId: string, request: CompleteSelectionRequest, key: string): Promise<void>;
  exclude(companyId: string, caseId: string, teamId: string, request: ExcludeTeamRequest, key: string): Promise<void>;
  closeFinal(companyId: string, caseId: string, request: CaseExecutionCommand, key: string): Promise<void>;
  beginEvaluation(companyId: string, caseId: string, request: CaseExecutionCommand, key: string): Promise<void>;
  review(companyId: string, caseId: string, applicationId: string, request: ReviewDraftRequest): Promise<void>;
  awards(companyId: string, caseId: string, request: SaveAwardsDraftRequest): Promise<void>;
}
