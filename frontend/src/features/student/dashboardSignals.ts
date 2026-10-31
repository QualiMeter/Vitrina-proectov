import { apiRequest } from "../../api/client";
import type * as C from "./contracts";

/** A UI projection of existing contracts, not a new server DTO or endpoint. */
export type DashboardSignals = {
  pending: { id: string; title: string; expiresAt: string }[];
  pendingPageOnly: boolean;
  deadlines: { id: string; title: string; at: string }[];
};
export async function readDashboardSignals(
  caseIds: string[],
): Promise<DashboardSignals> {
  const [inbox, ...cases] = await Promise.all([
    apiRequest<C.TeamInvitationInboxResponse>(
      "/api/v1/me/team-invitations?page=1&pageSize=20",
      { cache: "no-store" },
    ),
    ...caseIds
      .slice(0, 6)
      .map((id) =>
        apiRequest<C.CasePublicDetails>(
          `/api/v1/public/cases/${encodeURIComponent(id)}`,
          { cache: "no-store" },
        ),
      ),
  ]);
  return {
    pending: inbox.items
      .filter(
        (x) => x.status === "PENDING" && Date.parse(x.expiresAt) > Date.now(),
      )
      .map((x) => ({
        id: x.id,
        title: `${x.teamName} · ${x.caseTitle}`,
        expiresAt: x.expiresAt,
      })),
    pendingPageOnly: inbox.total > inbox.pageSize,
    deadlines: cases
      .filter(
        (x) =>
          x.status === "REGISTRATION_OPEN" &&
          Date.parse(x.registrationDeadline) > Date.now(),
      )
      .map((x) => ({ id: x.id, title: x.title, at: x.registrationDeadline }))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  };
}
