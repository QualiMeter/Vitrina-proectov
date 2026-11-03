import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Modal } from '../../../components/ui/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../../components/feedback/States';
import type { DemoContext } from '../cases/CompanyCasesPage';
import type { CaseCheckpoint, SubmissionVersionList } from '../workflow/contracts.generated';
import { caseStatusLabels } from '../../public/Cases/statusLabels';
import type { ExecutionParticipant, ExecutionRepository, ExecutionSnapshot } from './repository';
import './execution.css';

const labels = { ACTIVE: 'Активна', ELIMINATED: 'Выбыла', EXCLUDED: 'Исключена', WITHDRAWN: 'Отозвана' };
const date = (value: string) => new Date(value).toLocaleString('ru-RU');
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : 'Не удалось выполнить действие.';
type Run = (operation: () => Promise<void>, success: string) => Promise<boolean>;

export function CompanyExecutionPage() {
  const { execution, companyId } = useOutletContext<DemoContext>();
  const { caseId = '' } = useParams();
  return <ExecutionView key={caseId} repository={execution} companyId={companyId} caseId={caseId} />;
}

function ExecutionView({ repository, companyId, caseId }: { repository: ExecutionRepository; companyId: string; caseId: string }) {
  const [data, setData] = useState<ExecutionSnapshot | null>(null);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false); const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState<{ title: string; detail: string; action: (reason: string) => Promise<void>; reason?: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const locked = useRef(false); const generation = useRef(0); const alertRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (error) alertRef.current?.focus(); }, [error]);
  useEffect(() => {
    const token = ++generation.current; setData(null); setError(''); setPending(null); setNotice('');
    repository.snapshot(companyId, caseId).then(value => { if (token === generation.current) setData(value); })
      .catch(err => { if (token === generation.current) setError(errorMessage(err)); });
    return () => { generation.current = token + 1; };
  }, [repository, companyId, caseId]);
  const run: Run = async (operation, success) => {
    if (locked.current) return false;
    const token = generation.current; locked.current = true; setBusy(true); setError(''); setNotice('');
    try {
      await operation(); const snapshot = await repository.snapshot(companyId, caseId);
      if (token !== generation.current) return false;
      setData(snapshot); setNotice(`${success} Изменены только демоданные.`); return true;
    } catch (err) { if (token === generation.current) setError(errorMessage(err)); return false; }
    finally { locked.current = false; if (token === generation.current) setBusy(false); }
  };
  async function reload() {
    if (await run(async () => {}, 'Данные обновлены.')) { setRevision(v => v + 1); setPending(null); }
  }
  const alert = error && <div className="workflow__error" role="alert" tabIndex={-1} ref={alertRef}>
    {error}<p>При 409 решение не применяется повторно автоматически. Ввод остаётся до явного обновления.</p>
    <Button variant="secondary" disabled={busy} onClick={() => void reload()}>Загрузить актуальные данные</Button>
  </div>;
  if (!data) return <section><Link to="/company/cases">← Мои кейсы</Link>{error
    ? <ErrorState title="Рабочее пространство недоступно" description={error} action={<Button onClick={() => void reload()}>Повторить</Button>} /> : <LoadingState />}</section>;
  const { dashboard, participants } = data;
  const points = dashboard.stages.flatMap(s => s.checkpoints);
  const active = participants.filter(p => p.status === 'ACTIVE');
  const canExecute = data.canManage && dashboard.status === 'EXECUTING';
  const command = { expectedCaseVersion: dashboard.caseVersion };
  function confirm(title: string, detail: string, operation: () => Promise<void>) {
    setError(''); setReason(''); setPending({ title, detail, action: operation });
  }
  return <section className="workflow execution">
    <Link to="/company/cases">← Мои кейсы</Link><h1>{data.title}</h1>
    <p>UI Ready · {caseStatusLabels[dashboard.status]} · версия {dashboard.caseVersion}</p>
    {!pending && alert}{notice && <p role="status">{notice}</p>}
    {!data.canManage && <p>Только просмотр: действия компании недоступны.</p>}
    <dl className="workflow__quotas"><div><dt>Активные команды</dt><dd>{dashboard.activeTeamCount}</dd></div>
      <div><dt>Выбывшие / исключённые</dt><dd>{dashboard.eliminatedTeamCount} / {dashboard.excludedTeamCount}</dd></div>
      <div><dt>Активные соло</dt><dd>{dashboard.admittedSoloCount}</dd></div></dl>
    <h2>Этапы и контрольные точки</h2>
    {dashboard.stages.length === 0 && <EmptyState title="Этапов пока нет" />}
    <div className="workflow__cards">{dashboard.stages.map(stage => <Card key={stage.id}>
      <h3>{stage.sequence}. {stage.title}</h3>{stage.availableFrom && <p>Открытие: {date(stage.availableFrom)}</p>}
      {stage.checkpoints.map(point => <section key={point.id} className="workflow__checkpoint">
        <h4>{point.title}</h4><p>Общий срок: {date(point.deadline)} · {point.intakeStatus === 'OPEN' ? 'Приём открыт' : 'Приём закрыт'}</p>
        {point.instructions && <p>{point.instructions}</p>}
        {point.kind === 'SELECTION' && <Selection key={`${point.id}:${revision}`} point={point} participants={active}
          disabled={!canExecute || point.intakeStatus !== 'OPEN' || points.slice(0, points.indexOf(point)).some(p => p.intakeStatus === 'OPEN')}
          busy={busy} confirm={(teams, solo) => {
            const key = crypto.randomUUID();
            confirm('Завершить отбор?', `Пройдут ${teams.length} команд и ${solo.length} соло. Неотмеченные активные участники выбывают и теряют доступ к будущим закрытым материалам. Действие необратимо.`,
              () => repository.select(companyId, caseId, point.id, { expectedVersion: point.version, passingTeamIds: teams, passingSoloApplicationIds: solo }, key));
          }} />}
        {point.kind === 'REGULAR' && point.intakeStatus === 'OPEN' && data.canManage && <Button disabled={!canExecute || busy}
          onClick={() => { const key = crypto.randomUUID(); confirm('Закрыть приём точки?', 'Новые версии этой точки больше не принимаются.',
            () => repository.closeCheckpoint(companyId, caseId, point.id, { expectedVersion: point.version }, key)); }}>Закрыть приём точки</Button>}
      </section>)}
    </Card>)}</div>
    <h2>Участники и сдачи</h2>
    {!participants.length ? <EmptyState title="Участников пока нет" /> : <div className="workflow__cards">{participants.map(p => <Card key={p.applicationId}>
      <h3>{p.name}</h3><p>{p.format === 'TEAM' ? 'Команда' : 'Соло'} · {labels[p.status]}</p>
      {p.exclusion && <p>Причина исключения: {p.exclusion.reason}</p>}
      {canExecute && p.status === 'ACTIVE' && p.teamId && <Button variant="secondary" disabled={busy} onClick={() => {
        const key = crypto.randomUUID(); setReason(''); setError(''); setPending({ title: `Исключить команду ${p.name}?`,
          detail: 'Команда теряет возможность сдавать результаты и доступ к будущим закрытым материалам. История сохраняется. Укажите обязательную причину.', reason: true,
          action: reason => repository.exclude(companyId, caseId, p.teamId!, { ...command, reason }, key) });
      }}>Исключить команду {p.name}</Button>}
    </Card>)}</div>}
    {participants.length > 0 && points.length > 0 && <SubmissionViewer key={`${caseId}:${revision}`} repository={repository} companyId={companyId} caseId={caseId} points={points} participants={participants} />}
    <div className="workflow__actions">
      {canExecute && <Button disabled={busy || points.some(p => p.kind !== 'FINAL' && p.intakeStatus === 'OPEN') || !points.some(p => p.kind === 'FINAL')}
        onClick={() => { const key = crypto.randomUUID(); confirm('Завершить финальный приём?', 'Новые финальные версии больше не принимаются. История сдач сохраняется.',
          () => repository.closeFinal(companyId, caseId, command, key)); }}>Завершить финальный приём</Button>}
      {data.canManage && dashboard.status === 'FINAL_CLOSED' && <Button disabled={busy} onClick={() => { const key = crypto.randomUUID();
        confirm('Начать оценивание?', 'Отзывы и ручное назначение мест станут доступны компании.', () => repository.beginEvaluation(companyId, caseId, command, key)); }}>Начать оценивание</Button>}
    </div>
    {dashboard.status === 'EVALUATING' && <Evaluation key={`${caseId}:${revision}`} data={data} busy={busy} run={run} repository={repository} companyId={companyId} />}
    <Modal open={Boolean(pending)} title={pending?.title ?? 'Подтверждение'} onClose={() => { if (!busy) setPending(null); }}>
      <p>{pending?.detail}</p>{pending?.reason && <div className="field"><label htmlFor="exclusion-reason">Причина исключения</label><textarea id="exclusion-reason" required maxLength={2000} value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></div>}
      {pending && alert}<div className="workflow__actions"><Button variant="secondary" disabled={busy} onClick={() => setPending(null)}>Отмена</Button>
        <Button disabled={busy || Boolean(pending?.reason && !reason.trim())} onClick={async () => {
          if (pending && await run(() => pending.action(reason), 'Решение сохранено.')) setPending(null);
        }}>{busy ? 'Сохранение…' : 'Подтвердить'}</Button></div>
    </Modal>
  </section>;
}

function Selection({ point, participants, disabled, busy, confirm }: { point: CaseCheckpoint; participants: ExecutionParticipant[]; disabled: boolean; busy: boolean; confirm: (teams: string[], solo: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const teams = participants.filter(p => p.teamId && selected.includes(p.applicationId)).map(p => p.teamId!);
  const solo = participants.filter(p => p.format === 'SOLO' && selected.includes(p.applicationId)).map(p => p.applicationId);
  return <fieldset disabled={disabled || busy}><legend>Ручной отбор</legend>
    <p>Выбрано команд: {teams.length} / {point.selectionLimit ?? 0}; соло: {solo.length} / {point.soloSelectionLimit ?? 0}.</p>
    {participants.map(p => { const checked = selected.includes(p.applicationId); const full = p.format === 'TEAM' ? teams.length >= (point.selectionLimit ?? 0) : solo.length >= (point.soloSelectionLimit ?? 0);
      return <label className="execution__choice" key={p.applicationId}><input type="checkbox" checked={checked} disabled={!checked && full} onChange={e => setSelected(ids => e.target.checked ? [...ids, p.applicationId] : ids.filter(id => id !== p.applicationId))} />{p.name}</label>;
    })}
    <p>Можно выбрать меньше N, в том числе никого. Баллы не определяют проходящих.</p>
    <Button disabled={participants.length === 0} onClick={() => confirm(teams, solo)}>Завершить отбор</Button>
  </fieldset>;
}

function SubmissionViewer({ repository, companyId, caseId, points, participants }: { repository: ExecutionRepository; companyId: string; caseId: string; points: CaseCheckpoint[]; participants: ExecutionParticipant[] }) {
  const [applicationId, setApplicationId] = useState(participants[0].applicationId);
  const [checkpointId, setCheckpointId] = useState(points[0].id);
  const [history, setHistory] = useState<SubmissionVersionList | null>(null); const [version, setVersion] = useState(0);
  const [error, setError] = useState(''); const [retry, setRetry] = useState(0); const [downloading, setDownloading] = useState(false);
  useEffect(() => {
    let alive = true; setHistory(null); setError('');
    repository.versions(companyId, caseId, checkpointId, applicationId).then(data => { if (alive) { setHistory(data); setVersion(data.latestVersion); } })
      .catch(err => { if (alive) setError(errorMessage(err)); });
    return () => { alive = false; };
  }, [repository, companyId, caseId, checkpointId, applicationId, retry]);
  const submission = history?.items.find(v => v.version === version);
  async function download(fileId: string, name: string) {
    setDownloading(true); setError('');
    try { const blob = await repository.file(companyId, caseId, fileId); const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(errorMessage(err)); } finally { setDownloading(false); }
  }
  return <section><h2>Просмотр версий сдачи</h2><div className="workflow__filters">
    <div className="field"><label htmlFor="submission-participant">Участник</label><select id="submission-participant" value={applicationId} onChange={e => setApplicationId(e.target.value)}>{participants.map(p => <option key={p.applicationId} value={p.applicationId}>{p.name}</option>)}</select></div>
    <div className="field"><label htmlFor="submission-checkpoint">Контрольная точка</label><select id="submission-checkpoint" value={checkpointId} onChange={e => setCheckpointId(e.target.value)}>{points.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
  </div>{error && <div role="alert">{error}<Button onClick={() => setRetry(v => v + 1)}>Повторить загрузку сдач</Button></div>}
    {!history ? !error && <LoadingState /> : !history.items.length ? <EmptyState title="Сдач пока нет" /> : <>
      <div className="field"><label htmlFor="submission-version">Версия сдачи</label><select id="submission-version" value={version} onChange={e => setVersion(Number(e.target.value))}>{history.items.map(v => <option key={v.id} value={v.version}>Версия {v.version}</option>)}</select></div>
      {submission && <Card><h3>Версия {submission.version}</h3><p>Сдано: {date(submission.submittedAt)}</p>
        <p>{submission.isLate ? 'Просрочено' : 'В срок'}</p><p className="workflow__private">{submission.description}</p>
        {submission.links.map(link => /^https?:\/\//i.test(link.url) && <p key={link.url}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a></p>)}
        {submission.attachments.map(file => <p key={file.id}><Button variant="secondary" disabled={downloading || file.status !== 'READY'} onClick={() => void download(file.id, file.displayName)}>Скачать {file.displayName}</Button> · {file.sizeBytes} байт · {file.contentType}</p>)}
        <p>Скачивается только демонстрационный файл. Доступ к реальным файлам проверяет сервер.</p>
      </Card>}
    </>}
  </section>;
}

function Evaluation({ data, busy, run, repository, companyId }: { data: ExecutionSnapshot; busy: boolean; run: Run; repository: ExecutionRepository; companyId: string }) {
  const eligible = data.participants.filter(p => p.status === 'ACTIVE');
  const [places, setPlaces] = useState<Record<string, string>>(() => Object.fromEntries(data.awards.placements.map(p => [p.applicationId, String(p.place)])));
  const [nominations, setNominations] = useState<Record<string, string[]>>(() => Object.fromEntries(eligible.map(p => [p.applicationId, data.awards.nominations.filter(n => n.applicationId === p.applicationId).map(n => n.nomination)])));
  const shared = data.rules.allowSharedPlaces;
  const chosen = Object.values(places).filter(Boolean);
  const invalid = !shared && new Set(chosen).size !== chosen.length;
  return <section><h2>Отзывы и оценки</h2><p>Отзывы приватны. Числовая оценка необязательна; места назначаются вручную.</p>
    {!eligible.length && <EmptyState title="Нет участников для оценивания" />}
    {eligible.map(p => <ReviewEditor key={p.applicationId} participant={p} data={data} busy={busy} run={run} repository={repository} companyId={companyId} />)}
    <h2>Призовые места и номинации</h2><p>Опубликованные правила: мест {data.rules.prizePlaceCount}; совместные места {shared ? 'разрешены' : 'запрещены'}.</p>
    <p>Баллы не сортируют участников и не назначают победителей.</p>
    <fieldset disabled={!data.canManage || busy}><legend>Ручное распределение</legend>{eligible.map(p => <section key={p.applicationId}>
      <div className="field"><label htmlFor={`place-${p.applicationId}`}>Место — {p.name}</label><select id={`place-${p.applicationId}`} value={places[p.applicationId] ?? ''} onChange={e => setPlaces(old => ({ ...old, [p.applicationId]: e.target.value }))}>
        <option value="">Без места</option>{Array.from({ length: data.rules.prizePlaceCount }, (_, i) => <option key={i} value={i + 1}>{i + 1} место</option>)}
      </select></div>
      {data.rules.nominationNames.map(name => <label className="execution__choice" key={name}><input type="checkbox" checked={nominations[p.applicationId]?.includes(name) ?? false}
        onChange={e => setNominations(old => ({ ...old, [p.applicationId]: e.target.checked ? [...(old[p.applicationId] ?? []), name] : (old[p.applicationId] ?? []).filter(n => n !== name) }))} />{name} — {p.name}</label>)}
    </section>)}
      {invalid && <p role="alert">Совместные места запрещены правилами. Выберите разные места.</p>}
      <Button disabled={invalid || !eligible.length} onClick={() => void run(() => repository.awards(companyId, data.dashboard.caseId, {
        expectedAwardsVersion: data.awards.version,
        placements: eligible.flatMap(p => places[p.applicationId] ? [{ applicationId: p.applicationId, place: Number(places[p.applicationId]) }] : []),
        nominations: eligible.flatMap(p => (nominations[p.applicationId] ?? []).map(nomination => ({ applicationId: p.applicationId, nomination }))),
      }), 'Распределение мест сохранено.')}>Сохранить распределение</Button>
    </fieldset>
    <h3>Сохранённое распределение · версия {data.awards.version}</h3>
    {!data.awards.placements.length && <p>Места пока не назначены.</p>}
    {Array.from({ length: data.rules.prizePlaceCount }, (_, i) => i + 1).map(place => {
      const winners = data.awards.placements.filter(p => p.place === place);
      return winners.length > 0 && <p key={place}>{place} место: {winners.map(w => data.participants.find(p => p.applicationId === w.applicationId)?.name).join(', ')}</p>;
    })}
    {data.awards.nominations.map(n => <p key={`${n.applicationId}:${n.nomination}`}>{n.nomination}: {data.participants.find(p => p.applicationId === n.applicationId)?.name}</p>)}
    <p>Черновик результатов не опубликован. Публикация и реальная интеграция — следующий этап.</p>
  </section>;
}

function ReviewEditor({ participant, data, busy, run, repository, companyId }: { participant: ExecutionParticipant; data: ExecutionSnapshot; busy: boolean; run: Run; repository: ExecutionRepository; companyId: string }) {
  const saved = data.reviews.find(r => r.applicationId === participant.applicationId);
  const [feedback, setFeedback] = useState(saved?.feedback ?? ''); const [score, setScore] = useState(saved?.score == null ? '' : String(saved.score));
  const range = data.rules.scoreRange;
  async function submit(e: FormEvent) {
    e.preventDefault(); await run(() => repository.review(companyId, data.dashboard.caseId, participant.applicationId, {
      expectedReviewVersion: saved?.version ?? 0, feedback, score: score === '' ? null : Number(score),
    }), `Отзыв для ${participant.name} сохранён.`);
  }
  return <form onSubmit={submit} className="workflow__form"><fieldset disabled={!data.canManage || busy}><legend>Отзыв — {participant.name}</legend>
    <div className="field"><label htmlFor={`feedback-${participant.applicationId}`}>Комментарий компании — {participant.name}</label><textarea id={`feedback-${participant.applicationId}`} required maxLength={10000} value={feedback} onChange={e => setFeedback(e.target.value)} /></div>
    <div className="field"><label htmlFor={`score-${participant.applicationId}`}>Оценка — {participant.name}</label><input id={`score-${participant.applicationId}`} type="number" step="any" min={range?.min} max={range?.max} disabled={!range} value={score} onChange={e => setScore(e.target.value)} /></div>
    <p>{range ? `Шкала ${range.min}–${range.max}. Пустое поле удаляет оценку.` : 'Числовая шкала не предусмотрена правилами.'}</p>
    <Button type="submit" disabled={!feedback.trim()}>Сохранить отзыв — {participant.name}</Button>
    <p>Версия отзыва: {saved?.version ?? 0}</p>
  </fieldset></form>;
}
