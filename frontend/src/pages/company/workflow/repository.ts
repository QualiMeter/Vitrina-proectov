import type { CaseDraft, CaseStage, CaseStageListResponse, CaseApplication, CaseApplicationListResponse,
  CreateStageRequest, UpdateStageRequest, CreateCheckpointRequest, UpdateCheckpointRequest,
  CaseApplicationDecisionRequest, CompanyStudentProfile, CaseVersionCommand, CaseExecutionCommand } from './contracts.generated';

export type WorkflowFailure = 'denied' | 'notFound' | 'conflict' | 'validation' | 'quota' | 'network';
export type RunAction = (operation: () => Promise<unknown>, success: string) => Promise<boolean>;
export class WorkflowError extends Error {
  constructor(public readonly kind: WorkflowFailure, message: string) { super(message); }
}
export interface WorkflowPermissions {
  editStages: boolean;
  decide: boolean;
  closeRegistration: boolean;
  startExecution: boolean;
}
export interface CaseSnapshot {
  item: CaseDraft;
  permissions: WorkflowPermissions;
  admittedTeams: number;
  admittedSolo: number;
}
export interface ApplicationQuery {
  page: number;
  pageSize: number;
  status?: CaseApplication['status'];
  format?: CaseApplication['format'];
}
/** Boundary for documented operations; the demo implementation makes no HTTP calls. */
export interface WorkflowRepository {
  snapshot(companyId: string, caseId: string): Promise<CaseSnapshot>;
  stages(companyId: string, caseId: string): Promise<CaseStageListResponse>;
  createStage(companyId: string, caseId: string, request: CreateStageRequest): Promise<CaseStage>;
  updateStage(companyId: string, stageId: string, request: UpdateStageRequest): Promise<CaseStage>;
  deleteStage(companyId: string, stageId: string, request: CaseExecutionCommand): Promise<void>;
  createCheckpoint(companyId: string, stageId: string, request: CreateCheckpointRequest): Promise<void>;
  updateCheckpoint(companyId: string, checkpointId: string, request: UpdateCheckpointRequest): Promise<void>;
  deleteCheckpoint(companyId: string, checkpointId: string, request: CaseExecutionCommand): Promise<void>;
  applications(companyId: string, caseId: string, query: ApplicationQuery): Promise<CaseApplicationListResponse>;
  application(companyId: string, caseId: string, id: string): Promise<CaseApplication>;
  profile(companyId: string, userId: string): Promise<CompanyStudentProfile>;
  decide(companyId: string, applicationId: string, request: CaseApplicationDecisionRequest, idempotencyKey: string): Promise<CaseApplication>;
  closeRegistration(companyId: string, caseId: string, request: CaseVersionCommand): Promise<void>;
  startExecution(companyId: string, caseId: string, request: CaseExecutionCommand): Promise<void>;
}
