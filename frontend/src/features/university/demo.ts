import type { AuthSession } from '../../api/auth';
import type {
  Company, CompanyInvitation, CompanyListResponse, CreateCompanyPayload,
  InvitationListResponse, InvitationRole, ReferenceData,
} from '../../api/university';

let demoEnabled = false;
let nextCompanyNumber = 3;
let nextInvitationNumber = 2;

const companies: Company[] = [
  {
    id: 'demo-company-001',
    name: 'Лаборатория цифровых решений',
    description: 'Демонстрационная организация для просмотра университетского кабинета.',
    website: 'https://example.org',
    directionIds: ['direction-it', 'direction-data'],
    contactEmail: 'hello@example.org',
    createdAt: '2026-10-28T09:30:00.000Z',
  },
  {
    id: 'demo-company-002',
    name: 'Студия образовательных технологий',
    description: 'Пример карточки компании. Эти сведения существуют только в памяти вкладки.',
    directionIds: ['direction-edu'],
    contactEmail: 'team@example.net',
    createdAt: '2026-10-30T12:00:00.000Z',
  },
];

const invitations = new Map<string, CompanyInvitation[]>([[companies[0].id, [
  {
    id: 'demo-invitation-001',
    email: 'representative@example.org',
    role: 'OWNER',
    status: 'PENDING',
    createdAt: '2026-10-30T12:00:00.000Z',
    expiresAt: '2026-11-06T12:00:00.000Z',
  },
]]]);

export function isUniversityDemoEnabled() {
  return demoEnabled;
}

export function enableUniversityDemo(enabled: boolean) {
  demoEnabled = import.meta.env.DEV && enabled;
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    if (demoEnabled) window.sessionStorage.setItem('vitrina-university-demo', '1');
    else window.sessionStorage.removeItem('vitrina-university-demo');
  }
}

export function universityDemoWasRequested() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('demo') === 'university'
    || window.sessionStorage.getItem('vitrina-university-demo') === '1';
}

export function createUniversityDemoSession(): AuthSession {
  return {
    user: {
      id: 'demo-university-staff',
      email: 'staff@example.edu',
      fullName: 'Демо сотрудник УУНиТ',
      globalRoles: ['UNIVERSITY_STAFF'],
      availableAreas: ['university'],
      permissions: ['companies.listAll', 'companies.create', 'companies.readPrivate', 'companies.invite'],
      companyMemberships: [],
    },
    session: { expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() },
  };
}

export function demoListCompanies({ page, pageSize, search }: {
  page: number; pageSize: number; search: string;
}): CompanyListResponse {
  const query = search.trim().toLocaleLowerCase('ru-RU');
  const filtered = companies.filter(company => !query
    || company.name.toLocaleLowerCase('ru-RU').includes(query)
    || company.contactEmail.toLocaleLowerCase('ru-RU').includes(query));
  const offset = (page - 1) * pageSize;
  return { items: filtered.slice(offset, offset + pageSize), page, pageSize, total: filtered.length };
}

export function demoGetCompany(companyId: string) {
  const company = companies.find(item => item.id === companyId);
  if (!company) return Promise.reject(new Error('Demo company not found'));
  return Promise.resolve(company);
}

export function demoCreateCompany(payload: CreateCompanyPayload) {
  const now = new Date().toISOString();
  const company: Company = {
    id: `demo-company-${String(nextCompanyNumber++).padStart(3, '0')}`,
    ...payload,
    createdAt: now,
  };
  companies.unshift(company);
  return Promise.resolve(company);
}

export function demoListInvitations(companyId: string, page: number, pageSize: number): InvitationListResponse {
  const all = invitations.get(companyId) ?? [];
  const offset = (page - 1) * pageSize;
  return { items: all.slice(offset, offset + pageSize), page, pageSize, total: all.length };
}

export function demoInviteRepresentative(companyId: string, email: string, role: InvitationRole) {
  const invitation: CompanyInvitation = {
    id: `demo-invitation-${String(nextInvitationNumber++).padStart(3, '0')}`,
    email,
    role,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  };
  invitations.set(companyId, [invitation, ...(invitations.get(companyId) ?? [])]);
  return Promise.resolve(invitation);
}

export function demoReferenceData(): ReferenceData {
  return {
    directions: [
      { id: 'direction-it', name: 'Информационные технологии' },
      { id: 'direction-data', name: 'Аналитика данных' },
      { id: 'direction-edu', name: 'Образовательные технологии' },
      { id: 'direction-industry', name: 'Промышленность и инженерия' },
    ],
    technologies: [],
    competencies: [],
    portfolioCategories: [],
    institutes: [],
  };
}
