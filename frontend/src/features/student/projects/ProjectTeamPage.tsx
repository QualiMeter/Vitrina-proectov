import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { useStudent, useLoad, useAction, date } from "../hooks";
import { Load, Status } from "../shared";
import {
  PublicationStatus,
  PublicationDemoLink,
} from "../publications/PublicationsUI";
import { useProjectManagement } from "./context";
import type { ManagedProject } from "./models";
import "./projects.css";
export function ProjectTeamPage() {
  const { projectId = "" } = useParams(),
    { demo, base } = useStudent(),
    api = useProjectManagement(demo),
    state = useLoad(() => api.manage(projectId), `project-team-${projectId}`);
  return (
    <>
      <Link to={`${base}/projects`}>← Мои проекты</Link>
      <h1>Команда и заявки проекта</h1>
      <Load state={state}>
        {(data) => (
          <TeamContent
            key={`${projectId}-${data.version}-${data.project.version}`}
            data={data}
            reload={state.reload}
          />
        )}
      </Load>
      {!demo && <PublicationDemoLink to="/demo/student/projects" />}
    </>
  );
}
function TeamContent({
  data,
  reload,
}: {
  data: ManagedProject;
  reload: () => void;
}) {
  const { demo, base } = useStudent(),
    api = useProjectManagement(demo),
    action = useAction(),
    [stale, setStale] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const p = data.project;
  async function command(fn: () => Promise<void>) {
    try {
      await fn();
      reload();
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "status" in e &&
        (e.status === 409 || e.status === 403)
      )
        setStale(true);
      throw e;
    }
  }
  return (
    <div className="student-stack">
      <Card>
        <h2 className="publication-title">{p.title}</h2>
        <PublicationStatus item={p} />
        <Link to={`${base}/projects/${p.id}/edit`}>
          Редактировать проект и открытые роли
        </Link>
      </Card>
      {action.feedback}
      {stale && (
        <section role="alert">
          <p>
            Данные или права изменились. Обновите состав и заново выберите
            действие; решение автоматически не повторяется.
          </p>
          <Button onClick={reload}>Обновить состав и заявки</Button>
        </section>
      )}
      <Card>
        <h2>Назначенный куратор</h2>
        {data.curator ? (
          <>
            <p>{data.curator.nickname}</p>
            <p>Назначен: {date(data.curator.assignedAt)}</p>
          </>
        ) : (
          <p>Куратор пока не назначен.</p>
        )}
        <p className="student-note">
          Назначение и снятие выполняет университет. Изменения отображаются в
          уведомлениях.
        </p>
        <Link to={`${base}/notifications`}>Открыть уведомления</Link>
      </Card>
      <Card>
        <h2>Подтверждённый состав</h2>
        <ul className="student-list">
          {data.members.map((m) => (
            <li key={m.userId}>
              <strong>{m.nickname}</strong> · {m.role}
              {m.userId !== p.authorId &&
                data.allowedActions.includes("remove") && (
                  <div className="student-actions">
                    {confirmation === m.userId ? (
                      <>
                        <p>Исключить {m.nickname} из проекта?</p>
                        <Button
                          disabled={action.busy || stale}
                          onClick={() =>
                            void action.run(
                              () =>
                                command(() =>
                                  api.remove(p.id, m.userId, data.version),
                                ),
                              "Участник исключён",
                            )
                          }
                        >
                          Подтвердить исключение
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => setConfirmation("")}
                        >
                          Отмена
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="secondary"
                        disabled={action.busy || stale}
                        onClick={() => setConfirmation(m.userId)}
                      >
                        Исключить участника {m.nickname}
                      </Button>
                    )}
                  </div>
                )}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2>Заявки в проект</h2>
        {!data.applications.length && <p>Заявок пока нет.</p>}
        <div className="student-stack">
          {data.applications.map((a) => (
            <article key={a.id} className="project-application">
              <h3>{a.nickname}</h3>
              <Status value={a.status} />
              <p>Роль: {a.roleTitle}</p>
              <p className="student-preserve-text">{a.message}</p>
              <p>{date(a.createdAt)}</p>
              {a.status === "PENDING" &&
                data.allowedActions.includes("decide") && (
                  <div className="student-actions">
                    <Button
                      disabled={
                        action.busy ||
                        stale ||
                        p.moderation !== "PUBLISHED" ||
                        p.kind !== "PROJECT" ||
                        ["PAUSED", "COMPLETED"].includes(p.developmentStatus) ||
                        !p.vacancies.some((v) => v.id === a.roleId && v.active)
                      }
                      onClick={() =>
                        void action.run(
                          () =>
                            command(() =>
                              api.decide(p.id, a.id, "ACCEPTED", data.version),
                            ),
                          "Заявка принята; участник добавлен в состав",
                        )
                      }
                    >
                      Принять {a.nickname}
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={action.busy || stale}
                      onClick={() =>
                        void action.run(
                          () =>
                            command(() =>
                              api.decide(p.id, a.id, "REJECTED", data.version),
                            ),
                          "Заявка отклонена",
                        )
                      }
                    >
                      Отклонить {a.nickname}
                    </Button>
                  </div>
                )}
            </article>
          ))}
        </div>
      </Card>
      <Card>
        <h2>Открытые роли</h2>
        {p.kind === "PROJECT" &&
          p.vacancies
            .filter((v) => v.active)
            .map((v) => (
              <p key={v.id}>
                <strong>{v.title}</strong> · {v.skills}
              </p>
            ))}
        {p.kind === "PROJECT" && !p.vacancies.some((v) => v.active) && (
          <p>Открытых ролей нет.</p>
        )}
        <p className="student-note">
          Изменение ролей выполняется в редакторе проекта и не меняет
          фактический состав.
        </p>
      </Card>
    </div>
  );
}
