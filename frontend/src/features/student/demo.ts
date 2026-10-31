import { ApiError } from "../../api/client";
import type * as C from "./contracts";
import type { StudentGateway } from "./gateway";
export const demoUserId = "00000000-0000-4000-8000-000000000001";
const instituteId = "00000000-0000-4000-8000-000000000002";
const technologyId = "00000000-0000-4000-8000-000000000003";
const skillId = "00000000-0000-4000-8000-000000000004";
/** Explicit volatile examples. Never a fallback for failed live requests. */
export function createDemoGateway(): StudentGateway {
  let profile: C.StudentProfilePrivate = {
    userId: demoUserId,
    fullName: "Демо Студент",
    nickname: "student_demo",
    instituteId,
    course: 2,
    studyGroup: "ДЕМО-201",
    version: 1,
    skillIds: [skillId],
    technologyIds: [technologyId],
    publicLinks: [],
    achievements: [],
    avatarUrl: null,
    publicSummary:
      "Разрабатываю веб-приложения и ищу команду для практических проектов.",
  };
  const reference: C.ReferenceDataResponse = {
    directions: [],
    competencies: [{ id: skillId, name: "Веб-разработка" }],
    technologies: [{ id: technologyId, name: "React" }],
    institutes: [{ id: instituteId, name: "Демонстрационный институт" }],
    portfolioCategories: [],
  };
  const items: C.MyCaseParticipationListResponse["items"] = [
    {
      caseId: "00000000-0000-4000-8000-000000000010",
      caseTitle: "Сервис для студенческих команд",
      format: "TEAM",
      role: "CAPTAIN",
      applicationStatus: "ADMITTED",
      caseStatus: "EXECUTING",
      teamExecutionStatus: "ACTIVE",
    },
    {
      caseId: "00000000-0000-4000-8000-000000000011",
      caseTitle: "Учебный кейс по веб-разработке",
      format: "SOLO",
      role: "SOLO",
      applicationStatus: "DRAFT",
      caseStatus: "REGISTRATION_OPEN",
    },
  ];
  const clone = <T>(value: T): T => structuredClone(value);
  return {
    session: async () => ({
      user: {
        id: demoUserId,
        email: "demo@example.invalid",
        fullName: profile.fullName,
        globalRoles: ["STUDENT"],
        availableAreas: ["student"],
        permissions: [],
        companyMemberships: [],
      },
      session: { expiresAt: new Date(Date.now() + 3600000).toISOString() },
    }),
    profile: async () => clone(profile),
    updateProfile: async (body) => {
      const { expectedVersion, ...values } = body;
      if (expectedVersion !== profile.version)
        throw new ApiError("conflict", 409);
      const provided = Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== undefined),
      );
      profile = { ...profile, ...provided, version: profile.version + 1 };
      return clone(profile);
    },
    avatar: async (file) => {
      if (file)
        throw new Error(
          "Загрузка аватара требует сервера обработки изображений.",
        );
      profile.avatarUrl = null;
      return clone(profile);
    },
    publicProfile: async (id) => {
      if (id !== demoUserId) throw new ApiError("notFound", 404);
      return clone({
        studentId: profile.userId,
        nickname: profile.nickname,
        avatarUrl: profile.avatarUrl ?? null,
        achievements: profile.achievements,
        skillIds: profile.skillIds,
        technologyIds: profile.technologyIds,
        publicLinks: profile.publicLinks,
        publicSummary: profile.publicSummary,
      });
    },
    reference: async () => clone(reference),
    participations: async (page) => ({
      items: clone(items.slice((page - 1) * 20, page * 20)),
      page,
      pageSize: 20,
      total: items.length,
    }),
  };
}
