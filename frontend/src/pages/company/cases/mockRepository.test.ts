import { describe, expect, it } from 'vitest';
import { createMockRepository, demoCompanyId, validateDraft } from './mockRepository';

describe('company draft demo boundary', () => {
  it('creates, updates and reopens with independent quotas including zero', async () => {
    const repository = createMockRepository('empty');
    const draft = await repository.create(demoCompanyId, { title: 'Кейс' });
    expect(draft.id).toMatch(/^[0-9a-f-]{36}$/);
    const saved = await repository.update(demoCompanyId, draft.id, {
      expectedVersion: 1, participationFormat: 'BOTH', maxAdmittedTeams: 0, maxAdmittedSolo: null
    });
    expect(saved).toMatchObject({ version: 2, status: 'DRAFT', maxAdmittedTeams: 0, maxAdmittedSolo: null });
    expect(await repository.get(demoCompanyId, draft.id)).toEqual(saved);
    await expect(repository.update(demoCompanyId, draft.id, { expectedVersion: 1, title: 'Устаревшее' })).rejects.toThrow('409');
    expect((await repository.list(demoCompanyId)).total).toBe(1);
  });
  it('does not expose another company and supports denied/error/empty states', async () => {
    await expect(createMockRepository().list('another-company')).rejects.toThrow('Нет доступа');
    await expect(createMockRepository('denied').list(demoCompanyId)).rejects.toThrow('Нет доступа');
    await expect(createMockRepository('error').list(demoCompanyId)).rejects.toThrow('ошибка');
    expect((await createMockRepository('empty').list(demoCompanyId)).items).toEqual([]);
  });
  it('rejects invalid ranges, fractional and negative quotas without persisting', async () => {
    expect(validateDraft({ title: ' ', minCourse: 4, maxCourse: 2, maxAdmittedSolo: -1, minTeamSize: 1.5 })).toHaveLength(4);
    const repository = createMockRepository('empty');
    await expect(repository.create(demoCompanyId, { title: '' })).rejects.toThrow('Название');
    expect((await repository.list(demoCompanyId)).total).toBe(0);
  });
  it('returns copies and resets demo changes in a new repository', async () => {
    const repository = createMockRepository('empty');
    const draft = await repository.create(demoCompanyId, { title: 'Исходное' });
    draft.title = 'Внешнее изменение';
    expect((await repository.get(demoCompanyId, draft.id)).title).toBe('Исходное');
    await expect(createMockRepository('empty').get(demoCompanyId, draft.id)).rejects.toThrow('не найден');
  });
});
