import type { CasePublicListResponse } from './types';

export const directions: Record<string, string> = {
  'dir-web': 'Веб-разработка',
  'dir-data': 'Аналитика данных',
  'dir-ai': 'Искусственный интеллект',
  'dir-design': 'Продуктовый дизайн'
};

export const technologies: Record<string, string> = {
  'tech-react': 'React',
  'tech-python': 'Python',
  'tech-ml': 'Машинное обучение',
  'tech-figma': 'Figma',
  'tech-java': 'Java'
};

/** UI Ready fixtures only. Replace with casesListPublic after the backend ships. */
export const mockPublicCases: CasePublicListResponse = {
  page: 1,
  pageSize: 6,
  total: 6,
  items: [
    { id: 'case-001', companyId: 'company-001', companyName: 'Лаборатория цифровых решений', title: 'Сервис мониторинга городской среды', status: 'REGISTRATION_OPEN', participationFormat: 'TEAM', admissionMode: 'SELECTIVE', registrationDeadline: '2026-12-15T18:00:00+05:00', directionIds: ['dir-data'], technologyIds: ['tech-python'], rewardTerms: 'Оплачиваемая стажировка для команды-победителя', minCourse: 2, maxCourse: 4 },
    { id: 'case-002', companyId: 'company-002', companyName: 'УУНиТ · Инженерный центр', title: 'Каталог исследовательских данных', status: 'REGISTRATION_OPEN', participationFormat: 'BOTH', admissionMode: 'OPEN', registrationDeadline: '2026-12-20T18:00:00+05:00', directionIds: ['dir-web'], technologyIds: ['tech-react', 'tech-java'], rewardTerms: 'Сертификаты участникам', minCourse: 1, maxCourse: 6 },
    { id: 'case-003', companyId: 'company-003', companyName: 'АльфаТех', title: 'Помощник для анализа документов', status: 'REGISTRATION_OPEN', participationFormat: 'TEAM', admissionMode: 'SELECTIVE', registrationDeadline: '2027-01-12T18:00:00+05:00', directionIds: ['dir-ai'], technologyIds: ['tech-python', 'tech-ml'], rewardTerms: 'Призовой фонд по условиям конкурса', minCourse: 3, maxCourse: 6 },
    { id: 'case-004', companyId: 'company-004', companyName: 'Дизайн-бюро Практика', title: 'Новый интерфейс университетского сервиса', status: 'REGISTRATION_OPEN', participationFormat: 'BOTH', admissionMode: 'OPEN', registrationDeadline: '2027-01-22T18:00:00+05:00', directionIds: ['dir-design'], technologyIds: ['tech-figma'], minCourse: 1, maxCourse: 6 },
    { id: 'case-005', companyId: 'company-005', companyName: 'Кампусные технологии', title: 'Мобильная навигация по кампусу', status: 'EXECUTING', participationFormat: 'TEAM', admissionMode: 'SELECTIVE', registrationDeadline: '2026-10-10T18:00:00+05:00', directionIds: ['dir-web'], technologyIds: ['tech-react'], rewardTerms: 'Проектная практика', minCourse: 2, maxCourse: 5 },
    { id: 'case-006', companyId: 'company-006', companyName: 'Центр прикладной аналитики', title: 'Прогнозирование нагрузки на лаборатории', status: 'REGISTRATION_OPEN', participationFormat: 'SOLO', admissionMode: 'OPEN', registrationDeadline: '2027-02-05T18:00:00+05:00', directionIds: ['dir-data', 'dir-ai'], technologyIds: ['tech-python', 'tech-ml'], minCourse: 2, maxCourse: 6 }
  ]
};

export async function loadMockPublicCases(): Promise<CasePublicListResponse> {
  return mockPublicCases;
}
