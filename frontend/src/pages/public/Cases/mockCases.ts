import type { CasePublicDetails, CasePublicSummary, PublicCaseStatus } from './types';

/** Demonstration directory fixtures; replace with the shared reference-data API. */
export const directions: Record<string, string> = {
  'd1000000-0000-4000-8000-000000000001': 'Веб-разработка',
  'd1000000-0000-4000-8000-000000000002': 'Аналитика данных',
  'd1000000-0000-4000-8000-000000000003': 'Искусственный интеллект',
  'd1000000-0000-4000-8000-000000000004': 'Продуктовый дизайн'
};

export const technologies: Record<string, string> = {
  'f1000000-0000-4000-8000-000000000001': 'React',
  'f1000000-0000-4000-8000-000000000002': 'Python',
  'f1000000-0000-4000-8000-000000000003': 'Машинное обучение',
  'f1000000-0000-4000-8000-000000000004': 'Figma',
  'f1000000-0000-4000-8000-000000000005': 'Java'
};

const companyIds = [
  'c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000004',
  'c1000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000006'
];

const caseIds = [
  'a1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000004',
  'a1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000006'
];

/** Public fixture narrows the contract DTO to statuses allowed by the catalogue. */
type MockPublicCase = Omit<CasePublicSummary, 'status'> & { status: PublicCaseStatus };

/** Full local fixture set. Unlike the API DTO, this is deliberately unpaginated. */
export const mockPublicCases: MockPublicCase[] = [
  { id: caseIds[0], companyId: companyIds[0], companyName: 'Лаборатория цифровых решений', title: 'Сервис мониторинга городской среды', status: 'REGISTRATION_OPEN', participationFormat: 'TEAM', admissionMode: 'SELECTIVE', registrationDeadline: '2026-12-15T18:00:00+05:00', directionIds: ['d1000000-0000-4000-8000-000000000002'], technologyIds: ['f1000000-0000-4000-8000-000000000002'], rewardTerms: 'Оплачиваемая стажировка для команды-победителя', minCourse: 2, maxCourse: 4 },
  { id: caseIds[1], companyId: companyIds[1], companyName: 'УУНиТ · Инженерный центр', title: 'Каталог исследовательских данных', status: 'REGISTRATION_OPEN', participationFormat: 'BOTH', admissionMode: 'OPEN', registrationDeadline: '2026-12-20T18:00:00+05:00', directionIds: ['d1000000-0000-4000-8000-000000000001'], technologyIds: ['f1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000005'], rewardTerms: 'Сертификаты участникам', minCourse: 1, maxCourse: 6 },
  { id: caseIds[2], companyId: companyIds[2], companyName: 'АльфаТех', title: 'Помощник для анализа документов', status: 'REGISTRATION_OPEN', participationFormat: 'TEAM', admissionMode: 'SELECTIVE', registrationDeadline: '2027-01-12T18:00:00+05:00', directionIds: ['d1000000-0000-4000-8000-000000000003'], technologyIds: ['f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003'], rewardTerms: 'Призовой фонд по условиям конкурса', minCourse: 3, maxCourse: 6 },
  { id: caseIds[3], companyId: companyIds[3], companyName: 'Дизайн-бюро Практика', title: 'Новый интерфейс университетского сервиса', status: 'REGISTRATION_OPEN', participationFormat: 'BOTH', admissionMode: 'OPEN', registrationDeadline: '2027-01-22T18:00:00+05:00', directionIds: ['d1000000-0000-4000-8000-000000000004'], technologyIds: ['f1000000-0000-4000-8000-000000000004'], minCourse: 1, maxCourse: 6 },
  { id: caseIds[4], companyId: companyIds[4], companyName: 'Кампусные технологии', title: 'Мобильная навигация по кампусу', status: 'EXECUTING', participationFormat: 'TEAM', admissionMode: 'SELECTIVE', registrationDeadline: '2026-10-10T18:00:00+05:00', directionIds: ['d1000000-0000-4000-8000-000000000001'], technologyIds: ['f1000000-0000-4000-8000-000000000001'], rewardTerms: 'Проектная практика', minCourse: 2, maxCourse: 5 },
  { id: caseIds[5], companyId: companyIds[5], companyName: 'Центр прикладной аналитики', title: 'Прогнозирование нагрузки на лаборатории', status: 'REGISTRATION_OPEN', participationFormat: 'SOLO', admissionMode: 'OPEN', registrationDeadline: '2027-02-05T18:00:00+05:00', directionIds: ['d1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000003'], technologyIds: ['f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003'], rewardTerms: 'Публикация результатов проекта', minCourse: 2, maxCourse: 6 }
];

/** Public detail fixtures use the same UUIDs as the list fixtures. */
export const mockCaseDetails: Record<string, CasePublicDetails> = Object.fromEntries(
  mockPublicCases.map((item) => [item.id, {
    ...item,
    description: `О проекте «${item.title}»: команда исследует задачу и предлагает проверяемое решение для ${item.companyName}.`,
    publicTaskDescription: 'Подготовьте прототип, опишите подход и представьте результаты экспертам.',
    minTeamSize: item.participationFormat === 'SOLO' ? undefined : 2,
    maxTeamSize: item.participationFormat === 'SOLO' ? undefined : 5,
    maxAdmittedTeams: null
  } satisfies CasePublicDetails])
);

export async function loadMockPublicCases(): Promise<CasePublicSummary[]> {
  return mockPublicCases;
}
