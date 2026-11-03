import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../../components/feedback/States';
import type { DemoContext } from '../cases/CompanyCasesPage';
import { WorkflowError, type CaseSnapshot, type WorkflowRepository, type RunAction } from './repository';
import type { CaseStage, CaseApplication } from './contracts.generated';
import { applicationStatuses } from './viewHelpers';
import { QuotaSummary } from './QuotaSummary';
import { StageEditor } from './StageEditor';
import { ApplicationDetails } from './ApplicationDetails';
import './workflow.css';
import { caseStatusLabels } from '../../public/Cases/statusLabels';

type Pending = { title: string; description: string; confirm: () => Promise<unknown> };
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Не удалось загрузить данные.';

export function CompanyWorkflowPage({ view }: { view: 'overview' | 'stages' | 'applications' }) {
  const { workflow, companyId } = useOutletContext<DemoContext>();
  const { caseId = '', applicationId } = useParams();
  const [data, setData] = useState<{ snapshot: CaseSnapshot; stages: CaseStage[] } | null>(null);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<Pending | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  const load = useCallback(async () => {
    const [snapshot, stages] = await Promise.all([workflow.snapshot(companyId, caseId), workflow.stages(companyId, caseId)]);
    return { snapshot, stages: stages.items };
  }, [workflow, companyId, caseId]);
  useEffect(() => {
    let alive = true;
    setData(null); setError(''); setNotice(''); setPending(null); setConflict(false);
    load().then((result) => { if (alive) setData(result); }).catch((reason: unknown) => { if (alive) setError(errorText(reason)); });
    return () => { alive = false; };
  }, [load]);
  async function reload() {
    setBusy(true); setError(''); setConflict(false); setPending(null); setNotice('');
    try { setData(await load()); setRevision((value) => value + 1); }
    catch (reason) { setError(errorText(reason)); } finally { setBusy(false); }
  }
  const run: RunAction = async (operation, success) => {
    if (busy) return false;
    setBusy(true); setError(''); setConflict(false); setNotice('');
    try {
      await operation(); setData(await load()); setRevision((value) => value + 1);
      setNotice(`${success} Изменены только демонстрационные данные.`); return true;
    } catch (reason) {
      setError(errorText(reason)); setConflict(reason instanceof WorkflowError && ['conflict', 'quota'].includes(reason.kind)); return false;
    } finally { setBusy(false); }
  };
  const errorBlock = error && <div ref={errorRef} role="alert" tabIndex={-1} className="workflow__error">
    {error}{conflict && <p>Проверьте актуальные версии и свободные места. Ввод не заменяется автоматически.</p>}
    <Button variant="secondary" disabled={busy} onClick={() => void reload()}>Загрузить актуальные данные</Button>
  </div>;
  if (!data) return <section><Link to="/company/cases">← Мои кейсы</Link>
    {error ? <ErrorState title="Данные кейса недоступны" description={error} action={<Button disabled={busy} onClick={() => void reload()}>Повторить</Button>} /> : <LoadingState />}
  </section>;
  const { snapshot, stages } = data;
  const root = `/company/cases/${caseId}`;
  return <section className="workflow">
    <Link to="/company/cases">← Мои кейсы</Link>
    <h1>{snapshot.item.title}</h1>
    <p>Статус: {caseStatusLabels[snapshot.item.status]} · версия {snapshot.item.version}</p>
    <nav aria-label="Разделы кейса" className="workflow__nav">
      <ButtonLink to={`${root}/manage`} variant={view === 'overview' ? 'primary' : 'secondary'}>Управление</ButtonLink>
      <ButtonLink to={`${root}/stages`} variant={view === 'stages' ? 'primary' : 'secondary'}>Этапы и контрольные точки</ButtonLink>
      <ButtonLink to={`${root}/applications`} variant={view === 'applications' ? 'primary' : 'secondary'}>Заявки</ButtonLink>
      {snapshot.permissions.editStages && <ButtonLink to={`${root}/edit`} variant="secondary">Условия кейса</ButtonLink>}
    </nav>
    {!pending && errorBlock}
    {notice && <p role="status" className="workflow__success">{notice}</p>}
    {view === 'overview' && <>
      <h2>Набор и запуск</h2>
      <QuotaSummary snapshot={snapshot} />
      <p>Редактирование этапов доступно до публикации. Запуск разрешён после закрытия набора,
        при наличии допущенных участников и настроенных этапов с контрольными точками.</p>
      <div className="workflow__actions">
        {snapshot.permissions.closeRegistration && <Button disabled={busy} onClick={() => setPending({
          title: 'Закрыть набор?', description: 'Новые заявки больше не принимаются. Решение применяется к демонстрационному кейсу.',
          confirm: () => workflow.closeRegistration(companyId, caseId, { expectedVersion: snapshot.item.version })
        })}>Закрыть набор</Button>}
        {snapshot.permissions.startExecution && <Button disabled={busy} onClick={() => setPending({
          title: 'Запустить кейс?', description: 'Допущенные участники перейдут к выполнению. Этапы после публикации недоступны для обычного редактирования.',
          confirm: () => workflow.startExecution(companyId, caseId, { expectedCaseVersion: snapshot.item.version })
        })}>Запустить кейс</Button>}
      </div>
      {!snapshot.permissions.closeRegistration && !snapshot.permissions.startExecution && <p>Сейчас переход статуса недоступен по состоянию кейса или правам.</p>}
    </>}
    {view === 'stages' && <StageEditor workflow={workflow} companyId={companyId} snapshot={snapshot}
      stages={stages} busy={busy} run={run} confirm={(title, description, operation) => setPending({ title, description, confirm: operation })} />}
    {view === 'applications' && (applicationId
      ? <ApplicationDetails workflow={workflow} companyId={companyId} caseId={caseId} applicationId={applicationId}
          snapshot={snapshot} revision={revision} busy={busy} run={run} />
      : <ApplicationList workflow={workflow} companyId={companyId} caseId={caseId} revision={revision} snapshot={snapshot} />)}
    <Modal open={Boolean(pending)} title={pending?.title ?? 'Подтверждение'} onClose={() => { if (!busy) setPending(null); }}>
      <p>{pending?.description}</p>{pending && errorBlock}
      <div className="workflow__actions"><Button variant="secondary" disabled={busy} onClick={() => setPending(null)}>Отмена</Button>
        <Button disabled={busy} onClick={async () => {
          if (pending && await run(pending.confirm, 'Действие выполнено.')) setPending(null);
        }}>{busy ? 'Выполнение…' : 'Подтвердить'}</Button></div>
    </Modal>
  </section>;
}

function ApplicationList({ workflow, companyId, caseId, revision, snapshot }: {
  workflow: WorkflowRepository; companyId: string; caseId: string; revision: number; snapshot: CaseSnapshot;
}) {
  const [status, setStatus] = useState<CaseApplication['status'] | ''>('');
  const [format, setFormat] = useState<CaseApplication['format'] | ''>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Awaited<ReturnType<WorkflowRepository['applications']>> | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const statusId = 'company-application-status';
  const formatId = 'company-application-format';
  useEffect(() => {
    let alive = true; setData(null); setError('');
    workflow.applications(companyId, caseId, { page, pageSize: 3, status: status || undefined, format: format || undefined })
      .then((result) => { if (alive) setData(result); }).catch((reason: unknown) => { if (alive) setError(errorText(reason)); });
    return () => { alive = false; };
  }, [workflow, companyId, caseId, status, format, page, revision, retry]);
  return <section><h2>Заявки на кейс</h2><QuotaSummary snapshot={snapshot} />
    {snapshot.item.admissionMode === 'OPEN' && <p>Свободный набор: допуск выполняется автоматически при подаче с проверкой условий и мест. Ручное решение недоступно.</p>}
    <div className="workflow__filters">
      <div className="field"><label htmlFor={statusId}>Статус заявки</label><select id={statusId} value={status} onChange={(event) => { setStatus(event.target.value as typeof status); setPage(1); }}>
        <option value="">Все статусы</option>{(['SUBMITTED', 'ADMITTED', 'REJECTED', 'WITHDRAWN'] as const).map((value) => <option key={value} value={value}>{applicationStatuses[value]}</option>)}
      </select></div>
      <div className="field"><label htmlFor={formatId}>Формат заявки</label><select id={formatId} value={format} onChange={(event) => { setFormat(event.target.value as typeof format); setPage(1); }}>
        <option value="">Все форматы</option><option value="TEAM">Команда</option><option value="SOLO">Соло</option>
      </select></div>
      <Button variant="secondary" onClick={() => { setStatus(''); setFormat(''); setPage(1); }}>Сбросить фильтры</Button>
    </div>
    {error ? <ErrorState title="Не удалось загрузить заявки" description={error} action={<Button onClick={() => setRetry((value) => value + 1)}>Повторить</Button>} />
      : !data ? <LoadingState /> : !data.items.length ? <EmptyState title="Заявок нет" description="Измените фильтры или дождитесь новых заявок." />
        : <><p>Найдено: {data.total}. Страница {data.page} из {Math.ceil(data.total / data.pageSize)}.</p>
          <div className="workflow__cards">{data.items.map((app) => <Card key={app.id}>
            <h3>{app.format === 'TEAM' ? 'Командная заявка' : 'Соло-заявка'} · {app.id.slice(-4)}</h3>
            <p>{applicationStatuses[app.status]}</p><p>Подтверждённых участников при подаче: {app.participantUserIds.length}</p>
            <ButtonLink to={`/company/cases/${caseId}/applications/${app.id}`}>Открыть заявку</ButtonLink>
          </Card>)}</div>
          <nav aria-label="Страницы заявок" className="workflow__actions">
            <Button variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Назад</Button>
            <Button variant="secondary" disabled={page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>Далее</Button>
          </nav></>}
  </section>;
}
