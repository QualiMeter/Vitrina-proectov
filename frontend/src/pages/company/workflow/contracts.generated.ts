// Generated from docs/api/openapi.yaml. Run node scripts/generate-company-contracts.mjs
// SHA256: 5c263a4f6adb2c79c83be6da67b60e85a6763fd92d3fd26391501997424ff947
// Conditional constraints are enforced by repository/server validation.
export type Id = string;
export type DisplayName = string;
export type Nickname = string;
export type CaseStatus = "DRAFT" | "MODERATION" | "REVISION" | "REJECTED" | "APPROVED" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "EXECUTING" | "FINAL_CLOSED" | "EVALUATING" | "COMPLETED" | "CANCELED";
export type CaseParticipationFormat = "SOLO" | "TEAM" | "BOTH";
export type CaseAdmissionMode = "OPEN" | "SELECTIVE";
export type CaseApplicationStatus = "DRAFT" | "SUBMITTED" | "ADMITTED" | "REJECTED" | "WITHDRAWN";
export type CaseApplicationFormat = "SOLO" | "TEAM";
export type CaseDecisionAction = "ADMIT" | "REJECT";
export type CaseDraft = { "id": Id; "companyId": Id; "createdByUserId": Id; "status": CaseStatus; "version": number; "title": string; "description"?: string; "directionIds"?: (Id)[]; "technologyIds"?: (Id)[]; "participationFormat"?: CaseParticipationFormat; "admissionMode"?: CaseAdmissionMode; "registrationDeadline"?: string; "minCourse"?: number; "maxCourse"?: number; "minTeamSize"?: number; "maxTeamSize"?: number; "maxAdmittedTeams"?: (number | null); "maxAdmittedSolo"?: (number | null); "coverLetterRequired"?: boolean; "rewardTerms"?: string; "resultRightsTerms"?: string; "publicTaskDescription"?: string; "admittedTeamCount"?: number; "admittedSoloCount"?: number; "createdAt": string; "updatedAt": string; "allowedActions": (string)[]; "contestRules"?: CaseContestRules; };
export type CaseVersionCommand = { "expectedVersion": number; };
export type CaseApplication = { "id": Id; "caseId": Id; "format": CaseApplicationFormat; "teamId"?: Id; "soloApplicantUserId"?: Id; "status": CaseApplicationStatus; "version": number; "coverLetter"?: string; "participantUserIds": (Id)[]; "ndaAcceptance"?: NdaAcceptanceResult; "submittedAt"?: (string | null); "decidedAt"?: (string | null); "decidedByUserId"?: Id; "decisionReason"?: string; "createdAt": string; "updatedAt": string; "allowedActions": (string)[]; };
export type CaseApplicationListResponse = { "items": (CaseApplication)[]; "page": number; "pageSize": number; "total": number; };
export type CaseApplicationDecisionRequest = { "action": CaseDecisionAction; "expectedVersion": number; "reason"?: string; };
export type StageKind = "WORK" | "FINAL";
export type CheckpointKind = "REGULAR" | "SELECTION" | "FINAL";
export type CheckpointIntakeStatus = "OPEN" | "CLOSED" | "SELECTION_CLOSED";
export type FilePurpose = "STAGE_MATERIAL" | "SUBMISSION_ATTACHMENT";
export type UploadedFileStatus = "QUARANTINED" | "READY" | "REJECTED";
export type CaseStage = { "id": Id; "caseId": Id; "version": number; "sequence": number; "kind": StageKind; "title": string; "description"?: string; "availableFrom"?: string; "createdAt"?: string; "updatedAt"?: string; "checkpoints": (CaseCheckpoint)[]; "materials": (CaseFileMetadata)[]; };
export type CaseStageListResponse = { "items": (CaseStage)[]; "caseVersion": number; };
export type CreateStageRequest = { "expectedCaseVersion": number; "title": string; "kind": StageKind; "sequence": number; "description"?: string; "availableFrom"?: string; };
export type UpdateStageRequest = { "expectedCaseVersion": number; "expectedVersion": number; "title"?: string; "description"?: string; "sequence"?: number; "availableFrom"?: string; };
export type CreateCheckpointRequest = { "expectedCaseVersion": number; "title": string; "kind": CheckpointKind; "deadline": string; "selectionLimit"?: number; "instructions"?: string; "soloSelectionLimit"?: number; };
export type UpdateCheckpointRequest = { "expectedCaseVersion": number; "expectedVersion": number; "title"?: string; "deadline"?: string; "selectionLimit"?: number; "instructions"?: string; "soloSelectionLimit"?: number; };
export type CaseCheckpoint = { "id": Id; "caseId": Id; "stageId": Id; "version": number; "title": string; "kind": CheckpointKind; "deadline": string; "intakeStatus": CheckpointIntakeStatus; "selectionLimit"?: number; "instructions"?: string; "closedAt"?: (string | null); "allowedActions": (string)[]; "soloSelectionLimit"?: number; };
export type CaseExecutionCommand = { "expectedCaseVersion": number; };
export type CaseFileMetadata = { "id": Id; "displayName": string; "contentType": string; "sizeBytes": number; "purpose": FilePurpose; "status": UploadedFileStatus; "createdAt": string; };
export type NdaAcceptanceResult = { "caseId": Id; "version": string; "userId": Id; "acceptedAt": string; };
export type CaseContestRules = { "allowSharedPlaces": boolean; "prizePlaceCount": number; "nominationNames": (string)[]; "scoreRange"?: CaseScoreRange; };
export type CaseScoreRange = { "min": number; "max": number; };
export type ProfileAchievement = { "title": string; "description"?: string; "url"?: string; };
export type CompanyStudentProfile = { "publicProfile": StudentProfilePublic; "fullName": DisplayName; "studyGroup": (string | null); "course": (number | null); };
export type PublicStudentLink = { "label": string; "url": string; };
export type StudentProfilePublic = { "studentId": Id; "nickname": Nickname; "avatarUrl": (string | null); "achievements": (ProfileAchievement)[]; "publicSummary"?: string; "skillIds": (Id)[]; "technologyIds": (Id)[]; "publicLinks": (PublicStudentLink)[]; };
