import { readOwnHistory } from "./submissionHistory";
import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { Load, Status, ExternalLink } from "./shared";
import { date, useLoad, useStudent } from "./hooks";
import { executionBlock, checkpointKind } from "./executionRules";
import { SubmissionEditor } from "./SubmissionEditor";
import { ProtectedFileButton } from "./ProtectedFileButton";
import { executionDemoExtras } from "./executionDemo";
import type * as C from "./contracts";
type Props = {
  workspace: C.CaseParticipantWorkspace;
  app: C.CaseApplication;
  team?: C.CaseTeam;
  point: C.WorkspaceCheckpoint;
  onDirty: (id: string, dirty: boolean) => void;
};
function HistoryAndEditor({
  initial,
  ...props
}: Props & { initial: C.SubmissionVersionList }) {
  const { user, demo } = useStudent();
  const { workspace, app, team, point, onDirty } = props;
  const [history, setHistory] = useState(initial);
  const blocked = executionBlock(workspace, app, team, user.id, point);
  return (
    <>
      <h4>История версий</h4>
      {history.items.length ? (
        <ol className="student-version-list">
          {[...history.items]
            .sort((a, b) => b.version - a.version)
            .map((v) => (
              <li key={v.id}>
                <details>
                  <summary>
                    Версия {v.version} · {date(v.submittedAt)}
                    {v.isLate ? " · Просрочено" : " · В срок"}
                  </summary>
                  <p className="student-preserve-text">
                    {v.description || "Без текстового описания"}
                  </p>
                  <ul className="student-list">
                    {v.links.map((x, i) => (
                      <li key={i}>
                        <ExternalLink url={x.url}>{x.label}</ExternalLink>
                      </li>
                    ))}
                  </ul>
                  {v.attachments.map((f) => (
                    <ProtectedFileButton
                      key={f.id}
                      id={f.id}
                      name={f.displayName}
                    />
                  ))}
                </details>
              </li>
            ))}
        </ol>
      ) : (
        <p>Результаты ещё не отправлялись.</p>
      )}
      {point.kind === "REGULAR" && (
        <p>
          {demo
            ? `Учебный результат проверки: ${executionDemoExtras.regularResult}`
            : "Результат проверки пока недоступен."}
        </p>
      )}
      {blocked ? (
        <p className="student-note">{blocked}</p>
      ) : (
        <SubmissionEditor
          caseId={workspace.caseId}
          applicationId={app.id}
          point={point}
          initialVersion={history.latestVersion}
          onDirty={onDirty}
          onSaved={(v) =>
            setHistory((previous) => ({
              items: [...previous.items.filter((x) => x.id !== v.id), v],
              latestVersion: v.version,
            }))
          }
        />
      )}
      {point.kind === "SELECTION" && (
        <SelectionResult
          point={point}
          applicationId={app.id}
          teamId={app.teamId}
        />
      )}
    </>
  );
}
function SelectionResult({
  point,
  applicationId,
  teamId,
}: {
  point: C.WorkspaceCheckpoint;
  applicationId: string;
  teamId?: string;
}) {
  const { api } = useStudent();
  const state = useLoad(async () => {
    const result = await api.selectionResult(point.id);
    if (
      result.checkpointId !== point.id ||
      ("applicationId" in result
        ? result.applicationId !== applicationId
        : result.teamId !== teamId)
    )
      throw new Error("Ответ не соответствует вашей заявке.");
    return result;
  }, `selection-${point.id}`);
  return (
    <section aria-label="Результат отбора">
      <h4>Результат отбора</h4>
      <Load state={state}>
        {(result) => (
          <>
            <Status value={result.outcome} />
            {result.decidedAt && <p>Решение: {date(result.decidedAt)}</p>}
          </>
        )}
      </Load>
    </section>
  );
}
export function CheckpointPanel(props: Props) {
  const { api } = useStudent();
  const { point } = props;
  const history = useLoad(
    () => readOwnHistory(api, point.id, props.app.id),
    `history-${point.id}`,
  );
  return (
    <Card>
      <h3>{point.title}</h3>
      <p>
        {checkpointKind[point.kind]} · Срок:{" "}
        <time dateTime={point.deadline}>{date(point.deadline)}</time>
      </p>
      <p>{point.intakeStatus === "OPEN" ? "Приём открыт" : "Приём закрыт"}</p>
      <Load state={history}>
        {(data) => <HistoryAndEditor {...props} initial={data} />}
      </Load>
    </Card>
  );
}
