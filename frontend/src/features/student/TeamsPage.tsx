import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { ButtonLink } from "../../components/ui/Button";
import { EmptyState } from "../../components/feedback/States";
import { Load, Pager, Status } from "./shared";
import { useLoad, useStudent } from "./hooks";

export function TeamsPage() {
  const { base } = useStudent();
  const { pathname } = useLocation();
  const invitations = pathname.endsWith("/invitations");
  return (
    <>
      <h1>Команды</h1>
      <p className="student-lead">
        Ваши подтверждённые команды и личные приглашения.
      </p>
      <nav
        className="student-actions student-team-tabs"
        aria-label="Разделы команд"
      >
        <ButtonLink
          to={`${base}/teams`}
          variant={invitations ? "secondary" : "primary"}
          aria-current={!invitations ? "page" : undefined}
        >
          Мои команды
        </ButtonLink>
        <ButtonLink
          to={`${base}/teams/invitations`}
          variant={invitations ? "primary" : "secondary"}
          aria-current={invitations ? "page" : undefined}
        >
          Приглашения
        </ButtonLink>
      </nav>
      <Outlet />
    </>
  );
}
export function MyTeamsPage() {
  const { api, base } = useStudent();
  const [page, setPage] = useState(1);
  const state = useLoad(() => api.myTeams(page), `my-teams-${page}`);
  return (
    <>
      <h2>Мои команды</h2>
      <Load state={state}>
        {(data) => (
          <>
            <p className="student-note">Всего команд: {data.total}</p>
            <div className="student-grid">
              {data.items.map((item) => (
                <Card key={item.teamId}>
                  <h3>{item.teamName}</h3>
                  <p>{item.caseTitle}</p>
                  <div className="student-tags">
                    <Status value={item.role} />
                    {item.applicationStatus ? (
                      <Status value={item.applicationStatus} />
                    ) : (
                      <span className="badge">Заявка не создана</span>
                    )}
                  </div>
                  <p className="student-note">
                    Подтверждённый состав · {item.members.length}
                  </p>
                  <ul className="student-list">
                    {item.members.map((member) => (
                      <li key={member.userId}>
                        {member.displayName}
                        {member.isCaptain ? " · капитан" : ""}
                      </li>
                    ))}
                  </ul>
                  <div className="student-actions">
                    <ButtonLink to={`${base}/teams/${item.teamId}`}>
                      Открыть команду
                    </ButtonLink>
                    {item.applicationId && (
                      <ButtonLink
                        variant="secondary"
                        to={`${base}/cases/${item.caseId}/apply`}
                      >
                        Посмотреть заявку
                      </ButtonLink>
                    )}
                  </div>
                </Card>
              ))}
            </div>
            {!data.items.length && (
              <EmptyState
                title="Подтверждённых команд пока нет"
                description="Примите приглашение или создайте команду при участии в кейсе."
              />
            )}
            <Pager
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={setPage}
            />
          </>
        )}
      </Load>
    </>
  );
}
