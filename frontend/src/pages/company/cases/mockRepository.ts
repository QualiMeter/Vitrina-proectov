import type { CaseDraft, CompanyCasesRepository, DraftFields } from './contracts';

export const demoCompanyId = 'c1000000-0000-4000-8000-000000000001';
export const demoUserId = 'f1000000-0000-4000-8000-000000000001';
export const directions = [
  { id: 'd1000000-0000-4000-8000-000000000001', name: 'Веб-разработка' },
  { id: 'd1000000-0000-4000-8000-000000000002', name: 'Анализ данных' }
];
export const technologies = [
  { id: 'e1000000-0000-4000-8000-000000000001', name: 'React' },
  { id: 'e1000000-0000-4000-8000-000000000002', name: 'TypeScript' }
];
// These action names are local UI capabilities, NOT an approved server allowedActions enum.
export type DemoMode = 'normal' | 'empty' | 'error' | 'denied' | 'read-only' | 'save-error' | 'conflict';

export function validateDraft(fields: DraftFields): string[] {
  const errors: string[] = [];
  if (!fields.title.trim() || fields.title.length > 200) errors.push('Название: от 1 до 200 символов.');
  for (const key of ['description', 'publicTaskDescription'] as const) {
    if ((fields[key]?.length ?? 0) > 20000) errors.push('Описание: не более 20000 символов.');
  }
  if (fields.description === '') errors.push('Описание не может быть пустым, если оно передано.');
  for (const key of ['rewardTerms', 'resultRightsTerms'] as const) {
    if ((fields[key]?.length ?? 0) > 5000) errors.push('Условия: не более 5000 символов.');
  }
  for (const key of ['minCourse', 'maxCourse', 'minTeamSize', 'maxTeamSize', 'maxAdmittedTeams', 'maxAdmittedSolo'] as const) {
    const n = fields[key];
    if (n != null && (!Number.isInteger(n) || n < (key.startsWith('maxAdmitted') ? 0 : 1))) {
      errors.push('Курс, размер команды и лимиты должны быть целыми допустимыми числами.');
    }
  }
  if (fields.minCourse != null && fields.maxCourse != null && fields.minCourse > fields.maxCourse) errors.push('Минимальный курс больше максимального.');
  if (fields.minTeamSize != null && fields.maxTeamSize != null && fields.minTeamSize > fields.maxTeamSize) errors.push('Минимальный размер команды больше максимального.');
  if (fields.registrationDeadline && !Number.isFinite(Date.parse(fields.registrationDeadline))) errors.push('Некорректный срок набора.');
  return errors;
}

/** In-memory demo only. Reload resets data; no private data or fake authentication. */
export function createMockRepository(mode: DemoMode = 'normal', sharedRecords?: Map<string, CaseDraft>): CompanyCasesRepository {
  const stamp = '2026-11-01T10:00:00Z';
  const seed: CaseDraft = {
    id: 'a2000000-0000-4000-8000-000000000001', companyId: demoCompanyId,
    createdByUserId: demoUserId, title: 'Новый сервис компании', status: 'DRAFT',
    version: 1, createdAt: stamp, updatedAt: stamp, allowedActions: ['edit', 'submit-moderation']
  };
  const fixtures: CaseDraft[] = [seed, {
    ...seed, id: 'a2000000-0000-4000-8000-000000000002', title: 'Система анализа обращений',
    status: 'REVISION', allowedActions: ['edit', 'submit-moderation']
  }, {
    ...seed, id: 'a2000000-0000-4000-8000-000000000003', title: 'Панель показателей компании',
    status: 'APPROVED', allowedActions: ['open-registration']
  }];
  const items = sharedRecords ?? new Map<string, CaseDraft>();
  if (mode !== 'empty') for (const item of fixtures) items.set(item.id,
    mode === 'read-only' ? { ...item, allowedActions: [] } : item);
  let conflictPending = mode === 'conflict';
  async function check(companyId: string) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (mode === 'error') throw new Error('Демонстрационная ошибка загрузки. Повторите попытку.');
    if (mode === 'denied' || companyId !== demoCompanyId) throw new Error('Нет доступа к кейсам этой компании.');
  }
  function find(id: string) {
    const item = items.get(id);
    if (!item) throw new Error('Черновик не найден. После перезагрузки демонстрационные изменения сбрасываются.');
    return item;
  }
  return {
    async list(companyId) {
      await check(companyId);
      return { items: structuredClone([...items.values()]), page: 1, pageSize: 20, total: items.size };
    },
    async get(companyId, id) { await check(companyId); return structuredClone(find(id)); },
    async create(companyId, request) {
      await check(companyId);
      if (mode === 'read-only') throw new Error('Создание запрещено.');
      if (mode === 'save-error') throw new Error('Не удалось сохранить черновик. Введённые данные сохранены в форме.');
      const errors = validateDraft(request);
      if (errors.length) throw new Error(errors.join(' '));
      const now = new Date().toISOString();
      const item: CaseDraft = { ...seed, ...request, id: crypto.randomUUID(), createdAt: now, updatedAt: now };
      items.set(item.id, item);
      return structuredClone(item);
    },
    async update(companyId, id, { expectedVersion, ...fields }) {
      await check(companyId);
      const current = find(id);
      if (!['DRAFT', 'REVISION'].includes(current.status) || !current.allowedActions.includes('edit')) throw new Error('Редактирование запрещено.');
      if (mode === 'save-error') throw new Error('Не удалось сохранить черновик. Введённые данные сохранены в форме.');
      if (conflictPending) {
        conflictPending = false;
        items.set(id, { ...current, version: current.version + 1 });
        throw new Error('Конфликт версии (409). Откройте черновик повторно.');
      }
      if (current.version !== expectedVersion) throw new Error('Конфликт версии (409). Откройте черновик повторно.');
      // Match JSON PATCH: undefined properties are omitted, not cleared on the server.
      const supplied = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
      const next: CaseDraft = { ...current, ...supplied, version: current.version + 1, updatedAt: new Date().toISOString() };
      const errors = validateDraft(next);
      if (errors.length) throw new Error(errors.join(' '));
      items.set(id, next);
      return structuredClone(next);
    }
  };
}
