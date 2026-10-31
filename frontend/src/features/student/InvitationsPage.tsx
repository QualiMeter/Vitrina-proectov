import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/feedback/States";
import { Load, Pager, Status } from "./shared";
import { date, useAction, useLoad, useStudent } from "./hooks";
export function InvitationsPage() {
  const { api, base } = useStudent();
  const [page, setPage] = useState(1);
  const action = useAction();
  const state = useLoad(() => api.invitations(page), `invitations-${page}`);
  return (
    <>
      <h1>Приглашения в команды</h1>
      <p className="student-lead">
        Участие подтверждаете только вы. История решений сохраняется.
      </p>
      {action.feedback}
      <Load state={state}>
        {(data) => (
          <>
            <div className="student-stack">
              {data.items.map((item) => (
                <Card key={item.id}>
                  <h2>{item.teamName}</h2>
                  <p>
                    {item.caseTitle} · капитан: {item.captainDisplayName}
                  </p>
                  <Status value={item.status} />
                  <p className="student-note">
                    Действует до {date(item.expiresAt)}
                  </p>
                  {item.status === "PENDING" &&
                  new Date(item.expiresAt).getTime() > Date.now() ? (
                    <div className="student-actions">
                      {(["accept", "decline"] as const).map((value) => (
                        <Button
                          key={value}
                          disabled={action.busy}
                          variant={value === "accept" ? "primary" : "secondary"}
                          onClick={() =>
                            void action.run(async () => {
                              await api.decideInvitation(item.id, value);
                              state.reload();
                            })
                          }
                        >
                          {value === "accept" ? "Принять" : "Отклонить"}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    item.status === "ACCEPTED" && (
                      <p>
                        <Link to={`${base}/teams/${item.teamId}`}>
                          Открыть команду
                        </Link>
                      </p>
                    )
                  )}
                </Card>
              ))}
            </div>
            {!data.items.length && <EmptyState title="Приглашений пока нет" />}
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
