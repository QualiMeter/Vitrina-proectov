import { Link, useParams } from 'react-router-dom';
import { PublicHeader } from '../../../components/layout/PublicHeader';
import { Badge } from '../../../components/ui/Badge';
import { ErrorState } from '../../../components/feedback/States';
import { mockCaseDetails } from './mockCases';
import { directions, technologies } from './mockCases';
import type { CaseStatus } from './types';

const statusLabels: Record<CaseStatus, string> = {
  DRAFT: 'Черновик', MODERATION: 'На модерации', REVISION: 'Нужны изменения', REJECTED: 'Отклонён',
  APPROVED: 'Опубликован', REGISTRATION_OPEN: 'Набор открыт', REGISTRATION_CLOSED: 'Набор закрыт',
  EXECUTING: 'В работе', FINAL_CLOSED: 'Работы завершены', EVALUATING: 'Подведение итогов',
  COMPLETED: 'Завершён', CANCELED: 'Отменён'
};

export function CaseDetailsPage() {
  const { caseId = '' } = useParams();
  const item = mockCaseDetails[caseId];

  return <>
    <PublicHeader />
    <main className="cases-page">
      <section className="section">
        <div className="container case-detail">
          <Link to="/cases" className="case-detail__back">← К каталогу</Link>
          {!item ? <ErrorState title="Кейс не найден" description="Возможно, ссылка устарела или кейс больше не опубликован." /> : <article>
            <Badge tone={item.status === 'REGISTRATION_OPEN' ? 'success' : 'neutral'}>{statusLabels[item.status]}</Badge>
            <Link className="case-card__company case-card__company-link" to={`/companies/${item.companyId}`}>{item.companyName}</Link>
            <h1>{item.title}</h1>
            <p>{item.description}</p>
            {item.publicTaskDescription && <section><h2>Задача</h2><p>{item.publicTaskDescription}</p></section>}
            <section><h2>Условия участия</h2>
              <dl className="case-card__details">
                <div><dt>Срок набора</dt><dd>{new Date(item.registrationDeadline).toLocaleDateString('ru-RU')}</dd></div>
                <div><dt>Формат</dt><dd>{item.participationFormat === 'SOLO' ? 'Индивидуально' : item.participationFormat === 'TEAM' ? 'Командой' : 'Индивидуально или командой'}</dd></div>
                <div><dt>Размер команды</dt><dd>{item.minTeamSize ? `${item.minTeamSize}–${item.maxTeamSize} человек` : 'Индивидуальное участие'}</dd></div>
                <div><dt>Курс</dt><dd>{item.minCourse ?? 1}–{item.maxCourse ?? 6}</dd></div>
                <div><dt>Отбор</dt><dd>{item.admissionMode === 'SELECTIVE' ? 'Ручной' : 'Открытый'}</dd></div>
              </dl>
            </section>
            <section><h2>Направления и технологии</h2><div className="case-card__tags">
              {item.directionIds.map((id) => <Badge key={id}>{directions[id] ?? 'Направление'}</Badge>)}
              {item.technologyIds.map((id) => <Badge key={id}>{technologies[id] ?? 'Технология'}</Badge>)}
            </div></section>
            {item.rewardTerms && <section><h2>Вознаграждение</h2><p>{item.rewardTerms}</p></section>}
            <p className="cases-api-note">Показаны демонстрационные данные. Детали будут загружаться с сервера после реализации API.</p>
          </article>}
        </div>
      </section>
    </main>
  </>;
}
