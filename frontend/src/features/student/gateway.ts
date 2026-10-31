import { apiRequest } from "../../api/client";
import type * as C from "./contracts";

/** Day 1 only. Use the cookie session owned by FE-C; no second login. */
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
}
const root = "/api/v1";
async function mutate<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const token = await apiRequest<C.CsrfTokenResponse>(`${root}/auth/csrf`, {
    cache: "no-store",
  });
  const headers: Record<string, string> = { "X-CSRF-Token": token.csrfToken };
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
};
