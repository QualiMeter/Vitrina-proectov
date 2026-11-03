import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  createCompany, getCompany, getReferenceData, inviteCompanyRepresentative, listCompanies,
  listCompanyInvitations, type Company, type CompanyInvitation, type InvitationRole, type ReferenceData,
} from '../../api/university';
import { useAuth } from '../../features/auth/useAuth';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { DataTable, type DataTableColumn } from '../../components/ui/DataTable';
import { Input } from '../../components/ui/Input';
import { EmptyState, ErrorState, LoadingState } from '../../components/feedback/States';
import './university.css';

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') return 'Сессия завершилась. Войдите в систему и повторите действие.';
    if (error.kind === 'forbidden') return 'У вашей учётной записи нет разрешения на эту операцию.';
    if (error.kind === 'notFound') return 'Запись не найдена или больше недоступна.';
    if (error.kind === 'conflict') return 'Данные изменились или действие уже выполнено. Обновите страницу.';
    if (error.kind === 'network') return 'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.';
    if (error.kind === 'server') return 'Сервер временно недоступен. Попробуйте позже.';
  }
  return 'Не удалось загрузить данные. Попробуйте ещё раз.';
}

function PageHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="university-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1></div>{children}</div>;
}

export function UniversityDashboardPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { session } = useAuth();
  const canViewCompanies = session?.user.permissions.includes('companies.listAll') ?? false;
  const canCreateCompany = session?.user.permissions.includes('companies.create') ?? false;

  const load = useCallback(async () => {
    if (!canViewCompanies) { setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const result = await listCompanies({ page: 1, pageSize: 5 });
      setCompanies(result.items); setTotal(result.total);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [canViewCompanies]);
  useEffect(() => { void load(); }, [load]);

  return <section className="university-page">
    <PageHeading eyebrow="Рабочее пространство" title="Кабинет сотрудника университета" />
    <p className="university-lead">Здесь собраны переходы к реестру компаний и рабочим разделам университета.</p>
    <div className="university-shortcuts">
      <Card className="university-shortcut"><span className="university-shortcut__icon" aria-hidden="true">⌂</span><div><h2>Компании</h2><p>{canViewCompanies ? 'Организации в реестре' : 'Для просмотра реестра требуется отдельное разрешение.'}</p>{canViewCompanies && <strong className="university-metric">{loading ? '…' : error ? '—' : total ?? 0}</strong>}</div>{canViewCompanies ? <ButtonLink variant="secondary" to="/university/companies">Открыть реестр</ButtonLink> : canCreateCompany ? <ButtonLink variant="secondary" to="/university/companies/new">Создать компанию</ButtonLink> : null}</Card>
      <Card className="university-shortcut"><span className="university-shortcut__icon" aria-hidden="true">✓</span><div><h2>Модерация</h2><p>Очередь задач появится после публикации API модерации.</p><strong className="university-metric university-metric--unknown" aria-label="Нет данных">—</strong></div><ButtonLink variant="secondary" to="/university/moderation">Перейти</ButtonLink></Card>
      <Card className="university-shortcut"><span className="university-shortcut__icon" aria-hidden="true">◎</span><div><h2>Кураторы</h2><p>Список назначений появится после публикации API кураторов.</p><strong className="university-metric university-metric--unknown" aria-label="Нет данных">—</strong></div><ButtonLink variant="secondary" to="/university/curators">Перейти</ButtonLink></Card>
    </div>
    <div className="university-section-heading"><div><h2>Недавно добавленные компании</h2><p>Список загружается из реестра по доступному разрешению.</p></div>{canViewCompanies && <ButtonLink variant="ghost" to="/university/companies">Все компании</ButtonLink>}</div>
    {loading ? <LoadingState title="Загружаем реестр компаний" /> : !canViewCompanies ? <EmptyState title="Сводка недоступна" description="У вашей учётной записи нет разрешения companies.listAll." /> : error ? <ErrorState title="Не удалось загрузить компании" description={error} action={<Button variant="secondary" onClick={() => void load()}>Повторить</Button>} /> : companies.length === 0 ? <EmptyState title="Компаний пока нет" description="Созданные организации появятся здесь." action={canCreateCompany ? <ButtonLink to="/university/companies/new">Создать компанию</ButtonLink> : undefined} /> : <Card className="university-recent"><p className="university-count">Всего в реестре: <strong>{total}</strong></p><ul>{companies.map(company => <li key={company.id}><Link to={`/university/companies/${encodeURIComponent(company.id)}`}>{company.name}</Link><span>{company.contactEmail}</span></li>)}</ul></Card>}
  </section>;
}

export function UniversityCompaniesPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { session } = useAuth();
  const canCreate = session?.user.permissions.includes('companies.create') ?? false;
  const pageSize = 20;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await listCompanies({ page, pageSize, search }); setItems(result.items); setTotal(result.total); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [page, search]);
  useEffect(() => { void load(); }, [load]);
  const columns: DataTableColumn<Company>[] = [
    { key: 'name', header: 'Компания', render: company => <Link className="university-table-link" to={`/university/companies/${encodeURIComponent(company.id)}`}>{company.name}</Link> },
    { key: 'contact', header: 'Контактный email', render: company => company.contactEmail },
    { key: 'directions', header: 'Направления', render: company => company.directionIds.length ? `${company.directionIds.length} выбрано` : 'Не указаны' },
    { key: 'created', header: 'Добавлена', render: company => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(company.createdAt)) },
  ];
  function submitSearch(event: FormEvent) { event.preventDefault(); setPage(1); setSearch(query.trim()); }
  return <section className="university-page">
    <PageHeading eyebrow="Организации" title="Реестр компаний">{canCreate && <ButtonLink to="/university/companies/new">Создать компанию</ButtonLink>}</PageHeading>
    <Card className="university-panel"><form className="company-search" onSubmit={submitSearch}><Input label="Поиск по названию или контактам" value={query} onChange={event => setQuery(event.target.value)} maxLength={150} placeholder="Например, ИТ-компания" /><Button type="submit" variant="secondary">Найти</Button>{search && <Button type="button" variant="ghost" onClick={() => { setQuery(''); setSearch(''); setPage(1); }}>Сбросить</Button>}</form>
      {loading ? <LoadingState title="Загружаем реестр" /> : error ? <ErrorState title="Реестр недоступен" description={error} action={<Button variant="secondary" onClick={() => void load()}>Повторить</Button>} /> : items.length === 0 ? <EmptyState title={search ? 'Ничего не найдено' : 'В реестре пока нет компаний'} description={search ? 'Измените поисковый запрос.' : 'Создайте компанию, чтобы пригласить её первого представителя.'} action={canCreate && !search ? <ButtonLink to="/university/companies/new">Создать компанию</ButtonLink> : undefined} /> : <><DataTable caption="Реестр компаний" columns={columns} rows={items} /><div className="university-pagination"><span>Показано {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} из {total}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Назад</Button><span>Страница {page}</span><Button variant="secondary" disabled={page * pageSize >= total} onClick={() => setPage(value => value + 1)}>Далее</Button></div></div></>}</Card>
  </section>;
}

export function UniversityCreateCompanyPage() {
  const navigate = useNavigate();
  const [references, setReferences] = useState<ReferenceData | null>(null);
  const [referenceError, setReferenceError] = useState('');
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState(''); const [website, setWebsite] = useState('');
  const [directionIds, setDirectionIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('');
  useEffect(() => { getReferenceData().then(setReferences).catch(cause => setReferenceError(errorMessage(cause))); }, []);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSubmitting(true);
    try {
      const company = await createCompany({ name: name.trim(), description: description.trim(), contactEmail: contactEmail.trim(), ...(website.trim() ? { website: website.trim() } : {}), directionIds });
      navigate(`/university/companies/${encodeURIComponent(company.id)}`, { replace: true });
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSubmitting(false); }
  }
  return <section className="university-page university-form-page">
    <PageHeading eyebrow="Реестр компаний" title="Новая компания"><ButtonLink variant="secondary" to="/university/companies">К реестру</ButtonLink></PageHeading>
    <Card className="university-form-card"><p className="university-lead">Компания создаётся сотрудником университета. После сохранения можно отправить представителю адресное приглашение.</p>
      {referenceError && <p className="university-inline-note" role="status">Справочник направлений не загрузился: {referenceError}. Можно сохранить компанию без направлений и добавить их позже.</p>}
      <form className="university-form" onSubmit={event => void submit(event)}>
        <Input label="Название компании" required minLength={2} maxLength={200} value={name} onChange={event => setName(event.target.value)} />
        <div className="field"><label htmlFor="company-description">Описание</label><textarea id="company-description" required maxLength={5000} rows={5} value={description} onChange={event => setDescription(event.target.value)} /></div>
        <Input label="Контактный email" type="email" required maxLength={254} value={contactEmail} onChange={event => setContactEmail(event.target.value)} />
        <Input label="Сайт компании" type="url" maxLength={2048} placeholder="https://example.ru" value={website} onChange={event => setWebsite(event.target.value)} hint="Необязательное поле" />
        <p className="university-inline-note">Поле загрузки логотипа подключим вместе с поддержкой файлов для компаний.</p>
        <fieldset className="university-directions"><legend>Направления деятельности</legend>{references?.directions.length ? <div>{references.directions.map(direction => <label className="university-check" key={direction.id}><input type="checkbox" checked={directionIds.includes(direction.id)} onChange={() => setDirectionIds(current => current.includes(direction.id) ? current.filter(id => id !== direction.id) : [...current, direction.id])} />{direction.name}</label>)}</div> : <p>{references ? 'В справочнике пока нет опубликованных направлений.' : 'Загружаем справочник…'}</p>}</fieldset>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="university-form-actions"><ButtonLink variant="ghost" to="/university/companies">Отмена</ButtonLink><Button type="submit" disabled={submitting}>{submitting ? 'Сохраняем…' : 'Создать компанию'}</Button></div>
      </form>
    </Card>
  </section>;
}

const invitationStatus: Record<CompanyInvitation['status'], string> = { PENDING: 'Ожидает принятия', ACCEPTED: 'Принято', REVOKED: 'Отозвано', EXPIRED: 'Истекло' };
const invitationRole: Record<InvitationRole, string> = { OWNER: 'Владелец', MEMBER: 'Сотрудник' };

export function UniversityCompanyDetailsPage() {
  const { id = '' } = useParams();
  const [company, setCompany] = useState<Company | null>(null); const [invitations, setInvitations] = useState<CompanyInvitation[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false); const [message, setMessage] = useState(''); const [sendError, setSendError] = useState('');
  const { session } = useAuth(); const canInvite = session?.user.permissions.includes('companies.invite') ?? false;
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [record, inviteList] = await Promise.all([getCompany(id), canInvite ? listCompanyInvitations(id) : Promise.resolve({ items: [], page: 1, pageSize: 0, total: 0 })]); setCompany(record); setInvitations(inviteList.items); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [id, canInvite]);
  useEffect(() => { void load(); }, [load]);
  async function submitInvite(event: FormEvent) {
    event.preventDefault(); setSending(true); setMessage(''); setSendError('');
    try { const invitation = await inviteCompanyRepresentative(id, email.trim(), 'OWNER'); setInvitations(current => [invitation, ...current]); setEmail(''); setMessage(`Приглашение для ${invitation.email} отправлено. Ссылка направлена адресату по email.`); }
    catch (cause) { setSendError(errorMessage(cause)); }
    finally { setSending(false); }
  }
  const columns: DataTableColumn<CompanyInvitation>[] = [
    { key: 'email', header: 'Email', render: invite => invite.email },
    { key: 'role', header: 'Роль', render: invite => invitationRole[invite.role] },
    { key: 'status', header: 'Статус', render: invite => <span className={`invitation-status invitation-status--${invite.status.toLowerCase()}`}>{invitationStatus[invite.status]}</span> },
    { key: 'expires', header: 'Действует до', render: invite => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(invite.expiresAt)) },
  ];
  return <section className="university-page">
    <PageHeading eyebrow="Реестр компаний" title={loading ? 'Карточка компании' : company?.name ?? 'Компания'}><ButtonLink variant="secondary" to="/university/companies">К реестру</ButtonLink></PageHeading>
    {loading ? <LoadingState title="Загружаем компанию" /> : error ? <ErrorState title="Карточка недоступна" description={error} action={<Button variant="secondary" onClick={() => void load()}>Повторить</Button>} /> : company && <>
      <Card className="university-company-summary"><div><span className="eyebrow">Контакт</span><a href={`mailto:${company.contactEmail}`}>{company.contactEmail}</a></div>{company.website && <div><span className="eyebrow">Сайт</span><a href={company.website} target="_blank" rel="noreferrer">{company.website}</a></div>}<p>{company.description || 'Описание не заполнено.'}</p></Card>
      {canInvite ? <Card className="university-panel university-invite-panel"><div><h2>Пригласить первого представителя</h2><p>На email придёт одноразовая ссылка. Первый представитель станет владельцем компании после принятия приглашения.</p></div><form className="company-search" onSubmit={event => void submitInvite(event)}><Input label="Email представителя" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /><Button type="submit" disabled={sending}>{sending ? 'Отправляем…' : 'Отправить приглашение'}</Button></form>{message && <p className="university-success" role="status">{message}</p>}{sendError && <p className="auth-error" role="alert">{sendError}</p>}</Card> : <p className="university-inline-note">Для отправки приглашений требуется разрешение companies.invite.</p>}
      <div className="university-section-heading"><div><h2>Приглашения</h2><p>Список не содержит секретных ссылок или токенов.</p></div></div>
      {canInvite ? <Card className="university-panel"><DataTable caption="Приглашения представителей компании" columns={columns} rows={invitations} emptyMessage="Приглашений пока нет." /></Card> : <EmptyState title="Список приглашений недоступен" description="У вашей учётной записи нет разрешения companies.invite." />}
    </>}
  </section>;
}
