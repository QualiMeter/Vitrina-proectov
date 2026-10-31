import { Card } from "../../components/ui/Card";
import { ButtonLink } from "../../components/ui/Button";
import { StudentProjectsBlock } from "./StudentProjectsBlock";
import { demoStudentProjects } from "./projectExamples";
import { Load, Status } from "./shared";
import { date, useLoad, useStudent } from "./hooks";
import type * as C from "./contracts";

function Signals({ items }: { items: C.MyCaseParticipation[] }) {
  const { api, base } = useStudent();
  const ids = items
    .filter((x) => x.caseStatus === "REGISTRATION_OPEN")
    .slice(0, 6)
    .map((x) => x.caseId);
  const state = useLoad(
    () => api.dashboardSignals(ids),
    `signals-${ids.join(",")}`,
  );
  return (
    <Load state={state}>
      {(data) => (
        <div className="student-grid">
          <Card>
            <h2>Ожидающие приглашения</h2>
            {data.pending.length ? (
              <ul className="student-dashboard-list">
                {data.pending.map((x) => (
                  <li key={x.id}>
                    <strong>{x.title}</strong>
                    <span>Ответить до {date(x.expiresAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="student-note">Нет приглашений, ожидающих ответа.</p>
            )}
            {data.pendingPageOnly && (
              <p className="student-note">
                Показана первая страница приглашений.
              </p>
            )}
            <ButtonLink variant="secondary" to={`${base}/invitations`}>
              Посмотреть приглашения
            </ButtonLink>
          </Card>
          <Card>
            <h2>Ближайшие сроки подачи</h2>
            {data.deadlines.length ? (
              <ul className="student-dashboard-list">
                {data.deadlines.map((x) => (
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
            <p className="student-note">
              Сроки набора для первых шести открытых кейсов на странице участий.
            </p>
          </Card>
        </div>
      )}
    </Load>
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
