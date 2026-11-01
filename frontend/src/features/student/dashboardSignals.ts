import { apiRequest } from "../../api/client";
import type * as C from "./contracts";
/** UI projections of existing contracts; no additional endpoint. */
export type DashboardInvitations = {
  items: { id: string; title: string; expiresAt: string }[];
  total: number;
};
export type DashboardDeadlines = {
  items: { id: string; title: string; at: string }[];
  unavailable: number;
};
export async function readPendingInvitations(): Promise<DashboardInvitations> {
  const inbox = await apiRequest<C.TeamInvitationInboxResponse>(
    "/api/v1/me/team-invitations?status=PENDING&page=1&pageSize=20",
    { cache: "no-store" },
  );
  return {
    total: inbox.total,
    items: inbox.items
      .filter(
        (x) => x.status === "PENDING" && Date.parse(x.expiresAt) > Date.now(),
      )
      .map((x) => ({
        id: x.id,
        title: `${x.teamName} · ${x.caseTitle}`,
        expiresAt: x.expiresAt,
      })),
  };
}
export async function readCaseDeadlines(
  caseIds: string[],
): Promise<DashboardDeadlines> {
  const ids = [...new Set(caseIds)].slice(0, 6);
  const results = await Promise.allSettled(
    ids.map((id) =>
      apiRequest<C.CasePublicDetails>(
        `/api/v1/public/cases/${encodeURIComponent(id)}`,
        { cache: "no-store" },
      ),
    ),
  );
  const cases = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length && !cases.length) throw failures[0].reason;
  return {
    unavailable: failures.length,
    items: cases
      .filter(
        (x) =>
          x.status === "REGISTRATION_OPEN" &&
          Date.parse(x.registrationDeadline) > Date.now(),
      )
      .map((x) => ({ id: x.id, title: x.title, at: x.registrationDeadline }))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  };
}
