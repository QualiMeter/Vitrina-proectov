// Generated from OpenAPI; do not edit by hand.
// SHA256: a817e3ecdccae6d5a8067d01f03dd1baa2548b4b70d8f640f258716d48aaa3ff
// Compile-time shapes only; conditional constraints are validated by the server.
export type Id = string;
export type Email = string;
export type DisplayName = string;
export type Nickname = string;
export type CsrfTokenResponse = { "csrfToken": string; };
export type GlobalRole = "STUDENT" | "UNIVERSITY_STAFF" | "PLATFORM_ADMIN";
export type AvailableArea = "student" | "company" | "university" | "mentor" | "admin";
export type CompanyMembershipRole = "OWNER" | "MEMBER";
export type MembershipSummary = { "companyId": Id; "companyName": string; "membershipRole": CompanyMembershipRole; };
export type AuthUser = { "id": Id; "email": Email; "fullName": DisplayName; "nickname"?: Nickname; "globalRoles": (GlobalRole)[]; "availableAreas": (AvailableArea)[]; "permissions": (string)[]; "companyMemberships": (MembershipSummary)[]; };
export type AuthSessionResponse = { "user": AuthUser; "session": { "expiresAt": string; }; };
export type CaseStatus = "DRAFT" | "MODERATION" | "REVISION" | "REJECTED" | "APPROVED" | "REGISTRATION_OPEN" | "REGISTRATION_CLOSED" | "EXECUTING" | "FINAL_CLOSED" | "EVALUATING" | "COMPLETED" | "CANCELED";
export type CaseApplicationStatus = "DRAFT" | "SUBMITTED" | "ADMITTED" | "REJECTED" | "WITHDRAWN";
export type CaseApplicationFormat = "SOLO" | "TEAM";
export type ProfileAchievement = { "title": string; "description"?: string; "url"?: string; };
export type StudentProfilePrivate = { "userId": Id; "fullName": DisplayName; "nickname": Nickname; "avatarUrl"?: (string | null); "achievements": (ProfileAchievement)[]; "version": number; "instituteId"?: Id; "course"?: number; "studyGroup"?: string; "description"?: string; "publicSummary"?: string; "skillIds": (Id)[]; "technologyIds": (Id)[]; "publicLinks": (PublicStudentLink)[]; };
export type StudentProfileUpdateRequest = { "expectedVersion": number; "fullName"?: DisplayName; "nickname"?: Nickname; "achievements"?: (ProfileAchievement)[]; "instituteId"?: Id; "course"?: number; "studyGroup"?: string; "description"?: string; "publicSummary"?: string; "skillIds"?: (Id)[]; "technologyIds"?: (Id)[]; "publicLinks"?: (PublicStudentLink)[]; };
export type PublicStudentLink = { "label": string; "url": string; };
export type StudentProfilePublic = { "studentId": Id; "nickname": Nickname; "avatarUrl": (string | null); "achievements": (ProfileAchievement)[]; "publicSummary"?: string; "skillIds": (Id)[]; "technologyIds": (Id)[]; "publicLinks": (PublicStudentLink)[]; };
export type MyCaseParticipation = { "caseId": Id; "caseTitle": string; "caseStatus"?: CaseStatus; "applicationId"?: Id; "teamId"?: Id; "format": CaseApplicationFormat; "role": "SOLO" | "CAPTAIN" | "MEMBER"; "applicationStatus": CaseApplicationStatus; "teamExecutionStatus"?: "ACTIVE" | "ELIMINATED" | "EXCLUDED"; };
export type MyCaseParticipationListResponse = { "items": (MyCaseParticipation)[]; "page": number; "pageSize": number; "total": number; };
export type DirectoryEntry = { "id": Id; "name": string; };
export type ReferenceDataResponse = { "directions": (DirectoryEntry)[]; "technologies": (DirectoryEntry)[]; "competencies": (DirectoryEntry)[]; "portfolioCategories": (DirectoryEntry)[]; "institutes": (DirectoryEntry)[]; };
