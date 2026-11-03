import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/feedback/States';
import type { CaseStage, CaseCheckpoint } from './contracts.generated';
import type { WorkflowRepository, CaseSnapshot, RunAction } from './repository';
import { isoDate, localDate } from './viewHelpers';

type Props = { workflow: WorkflowRepository; companyId: string; snapshot: CaseSnapshot; stages: CaseStage[];
  busy: boolean; run: RunAction; confirm: (title: string, description: string, operation: () => Promise<unknown>) => void };
type StageFields = { id?: string; version?: number; title: string; sequence: string; kind: CaseStage['kind']; description: string; availableFrom: string };
type CheckpointFields = { id?: string; version?: number; stageId: string; title: string; kind: CaseCheckpoint['kind']; deadline: string; teamLimit: string; soloLimit: string; instructions: string };
const checkpointLabels = { REGULAR: 'Обычная', SELECTION: 'Отборочная', FINAL: 'Финальная' };

export function StageEditor({ workflow, companyId, snapshot, stages, busy, run, confirm }: Props) {
  const formId = useId();
  const [stageForm, setStageForm] = useState<StageFields | null>(null);
  const [pointForm, setPointForm] = useState<CheckpointFields | null>(null);
  const writable = snapshot.permissions.editStages;
  const caseId = snapshot.item.id;
  const version = snapshot.item.version;
  function editStage(stage?: CaseStage) {
    setStageForm(stage ? { id: stage.id, version: stage.version, title: stage.title, sequence: String(stage.sequence), kind: stage.kind,
      description: stage.description ?? '', availableFrom: localDate(stage.availableFrom) }
      : { title: '', sequence: String(Math.max(0, ...stages.map((item) => item.sequence)) + 1), kind: 'WORK', description: '', availableFrom: '' });
    setPointForm(null);
  }
  function editPoint(stage: CaseStage, point?: CaseCheckpoint) {
    setPointForm({ stageId: stage.id, id: point?.id, version: point?.version, title: point?.title ?? '', kind: point?.kind ?? 'REGULAR',
      deadline: localDate(point?.deadline), teamLimit: point?.selectionLimit === undefined ? '' : String(point.selectionLimit),
      soloLimit: point?.soloSelectionLimit === undefined ? '' : String(point.soloSelectionLimit), instructions: point?.instructions ?? '' });
    setStageForm(null);
  }
  async function saveStage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!stageForm || !writable) return;
    const form = stageForm;
    const ok = await run(async () => {
      const fields = { title: form.title.trim(), sequence: Number(form.sequence), description: form.description,
        ...(form.availableFrom ? { availableFrom: isoDate(form.availableFrom) } : {}) };
      if (form.id) await workflow.updateStage(companyId, form.id, { ...fields, expectedCaseVersion: version, expectedVersion: form.version ?? 0 });
      else await workflow.createStage(companyId, caseId, { ...fields, kind: form.kind, expectedCaseVersion: version });
    }, 'Этап сохранён.');
    if (ok) setStageForm(null);
  }
  async function savePoint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!pointForm || !writable) return;
    const form = pointForm;
    const ok = await run(async () => {
      const fields = { title: form.title.trim(), deadline: isoDate(form.deadline), instructions: form.instructions,
        ...(form.kind === 'SELECTION' && snapshot.item.participationFormat !== 'SOLO' ? { selectionLimit: Number(form.teamLimit) } : {}),
        ...(form.kind === 'SELECTION' && snapshot.item.participationFormat !== 'TEAM' ? { soloSelectionLimit: form.soloLimit === '' ? -1 : Number(form.soloLimit) } : {}) };
      if (form.id) await workflow.updateCheckpoint(companyId, form.id, { ...fields, expectedCaseVersion: version, expectedVersion: form.version ?? 0 });
      else await workflow.createCheckpoint(companyId, form.stageId, { ...fields, kind: form.kind, expectedCaseVersion: version });
    }, 'Контрольная точка сохранена.');
    if (ok) setPointForm(null);
  }
  return <section><h2>Этапы и контрольные точки</h2>
    <p>Обычные этапы описывают план и не имеют отметки «готово». Срок каждой точки общий для всех участников.
      Общий финальный срок задаётся в финальной контрольной точке.</p>
    {!writable && <p>Изменение структуры недоступно: нужен доступный черновик или кейс на доработке.</p>}
    {writable && <Button disabled={busy} onClick={() => editStage()}>Добавить этап</Button>}
    {stageForm && <form className="workflow__form" onSubmit={(event) => void saveStage(event)}>
      <fieldset disabled={!writable || busy}><legend>{stageForm.id ? 'Редактирование этапа' : 'Новый этап'}</legend>
        <Input label="Название этапа" required maxLength={200} value={stageForm.title} onChange={(event) => setStageForm({ ...stageForm, title: event.target.value })} />
        <Input label="Порядок этапа" type="number" min={1} step={1} required value={stageForm.sequence} onChange={(event) => setStageForm({ ...stageForm, sequence: event.target.value })} hint="Для перестановки сначала используйте свободный номер; номера не должны повторяться." />
        <div className="field"><label htmlFor={`${formId}-stage-kind`}>Тип этапа</label><select id={`${formId}-stage-kind`} disabled={Boolean(stageForm.id)}
          value={stageForm.kind} onChange={(event) => setStageForm({ ...stageForm, kind: event.target.value as CaseStage['kind'] })}>
          <option value="WORK">Обычный</option><option value="FINAL">Финальный</option>
        </select></div>
        <label className="field">Описание этапа<textarea maxLength={10000} value={stageForm.description} onChange={(event) => setStageForm({ ...stageForm, description: event.target.value })} /></label>
        <Input label="Дата доступности этапа" type="datetime-local" value={stageForm.availableFrom} onChange={(event) => setStageForm({ ...stageForm, availableFrom: event.target.value })} hint="Для ранее заданной даты укажите новое значение; удаление даты контрактом не предусмотрено." />
        <div className="workflow__actions"><Button type="submit">Сохранить этап</Button><Button type="button" variant="secondary" onClick={() => setStageForm(null)}>Отменить редактирование этапа</Button></div>
      </fieldset>
    </form>}
    {pointForm && <form className="workflow__form" onSubmit={(event) => void savePoint(event)}>
      <fieldset disabled={!writable || busy}><legend>{pointForm.id ? 'Редактирование точки' : 'Новая контрольная точка'}</legend>
        <Input label="Название контрольной точки" required maxLength={200} value={pointForm.title} onChange={(event) => setPointForm({ ...pointForm, title: event.target.value })} />
        <div className="field"><label htmlFor={`${formId}-point-kind`}>Вид контрольной точки</label><select id={`${formId}-point-kind`} value={pointForm.kind} disabled={Boolean(pointForm.id)}
          onChange={(event) => setPointForm({ ...pointForm, kind: event.target.value as CaseCheckpoint['kind'], teamLimit: '', soloLimit: '' })}>
          {Object.entries(checkpointLabels).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
        </select></div>
        <Input label="Общий срок контрольной точки" type="datetime-local" required value={pointForm.deadline} onChange={(event) => setPointForm({ ...pointForm, deadline: event.target.value })} />
        {pointForm.kind === 'SELECTION' && <div className="workflow__filters">
          {snapshot.item.participationFormat !== 'SOLO' && <Input label="Проходящих команд" type="number" min={1} step={1} required value={pointForm.teamLimit} onChange={(event) => setPointForm({ ...pointForm, teamLimit: event.target.value })} />}
          {snapshot.item.participationFormat !== 'TEAM' && <Input label="Проходящих соло-участников" type="number" min={0} step={1} required value={pointForm.soloLimit} onChange={(event) => setPointForm({ ...pointForm, soloLimit: event.target.value })} />}
        </div>}
        <label className="field">Закрытые инструкции<textarea maxLength={10000} value={pointForm.instructions} onChange={(event) => setPointForm({ ...pointForm, instructions: event.target.value })} /></label>
        <div className="workflow__actions"><Button type="submit">Сохранить контрольную точку</Button><Button type="button" variant="secondary" onClick={() => setPointForm(null)}>Отменить редактирование точки</Button></div>
      </fieldset>
    </form>}
    {!stages.length && <EmptyState title="Этапов пока нет" description="Можно настроить обычные этапы; финальная сдача задаётся отдельно как финальная точка." />}
    <div className="workflow__cards">{stages.map((stage) => <Card key={stage.id}>
      <h3>{stage.sequence}. {stage.title}</h3><p>{stage.kind === 'FINAL' ? 'Финальный этап' : 'Обычный этап'}</p>
      {stage.description && <p>{stage.description}</p>}
      {stage.availableFrom && <p>Доступен с: {new Date(stage.availableFrom).toLocaleString('ru-RU')}</p>}
      {writable && <div className="workflow__actions">
        <Button variant="secondary" disabled={busy} onClick={() => editStage(stage)}>Изменить этап</Button>
        <Button variant="secondary" disabled={busy || stage.checkpoints.length > 0 || stage.materials.length > 0} onClick={() => confirm('Удалить этап?', stage.title,
          () => workflow.deleteStage(companyId, stage.id, { expectedCaseVersion: version }))}>Удалить этап</Button>
        <Button disabled={busy} onClick={() => editPoint(stage)}>Добавить контрольную точку</Button>
      </div>}
      {(stage.checkpoints.length > 0 || stage.materials.length > 0) && writable && <p>Перед удалением этапа удалите его контрольные точки и материалы.</p>}
      {!stage.checkpoints.length && <p>Контрольных точек нет.</p>}
      {stage.checkpoints.map((point) => <section className="workflow__checkpoint" key={point.id} aria-label={`Контрольная точка ${point.title}`}>
        <h4>{point.title} · {checkpointLabels[point.kind]}</h4>
        <p>Общий срок: {new Date(point.deadline).toLocaleString('ru-RU')}</p>
        {point.kind === 'SELECTION' && <p>Проходящих команд: {point.selectionLimit ?? 'Не применяется'}; соло-участников: {point.soloSelectionLimit ?? 'Не применяется'}. Решение об отборе принимается вручную.</p>}
        {point.instructions && <p className="workflow__private">{point.instructions}</p>}
        {writable && <div className="workflow__actions"><Button variant="secondary" disabled={busy} onClick={() => editPoint(stage, point)}>Изменить точку</Button>
          <Button variant="secondary" disabled={busy} onClick={() => confirm('Удалить контрольную точку?', point.title,
            () => workflow.deleteCheckpoint(companyId, point.id, { expectedCaseVersion: version }))}>Удалить точку</Button></div>}
      </section>)}
    </Card>)}</div>
    <section className="workflow__blocked"><h3>Формат проверки и защита</h3>
      <p>Настройка проверки без встречи, онлайн- или очной защиты ожидает согласования полей сервиса.</p>
      <fieldset disabled><legend>Предпросмотр недоступных настроек</legend>
        <label className="field">Формат защиты<select defaultValue="materials"><option value="materials">Проверка материалов без встречи</option><option value="online">Онлайн</option><option value="offline">Очно</option></select></label>
        <Input label="Общая дата и время защиты" type="datetime-local" />
        <Input label="Место очной защиты" /><Input label="Ссылка онлайн-встречи" type="url" />
      </fieldset>
    </section>
  </section>;
}
