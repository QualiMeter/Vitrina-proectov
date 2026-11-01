import { ApiError } from "../../../api/client";
import { publicationDemoUserId, publicationIds } from "../publications/demo";
import {
  draftOf,
  type PublicationGateway,
  type Development,
} from "../publications/models";
import { editable } from "../publications/rules";
import { demoCaseId } from "../day2Demo";
import type {
  Curator,
  Member,
  ProjectApplication,
  Notice,
  ProjectManagementGateway,
} from "./models";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const externalProjectId = uid(128);
type Team = {
  version: number;
  members: Member[];
  applications: ProjectApplication[];
  curator: Curator | null;
};
export function createProjectManagementState() {
  const now = new Date().toISOString();
  const teams: Record<string, Team> = {
    [publicationIds.project]: {
      version: 1,
      members: [
        {
          userId: publicationDemoUserId,
          nickname: "student_demo",
          role: "Автор",
        },
        { userId: uid(3), nickname: "designer_demo", role: "Дизайнер" },
      ],
      applications: [
        {
          id: uid(701),
          projectId: publicationIds.project,
          userId: uid(2),
          nickname: "candidate_demo",
          roleId: uid(300),
          roleTitle: "Frontend-разработчик",
          message: "Хочу помочь с интерфейсом. Есть опыт React.",
          status: "PENDING",
          version: 1,
          createdAt: now,
        },
      ],
      curator: { nickname: "curator_demo", assignedAt: now },
    },
    [externalProjectId]: {
      version: 1,
      members: [{ userId: uid(2), nickname: "project_author", role: "Автор" }],
      applications: [],
      curator: null,
    },
  };
  const notices: Notice[] = [
    {
      id: uid(801),
      userId: publicationDemoUserId,
      kind: "CURATOR",
      destination: "TEAM",
      title: "Изменилось назначение куратора проекта",
      projectId: publicationIds.project,
      read: false,
      version: 1,
      createdAt: now,
    },
  ];
  return {
    teams,
    notices,
    favorites: new Map<string, Set<string>>([
      [publicationDemoUserId, new Set([demoCaseId])],
    ]),
  };
}
export type ProjectManagementState = ReturnType<
  typeof createProjectManagementState
>;
/** In-memory teaching model, not a substitute for server access checks. */
export function createProjectManagementDemo(
  publications: PublicationGateway,
  actorId = publicationDemoUserId,
  state = createProjectManagementState(),
): ProjectManagementGateway {
  const clone = <T>(x: T): T => structuredClone(x),
    now = () => new Date().toISOString();
  async function owner(id: string) {
    const project = await publications.getOwned("PROJECT", id);
    if (project.authorId !== actorId) throw new ApiError("forbidden", 403);
    return project;
  }
  function team(id: string, authorId: string): Team {
    return (state.teams[id] ??= {
      version: 1,
      members: [{ userId: authorId, nickname: "student_demo", role: "Автор" }],
      applications: [],
      curator: null,
    });
  }
  function version(actual: number, expected: number) {
    if (actual !== expected) throw new ApiError("conflict", 409);
  }
  function notify(
    userId: string,
    projectId: string,
    title: string,
    destination: "TEAM" | "APPLICATION" = "APPLICATION",
  ) {
    state.notices.push({
      id: crypto.randomUUID(),
      userId,
      projectId,
      kind: "APPLICATION",
      destination,
      title,
      read: false,
      version: 1,
      createdAt: now(),
    });
  }
  return {
    projects: async () =>
      clone(
        (await publications.portfolio()).projects.filter(
          (p) => p.authorId === actorId,
        ),
      ),
    manage: async (id) => {
      const project = await owner(id),
        t = team(id, project.authorId);
      return clone({ project, ...t, allowedActions: ["decide", "remove"] });
    },
    changeDevelopment: async (id, value: Development, expectedVersion) => {
      const p = await owner(id);
      if (p.kind !== "PROJECT" || !editable(p.moderation))
        throw new ApiError("forbidden", 403);
      version(p.version, expectedVersion);
      const draft = draftOf(p);
      if (draft.kind !== "PROJECT") throw new ApiError("notFound", 404);
      return publications.save(
        { ...draft, developmentStatus: value },
        id,
        expectedVersion,
      );
    },
    decide: async (id, applicationId, decision, expected) => {
      const p = await owner(id),
        t = team(id, p.authorId);
      version(t.version, expected);
      const a = t.applications.find((x) => x.id === applicationId);
      if (!a) throw new ApiError("notFound", 404);
      if (a.status !== "PENDING") throw new ApiError("conflict", 409);
      if (decision === "ACCEPTED") {
        if (
          p.kind !== "PROJECT" ||
          p.moderation !== "PUBLISHED" ||
          p.developmentStatus === "COMPLETED" ||
          p.developmentStatus === "PAUSED"
        )
          throw new ApiError("forbidden", 403);
        if (!p.vacancies.some((v) => v.id === a.roleId && v.active))
          throw new Error("Роль больше не открыта. Обновите проект.");
        if (t.members.some((m) => m.userId === a.userId))
          throw new ApiError("conflict", 409);
        t.members.push({
          userId: a.userId,
          nickname: a.nickname,
          role: a.roleTitle,
        });
      }
      a.status = decision;
      a.version++;
      t.version++;
      notify(
        a.userId,
        id,
        decision === "ACCEPTED"
          ? "Заявка в проект принята"
          : "Заявка в проект отклонена",
      );
    },
    remove: async (id, userId, expected) => {
      const p = await owner(id),
        t = team(id, p.authorId);
      version(t.version, expected);
      if (userId === p.authorId) throw new ApiError("forbidden", 403);
      const index = t.members.findIndex((m) => m.userId === userId);
      if (index < 0) throw new ApiError("notFound", 404);
      t.members.splice(index, 1);
      t.version++;
      notify(userId, id, "Ваше участие в проекте завершено");
    },
    applicationContext: async (id) => {
      const project = await publications.publicProject(id),
        t = team(id, project.author.id);
      return clone({
        project,
        relation:
          project.author.id === actorId
            ? "AUTHOR"
            : t.members.some((m) => m.userId === actorId)
              ? "MEMBER"
              : "CANDIDATE",
        application: t.applications.find((a) => a.userId === actorId),
      });
    },
    apply: async (id, roleId, message) => {
      const project = await publications.publicProject(id),
        t = team(id, project.author.id);
      if (
        project.author.id === actorId ||
        t.members.some((m) => m.userId === actorId)
      )
        throw new ApiError("forbidden", 403);
      if (["PAUSED", "COMPLETED"].includes(project.developmentStatus))
        throw new ApiError("forbidden", 403);
      if (t.applications.some((a) => a.userId === actorId))
        throw new ApiError("conflict", 409);
      const role = project.vacancies.find((v) => v.id === roleId && v.active);
      if (!role) throw new Error("Выберите открытую роль.");
      if (!message.trim() || message.length > 2000)
        throw new Error("Добавьте письмо до 2000 символов.");
      const a: ProjectApplication = {
        id: crypto.randomUUID(),
        projectId: id,
        userId: actorId,
        nickname:
          actorId === publicationDemoUserId ? "student_demo" : "candidate_demo",
        roleId,
        roleTitle: role.title,
        message: message.trim(),
        status: "PENDING",
        version: 1,
        createdAt: now(),
      };
      t.applications.push(a);
      t.version++;
      notify(project.author.id, id, "Получена новая заявка в проект", "TEAM");
      return clone(a);
    },
    withdraw: async (id, applicationId, expected) => {
      const t = state.teams[id],
        a = t?.applications.find((x) => x.id === applicationId);
      if (!a) throw new ApiError("notFound", 404);
      if (a.userId !== actorId) throw new ApiError("forbidden", 403);
      version(a.version, expected);
      if (a.status !== "PENDING") throw new ApiError("conflict", 409);
      a.status = "WITHDRAWN";
      a.version++;
      t.version++;
    },
    favorites: async () =>
      [...(state.favorites.get(actorId) ?? [])].map((caseId) => ({
        caseId,
        title: "Учебный кейс для команд",
        companyName: "Демо-компания",
      })),
    setFavorite: async (caseId, saved) => {
      if (caseId !== demoCaseId) throw new ApiError("notFound", 404);
      const list = state.favorites.get(actorId) ?? new Set<string>();
      if (saved) list.add(caseId);
      else list.delete(caseId);
      state.favorites.set(actorId, list);
    },
    notices: async () =>
      clone(
        state.notices
          .filter((n) => n.userId === actorId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    markRead: async (id, expected) => {
      const n = state.notices.find((x) => x.id === id);
      if (!n) throw new ApiError("notFound", 404);
      if (n.userId !== actorId) throw new ApiError("forbidden", 403);
      version(n.version, expected);
      n.read = true;
      n.version++;
    },
  };
}
