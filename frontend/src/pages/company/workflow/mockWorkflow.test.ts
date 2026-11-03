import { describe, expect, it } from 'vitest';
import { createCompanyDemo, registrationCaseId, closedCaseId, openAdmissionCaseId } from './mockWorkflow';
import { demoCompanyId } from '../cases/mockRepository';

const draftId = 'a2000000-0000-4000-8000-000000000001';
const requestStage = { title: 'Прототип', kind: 'WORK' as const, sequence: 2, expectedCaseVersion: 1 };
const query = { page: 1, pageSize: 20 };

describe('day three demo enforces the contract boundary', () => {
  it('creates, edits, orders and deletes stages while advancing shared case versions', async () => {
    const { workflow, repository } = createCompanyDemo();
    const stage = await workflow.createStage(demoCompanyId, draftId, requestStage);
    expect((await repository.get(demoCompanyId, draftId)).version).toBe(2);
    await workflow.updateStage(demoCompanyId, stage.id, { expectedCaseVersion: 2, expectedVersion: 1, title: 'Прототип 2', sequence: 3 });
    await expect(workflow.updateStage(demoCompanyId, stage.id, { expectedCaseVersion: 3, expectedVersion: 2, sequence: 1 })).rejects.toMatchObject({ kind: 'validation' });
    expect((await workflow.stages(demoCompanyId, draftId)).items.map((item) => item.sequence)).toEqual([1, 3]);
    await workflow.deleteStage(demoCompanyId, stage.id, { expectedCaseVersion: 3 });
    expect((await workflow.stages(demoCompanyId, draftId)).items).toHaveLength(1);
    expect((await repository.get(demoCompanyId, draftId)).version).toBe(4);
  });
  it('validates independent selection quotas, forbids quotas on regular points, and permits an empty stage list', async () => {
    const { workflow } = createCompanyDemo();
    const initial = await workflow.stages(demoCompanyId, draftId);
    const stage = initial.items[0];
    const point = { expectedCaseVersion: 1, title: 'Отбор', kind: 'SELECTION' as const, deadline: '2027-01-01T10:00:00Z' };
    await expect(workflow.createCheckpoint(demoCompanyId, stage.id, { ...point, selectionLimit: 2 })).rejects.toMatchObject({ kind: 'validation' });
    await expect(workflow.createCheckpoint(demoCompanyId, stage.id, { ...point, kind: 'REGULAR', selectionLimit: 2 })).rejects.toMatchObject({ kind: 'validation' });
    await workflow.createCheckpoint(demoCompanyId, stage.id, { ...point, selectionLimit: 2, soloSelectionLimit: 0 });
    const selection = (await workflow.stages(demoCompanyId, draftId)).items[0].checkpoints.find((item) => item.kind === 'SELECTION')!;
    expect(selection.soloSelectionLimit).toBe(0);
    await workflow.updateCheckpoint(demoCompanyId, selection.id, { expectedCaseVersion: 2, expectedVersion: 1, title: 'Новый отбор', selectionLimit: 3 });
    await expect(workflow.deleteStage(demoCompanyId, stage.id, { expectedCaseVersion: 3 })).rejects.toMatchObject({ kind: 'validation' });
    await workflow.deleteCheckpoint(demoCompanyId, selection.id, { expectedCaseVersion: 3 });
    await workflow.deleteCheckpoint(demoCompanyId, stage.checkpoints[0].id, { expectedCaseVersion: 4 });
    await workflow.deleteStage(demoCompanyId, stage.id, { expectedCaseVersion: 5 });
    expect((await workflow.stages(demoCompanyId, draftId)).items).toEqual([]);
  });
  it('forbids another company, read-only mutations and changes after publication', async () => {
    const normal = createCompanyDemo().workflow;
    await expect(normal.snapshot('foreign-company', registrationCaseId)).rejects.toMatchObject({ kind: 'denied' });
    await expect(normal.createStage(demoCompanyId, registrationCaseId, requestStage)).rejects.toMatchObject({ kind: 'denied' });
    const readOnly = createCompanyDemo('read-only').workflow;
    expect((await readOnly.snapshot(demoCompanyId, registrationCaseId)).permissions.closeRegistration).toBe(false);
    await expect(readOnly.closeRegistration(demoCompanyId, registrationCaseId, { expectedVersion: 1 })).rejects.toMatchObject({ kind: 'denied' });
    await expect(createCompanyDemo('denied').workflow.stages(demoCompanyId, draftId)).rejects.toMatchObject({ kind: 'denied' });
  });
  it('filters before pagination and preserves the submitted participant snapshot', async () => {
    const workflow = createCompanyDemo().workflow;
    const first = await workflow.applications(demoCompanyId, registrationCaseId, { page: 1, pageSize: 2, status: 'SUBMITTED' });
    const next = await workflow.applications(demoCompanyId, registrationCaseId, { page: 2, pageSize: 2, status: 'SUBMITTED' });
    expect(first.total).toBe(3); expect(first.items).toHaveLength(2); expect(next.items).toHaveLength(1);
    const solo = await workflow.applications(demoCompanyId, registrationCaseId, { ...query, status: 'SUBMITTED', format: 'SOLO' });
    expect(solo.items).toHaveLength(2);
    const app = first.items[0];
    const originalMembers = [...app.participantUserIds]; app.participantUserIds.length = 0;
    expect((await workflow.application(demoCompanyId, registrationCaseId, app.id)).participantUserIds).toEqual(originalMembers);
  });
  it('protects the last solo place under competing admissions and reuses idempotency keys', async () => {
    const workflow = createCompanyDemo().workflow;
    const solo = await workflow.applications(demoCompanyId, registrationCaseId, { ...query, status: 'SUBMITTED', format: 'SOLO' });
    const request = { action: 'ADMIT' as const, expectedVersion: 1 };
    const results = await Promise.allSettled(solo.items.map((app, index) => workflow.decide(demoCompanyId, app.id, request, `key-${index}`)));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const snapshot = await workflow.snapshot(demoCompanyId, registrationCaseId);
    expect(snapshot.admittedSolo).toBe(1); expect(snapshot.admittedTeams).toBe(1);
    const repeated = await workflow.decide(demoCompanyId, solo.items[0].id, request, 'key-0');
    expect(repeated.status).toBe('ADMITTED');
    expect((await workflow.snapshot(demoCompanyId, registrationCaseId)).admittedSolo).toBe(1);
    await expect(workflow.decide(demoCompanyId, solo.items[0].id, { action: 'REJECT', expectedVersion: 2, reason: 'Другое решение' }, 'key-0')).rejects.toMatchObject({ kind: 'conflict' });
  });
  it('counts a team as one place and requires a rejection reason', async () => {
    const workflow = createCompanyDemo().workflow;
    const app = (await workflow.applications(demoCompanyId, registrationCaseId, { ...query, status: 'SUBMITTED', format: 'TEAM' })).items[0];
    expect(app.participantUserIds).toHaveLength(2);
    await expect(workflow.decide(demoCompanyId, app.id, { action: 'REJECT', expectedVersion: 1 }, 'reject-1')).rejects.toMatchObject({ kind: 'validation' });
    await workflow.decide(demoCompanyId, app.id, { action: 'ADMIT', expectedVersion: 1 }, 'admit-1');
    expect((await workflow.snapshot(demoCompanyId, registrationCaseId)).admittedTeams).toBe(2);
    expect((await workflow.application(demoCompanyId, registrationCaseId, app.id)).participantUserIds).toEqual(app.participantUserIds);
  });
  it('blocks manual decisions for open admission and only starts after closing registration', async () => {
    const workflow = createCompanyDemo().workflow;
    const openApp = (await workflow.applications(demoCompanyId, openAdmissionCaseId, query)).items[0];
    await expect(workflow.decide(demoCompanyId, openApp.id, { action: 'ADMIT', expectedVersion: 1 }, 'open')).rejects.toMatchObject({ kind: 'denied' });
    await expect(workflow.startExecution(demoCompanyId, registrationCaseId, { expectedCaseVersion: 1 })).rejects.toMatchObject({ kind: 'denied' });
    await workflow.closeRegistration(demoCompanyId, registrationCaseId, { expectedVersion: 1 });
    expect((await workflow.snapshot(demoCompanyId, registrationCaseId)).permissions.startExecution).toBe(true);
    await workflow.startExecution(demoCompanyId, registrationCaseId, { expectedCaseVersion: 2 });
    expect((await workflow.snapshot(demoCompanyId, registrationCaseId)).item.status).toBe('EXECUTING');
    expect((await workflow.snapshot(demoCompanyId, closedCaseId)).permissions.startExecution).toBe(true);
  });
  it('rejects stale versions and simulated saving errors without losing existing values', async () => {
    const demo = createCompanyDemo('conflict');
    await expect(demo.workflow.createStage(demoCompanyId, draftId, requestStage)).rejects.toMatchObject({ kind: 'conflict' });
    expect((await demo.workflow.stages(demoCompanyId, draftId)).items).toHaveLength(1);
    const current = await demo.workflow.snapshot(demoCompanyId, draftId);
    await demo.workflow.createStage(demoCompanyId, draftId, { ...requestStage, expectedCaseVersion: current.item.version });
    await expect(createCompanyDemo('save-error').workflow.createStage(demoCompanyId, draftId, requestStage)).rejects.toMatchObject({ kind: 'network' });
    await expect(createCompanyDemo('empty').workflow.snapshot(demoCompanyId, draftId)).rejects.toMatchObject({ kind: 'notFound' });
  });
});
