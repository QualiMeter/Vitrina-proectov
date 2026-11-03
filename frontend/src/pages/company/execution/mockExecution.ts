import type { DemoMode } from '../cases/mockRepository';
import { demoCompanyId, demoUserId } from '../cases/mockRepository';
import type { CaseCheckpoint, SubmissionVersionList } from '../workflow/contracts.generated';
import { WorkflowError } from '../workflow/repository';
import { executionCaseId, evaluationCaseId, type ExecutionRepository, type ExecutionSnapshot } from './repository';
export { executionCaseId, evaluationCaseId } from './repository';

const uid = (n: number) => `d4000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const stamp = '2026-11-03T09:00:00Z';
const copy = <T,>(value: T): T => structuredClone(value);
function fail(kind: ConstructorParameters<typeof WorkflowError>[0], message: string): never {
  throw new WorkflowError(kind, message);
}

/** Isolated in-memory fixtures. No HTTP, real identities, authorization or persistence. */
export function createExecutionDemo(mode: DemoMode = 'normal'): ExecutionRepository {
  const cases = new Map<string, ExecutionSnapshot>();
  const histories = new Map<string, SubmissionVersionList>();
  const files = new Map<string, { caseId: string; text: string }>();
  const repetitions = new Map<string, string>();
  let conflictPending = mode === 'conflict';
  for (const [index, caseId] of [executionCaseId, evaluationCaseId].entries()) {
    const checkpoint = (n: number, kind: CaseCheckpoint['kind']): CaseCheckpoint => ({
      id: uid(index * 100 + n), caseId, stageId: uid(index * 100 + n + 10), version: 1,
      title: kind === 'SELECTION' ? 'Отбор прототипов' : 'Финальная сдача', kind,
      deadline: '2026-11-10T15:00:00Z', intakeStatus: index ? 'CLOSED' : 'OPEN',
      ...(kind === 'SELECTION' ? { selectionLimit: 2, soloSelectionLimit: 1 } : {}), allowedActions: [],
    });
    const points = [checkpoint(20, 'SELECTION'), checkpoint(21, 'FINAL')];
    if (index) points[0].intakeStatus = 'SELECTION_CLOSED';
    const participants: ExecutionSnapshot['participants'] = mode === 'empty' ? [] : Array.from({ length: 6 }, (_, n) => ({
      applicationId: uid(index * 100 + 40 + n),
      ...(n < 4 ? { teamId: uid(index * 100 + 50 + n) } : {}),
      name: n < 4 ? ['Альфа', 'Бета', 'Гамма', 'Дельта'][n] : `Соло ${n - 3}`,
      format: n < 4 ? 'TEAM' : 'SOLO',
      status: n === 3 ? 'ELIMINATED' : 'ACTIVE',
    }));
    cases.set(caseId, {
      title: index ? 'Итоги: городской сервис' : 'Выполнение: городской сервис',
      dashboard: {
        caseId, status: index ? 'EVALUATING' : 'EXECUTING', caseVersion: 1,
        activeTeamCount: 0, eliminatedTeamCount: 0, excludedTeamCount: 0, admittedSoloCount: 0, teams: [],
        stages: points.map((point, i) => ({ id: point.stageId, caseId, version: 1, sequence: i + 1,
          kind: i ? 'FINAL' : 'WORK', title: i ? 'Финальный этап' : 'Прототип',
          availableFrom: stamp, checkpoints: [point], materials: [] })),
      }, participants, canManage: mode !== 'read-only', reviews: [],
      rules: { allowSharedPlaces: index === 0, prizePlaceCount: 3, nominationNames: ['Лучший интерфейс'], scoreRange: { min: 0, max: 10 } },
      awards: { caseId, version: 0, placements: [], nominations: [] },
    });
    for (const p of participants) for (const point of points) {
      const fileId = uid(index * 1000 + Number(p.applicationId.slice(-3)) * 10 + (point.kind === 'FINAL' ? 1 : 0));
      const text = `Демонстрационный файл команды ${p.name}. Реальные материалы не подключены.`;
      files.set(fileId, { caseId, text });
      histories.set(`${point.id}:${p.applicationId}`, {
        latestVersion: 2,
        items: [1, 2].map(version => ({ id: uid(index * 10000 + Number(fileId.slice(-4)) * 10 + version),
          checkpointId: point.id, applicationId: p.applicationId, version, submittedByUserId: demoUserId,
          submittedAt: version === 1 ? stamp : '2026-11-11T09:00:00Z', isLate: version === 2,
          description: `Прототип, версия ${version}.`, links: [{ label: 'Репозиторий', url: 'https://github.com/QualiMeter/Vitrina-proectov' }],
          attachments: [{ id: fileId, displayName: 'Демо-описание.txt', contentType: 'text/plain', sizeBytes: new Blob([text]).size,
            purpose: 'SUBMISSION_ATTACHMENT', status: 'READY', createdAt: stamp }],
        })),
      });
    }
  }
  function get(companyId: string, caseId: string, write = false) {
    if (companyId !== demoCompanyId || mode === 'denied' || (write && mode === 'read-only')) fail('denied', '403: нет прав на действие или компанию.');
    if (mode === 'error' || (write && mode === 'save-error')) fail('network', 'Ошибка соединения. Ввод сохранён; повторите действие.');
    const data = cases.get(caseId);
    if (!data) fail('notFound', '404: демонстрационный кейс не найден.');
    if (write && conflictPending) { data.dashboard.caseVersion++; conflictPending = false; fail('conflict', '409: данные изменились. Загрузите актуальные версии и проверьте решение.'); }
    return data;
  }
  function version(actual: number, expected: number) {
    if (actual !== expected) fail('conflict', '409: устаревшая версия. Загрузите актуальные данные.');
  }
  function executing(data: ExecutionSnapshot) {
    if (data.dashboard.status !== 'EXECUTING') fail('conflict', '409: выполнение кейса уже закрыто.');
  }
  function evaluating(data: ExecutionSnapshot) {
    if (data.dashboard.status !== 'EVALUATING') fail('conflict', '409: отзывы и места доступны только во время оценивания.');
  }
  function point(data: ExecutionSnapshot, id: string) {
    const points = data.dashboard.stages.flatMap(stage => stage.checkpoints);
    const item = points.find(entry => entry.id === id);
    if (!item) fail('notFound', '404: точка не принадлежит кейсу.');
    return { item, points };
  }
  function repeat(key: string, payload: unknown, operation: () => void) {
    if (!key || key.length > 120) fail('validation', 'Некорректный ключ повтора.');
    const fingerprint = JSON.stringify(payload);
    if (repetitions.has(key)) {
      if (repetitions.get(key) !== fingerprint) fail('conflict', '409: ключ уже использован с другим запросом.');
      return;
    }
    operation(); repetitions.set(key, fingerprint);
  }
  function eligible(data: ExecutionSnapshot, applicationId: string) {
    const p = data.participants.find(entry => entry.applicationId === applicationId && entry.status === 'ACTIVE');
    if (!p) fail('validation', 'Участник не допущен к оцениванию.');
    return p;
  }
  return {
    async snapshot(companyId, caseId) {
      const data = copy(get(companyId, caseId)); const people = data.participants;
      data.dashboard.teams = people.filter(p => p.teamId).map(p => ({ teamId: p.teamId!, captainUserId: demoUserId, status: p.status }));
      data.dashboard.activeTeamCount = people.filter(p => p.format === 'TEAM' && p.status === 'ACTIVE').length;
      data.dashboard.eliminatedTeamCount = people.filter(p => p.format === 'TEAM' && p.status === 'ELIMINATED').length;
      data.dashboard.excludedTeamCount = people.filter(p => p.status === 'EXCLUDED').length;
      data.dashboard.admittedSoloCount = people.filter(p => p.format === 'SOLO' && p.status === 'ACTIVE').length;
      return data;
    },
    async versions(companyId, caseId, checkpointId, applicationId) {
      const data = get(companyId, caseId); point(data, checkpointId);
      if (!data.participants.some(p => p.applicationId === applicationId)) fail('notFound', '404: сдача не принадлежит кейсу.');
      return copy(histories.get(`${checkpointId}:${applicationId}`) ?? { items: [], latestVersion: 0 });
    },
    async file(companyId, caseId, fileId) {
      get(companyId, caseId); const file = files.get(fileId);
      if (!file || file.caseId !== caseId) fail('notFound', '404: файл недоступен.');
      return new Blob([file.text], { type: 'text/plain;charset=utf-8' });
    },
    async closeCheckpoint(companyId, caseId, checkpointId, request, key) {
      const data = get(companyId, caseId, true);
      repeat(key, { caseId, checkpointId, request, action: 'close-checkpoint' }, () => {
        executing(data); const { item } = point(data, checkpointId); version(item.version, request.expectedVersion);
        if (item.kind !== 'REGULAR' || item.intakeStatus !== 'OPEN') fail('conflict', '409: обычная точка недоступна.');
        item.intakeStatus = 'CLOSED'; item.closedAt = new Date().toISOString(); item.version++;
      });
    },
    async select(companyId, caseId, checkpointId, request, key) {
      const data = get(companyId, caseId, true);
      repeat(key, { caseId, checkpointId, request }, () => {
        executing(data); const { item, points } = point(data, checkpointId); version(item.version, request.expectedVersion);
        if (item.kind !== 'SELECTION' || item.intakeStatus !== 'OPEN' || points.slice(0, points.indexOf(item)).some(p => p.intakeStatus === 'OPEN')) fail('conflict', '409: отбор уже закрыт или ещё недоступен.');
        const teams = request.passingTeamIds, solo = request.passingSoloApplicationIds ?? [];
        if (new Set(teams).size !== teams.length || new Set(solo).size !== solo.length || teams.length > (item.selectionLimit ?? 0) || solo.length > (item.soloSelectionLimit ?? 0)) fail('validation', 'Превышен лимит N или повторяется участник.');
        if (!data.participants.some(p => p.status === 'ACTIVE')) fail('validation', 'Нет активных участников.');
        if (teams.some(id => !data.participants.some(p => p.teamId === id && p.status === 'ACTIVE')) || solo.some(id => !data.participants.some(p => p.applicationId === id && p.format === 'SOLO' && p.status === 'ACTIVE'))) fail('validation', 'Выбран недопустимый участник.');
        for (const p of data.participants) if (p.status === 'ACTIVE' && !(p.teamId ? teams.includes(p.teamId) : solo.includes(p.applicationId))) p.status = 'ELIMINATED';
        item.intakeStatus = 'SELECTION_CLOSED'; item.closedAt = new Date().toISOString(); item.version++;
      });
    },
    async exclude(companyId, caseId, teamId, request, key) {
      const data = get(companyId, caseId, true);
      repeat(key, { caseId, teamId, request }, () => {
        executing(data); version(data.dashboard.caseVersion, request.expectedCaseVersion);
        if (!request.reason.trim() || request.reason.length > 2000) fail('validation', 'Причина обязательна: от 1 до 2000 символов.');
        const p = data.participants.find(p => p.teamId === teamId && p.status === 'ACTIVE');
        if (!p) fail('conflict', '409: исключить можно только активную команду этого кейса.');
        p.status = 'EXCLUDED'; p.exclusion = { teamId, status: 'EXCLUDED', reason: request.reason.trim(), excludedAt: new Date().toISOString(), excludedByUserId: demoUserId };
        data.dashboard.caseVersion++;
      });
    },
    async closeFinal(companyId, caseId, request, key) {
      const data = get(companyId, caseId, true);
      repeat(key, { caseId, request, action: 'close-final' }, () => {
        executing(data); version(data.dashboard.caseVersion, request.expectedCaseVersion);
        const points = data.dashboard.stages.flatMap(stage => stage.checkpoints);
        if (!points.some(p => p.kind === 'FINAL') || points.some(p => p.kind !== 'FINAL' && p.intakeStatus === 'OPEN')) fail('conflict', '409: сначала завершите предыдущие контрольные точки.');
        points.filter(p => p.kind === 'FINAL').forEach(p => { p.intakeStatus = 'CLOSED'; p.closedAt = new Date().toISOString(); p.version++; });
        data.dashboard.status = 'FINAL_CLOSED'; data.dashboard.caseVersion++;
      });
    },
    async beginEvaluation(companyId, caseId, request, key) {
      const data = get(companyId, caseId, true);
      repeat(key, { caseId, request, action: 'evaluate' }, () => {
        version(data.dashboard.caseVersion, request.expectedCaseVersion);
        if (data.dashboard.status !== 'FINAL_CLOSED') fail('conflict', '409: сначала завершите финальный приём.');
        data.dashboard.status = 'EVALUATING'; data.dashboard.caseVersion++;
      });
    },
    async review(companyId, caseId, applicationId, request) {
      const data = get(companyId, caseId, true); evaluating(data); eligible(data, applicationId);
      const previous = data.reviews.find(r => r.applicationId === applicationId); version(previous?.version ?? 0, request.expectedReviewVersion);
      if (!request.feedback.trim() || request.feedback.length > 10000) fail('validation', 'Отзыв: от 1 до 10000 символов.');
      const range = data.rules.scoreRange;
      if (request.score != null && (!Number.isFinite(request.score) || !range || request.score < range.min || request.score > range.max)) fail('validation', 'Оценка вне опубликованной шкалы.');
      const review = { applicationId, caseId, version: (previous?.version ?? 0) + 1, feedback: request.feedback.trim(), score: request.score ?? null, updatedAt: new Date().toISOString(), isPublished: false };
      data.reviews = [...data.reviews.filter(r => r.applicationId !== applicationId), review];
    },
    async awards(companyId, caseId, request) {
      const data = get(companyId, caseId, true); evaluating(data); version(data.awards.version, request.expectedAwardsVersion);
      if (request.placements.length > 1000 || request.nominations.length > 1000 || new Set(request.placements.map(p => p.applicationId)).size !== request.placements.length) fail('validation', 'Недопустимые или повторяющиеся места.');
      for (const p of request.placements) { eligible(data, p.applicationId); if (!Number.isInteger(p.place) || p.place < 1 || p.place > data.rules.prizePlaceCount) fail('validation', 'Место не предусмотрено правилами конкурса.'); }
      if (!data.rules.allowSharedPlaces && new Set(request.placements.map(p => p.place)).size !== request.placements.length) fail('validation', 'Правила конкурса запрещают совместные места.');
      if (new Set(request.nominations.map(n => `${n.applicationId}:${n.nomination}`)).size !== request.nominations.length) fail('validation', 'Номинация повторяется.');
      for (const n of request.nominations) { eligible(data, n.applicationId); if (!data.rules.nominationNames.includes(n.nomination)) fail('validation', 'Номинация не предусмотрена правилами.'); }
      data.awards = { caseId, version: data.awards.version + 1, placements: copy(request.placements), nominations: copy(request.nominations), updatedAt: new Date().toISOString() };
    },
  };
}
