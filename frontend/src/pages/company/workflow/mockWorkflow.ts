import type { CaseStage, CaseCheckpoint, CaseApplication, CompanyStudentProfile } from './contracts.generated';
import type { CaseDraft as EditableCase } from '../cases/contracts';
import { createMockRepository, demoCompanyId, demoUserId, type DemoMode } from '../cases/mockRepository';
import { WorkflowError, type WorkflowRepository, type CaseSnapshot } from './repository';

const id = (prefix: string, n: number) => `${prefix}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const registrationCaseId = id('a2', 4);
export const closedCaseId = id('a2', 5);
export const openAdmissionCaseId = id('a2', 6);
const stamp = '2026-11-02T10:00:00Z';
const deadline = '2027-02-01T12:00:00Z';
export const demoSkillLabels: Readonly<Record<string, string>> = { [id('d4', 1)]: 'Разработка интерфейсов' };
export const demoTechnologyLabels: Readonly<Record<string, string>> = { [id('e1', 1)]: 'React' };

function fail(kind: ConstructorParameters<typeof WorkflowError>[0], message: string): never { throw new WorkflowError(kind, message); }
function positive(value: number) { return Number.isInteger(value) && value > 0; }
function validateTitle(title: string) { if (!title.trim() || title.length > 200) fail('validation', 'Название должно содержать от 1 до 200 символов.'); }
function validateDate(value: string) { if (!Number.isFinite(Date.parse(value))) fail('validation', 'Укажите корректную общую дату и время.'); }

/** Demo state is isolated per CompanyDemoLayout instance and resets on reload/mode change. */
export function createCompanyDemo(mode: DemoMode = 'normal') {
  const records = new Map<string, EditableCase>();
  const repository = createMockRepository(mode, records);
  const stages = new Map<string, CaseStage[]>();
  const applications = new Map<string, CaseApplication>();
  const profiles = new Map<string, CompanyStudentProfile>();
  const decisions = new Map<string, { fingerprint: string; result: CaseApplication }>();
  let conflictPending = mode === 'conflict';

  if (mode !== 'empty') {
    for (const [caseId, title, status, admissionMode] of [
      [registrationCaseId, 'Сервис городской среды', 'REGISTRATION_OPEN', 'SELECTIVE'],
      [closedCaseId, 'Аналитика обращений', 'REGISTRATION_CLOSED', 'SELECTIVE'],
      [openAdmissionCaseId, 'Открытый практикум', 'REGISTRATION_OPEN', 'OPEN']
    ] as const) records.set(caseId, {
      id: caseId, companyId: demoCompanyId, createdByUserId: demoUserId, title, status,
      admissionMode, participationFormat: 'BOTH', maxAdmittedTeams: 2, maxAdmittedSolo: 1,
      version: 1, registrationDeadline: deadline, createdAt: stamp, updatedAt: stamp,
      allowedActions: []
    });
    for (const item of records.values()) {
      // Day-2 minimum drafts did not have a format; the editor requires one before SELECTION.
      if (['DRAFT', 'REVISION'].includes(item.status)) item.participationFormat = 'BOTH';
      const stageId = id('d3', Number(item.id.slice(-2)));
      stages.set(item.id, [{ id: stageId, caseId: item.id, version: 1, sequence: 1, kind: 'FINAL', title: 'Финальная сдача', materials: [],
        checkpoints: [{ id: id('e3', Number(item.id.slice(-2))), caseId: item.id, stageId, version: 1,
          title: 'Финальный результат', kind: 'FINAL', deadline, intakeStatus: 'OPEN', allowedActions: [] }] }]);
      if (['REGISTRATION_OPEN', 'REGISTRATION_CLOSED'].includes(item.status)) {
        for (let n = 1; n <= 6; n++) {
          const suffix = Number(item.id.slice(-2)) * 100 + n;
          const format = n % 2 ? 'TEAM' : 'SOLO';
          const status = item.admissionMode === 'OPEN' ? (n <= 3 ? 'ADMITTED' : 'WITHDRAWN')
            : n === 3 ? 'ADMITTED' : n === 4 ? 'REJECTED' : n === 5 ? 'WITHDRAWN' : 'SUBMITTED';
          const userIds = [id('f3', suffix), ...(format === 'TEAM' ? [id('f3', suffix + 10000)] : [])];
          const app: CaseApplication = { id: id('a3', suffix), caseId: item.id, format, status, version: 1,
            ...(format === 'TEAM' ? { teamId: id('b3', suffix) } : { soloApplicantUserId: userIds[0] }),
            participantUserIds: userIds, coverLetter: 'Готовы разработать прототип и проверить его на открытых данных.',
            createdAt: stamp, updatedAt: stamp, submittedAt: stamp,
            // Local demo capability, not a guessed backend allowedActions vocabulary.
            allowedActions: status === 'SUBMITTED' && mode !== 'read-only' ? ['demo:decide'] : [] };
          applications.set(app.id, app);
          userIds.forEach((userId, index) => profiles.set(userId, {
            fullName: `Демо-участник ${n}.${index + 1}`, studyGroup: null, course: 3,
            publicProfile: { studentId: userId, nickname: `demo-${suffix}-${index}`, avatarUrl: null,
              achievements: [], skillIds: [id('d4', 1)], technologyIds: [id('e1', 1)], publicLinks: [],
              publicSummary: 'Учебный опыт: разработка интерфейсов и работа с открытыми данными.' }
          }));
        }
      }
    }
  }
  async function check(companyId: string, write = false) {
    await new Promise((resolve) => setTimeout(resolve, 80));
    if (companyId !== demoCompanyId || mode === 'denied' || (write && mode === 'read-only')) fail('denied', 'Нет доступа к действию или компании.');
    if (mode === 'error' || (write && mode === 'save-error')) fail('network', 'Не удалось выполнить действие. Введённые данные остаются в форме.');
  }
  function getCase(companyId: string, caseId: string): EditableCase {
    const item = records.get(caseId);
    if (!item) fail('notFound', 'Кейс не найден. Демоданные сбрасываются при перезагрузке.');
    if (item.companyId !== companyId) fail('denied', 'Кейс принадлежит другой компании.');
    return item;
  }
  function version(item: EditableCase, expected: number) {
    if (conflictPending) { item.version++; conflictPending = false; fail('conflict', 'Версия кейса изменилась. Загрузите актуальные данные; введённый текст остаётся в форме.'); }
    if (item.version !== expected) fail('conflict', 'Версия кейса изменилась. Загрузите актуальные данные.');
  }
  function bump(item: EditableCase) { item.version++; item.updatedAt = new Date().toISOString(); }
  function listStages(caseId: string) { return stages.get(caseId) ?? []; }
  function findStage(stageId: string) {
    for (const entries of stages.values()) { const stage = entries.find((entry) => entry.id === stageId); if (stage) return stage; }
    return fail('notFound', 'Этап не найден.');
  }
  function findCheckpoint(checkpointId: string) {
    for (const entries of stages.values()) for (const stage of entries) {
      const checkpoint = stage.checkpoints.find((entry) => entry.id === checkpointId);
      if (checkpoint) return { stage, checkpoint };
    }
    return fail('notFound', 'Контрольная точка не найдена.');
  }
  function editable(item: EditableCase) {
    if (!['DRAFT', 'REVISION'].includes(item.status) || !item.allowedActions.includes('edit')) fail('denied', 'Этапы разрешено менять только в доступном черновике или кейсе на доработке.');
  }
  function snapshot(companyId: string, caseId: string): CaseSnapshot {
    const item = getCase(companyId, caseId);
    const admitted = [...applications.values()].filter((app) => app.caseId === caseId && app.status === 'ADMITTED');
    const writable = mode !== 'read-only';
    return structuredClone({ item, admittedTeams: admitted.filter((app) => app.format === 'TEAM').length,
      admittedSolo: admitted.filter((app) => app.format === 'SOLO').length,
      permissions: {
        editStages: writable && ['DRAFT', 'REVISION'].includes(item.status) && item.allowedActions.includes('edit'),
        decide: writable && item.status === 'REGISTRATION_OPEN' && item.admissionMode === 'SELECTIVE'
          && (!item.registrationDeadline || Date.parse(item.registrationDeadline) > Date.now()),
        closeRegistration: writable && item.status === 'REGISTRATION_OPEN',
        startExecution: writable && item.status === 'REGISTRATION_CLOSED' && admitted.length > 0
          && listStages(caseId).some((stage) => stage.checkpoints.length > 0)
      } });
  }
  function validateCheckpoint(item: EditableCase, checkpoint: Pick<CaseCheckpoint, 'title' | 'kind' | 'deadline' | 'selectionLimit' | 'soloSelectionLimit' | 'instructions'>) {
    validateTitle(checkpoint.title); validateDate(checkpoint.deadline);
    if ((checkpoint.instructions?.length ?? 0) > 10000) fail('validation', 'Инструкции: не более 10000 символов.');
    if (checkpoint.kind !== 'SELECTION') {
      if (checkpoint.selectionLimit !== undefined || checkpoint.soloSelectionLimit !== undefined) fail('validation', 'Лимиты отбора допустимы только у отборочной точки.');
    } else {
      const team = ['TEAM', 'BOTH'].includes(item.participationFormat ?? '');
      const solo = ['SOLO', 'BOTH'].includes(item.participationFormat ?? '');
      if (!team && !solo) fail('validation', 'Сначала укажите формат участия в условиях кейса.');
      if (team ? !positive(checkpoint.selectionLimit ?? 0) : checkpoint.selectionLimit !== undefined) fail('validation', 'Укажите отдельный положительный лимит команд для разрешённого формата.');
      if (solo ? !Number.isInteger(checkpoint.soloSelectionLimit) || (checkpoint.soloSelectionLimit ?? -1) < 0 : checkpoint.soloSelectionLimit !== undefined) fail('validation', 'Укажите отдельный целый лимит соло (не меньше нуля).');
    }
  }
  const workflow: WorkflowRepository = {
    async snapshot(companyId, caseId) { await check(companyId); return snapshot(companyId, caseId); },
    async stages(companyId, caseId) {
      await check(companyId); const item = getCase(companyId, caseId);
      return structuredClone({ caseVersion: item.version, items: [...listStages(caseId)].sort((a, b) => a.sequence - b.sequence) });
    },
    async createStage(companyId, caseId, request) {
      await check(companyId, true); const item = getCase(companyId, caseId); editable(item); version(item, request.expectedCaseVersion);
      validateTitle(request.title);
      const entries = listStages(caseId);
      if (!positive(request.sequence) || entries.some((stage) => stage.sequence === request.sequence)) fail('validation', 'Порядок должен быть положительным и свободным.');
      if ((request.description?.length ?? 0) > 10000 || entries.length >= 100) fail('validation', 'Превышен лимит описания или числа этапов.');
      if (request.availableFrom) validateDate(request.availableFrom);
      if (request.kind === 'FINAL' && entries.some((stage) => stage.kind === 'FINAL')) fail('validation', 'Финальный этап уже существует.');
      const { expectedCaseVersion: _version, ...fields } = request;
      void _version;
      const stage: CaseStage = { ...fields, title: request.title.trim(), id: crypto.randomUUID(), caseId, version: 1, checkpoints: [], materials: [] };
      stages.set(caseId, [...entries, stage]); bump(item); return structuredClone(stage);
    },
    async updateStage(companyId, stageId, request) {
      await check(companyId, true); const stage = findStage(stageId); const item = getCase(companyId, stage.caseId);
      editable(item); version(item, request.expectedCaseVersion);
      if (stage.version !== request.expectedVersion) fail('conflict', 'Версия этапа изменилась.');
      if (request.title !== undefined) validateTitle(request.title);
      if (request.sequence !== undefined && (!positive(request.sequence) || listStages(item.id).some((entry) => entry.id !== stageId && entry.sequence === request.sequence))) fail('validation', 'Этот номер этапа уже занят или некорректен.');
      if ((request.description?.length ?? 0) > 10000) fail('validation', 'Описание: не более 10000 символов.');
      if (request.availableFrom) validateDate(request.availableFrom);
      const { expectedCaseVersion: _caseVersion, expectedVersion: _stageVersion, ...fields } = request;
      void _caseVersion; void _stageVersion;
      Object.assign(stage, fields, { version: stage.version + 1 }); bump(item); return structuredClone(stage);
    },
    async deleteStage(companyId, stageId, request) {
      await check(companyId, true); const stage = findStage(stageId); const item = getCase(companyId, stage.caseId);
      editable(item); version(item, request.expectedCaseVersion);
      if (stage.checkpoints.length || stage.materials.length) fail('validation', 'Сначала удалите контрольные точки и материалы этапа.');
      stages.set(item.id, listStages(item.id).filter((entry) => entry.id !== stageId)); bump(item);
    },
    async createCheckpoint(companyId, stageId, request) {
      await check(companyId, true); const stage = findStage(stageId); const item = getCase(companyId, stage.caseId);
      editable(item); version(item, request.expectedCaseVersion); validateCheckpoint(item, request);
      if (stage.checkpoints.length >= 100) fail('validation', 'Не более 100 точек на этапе.');
      if (request.kind === 'FINAL' && listStages(item.id).some((entry) => entry.checkpoints.some((point) => point.kind === 'FINAL'))) fail('validation', 'Финальная точка уже существует.');
      const { expectedCaseVersion: _version, ...fields } = request;
      void _version;
      stage.checkpoints.push({ ...fields, id: crypto.randomUUID(), caseId: item.id, stageId, version: 1, intakeStatus: 'OPEN', allowedActions: [] });
      stage.version++; bump(item);
    },
    async updateCheckpoint(companyId, checkpointId, request) {
      await check(companyId, true); const { stage, checkpoint } = findCheckpoint(checkpointId); const item = getCase(companyId, stage.caseId);
      editable(item); version(item, request.expectedCaseVersion);
      if (checkpoint.version !== request.expectedVersion) fail('conflict', 'Версия контрольной точки изменилась.');
      const { expectedCaseVersion: _caseVersion, expectedVersion: _version, ...fields } = request;
      void _caseVersion; void _version;
      const next = { ...checkpoint, ...fields, version: checkpoint.version + 1 }; validateCheckpoint(item, next);
      Object.assign(checkpoint, next); stage.version++; bump(item);
    },
    async deleteCheckpoint(companyId, checkpointId, request) {
      await check(companyId, true); const { stage } = findCheckpoint(checkpointId); const item = getCase(companyId, stage.caseId);
      editable(item); version(item, request.expectedCaseVersion);
      stage.checkpoints = stage.checkpoints.filter((entry) => entry.id !== checkpointId); stage.version++; bump(item);
    },
    async applications(companyId, caseId, query) {
      await check(companyId); getCase(companyId, caseId);
      const filtered = [...applications.values()].filter((app) => app.caseId === caseId && app.status !== 'DRAFT'
        && (!query.status || app.status === query.status) && (!query.format || app.format === query.format));
      if (!positive(query.page) || !positive(query.pageSize)) fail('validation', 'Некорректная страница.');
      return structuredClone({ items: filtered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: filtered.length, page: query.page, pageSize: query.pageSize });
    },
    async application(companyId, caseId, applicationId) {
      await check(companyId); getCase(companyId, caseId); const app = applications.get(applicationId);
      if (!app || app.caseId !== caseId || app.status === 'DRAFT') fail('notFound', 'Заявка не найдена.');
      return structuredClone(app);
    },
    async profile(companyId, userId) {
      await check(companyId); const profile = profiles.get(userId);
      if (!profile) fail('notFound', 'Профиль не найден.');
      return structuredClone(profile);
    },
    async decide(companyId, applicationId, request, key) {
      await check(companyId, true);
      const app = applications.get(applicationId);
      if (!app) fail('notFound', 'Заявка не найдена.');
      const item = getCase(companyId, app.caseId);
      const fingerprint = JSON.stringify({ companyId, applicationId, request });
      const prior = decisions.get(key);
      if (!key) fail('validation', 'Отсутствует ключ повтора операции.');
      if (prior) { if (prior.fingerprint !== fingerprint) fail('conflict', 'Ключ уже использован для другого действия.'); return structuredClone(prior.result); }
      if (!snapshot(companyId, item.id).permissions.decide || !app.allowedActions.includes('demo:decide')) fail('denied', 'Ручное решение недоступно для этого кейса или заявки.');
      if (app.status !== 'SUBMITTED' || app.version !== request.expectedVersion) fail('conflict', 'Статус или версия заявки изменились.');
      if (request.action === 'REJECT' && !request.reason?.trim()) fail('validation', 'Укажите причину отклонения.');
      if ((request.reason?.length ?? 0) > 2000) fail('validation', 'Причина: не более 2000 символов.');
      if (conflictPending) { app.version++; conflictPending = false; fail('conflict', 'Версия заявки изменилась. Загрузите актуальные данные.'); }
      if (request.action === 'ADMIT') {
        const counts = snapshot(companyId, item.id);
        const used = app.format === 'TEAM' ? counts.admittedTeams : counts.admittedSolo;
        const limit = app.format === 'TEAM' ? item.maxAdmittedTeams : item.maxAdmittedSolo;
        if (limit !== undefined && limit !== null && used >= limit) fail('quota', 'Мест для этого формата больше нет.');
      }
      app.status = request.action === 'ADMIT' ? 'ADMITTED' : 'REJECTED'; app.version++; app.allowedActions = [];
      app.decidedAt = new Date().toISOString(); app.decidedByUserId = demoUserId; app.updatedAt = app.decidedAt;
      if (request.reason) app.decisionReason = request.reason.trim();
      decisions.set(key, { fingerprint, result: structuredClone(app) }); return structuredClone(app);
    },
    async closeRegistration(companyId, caseId, request) {
      await check(companyId, true); const item = getCase(companyId, caseId); version(item, request.expectedVersion);
      if (!snapshot(companyId, caseId).permissions.closeRegistration) fail('denied', 'Закрытие набора недоступно.');
      item.status = 'REGISTRATION_CLOSED'; bump(item);
    },
    async startExecution(companyId, caseId, request) {
      await check(companyId, true); const item = getCase(companyId, caseId); version(item, request.expectedCaseVersion);
      if (!snapshot(companyId, caseId).permissions.startExecution) fail('denied', 'Для запуска нужен закрытый набор, допущенная заявка и этап с контрольной точкой.');
      item.status = 'EXECUTING'; bump(item);
    }
  };
  return { repository, workflow };
}
