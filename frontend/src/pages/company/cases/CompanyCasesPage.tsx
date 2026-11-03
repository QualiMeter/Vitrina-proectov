import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Button, ButtonLink } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../../components/feedback/States';
import type { CaseDraft, CompanyCasesRepository, DraftFields } from './contracts';
import { statuses } from './contracts';
import { demoCompanyId, directions, technologies, validateDraft, type DemoMode } from './mockRepository';
import './companyCases.css';
import { createCompanyDemo } from '../workflow/mockWorkflow';
import type { WorkflowRepository } from '../workflow/repository';
import { createLazyExecution } from '../execution/lazyExecution';
import { executionCaseId, evaluationCaseId, type ExecutionRepository } from '../execution/repository';

export type DemoContext = { repository: CompanyCasesRepository; workflow: WorkflowRepository; execution: ExecutionRepository; companyId: string; canCreate: boolean };
const message = (error: unknown) => error instanceof Error ? error.message : 'Не удалось выполнить действие.';
const statusLabels: Record<CaseDraft['status'], string> = {
  DRAFT: 'Черновик', MODERATION: 'На модерации', REVISION: 'На доработке', REJECTED: 'Отклонён',
  APPROVED: 'Одобрен', REGISTRATION_OPEN: 'Набор открыт', REGISTRATION_CLOSED: 'Набор закрыт',
  EXECUTING: 'Выполняется', FINAL_CLOSED: 'Финальный приём закрыт', EVALUATING: 'Оценивание',
  COMPLETED: 'Завершён', CANCELED: 'Отменён'
};

export function CompanyDemoLayout() {
  const [mode, setMode] = useState<DemoMode>('normal');
  const [active, setActive] = useState(false);
  const { repository, workflow } = useMemo(() => createCompanyDemo(mode), [mode]);
  const execution = useMemo(() => createLazyExecution(mode), [mode]);
  return <main className="container company-cases">
    <Link to="/">← На главную</Link>
    <p className="company-cases__notice">UI Ready · демонстрационные данные</p>
    <p>В этой демонстрации сервер и вход не подключены. Это проверка интерфейса на вымышленной компании.
      Изменения хранятся в памяти до перезагрузки страницы или смены сценария.</p>
    <label className="field">Сценарий проверки
      <select value={mode} onChange={(event) => setMode(event.target.value as DemoMode)}>
        <option value="normal">Обычный</option><option value="empty">Пустой список</option>
        <option value="error">Ошибка</option><option value="denied">Нет прав</option>
        <option value="read-only">Только просмотр</option><option value="save-error">Ошибка сохранения</option>
        <option value="conflict">Конфликт версии</option>
      </select>
    </label>
    {!active ? <section><h1>Кабинет компании</h1>
      <p>Реальные кейсы доступны только авторизованным представителям своей компании.</p>
      <Button onClick={() => setActive(true)}>Открыть демонстрацию</Button>
    </section> : mode === 'denied' ? <ErrorState title="Доступ запрещён" description="Нет членства и прав на эту компанию. Приватные данные не загружаются." />
      : <><nav aria-label="Демонстрации выполнения"><Link to={`/company/cases/${executionCaseId}/workspace`}>День 4: выполнение и совместные места</Link>{' · '}
          <Link to={`/company/cases/${evaluationCaseId}/workspace`}>День 4: оценивание без совместных мест</Link></nav>
        <Outlet context={{ repository, workflow, execution, companyId: demoCompanyId, canCreate: mode !== 'read-only' } satisfies DemoContext} /></>}
  </main>;
}

export function CompanyCasesPage() {
  const { repository, companyId, canCreate } = useOutletContext<DemoContext>();
  const [items, setItems] = useState<CaseDraft[] | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setItems(null); setError('');
    repository.list(companyId).then((data) => { if (alive) setItems(data.items); })
      .catch((reason: unknown) => { if (alive) setError(message(reason)); });
    return () => { alive = false; };
  }, [repository, companyId, retry]);
  const visible = items?.filter((item) => !status || item.status === status);
  return <section>
    <h1>Мои кейсы</h1>
    {canCreate && <ButtonLink to="new">Создать кейс</ButtonLink>}
    <label className="field">Статус
      <select value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="">Все статусы</option>
        {statuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}
      </select>
    </label>
    {error ? <ErrorState title="Не удалось загрузить кейсы" description={error}
      action={<Button onClick={() => setRetry((value) => value + 1)}>Повторить</Button>} />
      : !visible ? <LoadingState /> : !visible.length ? <EmptyState title="Кейсов нет" description="Создайте черновик или выберите другой статус." />
        : <div className="company-cases__list">{visible.map((item) => <Card key={item.id}>
          <h2>{item.title}</h2><p>{statusLabels[item.status]} · версия {item.version}</p>
          <ButtonLink to={`${item.id}/manage`}>Управление кейсом</ButtonLink>
          {['DRAFT', 'REVISION'].includes(item.status) && item.allowedActions.includes('edit') && <ButtonLink to={`${item.id}/edit`}>Редактировать</ButtonLink>}
          {['DRAFT', 'REVISION'].includes(item.status) && item.allowedActions.includes('submit-moderation') && <Button disabled aria-describedby={`actions-${item.id}`}>Отправить на модерацию</Button>}
          {item.status === 'APPROVED' && item.allowedActions.includes('open-registration') && <Button disabled aria-describedby={`actions-${item.id}`}>Открыть набор</Button>}
          <p id={`actions-${item.id}`}>{item.allowedActions.length ? 'Отправка на модерацию и открытие набора пока недоступны в демонстрации.' : 'Доступен только просмотр.'}</p>
        </Card>)}</div>}
  </section>;
}

export function CompanyCaseEditor() {
  const formId = useId();
  const { repository, companyId, canCreate } = useOutletContext<DemoContext>();
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<CaseDraft | null>(null);
  const [fields, setFields] = useState<DraftFields>({ title: '' });
  const [loading, setLoading] = useState(Boolean(caseId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [retry, setRetry] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  useEffect(() => {
    let alive = true;
    setError(''); setDraft(null); setFields({ title: '' }); setLoading(Boolean(caseId));
    if (caseId) repository.get(companyId, caseId).then((item) => {
      if (alive) { setDraft(item); setFields(item); setLoading(false); }
    }).catch((reason: unknown) => { if (alive) { setError(message(reason)); setLoading(false); } });
    return () => { alive = false; };
  }, [repository, companyId, caseId, retry]);
  const editable = caseId ? Boolean(draft && ['DRAFT', 'REVISION'].includes(draft.status) && draft.allowedActions.includes('edit')) : canCreate;
  function change<K extends keyof DraftFields>(key: K, value: DraftFields[K]) {
    setFields((current) => ({ ...current, [key]: value })); setSuccess('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setSuccess('');
    if (!editable || saving) return;
    const errors = validateDraft(fields);
    if (draft) {
      for (const key of ['description', 'registrationDeadline', 'minCourse', 'maxCourse', 'minTeamSize', 'maxTeamSize'] as const) {
        if (draft[key] !== undefined && fields[key] === undefined) errors.push('Очистка ранее заполненного описания, срока или числового условия пока не поддерживается. Измените значение.');
      }
    }
    if (errors.length) { setError(errors.join(' ')); return; }
    setSaving(true);
    try {
      // Create first, then PATCH only contract fields. Keep ID if PATCH fails to avoid duplicates on retry.
      const current = draft ?? await repository.create(companyId, { title: fields.title.trim() });
      setDraft(current);
      const payload: DraftFields = {
        title: fields.title, description: fields.description, publicTaskDescription: fields.publicTaskDescription,
        directionIds: fields.directionIds, technologyIds: fields.technologyIds,
        participationFormat: fields.participationFormat, admissionMode: fields.admissionMode,
        registrationDeadline: fields.registrationDeadline, minCourse: fields.minCourse, maxCourse: fields.maxCourse,
        minTeamSize: fields.minTeamSize, maxTeamSize: fields.maxTeamSize,
        maxAdmittedTeams: fields.maxAdmittedTeams, maxAdmittedSolo: fields.maxAdmittedSolo,
        rewardTerms: fields.rewardTerms, resultRightsTerms: fields.resultRightsTerms
      };
      const saved = await repository.update(companyId, current.id, { ...payload, title: fields.title.trim(), expectedVersion: current.version });
      setDraft(saved);
      if (!caseId) navigate(`/company/cases/${saved.id}/edit`, { replace: true });
      setSuccess('Демонстрационный черновик сохранён в памяти. На сервер ничего не отправлено.');
    } catch (reason) { setError(message(reason)); } finally { setSaving(false); }
  }
  if (loading) return <LoadingState />;
  if (caseId && !draft) return <ErrorState title="Черновик недоступен" description={error}
    action={<Button onClick={() => setRetry((value) => value + 1)}>Повторить</Button>} />;
  return <section><Link to="/company/cases">← Мои кейсы</Link>
    {caseId && <nav aria-label="Разделы кейса"><ButtonLink to={`/company/cases/${caseId}/stages`}>Этапы и контрольные точки</ButtonLink></nav>}
    <h1>{caseId ? 'Редактировать черновик' : 'Создать черновик'}</h1>
    <p>Для минимального черновика достаточно названия. Полные условия проверит сервер при отправке на модерацию.</p>
    <p>Поля навыков и сроков выполнения появятся после согласования условий. Ниже указывается срок набора участников.</p>
    {!editable && <ErrorState title="Редактирование запрещено" />}
    <form onSubmit={save} className="company-cases__form">
      <fieldset disabled={!editable || saving}><legend>Условия кейса</legend>
        <Input label="Название" required maxLength={200} value={fields.title} onChange={(event) => change('title', event.target.value)} />
        {(['description', 'publicTaskDescription', 'rewardTerms', 'resultRightsTerms'] as const).map((key) => <label className="field" key={key}>
          {textLabels[key]}<textarea value={fields[key] ?? ''} maxLength={key.endsWith('Terms') ? 5000 : 20000}
            onChange={(event) => change(key, key === 'description' ? event.target.value || undefined : event.target.value)} />
        </label>)}
        <fieldset className="company-cases__choices"><legend>Направления</legend>
          {directions.map((item) => <label key={item.id}><input type="checkbox" checked={fields.directionIds?.includes(item.id) ?? false}
            onChange={(event) => change('directionIds', toggleId(fields.directionIds, item.id, event.target.checked))} />{item.name}</label>)}
        </fieldset>
        <fieldset className="company-cases__choices"><legend>Технологии</legend>
          {technologies.map((item) => <label key={item.id}><input type="checkbox" checked={fields.technologyIds?.includes(item.id) ?? false}
            onChange={(event) => change('technologyIds', toggleId(fields.technologyIds, item.id, event.target.checked))} />{item.name}</label>)}
        </fieldset>
        <div className="field"><label htmlFor={`${formId}-format`}>Формат</label>
          <select id={`${formId}-format`} value={fields.participationFormat ?? ''} onChange={(event) => change('participationFormat', event.target.value as DraftFields['participationFormat'] || undefined)}>
            <option value="">Не выбран</option><option value="SOLO">Соло</option><option value="TEAM">Команда</option><option value="BOTH">Оба</option>
          </select>
        </div>
        <div className="field"><label htmlFor={`${formId}-admission`}>Приём участников</label>
          <select id={`${formId}-admission`} value={fields.admissionMode ?? ''} onChange={(event) => change('admissionMode', event.target.value as DraftFields['admissionMode'] || undefined)}>
            <option value="">Не выбран</option><option value="OPEN">Свободный</option><option value="SELECTIVE">Ручной отбор</option>
          </select>
        </div>
        <Input label="Срок набора (местное время)" type="datetime-local"
          value={fields.registrationDeadline ? localDate(fields.registrationDeadline) : ''}
          onChange={(event) => {
            const value = event.target.value;
            const timestamp = value ? new Date(value).getTime() : NaN;
            change('registrationDeadline', Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined);
          }} />
        <div className="company-cases__numbers">{numberKeys.map((key) => <Input key={key} label={numberLabels[key]} type="number"
          min={key.startsWith('maxAdmitted') ? 0 : 1} step={1} value={fields[key] ?? ''}
          hint={key.startsWith('maxAdmitted') ? 'Пусто — без ограничения; 0 — нет мест. Лимиты независимы.' : undefined}
          onChange={(event) => change(key, event.target.value === '' ? (key.startsWith('maxAdmitted') ? null : undefined) : Number(event.target.value))} />)}</div>
      </fieldset>
      {error && <div role="alert" tabIndex={-1} ref={errorRef} className="field-error">{error}
        {error.includes('409') && <p>Ваша версия остаётся в форме. Скопируйте нужный текст перед загрузкой обновлённой версии.
          <Button type="button" variant="secondary" onClick={() => setRetry((value) => value + 1)}>Загрузить актуальную версию</Button></p>}
      </div>}
      {success && <p role="status">{success}</p>}
      <Button type="submit" disabled={!editable || saving}>{saving ? 'Сохранение…' : 'Сохранить демочерновик'}</Button>
    </form>
  </section>;
}

const textLabels = { description: 'Описание', publicTaskDescription: 'Публичная часть задания', rewardTerms: 'Вознаграждение и призы', resultRightsTerms: 'Права на результат' };
const numberKeys = ['minCourse', 'maxCourse', 'minTeamSize', 'maxTeamSize', 'maxAdmittedTeams', 'maxAdmittedSolo'] as const;
const numberLabels = { minCourse: 'Минимальный курс', maxCourse: 'Максимальный курс', minTeamSize: 'Минимальный размер команды', maxTeamSize: 'Максимальный размер команды', maxAdmittedTeams: 'Лимит команд', maxAdmittedSolo: 'Лимит соло' };
function localDate(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toggleId(current: string[] | undefined, id: string, checked: boolean): string[] {
  return checked ? [...new Set([...(current ?? []), id])] : (current ?? []).filter((value) => value !== id);
}
