import { ApiError } from "../../../api/client";
import { publicationErrors, editable } from "./rules";
import {
  emptyDraft,
  type PublicationGateway,
  type Publication,
  type ProjectDraft,
  type WorkDraft,
  type PublicProject,
  type PublicWork,
  type Reference,
} from "./models";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const publicationDemoUserId = uid(1);
export const publicationIds = {
  project: uid(20),
  work: uid(101),
  returnedWork: uid(102),
  privateProject: uid(110),
};
export function createPublicationDemo(
  actorId = publicationDemoUserId,
  membersForPublic?: (id: string) => PublicProject["members"] | undefined,
): PublicationGateway {
  const now = () => new Date().toISOString(),
    clone = <T>(v: T): T => structuredClone(v);
  const reference: Reference = {
    technologies: [
      { id: uid(201), name: "React" },
      { id: uid(202), name: "TypeScript" },
      { id: uid(203), name: "Python" },
    ],
    directions: [
      { id: uid(211), name: "Веб-разработка" },
      { id: uid(212), name: "Анализ данных" },
    ],
  };
  const records: Publication[] = [];
  const blobs = new Map<string, File>();
  const meta = {
    authorId: publicationDemoUserId,
    version: 1,
    updatedAt: now(),
  };
  const work = (
    id: string,
    title: string,
    moderation: Publication["moderation"],
  ): Publication => ({
    ...(emptyDraft("WORK") as WorkDraft),
    ...meta,
    id,
    title,
    moderation,
    moderationNotes:
      moderation === "RETURNED"
        ? "Уточните личный вклад и добавьте подтверждение результата."
        : "",
    result: "Создан учебный прототип сервиса.",
    contribution: "Разработал интерфейс и проверил сценарии.",
    description: "Завершённая работа по веб-разработке.",
    technologyIds: [uid(201)],
    category: "COURSEWORK",
  });
  records.push(
    work(publicationIds.work, "Интерфейс студенческого сервиса", "PUBLISHED"),
    work(publicationIds.returnedWork, "Анализ открытых данных", "RETURNED"),
    work(uid(103), "Личный черновик работы", "DRAFT"),
  );
  for (let i = 0; i < 9; i++)
    records.push({
      ...(emptyDraft("PROJECT") as ProjectDraft),
      ...meta,
      authorId: i === 8 ? uid(2) : publicationDemoUserId,
      id: i === 0 ? publicationIds.project : uid(120 + i),
      title:
        i === 0
          ? "Карта студенческих команд"
          : `Студенческая инициатива ${i + 1}`,
      summary: "Открытый проект для совместной разработки.",
      description:
        "Платформа помогает студентам находить задачи и развивать навыки.",
      problem: "Студентам сложно найти подходящую команду.",
      goals: "Объединить участников по навыкам и интересам.",
      category: i % 2 ? "RESEARCH" : "PET",
      technologyIds: i === 0 ? [uid(201), uid(202)] : [uid(i % 2 ? 203 : 201)],
      directionId: uid(i % 2 ? 212 : 211),
      developmentStatus: i % 2 ? "IN_PROGRESS" : "RECRUITING",
      publicContactUrl: "https://example.com/project-chat",
      interests: i % 2 ? ["SEEK_MENTOR"] : ["SEEK_TEAM"],
      vacancies: [
        {
          id: uid(300 + i),
          title: "Frontend-разработчик",
          skills: "React",
          tasks: "Разработать интерфейс проекта",
          active: true,
        },
      ],
      moderation: "PUBLISHED",
      moderationNotes: "",
    });
  records.push({
    ...(emptyDraft("PROJECT") as ProjectDraft),
    ...meta,
    id: publicationIds.privateProject,
    title: "Непубличный проект автора",
    moderation: "DRAFT",
    moderationNotes: "",
  });
  records.push({
    ...records[3],
    id: uid(111),
    title: "Скрытая инициатива",
    moderation: "HIDDEN",
  });
  function owned(id: string) {
    const d = records.find((x) => x.id === id);
    if (!d) throw new ApiError("notFound", 404);
    if (d.authorId !== actorId) throw new ApiError("forbidden", 403);
    return d;
  }
  function privateList() {
    return records.filter((x) => x.authorId === actorId);
  }
  function baseFields(d: Publication) {
    return {
      title: d.title,
      category: d.category,
      description: d.description,
      technologyIds: clone(d.technologyIds),
      directionId: d.directionId,
      startDate: d.startDate,
      links: clone(d.links),
      media: clone(d.media),
    };
  }
  function publicWork(d: Publication): PublicWork {
    if (d.kind !== "WORK" || d.moderation !== "PUBLISHED")
      throw new ApiError("notFound", 404);
    return {
      ...baseFields(d),
      kind: "WORK",
      id: d.id,
      authorNickname: "student_demo",
      result: d.result,
      contribution: d.contribution,
      coauthors: d.coauthors,
      updatedAt: d.updatedAt,
    };
  }
  function publicProject(d: Publication): PublicProject {
    if (d.kind !== "PROJECT" || d.moderation !== "PUBLISHED")
      throw new ApiError("notFound", 404);
    return {
      ...baseFields(d),
      kind: "PROJECT",
      id: d.id,
      author: {
        id: d.authorId,
        nickname:
          d.authorId === publicationDemoUserId
            ? "student_demo"
            : "project_author",
      },
      summary: d.summary,
      problem: d.problem,
      goals: d.goals,
      developmentStatus: d.developmentStatus,
      publicContactUrl: d.publicContactUrl,
      interests: clone(d.interests),
      vacancies: clone(d.vacancies.filter((x) => x.active)),
      members: membersForPublic?.(d.id) ?? [
        {
          nickname:
            d.authorId === publicationDemoUserId
              ? "student_demo"
              : "project_author",
          role: "Автор",
          competencies: ["Веб-разработка"],
        },
      ],
      updatedAt: d.updatedAt,
    };
  }
  const evidence = [
    {
      id: uid(401),
      companyName: "Демо-компания",
      title: "Сервис для студенческих команд",
      result: "Подтверждён результат участия",
    },
  ];
  const closed = [{ id: uid(402), period: "2026" }];
  return {
    reference: async () => clone(reference),
    portfolio: async () =>
      clone({
        nickname: "student_demo",
        works: privateList().filter((x) => x.kind === "WORK"),
        projects: privateList().filter((x) => x.kind === "PROJECT"),
        confirmedCases: actorId === publicationDemoUserId ? evidence : [],
        closedProjects: actorId === publicationDemoUserId ? closed : [],
      }),
    publicPortfolio: async (userId) => {
      if (userId !== publicationDemoUserId) throw new ApiError("notFound", 404);
      return {
        nickname: "student_demo",
        works: records
          .filter(
            (x) =>
              x.authorId === userId &&
              x.kind === "WORK" &&
              x.moderation === "PUBLISHED",
          )
          .map(publicWork),
        projects: records
          .filter(
            (x) =>
              x.authorId === userId &&
              x.kind === "PROJECT" &&
              x.moderation === "PUBLISHED",
          )
          .map(publicProject),
        confirmedCases: clone(evidence),
        closedProjects: clone(closed),
      };
    },
    getOwned: async (kind, id) => {
      const d = owned(id);
      if (d.kind !== kind) throw new ApiError("notFound", 404);
      return clone(d);
    },
    save: async (draft, id, expectedVersion) => {
      const errors = publicationErrors(draft, false);
      if (errors.length) throw new Error(errors.join(" "));
      const previous = id ? owned(id) : undefined;
      if (
        previous &&
        (previous.kind !== draft.kind || previous.version !== expectedVersion)
      )
        throw new ApiError("conflict", 409);
      if (previous && !editable(previous.moderation))
        throw new ApiError("forbidden", 403);
      for (const media of draft.media)
        if (
          !blobs.has(media.id) &&
          !previous?.media.some((x) => x.id === media.id)
        )
          throw new ApiError("forbidden", 403);
      const updated: Publication = {
        ...clone(draft),
        id: previous?.id ?? crypto.randomUUID(),
        authorId: actorId,
        version: (previous?.version ?? 0) + 1,
        moderation:
          previous?.moderation === "PUBLISHED"
            ? "RETURNED"
            : (previous?.moderation ?? "DRAFT"),
        moderationNotes:
          previous?.moderation === "PUBLISHED"
            ? "Изменения опубликованной записи требуют повторной проверки."
            : (previous?.moderationNotes ?? ""),
        updatedAt: now(),
      };
      if (previous) records[records.indexOf(previous)] = updated;
      else records.push(updated);
      return clone(updated);
    },
    submitForModeration: async (id, version) => {
      const d = owned(id);
      if (d.version !== version) throw new ApiError("conflict", 409);
      if (!["DRAFT", "RETURNED", "REJECTED"].includes(d.moderation))
        throw new ApiError("forbidden", 403);
      const errors = publicationErrors(d);
      if (errors.length) throw new Error(errors.join(" "));
      d.moderation = "PENDING_MODERATION";
      d.moderationNotes = "";
      d.version++;
      return clone(d);
    },
    hideWork: async (id, version) => {
      const d = owned(id);
      if (d.kind !== "WORK" || d.moderation !== "PUBLISHED")
        throw new ApiError("forbidden", 403);
      if (d.version !== version) throw new ApiError("conflict", 409);
      d.moderation = "HIDDEN";
      d.version++;
      return clone(d);
    },
    catalog: async (q, page) => {
      const filtered = records
        .filter((x) => x.kind === "PROJECT" && x.moderation === "PUBLISHED")
        .map(publicProject)
        .filter(
          (x) =>
            (!q.q ||
              `${x.title} ${x.summary}`
                .toLocaleLowerCase()
                .includes(q.q.trim().toLocaleLowerCase())) &&
            (!q.category || x.category === q.category) &&
            (!q.technologyId || x.technologyIds.includes(q.technologyId)) &&
            (!q.directionId || x.directionId === q.directionId) &&
            (!q.development || x.developmentStatus === q.development) &&
            (!q.interest ||
              x.interests.includes(
                q.interest as ProjectDraft["interests"][number],
              )),
        );
      const actual = Math.max(
        1,
        Math.min(page, Math.max(1, Math.ceil(filtered.length / 6))),
      );
      return clone({
        items: filtered.slice((actual - 1) * 6, actual * 6),
        page: actual,
        pageSize: 6,
        total: filtered.length,
      });
    },
    publicProject: async (id) => {
      const d = records.find((x) => x.id === id);
      if (!d) throw new ApiError("notFound", 404);
      return publicProject(d);
    },
    upload: async (file, purpose) => {
      const allowed =
        purpose === "IMAGE"
          ? ["image/png", "image/jpeg", "image/webp"]
          : ["application/pdf", "application/zip", "text/plain"];
      if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024)
        throw new Error(
          "В учебном примере допустимы изображения PNG/JPEG/WebP или материалы PDF/ZIP/TXT до 10 МБ.",
        );
      const id = crypto.randomUUID();
      blobs.set(id, file);
      return {
        id,
        name: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        purpose,
      };
    },
    mediaBlob: async (id) => {
      const file = blobs.get(id);
      if (!file) throw new ApiError("notFound", 404);
      return file;
    },
  };
}
