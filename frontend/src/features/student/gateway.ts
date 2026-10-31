import { apiRequest } from "../../api/client";
import type * as C from "./contracts";

/** Student API uses the cookie session owned by FE-C; no second login. */
export interface StudentGateway {
  session(): Promise<C.AuthSessionResponse>;
  profile(): Promise<C.StudentProfilePrivate>;
  updateProfile(
    body: C.StudentProfileUpdateRequest,
  ): Promise<C.StudentProfilePrivate>;
  publicProfile(id: string): Promise<C.StudentProfilePublic>;
  avatar(file?: File): Promise<C.StudentProfilePrivate>;
  reference(): Promise<C.ReferenceDataResponse>;
  participations(page: number): Promise<C.MyCaseParticipationListResponse>;
  invitations(page: number): Promise<C.TeamInvitationInboxResponse>;
  decideInvitation(
    id: string,
    action: "accept" | "decline" | "revoke",
  ): Promise<C.CaseTeamInvitation>;
  caseDetails(id: string): Promise<C.CasePublicDetails>;
  teams(caseId: string): Promise<C.CaseTeamListResponse>;
  team(id: string): Promise<C.CaseTeam>;
  createTeam(caseId: string, name: string): Promise<C.CaseTeam>;
  candidates(
    teamId: string,
    search: string,
  ): Promise<C.StudentInviteCandidateList>;
  invite(teamId: string, userId: string): Promise<C.CaseTeamInvitation>;
  removeMember(teamId: string, userId: string): Promise<C.CaseTeam>;
  transfer(teamId: string, userId: string): Promise<C.CaptainTransfer>;
  decideTransfer(
    teamId: string,
    id: string,
    action: "CONFIRM" | "DECLINE",
  ): Promise<C.CaptainTransfer>;
  applications(caseId: string): Promise<C.CaseApplicationListResponse>;
  createApplication(
    caseId: string,
    body: C.CreateCaseApplicationRequest,
  ): Promise<C.CaseApplication>;
  application(id: string): Promise<C.CaseApplication>;
  saveApplication(
    id: string,
    body: C.UpdateCaseApplicationDraftRequest,
  ): Promise<C.CaseApplication>;
  submitApplication(
    id: string,
    body: C.CaseApplicationVersionCommand,
    key?: string,
  ): Promise<C.CaseApplication>;
  withdrawApplication(
    id: string,
    body: C.CaseApplicationWithdrawRequest,
    key?: string,
  ): Promise<C.CaseApplication>;
  nda(caseId: string): Promise<C.NdaPolicy>;
}
const root = "/api/v1";
async function mutate<T>(
  path: string,
  method: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<T> {
  const token = await apiRequest<C.CsrfTokenResponse>(`${root}/auth/csrf`, {
    cache: "no-store",
  });
  const headers: Record<string, string> = { "X-CSRF-Token": token.csrfToken };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  return apiRequest<T>(`${root}${path}`, {
    method,
    headers,
    body:
      body instanceof FormData
        ? body
        : body === undefined
          ? undefined
          : JSON.stringify(body),
    cache: "no-store",
  });
}
const get = <T>(path: string) =>
  apiRequest<T>(`${root}${path}`, { cache: "no-store" });
export const liveStudentGateway: StudentGateway = {
  session: () => get("/auth/me"),
  profile: () => get("/me/student-profile"),
  updateProfile: (body) => mutate("/me/student-profile", "PATCH", body),
  publicProfile: (studentId) =>
    get(`/public/students/${encodeURIComponent(studentId)}`),
  avatar: (file) => {
    const data = new FormData();
    if (file) data.append("file", file);
    return mutate(
      "/me/student-profile/avatar",
      file ? "POST" : "DELETE",
      file ? data : undefined,
    );
  },
  reference: () => get("/reference-data"),
  participations: (page) =>
    get(`/me/case-participations?page=${page}&pageSize=20`),
  invitations: (page) => get(`/me/team-invitations?page=${page}&pageSize=20`),
  decideInvitation: (invitationId, action) =>
    mutate(
      `/team-invitations/${encodeURIComponent(invitationId)}/${action}`,
      "POST",
    ),
  caseDetails: (caseId) => get(`/public/cases/${encodeURIComponent(caseId)}`),
  teams: (caseId) => get(`/cases/${encodeURIComponent(caseId)}/teams/mine`),
  team: (teamId) => get(`/teams/${encodeURIComponent(teamId)}`),
  createTeam: (caseId, name) =>
    mutate(`/cases/${encodeURIComponent(caseId)}/teams`, "POST", { name }),
  candidates: (teamId, search) =>
    get(
      `/teams/${encodeURIComponent(teamId)}/invite-candidates?search=${encodeURIComponent(search)}&limit=20`,
    ),
  invite: (teamId, inviteeUserId) =>
    mutate(`/teams/${encodeURIComponent(teamId)}/invitations`, "POST", {
      inviteeUserId,
    }),
  removeMember: (teamId, userId) =>
    mutate(
      `/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
      "DELETE",
    ),
  transfer: (teamId, toUserId) =>
    mutate(`/teams/${encodeURIComponent(teamId)}/captain-transfer`, "POST", {
      toUserId,
    }),
  decideTransfer: (teamId, transferId, action) =>
    mutate(
      `/teams/${encodeURIComponent(teamId)}/captain-transfer/${encodeURIComponent(transferId)}/decision`,
      "POST",
      { action },
    ),
  applications: (caseId) =>
    get(`/cases/${encodeURIComponent(caseId)}/applications/mine`),
  createApplication: (caseId, body) =>
    mutate(`/cases/${encodeURIComponent(caseId)}/applications`, "POST", body),
  application: (appId) => get(`/applications/${encodeURIComponent(appId)}`),
  saveApplication: (appId, body) =>
    mutate(`/applications/${encodeURIComponent(appId)}`, "PATCH", body),
  submitApplication: (appId, body, key) =>
    mutate(
      `/applications/${encodeURIComponent(appId)}/submit`,
      "POST",
      body,
      key ?? crypto.randomUUID(),
    ),
  withdrawApplication: (appId, body, key) =>
    mutate(
      `/applications/${encodeURIComponent(appId)}/withdraw`,
      "POST",
      body,
      key ?? crypto.randomUUID(),
    ),
  nda: (caseId) => get(`/cases/${encodeURIComponent(caseId)}/nda`),
};

export type Day1Gateway = Pick<
  StudentGateway,
  | "session"
  | "profile"
  | "updateProfile"
  | "publicProfile"
  | "avatar"
  | "reference"
  | "participations"
>;
