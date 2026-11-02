import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { ErrorState, LoadingState } from '../../../components/feedback/States';
import type { CaseApplication, CompanyStudentProfile } from './contracts.generated';
import type { WorkflowRepository, CaseSnapshot, RunAction } from './repository';
import { applicationStatuses } from './viewHelpers';
import { QuotaSummary } from './QuotaSummary';

type Props = { workflow: WorkflowRepository; companyId: string; caseId: string; applicationId: string;
  snapshot: CaseSnapshot; revision: number; busy: boolean; run: RunAction };
type Details = { app: CaseApplication; participants: { id: string; profile: CompanyStudentProfile | null }[] };

export function ApplicationDetails({ workflow, companyId, caseId, applicationId, snapshot, revision, busy, run }: Props) {
  const [data, setData] = useState<Details | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [decision, setDecision] = useState<'ADMIT' | 'REJECT' | null>(null);
  const [reason, setReason] = useState('');
  const [decisionError, setDecisionError] = useState('');
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const reasonId = useId();
  useEffect(() => { if (decisionError) errorRef.current?.focus(); }, [decisionError]);
  useEffect(() => {
    let alive = true; setData(null); setError('');
    workflow.application(companyId, caseId, applicationId).then(async (app) => {
      const profiles = await Promise.allSettled(app.participantUserIds.map((id) => workflow.profile(companyId, id)));
      if (alive) setData({ app, participants: app.participantUserIds.map((id, index) => {
        const result = profiles[index];
        return { id, profile: result.status === 'fulfilled' ? result.value : null };
      }) });
    }).catch((failure: unknown) => { if (alive) setError(failure instanceof Error ? failure.message : 'Не удалось открыть заявку.'); });
    return () => { alive = false; };
  }, [workflow, companyId, caseId, applicationId, revision, retry]);
  if (error) return <ErrorState title="Заявка недоступна" description={error} action={<Button onClick={() => setRetry((value) => value + 1)}>Повторить</Button>} />;
  if (!data) return <LoadingState />;
  const { app, participants } = data;
  const canDecide = snapshot.permissions.decide && app.status === 'SUBMITTED' && app.allowedActions.includes('demo:decide');
  const used = app.format === 'TEAM' ? snapshot.admittedTeams : snapshot.admittedSolo;
  const limit = app.format === 'TEAM' ? snapshot.item.maxAdmittedTeams : snapshot.item.maxAdmittedSolo;
  const full = limit !== undefined && limit !== null && used >= limit;
  function openDecision(action: 'ADMIT' | 'REJECT') {
    setDecision(action); setReason(''); setDecisionError(''); attempt.current = null;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!decision || !canDecide || busy) return;
    setDecisionError('');
    if (decision === 'REJECT' && !reason.trim()) { setDecisionError('Укажите причину отклонения.'); return; }
    const request = { action: decision, expectedVersion: app.version, ...(decision === 'REJECT' ? { reason: reason.trim() } : {}) };
    const signature = JSON.stringify({ applicationId, request });
    if (attempt.current?.signature !== signature) attempt.current = { signature, key: crypto.randomUUID() };
    const key = attempt.current.key;
    const ok = await run(async () => {
      try { await workflow.decide(companyId, applicationId, request, key); }
      catch (failure) { setDecisionError(failure instanceof Error ? failure.message : 'Не удалось сохранить решение.'); throw failure; }
    }, decision === 'ADMIT' ? 'Заявка допущена.' : 'Заявка отклонена.');
    if (ok) setDecision(null);
  }
  return <section>
    <Link to={`/company/cases/${caseId}/applications`}>← К списку заявок</Link>
    <h2>{app.format === 'TEAM' ? 'Командная заявка' : 'Соло-заявка'} · {app.id.slice(-4)}</h2>
    <p>Статус заявки: {applicationStatuses[app.status]} · версия {app.version}</p>
    <QuotaSummary snapshot={snapshot} />
    <h3>Сопроводительное письмо</h3><p>{app.coverLetter || 'Письмо не предоставлено.'}</p>
    {app.decisionReason && <p>Причина решения: {app.decisionReason}</p>}
    <h3>Подтверждённый состав при подаче</h3>
    {!participants.length && <p>Сведения об участниках не предоставлены. Не принимать решение без проверки состава.</p>}
    <div className="workflow__cards">{participants.map(({ id, profile }) => <Card key={id}>
      {!profile ? <p>Профиль участника недоступен. <Button variant="secondary" onClick={() => setRetry((value) => value + 1)}>Повторить загрузку профиля</Button></p>
        : <><h4>{profile.fullName}</h4><p>Никнейм: {profile.publicProfile.nickname}</p>
          <p>Группа: {profile.studyGroup ?? 'Не указано'} · курс: {profile.course ?? 'Не указано'}</p>
          <h5>Навыки и технологии</h5>
          <p>{profile.publicProfile.skillIds.length ? 'Демонстрационный навык: разработка интерфейсов.' : 'Навыки не указаны.'}</p>
          <p>{profile.publicProfile.technologyIds.length ? 'Демонстрационная технология: React.' : 'Технологии не указаны.'}</p>
          <h5>Предыдущий опыт — публичное описание</h5><p>{profile.publicProfile.publicSummary || 'Не указан.'}</p>
          <div className="workflow__actions"><Link to={`/students/${id}`}>Публичный профиль</Link><Link to={`/students/${id}/portfolio`}>Портфолио участника</Link></div>
          <small>Портфолио открывается в общем разделе; наличие опубликованных работ проверяется отдельно.</small>
        </>}
    </Card>)}</div>
    {snapshot.item.admissionMode === 'OPEN' && <p>Свободный набор: автодопуск при подаче. Ручные решения не применяются.</p>}
    {canDecide && <div className="workflow__actions">
      <Button disabled={busy || full || participants.length === 0} onClick={() => openDecision('ADMIT')}>Принять</Button>
      <Button variant="secondary" disabled={busy} onClick={() => openDecision('REJECT')}>Отклонить</Button>
      {full && <p>Мест для этого формата нет. После обновления данных доступность решения может измениться.</p>}
    </div>}
    {!canDecide && snapshot.item.admissionMode !== 'OPEN' && <p>Решение недоступно по правам, статусу заявки или состоянию набора.</p>}
    <Modal open={decision !== null} title={decision === 'REJECT' ? 'Отклонить заявку?' : 'Принять заявку?'} onClose={() => { if (!busy) setDecision(null); }}>
      <form onSubmit={(event) => void submit(event)}>
        <p>{decision === 'REJECT' ? 'Заявитель не сможет подать повторную заявку на этот кейс. Укажите причину.'
          : app.format === 'TEAM' ? 'Будет занято одно командное место, независимо от числа участников.' : 'Будет занято одно соло-место.'}</p>
        {decision === 'REJECT' && <div className="field"><label htmlFor={reasonId}>Причина отклонения</label>
          <textarea id={reasonId} required maxLength={2000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} /></div>}
        {decisionError && <p ref={errorRef} role="alert" tabIndex={-1}>{decisionError} Решение не подтверждено; при конфликте закройте окно и загрузите актуальные данные.</p>}
        <div className="workflow__actions"><Button type="button" variant="secondary" disabled={busy} onClick={() => setDecision(null)}>Отмена</Button>
          <Button type="submit" disabled={busy || !canDecide}>{busy ? 'Сохранение…' : decision === 'REJECT' ? 'Подтвердить отклонение' : 'Подтвердить допуск'}</Button></div>
      </form>
    </Modal>
  </section>;
}
