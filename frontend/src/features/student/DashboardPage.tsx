import { Card } from "../../components/ui/Card";
import { Button, ButtonLink } from "../../components/ui/Button";
import { StudentProjectsBlock } from "./StudentProjectsBlock";
import { demoStudentProjects } from "./projectExamples";
import { Load, Status } from "./shared";
import { date, useLoad, useStudent } from "./hooks";
import type * as C from "./contracts";

function Signals({ items }: { items: C.MyCaseParticipation[] }) {
  const { api } = useStudent();
  const ids = [
    ...new Set(
      items
        .filter((x) => x.caseStatus === "REGISTRATION_OPEN")
        .map((x) => x.caseId),
    ),
  ].slice(0, 6);
  const invitations = useLoad(
    () => api.dashboardInvitations(),
    "pending-invitations",
  );
  const deadlines = useLoad(
    () => api.dashboardDeadlines(ids),
    `deadlines-${ids.join(",")}`,
  );
  return (
    <div className="student-grid">
      <Card>
        <h2>Ожидающие приглашения</h2>
        <Load state={invitations}>
          {(data) => (
            <>
              <p>Ожидают ответа: {data.total}</p>
              {data.items.length ? (
                <ul className="student-dashboard-list">
                  {data.items.map((x) => (
                    <li key={x.id}>
                      <strong>{x.title}</strong>
                      <span>Ответить до {date(x.expiresAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="student-note">
                  Нет действующих приглашений на этой странице.
                </p>
              )}
              {data.total > 20 && (
                <p className="student-note">
                  Показаны первые 20 ожидающих приглашений.
                </p>
              )}
            </>
          )}
        </Load>
        <Button variant="secondary" disabled>
          Приглашения · Скоро
        </Button>
      </Card>
      <Card>
        <h2>Ближайшие сроки подачи</h2>
        <Load state={deadlines}>
          {(data) => (
            <>
              {data.items.length ? (
                <ul className="student-dashboard-list">
                  {data.items.map((x) => (
                    <li key={x.id}>
                      <strong>{x.title}</strong>
                      <time dateTime={x.at}>{date(x.at)}</time>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="student-note">
                  Для загруженных кейсов нет предстоящих сроков подачи.
                </p>
              )}
              {data.unavailable > 0 && (
                <p role="status">
                  Не удалось загрузить кейсов: {data.unavailable}.{" "}
                  <Button variant="ghost" onClick={deadlines.reload}>
                    Повторить загрузку сроков
                  </Button>
                </p>
              )}
            </>
          )}
        </Load>
        <p className="student-note">
          Сроки набора для первых шести открытых кейсов на странице участий.
        </p>
      </Card>
    </div>
  );
}
export function DashboardPage() {
  const { api, base, demo } = useStudent();
  const state = useLoad(
    async () => ({
      profile: await api.profile(),
      participations: await api.participations(1),
    }),
    "dashboard",
  );
  return (
    <>
      <h1>Мой кабинет</h1>
      <p className="student-lead">Ваши кейсы и ближайшие действия.</p>
      <Load state={state}>
        {({ profile, participations }) => {
          const active = participations.items.filter(
            (x) =>
              x.applicationStatus === "ADMITTED" &&
              !["ELIMINATED", "EXCLUDED"].includes(
                x.teamExecutionStatus ?? "",
              ) &&
              !["COMPLETED", "CANCELED", "FINAL_CLOSED"].includes(
                x.caseStatus ?? "",
              ),
          );
          const drafts = participations.items.filter(
            (x) => x.applicationStatus === "DRAFT",
          );
          return (
            <>
              <div className="student-welcome">
                <div>
                  <p className="student-note">С возвращением</p>
                  <h2>{profile.nickname}</h2>
                </div>
                <ButtonLink variant="secondary" to={`${base}/profile`}>
                  Открыть профиль
                </ButtonLink>
              </div>
              <div className="student-metrics" aria-label="Сводка участий">
                <Card>
                  <strong>{participations.total}</strong>
                  <span>Всего участий</span>
                </Card>
                <Card>
                  <strong>{active.length}</strong>
                  <span>Активных на странице</span>
                </Card>
                <Card>
                  <strong>{drafts.length}</strong>
                  <span>Черновиков на странице</span>
                </Card>
              </div>
              <div className="student-grid">
                <Card>
                  <h2>Активные кейсы</h2>
                  {active.length ? (
                    <ul className="student-dashboard-list">
                      {active.map((x) => (
                        <li key={x.caseId}>
                          <strong>{x.caseTitle}</strong>
                          <Status value={x.caseStatus ?? x.applicationStatus} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>На этой странице активных кейсов нет.</p>
                  )}
                  <ButtonLink to={`${base}/participations`}>
                    Все участия
                  </ButtonLink>
                </Card>
                <Card>
                  <h2>Продолжить черновики</h2>
                  {drafts.length ? (
                    <ul className="student-dashboard-list">
                      {drafts.map((x) => (
                        <li key={x.caseId}>
                          <strong>{x.caseTitle}</strong>
                          <span>Заявка ещё не отправлена</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>На этой странице черновиков нет.</p>
                  )}
                  <ButtonLink variant="secondary" to={`${base}/participations`}>
                    Открыть список заявок
                  </ButtonLink>
                </Card>
              </div>
              {participations.total > participations.pageSize && (
                <p className="student-note">
                  Сводка активных кейсов и черновиков относится к первой
                  странице.
                </p>
              )}
              <Signals items={participations.items} />
              {demo && (
                <StudentProjectsBlock
                  projects={demoStudentProjects}
                  basePath="/demo/student-projects"
                />
              )}
            </>
          );
        }}
      </Load>
    </>
  );
}
