import { useEffect, useMemo, useState } from 'react';
import { PublicHeader } from '../../../components/layout/PublicHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../../components/feedback/States';
import { directions, loadMockPublicCases, technologies } from './mockCases';
import type { CaseParticipationFormat, CasePublicListResponse, CaseStatus } from './types';
import './cases.css';

const formatLabels: Record<CaseParticipationFormat, string> = { SOLO: 'Индивидуально', TEAM: 'Командой', BOTH: 'Индивидуально или командой' };
const statusLabels: Record<CaseStatus, string> = {
  DRAFT: 'Черновик', MODERATION: 'На модерации', REVISION: 'Нужны изменения', REJECTED: 'Отклонён',
  APPROVED: 'Опубликован', REGISTRATION_OPEN: 'Набор открыт', REGISTRATION_CLOSED: 'Набор закрыт',
  EXECUTING: 'В работе', EVALUATING: 'Подведение итогов', COMPLETED: 'Завершён', CANCELED: 'Отменён'
};
const pageSize = 3;

export function CasesPage() {
  const [data, setData] = useState<CasePublicListResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState('');
  const [directionId, setDirectionId] = useState('');
  const [technologyId, setTechnologyId] = useState('');
  const [format, setFormat] = useState('');
  const [status, setStatus] = useState('');
  const [course, setCourse] = useState('');
  const [hasReward, setHasReward] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setData(null);
    setLoadError(false);
    loadMockPublicCases().then((result) => { if (active) setData(result); }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [reloadKey]);

  const filteredCases = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLocaleLowerCase('ru');
    return data.items.filter((item) => {
      const searchable = `${item.title} ${item.companyName} ${item.rewardTerms ?? ''}`.toLocaleLowerCase('ru');
      return (!query || searchable.includes(query))
        && (!directionId || item.directionIds.includes(directionId))
        && (!technologyId || item.technologyIds.includes(technologyId))
        && (!format || item.participationFormat === format || item.participationFormat === 'BOTH')
        && (!status || item.status === status)
        && (!course || ((item.minCourse ?? 1) <= Number(course) && (item.maxCourse ?? 6) >= Number(course)))
        && (!hasReward || Boolean(item.rewardTerms));
    });
  }, [data, directionId, technologyId, format, status, course, hasReward, search]);

  useEffect(() => setPage(1), [search, directionId, technologyId, format, status, course, hasReward]);

  const pageCount = Math.max(1, Math.ceil(filteredCases.length / pageSize));
  const visibleCases = filteredCases.slice((page - 1) * pageSize, page * pageSize);

  return <>
    <PublicHeader />
    <main className="cases-page">
      <section className="section cases-section">
        <div className="container">
          <div className="cases-intro">
            <div className="section-heading">
              <span className="eyebrow">Публичный каталог</span>
              <h1>Кейсы для совместной работы</h1>
              <p>Изучайте открытые задачи от компаний и университетских команд. Условия участия и требования указаны в карточке каждого кейса.</p>
            </div>
            <Badge tone="brand">UI Ready · демонстрационные данные</Badge>
          </div>

          <section className="case-filters" aria-label="Фильтры каталога кейсов">
            <div className="case-filter case-filter--search"><label htmlFor="case-search">Поиск</label><input id="case-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Название, компания или условие" /></div>
            <div className="case-filter"><label htmlFor="case-direction">Направление</label><select id="case-direction" value={directionId} onChange={(event) => setDirectionId(event.target.value)}><option value="">Все направления</option>{Object.entries(directions).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="case-filter"><label htmlFor="case-technology">Технология</label><select id="case-technology" value={technologyId} onChange={(event) => setTechnologyId(event.target.value)}><option value="">Все технологии</option>{Object.entries(technologies).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></div>
            <div className="case-filter"><label htmlFor="case-format">Формат</label><select id="case-format" value={format} onChange={(event) => setFormat(event.target.value)}><option value="">Любой формат</option><option value="SOLO">Индивидуально</option><option value="TEAM">Командой</option></select></div>
            <div className="case-filter"><label htmlFor="case-status">Статус</label><select id="case-status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Любой статус</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className="case-filter"><label htmlFor="case-course">Курс</label><select id="case-course" value={course} onChange={(event) => setCourse(event.target.value)}><option value="">Любой курс</option>{[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>Курс {value}</option>)}</select></div>
            <label className="case-filter__check"><input type="checkbox" checked={hasReward} onChange={(event) => setHasReward(event.target.checked)} /> Есть вознаграждение</label>
          </section>

          <div className="cases-results" aria-live="polite">
            {loadError && <ErrorState title="Не удалось загрузить кейсы" description="Попробуйте обновить список позже." action={<Button onClick={() => setReloadKey((key) => key + 1)}>Повторить</Button>} />}
            {!data && !loadError && <LoadingState title="Загружаем каталог" />}
            {data && filteredCases.length === 0 && <EmptyState title="Кейсы не найдены" description="Измените поисковый запрос или сбросьте фильтры." action={<Button variant="secondary" onClick={() => { setSearch(''); setDirectionId(''); setTechnologyId(''); setFormat(''); setStatus(''); setCourse(''); setHasReward(false); }}>Сбросить фильтры</Button>} />}
            {data && filteredCases.length > 0 && <>
              <p className="cases-count">Найдено: {filteredCases.length}</p>
              <div className="case-grid">{visibleCases.map((item) => <Card className="case-card" key={item.id}>
                <div className="case-card__top"><Badge tone={item.status === 'REGISTRATION_OPEN' ? 'success' : 'neutral'}>{statusLabels[item.status]}</Badge><span>{formatLabels[item.participationFormat]}</span></div>
                <p className="case-card__company">{item.companyName}</p>
                <h2>{item.title}</h2>
                <div className="case-card__tags">{item.directionIds.map((id) => <Badge key={id}>{directions[id] ?? 'Направление'}</Badge>)}{item.technologyIds.map((id) => <Badge key={id}>{technologies[id] ?? 'Технология'}</Badge>)}</div>
                <dl className="case-card__details"><div><dt>Срок набора</dt><dd>{new Date(item.registrationDeadline).toLocaleDateString('ru-RU')}</dd></div><div><dt>Курс</dt><dd>{item.minCourse ?? 1}–{item.maxCourse ?? 6}</dd></div><div><dt>Отбор</dt><dd>{item.admissionMode === 'SELECTIVE' ? 'Ручной' : 'Открытый'}</dd></div></dl>
                {item.rewardTerms && <p className="case-card__reward">{item.rewardTerms}</p>}
              </Card>)}</div>
              {pageCount > 1 && <nav className="cases-pagination" aria-label="Страницы каталога"><Button variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Назад</Button><span>Страница {page} из {pageCount}</span><Button variant="secondary" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Дальше</Button></nav>}
            </>}
          </div>
          <p className="cases-api-note">Показаны демонстрационные данные. Реальные опубликованные кейсы появятся после подключения сервера.</p>
        </div>
      </section>
    </main>
  </>;
}
