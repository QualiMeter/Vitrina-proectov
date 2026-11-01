import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicHeader } from '../../../components/layout/PublicHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../../components/feedback/States';
import { directions, loadMockPublicCases, technologies } from './mockCases';
import { selectLocalPage, type CatalogueFilters } from './catalogue';
import type { CasePublicSummary } from './types';
import { publicCaseStatuses } from './types';
import { caseStatusLabels } from './statusLabels';
import './cases.css';

const formatLabels = { SOLO: 'Индивидуально', TEAM: 'Командой', BOTH: 'Индивидуально или командой' } as const;
const pageSize = 3;
type Loader = () => Promise<CasePublicSummary[]>;

export function CasesPage({ loadCases = loadMockPublicCases }: { loadCases?: Loader }) {
  const [data, setData] = useState<CasePublicSummary[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<CatalogueFilters>({
    search: '', directionId: '', technologyId: '', format: '', status: '', course: '', hasReward: false
  });
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;
    setData(null);
    setLoadError(false);
    loadCases().then((result) => {
      if (active) setData(result);
    }).catch(() => {
      if (active) setLoadError(true);
    });
    return () => { active = false; };
  }, [loadCases, reloadKey]);

  const result = data ? selectLocalPage(data, filters, page, pageSize) : null;
  const activeFilterCount = [
    filters.search,
    filters.directionId,
    filters.technologyId,
    filters.format,
    filters.status,
    filters.course,
    filters.hasReward ? 'reward' : ''
  ].filter(Boolean).length;
  const updateFilter = <K extends keyof CatalogueFilters>(key: K, value: CatalogueFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const resetFilters = () => {
    setFilters({ search: '', directionId: '', technologyId: '', format: '', status: '', course: '', hasReward: false });
    setPage(1);
  };

  return <>
    <PublicHeader />
    <main className="cases-page">
      <section className="section cases-section">
        <div className="container">
          <div className="cases-intro">
            <div className="section-heading">
              <span className="eyebrow">Публичный каталог</span>
              <h1>Кейсы для совместной работы</h1>
              <p>
                Изучайте открытые задачи от компаний и университетских команд. Условия участия и
                требования указаны в карточке каждого кейса.
              </p>
            </div>
            <Badge tone="brand">UI Ready · демонстрационные данные</Badge>
          </div>

          <section className="case-filters" aria-label="Фильтры каталога кейсов">
            <div className="case-filters__primary">
              <div className="case-filter case-filter--search">
                <label htmlFor="case-search">Поиск</label>
                <input
                  id="case-search"
                  type="search"
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Название, компания или условие"
                />
              </div>
              <Button
                className="case-filters__toggle"
                variant="secondary"
                aria-expanded={filtersOpen}
                aria-controls="case-filter-options"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                Фильтры{activeFilterCount > 0 && <span className="case-filters__count">{' '}{activeFilterCount}</span>}
              </Button>
            </div>
            <div id="case-filter-options" className={`case-filters__fields${filtersOpen ? ' is-open' : ''}`}>
              <div className="case-filter">
                <label htmlFor="case-direction">Направление</label>
                <select
                  id="case-direction"
                  value={filters.directionId}
                  onChange={(event) => updateFilter('directionId', event.target.value)}
                >
                  <option value="">Все направления</option>
                  {Object.entries(directions).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div className="case-filter">
                <label htmlFor="case-technology">Технология</label>
                <select
                  id="case-technology"
                  value={filters.technologyId}
                  onChange={(event) => updateFilter('technologyId', event.target.value)}
                >
                  <option value="">Все технологии</option>
                  {Object.entries(technologies).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </div>
              <div className="case-filter">
                <label htmlFor="case-format">Формат</label>
                <select
                  id="case-format"
                  value={filters.format}
                  onChange={(event) => updateFilter('format', event.target.value as CatalogueFilters['format'])}
                >
                  <option value="">Любой формат</option>
                  <option value="SOLO">Индивидуально</option>
                  <option value="TEAM">Командой</option>
                </select>
              </div>
              <div className="case-filter">
                <label htmlFor="case-status">Статус</label>
                <select
                  id="case-status"
                  value={filters.status}
                  onChange={(event) => updateFilter('status', event.target.value as CatalogueFilters['status'])}
                >
                  <option value="">Любой статус</option>
                  {publicCaseStatuses.map((value) => <option key={value} value={value}>{caseStatusLabels[value]}</option>)}
                </select>
              </div>
              <div className="case-filter">
                <label htmlFor="case-course">Курс</label>
                <select id="case-course" value={filters.course} onChange={(event) => updateFilter('course', event.target.value)}>
                  <option value="">Любой курс</option>
                  {[1, 2, 3, 4, 5, 6].map((value) => <option key={value} value={value}>Курс {value}</option>)}
                </select>
              </div>
              <label className="case-filter__check">
                <input
                  type="checkbox"
                  checked={filters.hasReward}
                  onChange={(event) => updateFilter('hasReward', event.target.checked)}
                />
                Есть вознаграждение
              </label>
              {activeFilterCount > 0 && <Button className="case-filters__reset" variant="secondary" onClick={resetFilters}>
                Сбросить фильтры
              </Button>}
            </div>
          </section>

          <div className="cases-results" aria-live="polite">
            {loadError && <ErrorState
              title="Не удалось загрузить кейсы"
              description="Попробуйте обновить список позже."
              action={<Button onClick={() => setReloadKey((key) => key + 1)}>Повторить</Button>}
            />}
            {!data && !loadError && <LoadingState title="Загружаем каталог" />}
            {result && result.filtered.length === 0 && <EmptyState
              title="Кейсы не найдены"
              description="Измените поисковый запрос или сбросьте фильтры в панели настроек."
            />}
            {result && result.filtered.length > 0 && <>
              <p className="cases-count">Найдено: {result.filtered.length}</p>
              <div className="case-grid">
                {result.items.map((item) => <CaseCard key={item.id} item={item} />)}
              </div>
              {result.pageCount > 1 && <nav className="cases-pagination" aria-label="Страницы каталога">
                <Button
                  variant="secondary"
                  disabled={result.currentPage === 1}
                  onClick={() => setPage((value) => value - 1)}
                >Назад</Button>
                <span>Страница {result.currentPage} из {result.pageCount}</span>
                <Button
                  variant="secondary"
                  disabled={result.currentPage === result.pageCount}
                  onClick={() => setPage((value) => value + 1)}
                >Дальше</Button>
              </nav>}
            </>}
          </div>
          <p className="cases-api-note">
            Показаны демонстрационные данные. Реальные опубликованные кейсы появятся после подключения сервера.
          </p>
        </div>
      </section>
    </main>
  </>;
}

function CaseCard({ item }: { item: CasePublicSummary }) {
  return <Card className="case-card">
    <div className="case-card__top">
      <Badge tone={item.status === 'REGISTRATION_OPEN' ? 'success' : 'neutral'}>{caseStatusLabels[item.status]}</Badge>
      <span>{formatLabels[item.participationFormat]}</span>
    </div>
    <Link className="case-card__company case-card__company-link" to={`/companies/${item.companyId}`}>{item.companyName}</Link>
    <h2>{item.title}</h2>
    <div className="case-card__tags">
      {item.directionIds.map((id) => <Badge key={id}>{directions[id] ?? 'Направление'}</Badge>)}
      {item.technologyIds.map((id) => <Badge key={id}>{technologies[id] ?? 'Технология'}</Badge>)}
    </div>
    <dl className="case-card__details">
      <div><dt>Срок набора</dt><dd>{new Date(item.registrationDeadline).toLocaleDateString('ru-RU')}</dd></div>
      <div><dt>Курс</dt><dd>{item.minCourse ?? 1}–{item.maxCourse ?? 6}</dd></div>
      <div><dt>Отбор</dt><dd>{item.admissionMode === 'SELECTIVE' ? 'Ручной' : 'Открытый'}</dd></div>
    </dl>
    {item.rewardTerms && <p className="case-card__reward">{item.rewardTerms}</p>}
    <Link className="case-card__link" to={`/cases/${item.id}`}>Подробнее о кейсе <span aria-hidden="true">→</span></Link>
  </Card>;
}
