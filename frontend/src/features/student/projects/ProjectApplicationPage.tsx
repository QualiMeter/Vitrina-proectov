import { ProfileLeaveDialog } from "../ProfileLeaveDialog";
import { useEffect, useState } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { useStudent, useLoad, useAction } from "../hooks";
import { Load, Status } from "../shared";
import { PublicationDemoLink } from "../publications/PublicationsUI";
import { useProjectManagement } from "./context";
import type { ApplicationContext } from "./models";
export function ProjectApplicationPage() {
  const { projectId = "" } = useParams(),
    { demo } = useStudent(),
    api = useProjectManagement(demo),
    state = useLoad(
      () => api.applicationContext(projectId),
      `project-apply-${projectId}`,
    );
  return (
    <>
      <h1>Заявка в студенческий проект</h1>
      <Load state={state}>
        {(data) => (
          <ApplicationForm
            key={`${projectId}-${data.application?.version ?? 0}`}
            data={data}
            reload={state.reload}
          />
        )}
      </Load>
      {!demo && <PublicationDemoLink to="/demo/student-projects" />}
    </>
  );
}
function ApplicationForm({
  data,
  reload,
}: {
  data: ApplicationContext;
  reload: () => void;
}) {
  const { demo, base } = useStudent(),
    api = useProjectManagement(demo),
    action = useAction(),
    [message, setMessage] = useState(""),
    [role, setRole] = useState(""),
    [sent, setSent] = useState(false),
    [stale, setStale] = useState(false),
    [confirmation, setConfirmation] = useState(false);
  const dirty = !!(message.trim() || role) && !sent,
    blocker = useBlocker(dirty);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const [context, setContext] = useState(data);
  const p = context.project,
    a = context.application;
  return (
    <div className="student-stack">
      <Link to={`${demo ? "/demo" : ""}/student-projects/${p.id}`}>
        ← Публичная карточка проекта
      </Link>
      <Card>
        <h2>{p.title}</h2>
        <p>
          Контакт с автором необязателен для подачи. Личные телефон и email не
          раскрываются.
        </p>
        {context.relation === "AUTHOR" ? (
          <>
            <p>Вы автор этого проекта.</p>
            <Link to={`${base}/projects/${p.id}/team`}>
              Открыть кабинет проекта
            </Link>
          </>
        ) : context.relation === "MEMBER" ? (
          <p>Вы уже подтверждённый участник проекта.</p>
        ) : a ? (
          <>
            <h3>Ваша заявка</h3>
            {a.status === "ACCEPTED" && (
              <p>
                Состав изменился: вы больше не входите в команду. История
                принятой заявки сохранена.
              </p>
            )}
            <Status value={a.status} />
            <p>Роль: {a.roleTitle}</p>
            <p className="student-preserve-text">{a.message}</p>
            {a.status === "PENDING" &&
              (confirmation ? (
                <>
                  <p>
                    Отозвать заявку? В учебном примере повторная подача в этот
                    проект не предусмотрена.
                  </p>
                  <Button
                    disabled={action.busy || stale}
                    onClick={() =>
                      void action.run(async () => {
                        try {
                          await api.withdraw(p.id, a.id, a.version);
                          reload();
                        } catch (e) {
                          setStale(true);
                          throw e;
                        }
                      }, "Заявка отозвана")
                    }
                  >
                    Подтвердить отзыв
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirmation(false)}
                  >
                    Отмена
                  </Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmation(true)}
                >
                  Отозвать заявку
                </Button>
              ))}
          </>
        ) : (
          <form
            className="student-form"
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(async () => {
                try {
                  await api.apply(p.id, role, message);
                  setSent(true);
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
              }, "Заявка отправлена");
            }}
          >
            <label className="field">
              Открытая роль
              <select
                required
                value={role}
                disabled={action.busy || stale}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="">Выберите роль</option>
                {p.vacancies
                  .filter((v) => v.active)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.title}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Сопроводительное письмо
              <textarea
                required
                maxLength={2000}
                value={message}
                disabled={action.busy}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <p className="student-note">
              Письмо увидит автор проекта. Отправка не добавляет в команду до
              принятия заявки.
            </p>
            {["PAUSED", "COMPLETED"].includes(p.developmentStatus) && (
              <p>Приём заявок в этом состоянии разработки закрыт.</p>
            )}
            {!p.vacancies.some((v) => v.active) && (
              <p>Открытых ролей пока нет.</p>
            )}
            <Button
              disabled={
                action.busy ||
                stale ||
                !role ||
                !message.trim() ||
                ["PAUSED", "COMPLETED"].includes(p.developmentStatus)
              }
            >
              Отправить заявку в проект
            </Button>
          </form>
        )}
        {action.feedback}
        {stale && (
          <>
            <p>
              Данные или права изменились. Текст оставлен в форме. Проверка
              состояния не повторяет отправку; если заявка уже создана, будет
              показана её текущая версия.
            </p>
            <Button
              variant="secondary"
              onClick={() =>
                void action.run(async () => {
                  const fresh = await api.applicationContext(p.id);
                  if (fresh.application || fresh.relation !== "CANDIDATE")
                    reload();
                  else {
                    setContext(fresh);
                    if (
                      !fresh.project.vacancies.some(
                        (v) => v.id === role && v.active,
                      )
                    )
                      setRole("");
                    setStale(false);
                  }
                }, "Состояние проверено")
              }
            >
              Проверить состояние заявки
            </Button>
          </>
        )}
      </Card>
      {blocker.state === "blocked" && (
        <ProfileLeaveDialog
          title="Несохранённая заявка проекта"
          onStay={() => blocker.reset()}
          onLeave={() => blocker.proceed()}
        />
      )}
    </div>
  );
}
