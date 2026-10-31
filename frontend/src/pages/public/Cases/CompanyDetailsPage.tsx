import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PublicHeader } from '../../../components/layout/PublicHeader';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '../../../components/feedback/States';
import { directions } from './mockCases';
import { loadMockCompanyProfile } from './mockCompanies';
import { getSafeWebsiteUrl, type CompanyPublic } from './companyTypes';
import type { CasePublicSummary } from './types';
import { caseStatusLabels } from './statusLabels';
import './cases.css';

type CompanyPageData = { company: CompanyPublic | null; cases: CasePublicSummary[] };
type Loader = (companyId: string) => Promise<CompanyPageData>;

export function CompanyDetailsPage({ loadCompany = loadMockCompanyProfile }: { loadCompany?: Loader }) {
  const { companyId = '' } = useParams();
  const [data, setData] = useState<CompanyPageData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const company = data?.company;
  const websiteUrl = getSafeWebsiteUrl(company?.website);
  const cases = data?.cases ?? [];

  useEffect(() => {
    let active = true;
    setData(null);
    setLoadError(false);

    loadCompany(companyId).then((result) => {
      if (active) setData(result);
    }).catch(() => {
      if (active) setLoadError(true);
    });

    return () => { active = false; };
  }, [companyId, loadCompany, reloadKey]);

  return <>
    <PublicHeader />
    <main className="cases-page">
      <section className="section">
        <div className="container company-detail">
          <Link to="/cases" className="case-detail__back">← К каталогу кейсов</Link>
          {loadError && <ErrorState
            title="Не удалось загрузить профиль компании"
            description="Попробуйте загрузить профиль ещё раз."
            action={<Button onClick={() => setReloadKey((key) => key + 1)}>Повторить</Button>}
          />}
          {!data && !loadError && <LoadingState title="Загружаем профиль компании" />}
          {data && !data.company && <ErrorState
            title="Компания не найдена"
            description="Возможно, ссылка устарела или профиль больше не опубликован."
          />}
          {company && <>
            <article className="company-detail__profile">
              <div className="company-detail__mark" aria-hidden="true">{company.name.slice(0, 1)}</div>
              <div>
                <span className="eyebrow">Публичный профиль компании</span>
                <h1>{company.name}</h1>
                <p>{company.description}</p>
                {websiteUrl && <a href={websiteUrl} target="_blank" rel="noreferrer">Сайт компании ↗</a>}
                <div className="case-card__tags" aria-label="Направления компании">
                  {company.directionIds.map((id) => <Badge key={id}>{directions[id] ?? 'Направление'}</Badge>)}
                </div>
              </div>
            </article>

            <section className="company-detail__cases" aria-labelledby="company-cases-heading">
              <div className="section-heading">
                <span className="eyebrow">Опубликованные кейсы</span>
                <h2 id="company-cases-heading">Задачи компании</h2>
              </div>
              {cases.length ? <div className="case-grid">
                {cases.map((item) => <Card className="case-card" key={item.id}>
                  <Badge tone={item.status === 'REGISTRATION_OPEN' ? 'success' : 'neutral'}>
                    {caseStatusLabels[item.status]}
                  </Badge>
                  <h3>{item.title}</h3>
                  <p>{item.rewardTerms ?? 'Условия участия указаны в карточке кейса.'}</p>
                  <Link className="case-card__link" to={`/cases/${item.id}`}>
                    К описанию кейса <span aria-hidden="true">→</span>
                  </Link>
                </Card>)}
              </div> : <EmptyState
                title="Опубликованных кейсов пока нет"
                description="Новые задачи компании появятся здесь после публикации."
              />}
            </section>

            <p className="cases-api-note">
              Демонстрационные публичные данные. Профиль соответствует контракту CompanyPublic;
              выдача кейсов компании пока использует mock-данные. Для подключения к серверу нужен
              публичный фильтр кейсов по companyId.
            </p>
          </>}
        </div>
      </section>
    </main>
  </>;
}
