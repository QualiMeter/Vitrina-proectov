/** Provisional UI models from TZ v5.1 PW/SIP/PORT, not approved server DTOs. */
export const categories = [
  ["ACADEMIC", "Учебная работа"],
  ["COURSEWORK", "Курсовая"],
  ["THESIS", "ВКР"],
  ["HACKATHON", "Работа с хакатона"],
  ["PET", "Pet-проект"],
  ["STARTUP", "Стартап"],
  ["RESEARCH", "НИР"],
  ["TEAM", "Проект студенческой команды"],
  ["OPEN_SOURCE", "Open-source"],
] as const;
export type Category = (typeof categories)[number][0];
export const developmentLabels = {
  IDEA: "Идея",
  RECRUITING: "Поиск команды",
  IN_PROGRESS: "Разработка",
  PAUSED: "Приостановлен",
  COMPLETED: "Завершён",
} as const;
export type Development = keyof typeof developmentLabels;
export type Moderation =
  | "DRAFT"
  | "PENDING_MODERATION"
  | "PUBLISHED"
  | "RETURNED"
  | "REJECTED"
  | "HIDDEN";
export const moderationLabels: Record<Moderation, string> = {
  DRAFT: "Черновик",
  PENDING_MODERATION: "На проверке",
  PUBLISHED: "Опубликовано",
  RETURNED: "Возвращено на доработку",
  REJECTED: "Отклонено",
  HIDDEN: "Скрыто",
};
export const interestLabels = {
  SEEK_COMPANY_PARTNER: "Ищу компанию-партнёра",
  SEEK_TEAM: "Ищу команду",
  SEEK_MENTOR: "Ищу наставника",
  SEEK_INVESTOR: "Ищу инвестора",
  OPEN_TO_INTERNSHIP: "Открыт к стажировке",
  OPEN_TO_JOB: "Открыт к работе",
} as const;
export type Interest = keyof typeof interestLabels;
export type Media = {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  purpose: "IMAGE" | "MATERIAL";
};
export type BaseDraft = {
  title: string;
  category: Category;
  description: string;
  technologyIds: string[];
  directionId: string;
  startDate: string;
  links: { label: string; url: string }[];
  media: Media[];
};
export type WorkDraft = BaseDraft & {
  kind: "WORK";
  result: string;
  contribution: string;
  coauthors: string;
};
export type ProjectDraft = BaseDraft & {
  kind: "PROJECT";
  summary: string;
  problem: string;
  goals: string;
  developmentStatus: Development;
  publicContactUrl: string;
  interests: Interest[];
  vacancies: {
    id: string;
    title: string;
    skills: string;
    tasks: string;
    active: boolean;
  }[];
};
export type Draft = WorkDraft | ProjectDraft;
export type Publication = Draft & {
  id: string;
  authorId: string;
  version: number;
  moderation: Moderation;
  moderationNotes: string;
  updatedAt: string;
};
export type PublicWork = WorkDraft & {
  id: string;
  authorNickname: string;
  updatedAt: string;
};
export type PublicProject = ProjectDraft & {
  id: string;
  author: { id: string; nickname: string };
  members: { nickname: string; role: string; competencies: string[] }[];
  updatedAt: string;
};
export type Evidence = {
  id: string;
  companyName: string;
  title: string;
  result: string;
};
export type Portfolio = {
  nickname: string;
  works: Publication[];
  projects: Publication[];
  confirmedCases: Evidence[];
  closedProjects: { id: string; period: string }[];
};
export type PublicPortfolio = {
  nickname: string;
  works: PublicWork[];
  projects: PublicProject[];
  confirmedCases: Evidence[];
  closedProjects: { id: string; period: string }[];
};
export type ProjectQuery = {
  q: string;
  category: string;
  technologyId: string;
  directionId: string;
  development: string;
  interest: string;
};
export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
export type Reference = {
  technologies: { id: string; name: string }[];
  directions: { id: string; name: string }[];
};
export interface PublicationGateway {
  reference(): Promise<Reference>;
  portfolio(): Promise<Portfolio>;
  publicPortfolio(userId: string): Promise<PublicPortfolio>;
  getOwned(kind: Draft["kind"], id: string): Promise<Publication>;
  save(
    draft: Draft,
    id?: string,
    expectedVersion?: number,
  ): Promise<Publication>;
  submitForModeration(
    id: string,
    expectedVersion: number,
  ): Promise<Publication>;
  hideWork(id: string, expectedVersion: number): Promise<Publication>;
  catalog(query: ProjectQuery, page: number): Promise<Page<PublicProject>>;
  publicProject(id: string): Promise<PublicProject>;
  upload(file: File, purpose: Media["purpose"]): Promise<Media>;
  mediaBlob(id: string): Promise<Blob>;
}
export const emptyQuery: ProjectQuery = {
  q: "",
  category: "",
  technologyId: "",
  directionId: "",
  development: "",
  interest: "",
};
export function emptyDraft(kind: Draft["kind"]): Draft {
  const base: BaseDraft = {
    title: "",
    category: "ACADEMIC",
    description: "",
    technologyIds: [],
    directionId: "",
    startDate: "",
    links: [],
    media: [],
  };
  return kind === "WORK"
    ? { ...base, kind, result: "", contribution: "", coauthors: "" }
    : {
        ...base,
        kind,
        summary: "",
        problem: "",
        goals: "",
        developmentStatus: "IDEA",
        publicContactUrl: "",
        interests: [],
        vacancies: [],
      };
}
export function draftOf(p: Publication): Draft {
  const base: BaseDraft = {
    title: p.title,
    category: p.category,
    description: p.description,
    technologyIds: [...p.technologyIds],
    directionId: p.directionId,
    startDate: p.startDate,
    links: structuredClone(p.links),
    media: structuredClone(p.media),
  };
  return p.kind === "WORK"
    ? {
        ...base,
        kind: "WORK",
        result: p.result,
        contribution: p.contribution,
        coauthors: p.coauthors,
      }
    : {
        ...base,
        kind: "PROJECT",
        summary: p.summary,
        problem: p.problem,
        goals: p.goals,
        developmentStatus: p.developmentStatus,
        publicContactUrl: p.publicContactUrl,
        interests: [...p.interests],
        vacancies: structuredClone(p.vacancies),
      };
}
