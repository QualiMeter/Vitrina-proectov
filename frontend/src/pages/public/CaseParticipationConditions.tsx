import { Button, ButtonLink } from '../../components/ui/Button';
import type { ParticipationFormat } from '../company/cases/contracts';

/** Public DTO projection only. Never accepts a private draft or protected files/stages. */
export interface PublicParticipationConditions {
  participationFormat: ParticipationFormat;
  maxAdmittedTeams?: number | null;
  maxAdmittedSolo?: number | null;
  resultRightsTerms?: string;
}

/** Integrate into PR #9 CaseDetailsPage once that public route is in main. */
export function CaseParticipationConditions({ item, registrationOpen, loginAvailable = false }: {
  item: PublicParticipationConditions;
  registrationOpen: boolean;
  loginAvailable?: boolean;
}) {
  const quota = (value: number | null | undefined) => value === undefined ? 'Не указано' : value === null ? 'Без ограничения' : String(value);
  return <section aria-label="Лимиты и права на результат">
    <h2>Лимиты приёма</h2>
    <dl>
      {item.participationFormat !== 'SOLO' && <><dt>Команды</dt><dd>{quota(item.maxAdmittedTeams)}</dd></>}
      {item.participationFormat !== 'TEAM' && <><dt>Соло-участники</dt><dd>{quota(item.maxAdmittedSolo)}</dd></>}
    </dl>
    {item.resultRightsTerms && <><h2>Права на результат</h2><p>{item.resultRightsTerms}</p></>}
    {registrationOpen ? loginAvailable ? <ButtonLink to="/login">Войти для подачи заявки</ButtonLink>
      : <><Button disabled>Войти для подачи заявки</Button><p>Ожидается общий вход FE-C и API заявок.</p></>
      : <p>Набор закрыт.</p>}
  </section>;
}
