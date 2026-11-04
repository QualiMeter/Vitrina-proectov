import { describe, expect, it } from 'vitest';
import { demoCompanyId as company } from '../cases/mockRepository';
import { createExecutionDemo, executionCaseId as caseId, evaluationCaseId as evaluation } from './mockExecution';

describe('day four execution boundaries', () => {
  it('checks company, case and write permissions independently of the UI', async () => {
    const repo = createExecutionDemo('read-only');
    await expect(repo.snapshot('another-company', caseId)).rejects.toThrow('403');
    await expect(repo.snapshot(company, 'missing')).rejects.toThrow('404');
    await expect(repo.closeFinal(company, caseId, { expectedCaseVersion: 1 }, 'key')).rejects.toThrow('403');
  });
  it('enforces independent limits, valid IDs and duplicates atomically', async () => {
    const repo = createExecutionDemo(); const data = await repo.snapshot(company, caseId);
    const point = data.dashboard.stages[0].checkpoints[0];
    const teams = data.participants.filter(p => p.teamId && p.status === 'ACTIVE').map(p => p.teamId!);
    const solo = data.participants.filter(p => p.format === 'SOLO').map(p => p.applicationId);
    const select = (passingTeamIds: string[], passingSoloApplicationIds: string[] = []) => repo.select(company, caseId, point.id, { expectedVersion: 1, passingTeamIds, passingSoloApplicationIds }, crypto.randomUUID());
    await expect(select(teams)).rejects.toThrow('лимит');
    await expect(select([], solo)).rejects.toThrow('лимит');
    await expect(select([teams[0], teams[0]])).rejects.toThrow('повторяется');
    await expect(select(['foreign-team'])).rejects.toThrow('недопустимый');
    expect((await repo.snapshot(company, caseId)).dashboard.activeTeamCount).toBe(3);
    const request = { expectedVersion: 1, passingTeamIds: teams.slice(0, 2), passingSoloApplicationIds: solo.slice(0, 1) };
    await repo.select(company, caseId, point.id, request, 'selection');
    await repo.select(company, caseId, point.id, request, 'selection');
    const result = await repo.snapshot(company, caseId);
    expect(result.dashboard.activeTeamCount).toBe(2);
    expect(result.dashboard.admittedSoloCount).toBe(1);
    expect(result.dashboard.stages[0].checkpoints[0].version).toBe(2);
    await expect(repo.select(company, caseId, point.id, { ...request, passingTeamIds: [] }, 'selection')).rejects.toThrow('409');
  });
  it('requires a nonblank exclusion reason, preserves it, and rejects old case versions', async () => {
    const repo = createExecutionDemo(); const data = await repo.snapshot(company, caseId);
    const team = data.participants[0].teamId!;
    await expect(repo.exclude(company, caseId, team, { expectedCaseVersion: 1, reason: '  ' }, 'blank')).rejects.toThrow('Причина');
    await repo.exclude(company, caseId, team, { expectedCaseVersion: 1, reason: 'Нарушение условий' }, 'exclude');
    const next = await repo.snapshot(company, caseId);
    expect(next.participants[0].exclusion?.reason).toBe('Нарушение условий');
    expect(next.dashboard.excludedTeamCount).toBe(1);
    await expect(repo.exclude(company, caseId, data.participants[1].teamId!, { expectedCaseVersion: 1, reason: 'Причина' }, 'old')).rejects.toThrow('409');
  });
  it('keeps immutable submission versions and checks checkpoint/application/file ownership', async () => {
    const repo = createExecutionDemo(); const data = await repo.snapshot(company, caseId);
    const point = data.dashboard.stages[0].checkpoints[0], app = data.participants[0].applicationId;
    const history = await repo.versions(company, caseId, point.id, app);
    expect(history.items.map(v => v.version)).toEqual([1, 2]);
    expect(history.items.map(v => v.isLate)).toEqual([false, true]);
    history.items[0].description = 'tampered';
    expect((await repo.versions(company, caseId, point.id, app)).items[0].description).not.toBe('tampered');
    await expect(repo.versions(company, caseId, point.id, 'foreign-app')).rejects.toThrow('404');
    await expect(repo.file(company, evaluation, history.items[0].attachments[0].id)).rejects.toThrow('404');
    expect((await repo.file(company, caseId, history.items[0].attachments[0].id)).size).toBeGreaterThan(0);
  });
  it('requires selection before final closing, then explicit evaluation', async () => {
    const repo = createExecutionDemo(); const data = await repo.snapshot(company, caseId);
    await expect(repo.closeFinal(company, caseId, { expectedCaseVersion: 1 }, 'close')).rejects.toThrow('предыдущие');
    await repo.select(company, caseId, data.dashboard.stages[0].checkpoints[0].id, { expectedVersion: 1, passingTeamIds: [data.participants[0].teamId!] }, 'select');
    await repo.closeFinal(company, caseId, { expectedCaseVersion: 1 }, 'close');
    await repo.closeFinal(company, caseId, { expectedCaseVersion: 1 }, 'close');
    expect((await repo.snapshot(company, caseId)).dashboard.status).toBe('FINAL_CLOSED');
    await repo.beginEvaluation(company, caseId, { expectedCaseVersion: 2 }, 'begin');
    expect((await repo.snapshot(company, caseId)).dashboard.status).toBe('EVALUATING');
    await expect(repo.exclude(company, caseId, data.participants[0].teamId!, { expectedCaseVersion: 3, reason: 'Причина' }, 'exclude')).rejects.toThrow('409');
  });
  it('supports optional score removal and versioned feedback without automatic placements', async () => {
    const repo = createExecutionDemo(); const data = await repo.snapshot(company, evaluation); const app = data.participants[0].applicationId;
    await expect(repo.review(company, evaluation, app, { expectedReviewVersion: 0, feedback: ' ', score: 5 })).rejects.toThrow('Отзыв');
    await expect(repo.review(company, evaluation, app, { expectedReviewVersion: 0, feedback: 'Отзыв', score: 11 })).rejects.toThrow('шкалы');
    await repo.review(company, evaluation, app, { expectedReviewVersion: 0, feedback: 'Отзыв', score: 10 });
    await expect(repo.review(company, evaluation, app, { expectedReviewVersion: 0, feedback: 'Другой' })).rejects.toThrow('409');
    await repo.review(company, evaluation, app, { expectedReviewVersion: 1, feedback: 'Дополненный отзыв', score: null });
    const result = await repo.snapshot(company, evaluation);
    expect(result.reviews[0].score).toBeNull(); expect(result.reviews[0].version).toBe(2); expect(result.awards.placements).toEqual([]);
  });
  it('validates published places, eligibility, nominations and shared-place policy', async () => {
    const repo = createExecutionDemo(); const data = await repo.snapshot(company, evaluation);
    const placements = data.participants.slice(0, 2).map(p => ({ applicationId: p.applicationId, place: 1 }));
    await expect(repo.awards(company, evaluation, { expectedAwardsVersion: 0, placements, nominations: [] })).rejects.toThrow('совместные');
    await expect(repo.awards(company, evaluation, { expectedAwardsVersion: 0, placements: [{ ...placements[0], place: 4 }], nominations: [] })).rejects.toThrow('Место');
    await expect(repo.awards(company, evaluation, { expectedAwardsVersion: 0, placements: [{ applicationId: data.participants[3].applicationId, place: 1 }], nominations: [] })).rejects.toThrow('не допущен');
    await expect(repo.awards(company, evaluation, { expectedAwardsVersion: 0, placements: [], nominations: [{ applicationId: placements[0].applicationId, nomination: 'Выдуманная' }] })).rejects.toThrow('Номинация');
    await repo.awards(company, evaluation, { expectedAwardsVersion: 0, placements: [placements[0]], nominations: [] });
    await expect(repo.awards(company, evaluation, { expectedAwardsVersion: 0, placements: [], nominations: [] })).rejects.toThrow('409');
  });
  it('allows several winners of a place only under shared-place rules', async () => {
    const repo = createExecutionDemo(); const data = await repo.snapshot(company, caseId);
    await repo.select(company, caseId, data.dashboard.stages[0].checkpoints[0].id, { expectedVersion: 1, passingTeamIds: data.participants.slice(0, 2).map(p => p.teamId!) }, 's');
    await repo.closeFinal(company, caseId, { expectedCaseVersion: 1 }, 'c'); await repo.beginEvaluation(company, caseId, { expectedCaseVersion: 2 }, 'e');
    const placements = data.participants.slice(0, 2).map(p => ({ applicationId: p.applicationId, place: 1 }));
    await repo.awards(company, caseId, { expectedAwardsVersion: 0, placements, nominations: [] });
    expect((await repo.snapshot(company, caseId)).awards.placements).toEqual(placements);
  });
});
