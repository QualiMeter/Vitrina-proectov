import { ApiError } from "../../api/client";
import type * as C from "./contracts";
import type { Day1Gateway, StudentGateway } from "./gateway";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const demoCaseId = uid(12);
const me = uid(1),
  otherCaptain = uid(5),
  candidate = uid(6);
const now = () => new Date().toISOString();
const future = () => new Date(Date.now() + 30 * 86400000).toISOString();
const copy = <T>(value: T): T => structuredClone(value);
const paged = <T>(items: T[], page: number) => ({
  items: copy(items.slice((page - 1) * 20, page * 20)),
  page,
  pageSize: 20,
  total: items.length,
});

/** In-memory examples only, with UUID identifiers and server-like workflow checks. */
export function withParticipationDemo(base: Day1Gateway): StudentGateway {
  const teams: C.CaseTeam[] = [
    {
      id: uid(30),
      caseId: uid(10),
      name: "Демо-команда активного кейса",
      captainUserId: me,
      members: [
        {
          userId: me,
          displayName: "student_demo",
          isCaptain: true,
          joinedAt: now(),
        },
      ],
      pendingInvitations: [],
      membershipLocked: true,
      createdAt: now(),
    },
    {
      id: uid(33),
      caseId: uid(13),
      name: "Команда по приглашению",
      captainUserId: otherCaptain,
      members: [
        {
          userId: otherCaptain,
          displayName: "Демо Капитан",
          isCaptain: true,
          joinedAt: now(),
        },
      ],
      pendingInvitations: [],
      membershipLocked: false,
      createdAt: now(),
    },
  ];
  const invites: C.CaseTeamInvitation[] = [
    {
      id: uid(40),
      teamId: uid(33),
      inviteeUserId: me,
      invitedByUserId: otherCaptain,
      status: "PENDING",
      createdAt: now(),
      expiresAt: future(),
    },
  ];
  const apps: C.CaseApplication[] = [
    {
      id: uid(20),
      caseId: uid(10),
      format: "TEAM",
      teamId: uid(30),
      status: "ADMITTED",
      version: 1,
      participantUserIds: [me],
      allowedActions: [],
      createdAt: now(),
      updatedAt: now(),
    },
    {
      id: uid(21),
      caseId: uid(11),
      format: "SOLO",
      soloApplicantUserId: me,
      status: "DRAFT",
      version: 1,
      participantUserIds: [me],
      coverLetter: "Хочу участвовать в учебном кейсе.",
      allowedActions: ["edit", "submit"],
      createdAt: now(),
      updatedAt: now(),
    },
  ];
  const successful = new Map<
    string,
    { body: string; result: C.CaseApplication }
  >();
  const detail = (id: string): C.CasePublicDetails => {
    if (![uid(10), uid(11), uid(12), uid(13)].includes(id))
      throw new ApiError("notFound", 404);
    return {
      id,
      companyId: uid(90),
      companyName: "Демонстрационная компания",
      title:
        id === uid(10)
          ? "Сервис для студенческих команд"
          : id === uid(11)
            ? "Учебный кейс по веб-разработке"
            : id === uid(13)
              ? "Кейс команды по приглашению"
              : "Открытый учебный кейс",
      description:
        "Учебный пример для проверки командной и индивидуальной заявки.",
      status: id === uid(10) ? "EXECUTING" : "REGISTRATION_OPEN",
      admissionMode: "SELECTIVE",
      participationFormat: "BOTH",
      registrationDeadline: future(),
      directionIds: [],
      technologyIds: [uid(3)],
      coverLetterRequired: true,
      minCourse: 1,
      maxCourse: 6,
      minTeamSize: 1,
      maxTeamSize: 5,
      maxAdmittedTeams: 10,
      maxAdmittedSolo: 10,
      admittedTeamCount: 0,
      admittedSoloCount: 0,
    };
  };
  const rawTeam = (id: string) => {
    const t = teams.find((x) => x.id === id);
    if (!t) throw new ApiError("notFound", 404);
    return t;
  };
  const member = (t: C.CaseTeam) => t.members.some((x) => x.userId === me);
  const visibleTeam = (id: string) => {
    const t = rawTeam(id);
    if (!member(t)) throw new ApiError("forbidden", 403);
    return copy({
      ...t,
      pendingInvitations: invites.filter(
        (x) => x.teamId === id && x.status === "PENDING",
      ),
    });
  };
  const editableTeam = (id: string) => {
    const t = rawTeam(id);
    if (t.captainUserId !== me) throw new ApiError("forbidden", 403);
    if (t.membershipLocked || detail(t.caseId).status !== "REGISTRATION_OPEN")
      throw new ApiError("conflict", 409);
    return t;
  };
  const appForMe = (a: C.CaseApplication) =>
    a.soloApplicantUserId === me ||
    Boolean(a.teamId && member(rawTeam(a.teamId)));
  const application = (id: string) => {
    const a = apps.find((x) => x.id === id);
    if (!a) throw new ApiError("notFound", 404);
    if (!appForMe(a)) throw new ApiError("forbidden", 403);
    return a;
  };
  const owner = (a: C.CaseApplication) =>
    a.format === "SOLO"
      ? a.soloApplicantUserId === me
      : Boolean(a.teamId && rawTeam(a.teamId).captainUserId === me);
  const requireVersion = (a: C.CaseApplication, version: number) => {
    if (a.version !== version) throw new ApiError("conflict", 409);
    if (!owner(a)) throw new ApiError("forbidden", 403);
  };
  const policy = (caseId: string): C.NdaPolicy => ({
    caseId,
    required: caseId === demoCaseId,
    ...(caseId === demoCaseId
      ? {
          version: "demo-1",
          documentText:
            "Учебный текст NDA для демонстрации. Это не юридическое соглашение.",
        }
      : {}),
  });
  const command = (
    name: string,
    id: string,
    body: unknown,
    key: string | undefined,
    run: () => C.CaseApplication,
  ) => {
    const k = name + ":" + id + ":" + (key ?? crypto.randomUUID()),
      serialized = JSON.stringify(body);
    const old = successful.get(k);
    if (old) {
      if (old.body !== serialized) throw new ApiError("conflict", 409);
      return copy(old.result);
    }
    const result = copy(run());
    successful.set(k, { body: serialized, result });
    return result;
  };
  return {
    ...base,
    dashboardSignals: async (caseIds) => ({
      pending: invites
        .filter(
          (x) =>
            x.inviteeUserId === me &&
            x.status === "PENDING" &&
            Date.parse(x.expiresAt) > Date.now(),
        )
        .map((x) => {
          const t = rawTeam(x.teamId);
          return {
            id: x.id,
            title: `${t.name} · ${detail(t.caseId).title}`,
            expiresAt: x.expiresAt,
          };
        }),
      pendingPageOnly: false,
      deadlines: caseIds
        .map(detail)
        .filter(
          (x) =>
            x.status === "REGISTRATION_OPEN" &&
            Date.parse(x.registrationDeadline) > Date.now(),
        )
        .map((x) => ({ id: x.id, title: x.title, at: x.registrationDeadline }))
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    }),
    participations: async (page) =>
      paged(
        apps.filter(appForMe).map((a) => ({
          caseId: a.caseId,
          caseTitle: detail(a.caseId).title,
          format: a.format,
          role: (a.format === "SOLO"
            ? "SOLO"
            : rawTeam(a.teamId!).captainUserId === me
              ? "CAPTAIN"
              : "MEMBER") as C.MyCaseParticipation["role"],
          applicationStatus: a.status,
          applicationId: a.id,
          teamId: a.teamId,
          caseStatus: detail(a.caseId).status,
        })),
        page,
      ),
    invitations: async (page) =>
      paged(
        invites
          .filter((x) => x.inviteeUserId === me)
          .map((x) => {
            const t = rawTeam(x.teamId);
            return {
              id: x.id,
              caseId: t.caseId,
              caseTitle: detail(t.caseId).title,
              teamId: t.id,
              teamName: t.name,
              captainDisplayName: "Демо Капитан",
              status: x.status,
              createdAt: x.createdAt,
              expiresAt: x.expiresAt,
              respondedAt: x.respondedAt,
            };
          }),
        page,
      ),
    decideInvitation: async (id, action) => {
      const invite = invites.find((x) => x.id === id);
      if (!invite) throw new ApiError("notFound", 404);
      const t = rawTeam(invite.teamId);
      if (
        invite.status !== "PENDING" ||
        t.membershipLocked ||
        detail(t.caseId).status !== "REGISTRATION_OPEN" ||
        Date.parse(invite.expiresAt) <= Date.now()
      )
        throw new ApiError("conflict", 409);
      if (action === "revoke") {
        editableTeam(t.id);
        invite.status = "REVOKED";
      } else {
        if (invite.inviteeUserId !== me) throw new ApiError("forbidden", 403);
        if (action === "accept") {
          if (teams.some((other) => other.caseId === t.caseId && member(other)))
            throw new ApiError("conflict", 409);
          t.members.push({
            userId: me,
            displayName: "student_demo",
            isCaptain: false,
            joinedAt: now(),
          });
          invite.status = "ACCEPTED";
        } else invite.status = "DECLINED";
      }
      invite.respondedAt = now();
      return copy(invite);
    },
    caseDetails: async (id) => copy(detail(id)),
    teams: async (caseId) => ({
      items: teams
        .filter((x) => x.caseId === caseId && member(x))
        .map((x) => visibleTeam(x.id)),
    }),
    team: async (id) => visibleTeam(id),
    createTeam: async (caseId, name) => {
      if (
        detail(caseId).status !== "REGISTRATION_OPEN" ||
        teams.some((t) => t.caseId === caseId && member(t)) ||
        apps.some((a) => a.caseId === caseId && appForMe(a))
      )
        throw new ApiError("conflict", 409);
      if (name.trim().length < 2 || name.trim().length > 120)
        throw new ApiError("unknown", 422);
      const t: C.CaseTeam = {
        id: crypto.randomUUID(),
        caseId,
        name: name.trim(),
        captainUserId: me,
        members: [
          {
            userId: me,
            displayName: "student_demo",
            isCaptain: true,
            joinedAt: now(),
          },
        ],
        pendingInvitations: [],
        membershipLocked: false,
        createdAt: now(),
      };
      teams.push(t);
      return visibleTeam(t.id);
    },
    candidates: async (teamId, search) => {
      editableTeam(teamId);
      return {
        items: search.toLowerCase().includes("демо")
          ? [{ userId: candidate, displayName: "Демо Участник", course: 2 }]
          : [],
      };
    },
    invite: async (teamId, userId) => {
      const t = editableTeam(teamId);
      if (
        t.members.some((x) => x.userId === userId) ||
        invites.some(
          (x) =>
            x.teamId === teamId &&
            x.inviteeUserId === userId &&
            x.status === "PENDING",
        )
      )
        throw new ApiError("conflict", 409);
      const invite: C.CaseTeamInvitation = {
        id: crypto.randomUUID(),
        teamId,
        inviteeUserId: userId,
        invitedByUserId: me,
        status: "PENDING",
        createdAt: now(),
        expiresAt: detail(t.caseId).registrationDeadline,
      };
      invites.push(invite);
      return copy(invite);
    },
    removeMember: async (teamId, userId) => {
      const t = rawTeam(teamId);
      if (!member(t) || (t.captainUserId !== me && userId !== me))
        throw new ApiError("forbidden", 403);
      if (t.membershipLocked || userId === t.captainUserId)
        throw new ApiError("conflict", 409);
      t.members = t.members.filter((x) => x.userId !== userId);
      return copy(t);
    },
    transfer: async (teamId, toUserId) => {
      const t = editableTeam(teamId);
      if (!t.members.some((x) => x.userId === toUserId) || toUserId === me)
        throw new ApiError("unknown", 422);
      const transfer: C.CaptainTransfer = {
        id: crypto.randomUUID(),
        teamId,
        fromUserId: me,
        toUserId,
        status: "PENDING",
        createdAt: now(),
      };
      t.captainTransfer = transfer;
      return copy(transfer);
    },
    decideTransfer: async (teamId, id, action) => {
      const t = rawTeam(teamId),
        transfer = t.captainTransfer;
      if (!member(t) || !transfer || transfer.toUserId !== me)
        throw new ApiError("forbidden", 403);
      if (
        transfer.id !== id ||
        transfer.status !== "PENDING" ||
        t.membershipLocked
      )
        throw new ApiError("conflict", 409);
      transfer.status = action === "CONFIRM" ? "CONFIRMED" : "DECLINED";
      transfer.decidedAt = now();
      if (action === "CONFIRM") {
        t.captainUserId = me;
        t.members.forEach((x) => {
          x.isCaptain = x.userId === me;
        });
      }
      return copy(transfer);
    },
    applications: async (caseId) =>
      paged(
        apps.filter((a) => a.caseId === caseId && appForMe(a)),
        1,
      ),
    application: async (id) => copy(application(id)),
    createApplication: async (caseId, body) => {
      if (
        body.format === "SOLO" &&
        teams.some((t) => t.caseId === caseId && member(t))
      )
        throw new ApiError("conflict", 409);
      if (
        detail(caseId).status !== "REGISTRATION_OPEN" ||
        apps.some((a) => a.caseId === caseId && appForMe(a))
      )
        throw new ApiError("conflict", 409);
      if (body.format === "TEAM") {
        const t = editableTeam(body.teamId);
        if (t.caseId !== caseId) throw new ApiError("forbidden", 403);
      }
      const a: C.CaseApplication = {
        id: crypto.randomUUID(),
        caseId,
        format: body.format,
        ...(body.format === "TEAM"
          ? { teamId: body.teamId }
          : { soloApplicantUserId: me }),
        status: "DRAFT",
        version: 1,
        participantUserIds:
          body.format === "TEAM"
            ? rawTeam(body.teamId).members.map((x) => x.userId)
            : [me],
        allowedActions: ["edit", "submit"],
        createdAt: now(),
        updatedAt: now(),
      };
      apps.push(a);
      return copy(a);
    },
    saveApplication: async (id, body) => {
      const a = application(id);
      requireVersion(a, body.expectedVersion);
      if (a.status !== "DRAFT") throw new ApiError("conflict", 409);
      if ((body.coverLetter?.length ?? 0) > 5000)
        throw new ApiError("unknown", 422);
      a.coverLetter = body.coverLetter ?? a.coverLetter;
      a.version++;
      a.updatedAt = now();
      return copy(a);
    },
    submitApplication: async (id, body, key) => {
      const profile = await base.profile();
      return command("submit", id, body, key, () => {
        const a = application(id);
        requireVersion(a, body.expectedVersion);
        const d = detail(a.caseId),
          nda = policy(a.caseId);
        if (
          a.status !== "DRAFT" ||
          d.status !== "REGISTRATION_OPEN" ||
          Date.parse(d.registrationDeadline) <= Date.now()
        )
          throw new ApiError("conflict", 409);
        if (
          !a.coverLetter?.trim() ||
          !profile.course ||
          profile.course < (d.minCourse ?? 1) ||
          profile.course > (d.maxCourse ?? 6)
        )
          throw new ApiError("unknown", 422);
        if (
          nda.required &&
          (!body.ndaAcceptance?.accepted ||
            body.ndaAcceptance.version !== nda.version)
        )
          throw new ApiError("unknown", 422);
        if (a.teamId) {
          const t = editableTeam(a.teamId);
          if (
            t.members.length < (d.minTeamSize ?? 1) ||
            t.members.length > (d.maxTeamSize ?? Infinity) ||
            invites.some((x) => x.teamId === t.id && x.status === "PENDING")
          )
            throw new ApiError("conflict", 409);
          t.membershipLocked = true;
          a.participantUserIds = t.members.map((x) => x.userId);
        }
        a.status = "SUBMITTED";
        a.version++;
        a.submittedAt = now();
        a.updatedAt = now();
        a.allowedActions = ["withdraw"];
        return a;
      });
    },
    withdrawApplication: async (id, body, key) =>
      command("withdraw", id, body, key, () => {
        const a = application(id);
        requireVersion(a, body.expectedVersion);
        if (
          !["SUBMITTED", "ADMITTED"].includes(a.status) ||
          detail(a.caseId).status !== "REGISTRATION_OPEN"
        )
          throw new ApiError("conflict", 409);
        a.status = "WITHDRAWN";
        a.version++;
        a.updatedAt = now();
        a.allowedActions = [];
        return a;
      }),
    nda: async (caseId) => {
      detail(caseId);
      return policy(caseId);
    },
  };
}
