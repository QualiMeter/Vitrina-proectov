import type { CaseSnapshot } from './repository';

export function QuotaSummary({ snapshot }: { snapshot: CaseSnapshot }) {
  const remaining = (limit: number | null | undefined, used: number) => limit === undefined ? 'Не указано' : limit === null ? 'Без ограничения' : `${Math.max(0, limit - used)} из ${limit}`;
  return <dl className="workflow__quotas" aria-label="Доступные места">
    {snapshot.item.participationFormat !== 'SOLO' && <div><dt>Свободно командных мест</dt><dd>{remaining(snapshot.item.maxAdmittedTeams, snapshot.admittedTeams)}</dd><small>Одна команда занимает одно место.</small></div>}
    {snapshot.item.participationFormat !== 'TEAM' && <div><dt>Свободно соло-мест</dt><dd>{remaining(snapshot.item.maxAdmittedSolo, snapshot.admittedSolo)}</dd></div>}
  </dl>;
}
