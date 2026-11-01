import type { CompanyPublic } from './companyTypes';
import { mockPublicCases } from './mockCases';
import type { CasePublicSummary } from './types';

/** UI Ready public-company fixtures. No email, phone, or internal notes are included. */
export const mockPublicCompanies: Record<string, CompanyPublic> = {
  'c1000000-0000-4000-8000-000000000001': {
    id: 'c1000000-0000-4000-8000-000000000001',
    name: 'Лаборатория цифровых решений',
    description: 'Команда развивает цифровые решения и исследовательские сервисы для городской среды.',
    directionIds: ['d1000000-0000-4000-8000-000000000002']
  },
  'c1000000-0000-4000-8000-000000000002': {
    id: 'c1000000-0000-4000-8000-000000000002',
    name: 'УУНиТ · Инженерный центр',
    description: 'Инженерный центр университета объединяет исследовательские команды и цифровые проекты.',
    website: 'https://uust.ru/',
    directionIds: ['d1000000-0000-4000-8000-000000000001']
  },
  'c1000000-0000-4000-8000-000000000003': {
    id: 'c1000000-0000-4000-8000-000000000003',
    name: 'АльфаТех',
    description: 'Технологическая компания, работающая над инструментами анализа и обработки данных.',
    directionIds: ['d1000000-0000-4000-8000-000000000003']
  },
  'c1000000-0000-4000-8000-000000000004': {
    id: 'c1000000-0000-4000-8000-000000000004',
    name: 'Дизайн-бюро Практика',
    description: 'Дизайн-команда проектирует понятные цифровые продукты и интерфейсы.',
    directionIds: ['d1000000-0000-4000-8000-000000000004']
  },
  'c1000000-0000-4000-8000-000000000005': {
    id: 'c1000000-0000-4000-8000-000000000005',
    name: 'Кампусные технологии',
    description: 'Команда создаёт цифровые сервисы для повседневной жизни кампуса.',
    directionIds: ['d1000000-0000-4000-8000-000000000001']
  },
  'c1000000-0000-4000-8000-000000000006': {
    id: 'c1000000-0000-4000-8000-000000000006',
    name: 'Центр прикладной аналитики',
    description: 'Центр исследует данные и разрабатывает прикладные методы прогнозирования.',
    directionIds: ['d1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000003']
  }
};

export async function loadMockCompanyProfile(companyId: string) {
  const company = mockPublicCompanies[companyId] ?? null;
  const cases: CasePublicSummary[] = company
    ? mockPublicCases.filter((item) => item.companyId === companyId)
    : [];
  return { company, cases };
}
