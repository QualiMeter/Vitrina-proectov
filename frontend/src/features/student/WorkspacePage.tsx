import { useCallback, useEffect, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Load, Status } from "./shared";
import { useLoad, useStudent, date } from "./hooks";
import { ProtectedFileButton } from "./ProtectedFileButton";
import { ProfileLeaveDialog } from "./ProfileLeaveDialog";
import { CheckpointPanel } from "./CheckpointPanel";
import { executionDemoExtras } from "./executionDemo";
import type * as C from "./contracts";
type WorkspaceData = {
  workspace: C.CaseParticipantWorkspace;
  details: C.CasePublicDetails;
  app: C.CaseApplication;
  team?: C.CaseTeam;
};
function WorkspaceContent({ data }: { data: WorkspaceData }) {
  const { demo, base } = useStudent();
  const { workspace, details, app, team } = data;
  const [dirtyIds, setDirtyIds] = useState<string[]>([]);
  const onDirty = useCallback(
    (id: string, dirty: boolean) =>
      setDirtyIds((previous) =>
        previous.includes(id) === dirty
          ? previous
          : dirty
            ? [...previous, id]
            : previous.filter((x) => x !== id),
      ),
    [],
  );
  const blocker = useBlocker(dirtyIds.length > 0);
  useEffect(() => {
    if (!dirtyIds.length) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirtyIds.length]);
  const visible = [
    "EXECUTING",
    "FINAL_CLOSED",
    "EVALUATING",
    "COMPLETED",
    "CANCELED",
  ].includes(workspace.status);
  return (
    <>
      {blocker.state === "blocked" && (
        <ProfileLeaveDialog
          title="Неотправленные изменения результата"
          onStay={() => blocker.reset()}
          onLeave={() => blocker.proceed()}
        />
      )}
      <Card>
        <h2>{details.title}</h2>
        <p>{details.companyName}</p>
        <div className="student-tags">
          <Status value={workspace.status} />
          <Status value={workspace.myParticipationStatus} />
        </div>
        <p>
          {app.format === "SOLO"
            ? "Индивидуальное участие"
            : (team?.name ?? "Командная заявка")}
        </p>
        {team && (
          <>
            <h3>Состав команды</h3>
            <ul className="student-list">
              {team.members.map((m) => (
                <li key={m.userId}>
                  {m.displayName} · {m.isCaptain ? "Капитан" : "Участник"}
                </li>
              ))}
            </ul>
          </>
        )}
        <Link to={`${base}/cases/${workspace.caseId}/apply`}>
          Посмотреть заявку
        </Link>
      </Card>
      {!visible ? (
        <Card>
          <h2>Кейс ещё не запущен</h2>
          <p>Закрытые инструкции, этапы и материалы пока недоступны.</p>
        </Card>
      ) : (
        <>
          {workspace.myParticipationStatus !== "ACTIVE" && (
            <p role="status">
              Участие завершено. Показана только доступная вам история и
              разрешённые материалы.
            </p>
          )}
          {workspace.stages.length ? (
            workspace.stages.map((stage) => (
              <section
                className="student-stage student-stack"
                key={stage.id}
                aria-labelledby={`stage-${stage.id}`}
              >
                <h2 id={`stage-${stage.id}`}>
                  Этап {stage.sequence}. {stage.title}
                </h2>
                {stage.description && (
                  <p className="student-preserve-text">{stage.description}</p>
                )}
                <Card>
                  <h3>Материалы этапа</h3>
                  {stage.materials.length ? (
                    <ul className="student-list">
                      {stage.materials.map((m) => (
                        <li key={m.fileId}>
                          <p>
                            {m.displayName} · {Math.ceil(m.sizeBytes / 1024)} КБ
                          </p>
                          <ProtectedFileButton
                            id={m.fileId}
                            name={m.displayName}
                          />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Доступных материалов нет.</p>
                  )}
                </Card>
                {stage.checkpoints.map((point) => (
                  <CheckpointPanel
                    key={point.id}
                    workspace={workspace}
                    app={app}
                    team={team}
                    point={point}
                    onDirty={onDirty}
                  />
                ))}
              </section>
            ))
          ) : (
            <Card>
              <h2>Доступных этапов пока нет</h2>
              <p>Этапы появятся после открытия доступа.</p>
            </Card>
          )}
          <Card>
            <h2>Комментарии компании</h2>
            {demo ? (
              <>
                <p className="student-note">Учебные примеры комментариев</p>
                {executionDemoExtras.comments.map((c, i) => (
                  <article key={i}>
                    <h3>{c.author}</h3>
                    <p>{c.text}</p>
                    <time dateTime={c.at}>{date(c.at)}</time>
                  </article>
                ))}
              </>
            ) : (
              <p>Просмотр комментариев пока недоступен.</p>
            )}
          </Card>
        </>
      )}
    </>
  );
}
export function WorkspacePage() {
  const { caseId = "" } = useParams(),
    { api } = useStudent();
  const state = useLoad(async () => {
    const workspace = await api.workspace(caseId);
    if (workspace.caseId !== caseId)
      throw new Error("Рабочая область относится к другому кейсу.");
    const [details, app] = await Promise.all([
      api.caseDetails(caseId),
      api.application(workspace.applicationId),
    ]);
    if (app.caseId !== caseId || app.id !== workspace.applicationId)
      throw new Error("Заявка не соответствует рабочей области.");
    // Former members may retain history while the private team DTO is no longer available.
    let team: C.CaseTeam | undefined;
    if (app.teamId) {
      try {
        team = await api.team(app.teamId);
      } catch {
        /* Fail closed for authoring; keep the authorized history. */
      }
    }
    return { workspace, details, app, team };
  }, `workspace-${caseId}`);
  return (
    <div className="student-stack">
      <h1>Рабочее пространство кейса</h1>
      <Load state={state}>
        {(data) => (
          <WorkspaceContent key={data.workspace.applicationId} data={data} />
        )}
      </Load>
    </div>
  );
}
