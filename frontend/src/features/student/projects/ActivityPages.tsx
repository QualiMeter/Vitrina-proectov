import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { useStudent, useLoad, useAction, date } from "../hooks";
import { Load, Pager } from "../shared";
import { PublicationDemoLink } from "../publications/PublicationsUI";
import { useProjectManagement } from "./context";
import { demoCaseId } from "../day2Demo";
import { publicationIds } from "../publications/demo";
import type { Notice } from "./models";
export function FavoritesPage() {
  const { demo, base } = useStudent(),
    api = useProjectManagement(demo),
    state = useLoad(() => api.favorites(), "favorite-cases"),
    action = useAction();
  return (
    <>
      <h1>Избранные кейсы</h1>
      <p className="student-lead">
        Сохранённые кейсы не создают заявку и не меняют участие.
      </p>
      {action.feedback}
      <Load state={state}>
        {(items) => (
          <>
            <div className="student-grid">
              {items.map((item) => (
                <Card key={item.caseId}>
                  <h2>{item.title}</h2>
                  <p>{item.companyName}</p>
                  <Link
                    to={`${base}/cases/${encodeURIComponent(item.caseId)}/apply`}
                  >
                    Открыть условия участия
                  </Link>
                  <p>
                    <Button
                      variant="secondary"
                      disabled={action.busy}
                      onClick={() =>
                        void action.run(async () => {
                          await api.setFavorite(item.caseId, false);
                          state.reload();
                        }, "Кейс удалён из избранного")
                      }
                    >
                      Убрать из избранного
                    </Button>
                  </p>
                </Card>
              ))}
            </div>
            {!items.length && <p>Избранных кейсов пока нет.</p>}
          </>
        )}
      </Load>
      {demo && (
        <Button
          variant="secondary"
          disabled={action.busy}
          onClick={() =>
            void action.run(async () => {
              await api.setFavorite(demoCaseId, true);
              state.reload();
            }, "Учебный кейс сохранён")
          }
        >
          Сохранить учебный кейс
        </Button>
      )}
      {!demo && <PublicationDemoLink to="/demo/student/favorites" />}
    </>
  );
}
function NoticeCard({
  notice: n,
  reload,
}: {
  notice: Notice;
  reload: () => void;
}) {
  const { demo, base } = useStudent(),
    api = useProjectManagement(demo),
    action = useAction(),
    [stale, setStale] = useState(false);
  const destination = n.projectId
    ? `${base}/projects/${encodeURIComponent(n.projectId)}/${n.destination === "TEAM" ? "team" : "apply"}`
    : `${base}/teams/invitations`;
  return (
    <Card>
      <article className="project-notice">
        <h2>{n.title}</h2>
        <span className="badge badge--brand">
          {n.read ? "Прочитано" : "Новое"}
        </span>
        <p>{date(n.createdAt)}</p>
        <Link to={destination}>Открыть событие</Link>
        {!n.read && (
          <p>
            <Button
              variant="secondary"
              disabled={action.busy || stale}
              onClick={() =>
                void action.run(async () => {
                  try {
                    await api.markRead(n.id, n.version);
                    reload();
                  } catch (e) {
                    setStale(true);
                    throw e;
                  }
                }, "Уведомление прочитано")
              }
            >
              Отметить прочитанным
            </Button>
          </p>
        )}
        {action.feedback}
        {stale && (
          <Button variant="secondary" onClick={reload}>
            Обновить уведомления
          </Button>
        )}
      </article>
    </Card>
  );
}
export function NotificationsPage() {
  const { demo, base, api: student } = useStudent(),
    api = useProjectManagement(demo),
    state = useLoad(() => api.notices(), "project-notices"),
    invitations = useLoad(
      () => student.dashboardInvitations(),
      "pending-case-invitations",
    ),
    [onlyNew, setOnlyNew] = useState(false),
    [page, setPage] = useState(1);
  return (
    <>
      <h1>Уведомления</h1>
      <p className="student-lead">
        События заявок, приглашений и назначения куратора.
      </p>
      <Card>
        <h2>Приглашения в команды кейсов</h2>
        <Load state={invitations}>
          {(data) => (
            <>
              <p>Ожидают решения: {data.total}</p>
              <Link to={`${base}/teams/invitations`}>
                Открыть входящие приглашения
              </Link>
            </>
          )}
        </Load>
      </Card>
      <label>
        <input
          type="checkbox"
          checked={onlyNew}
          onChange={(e) => {
            setOnlyNew(e.target.checked);
            setPage(1);
          }}
        />
        Только непрочитанные
      </label>
      <Load state={state}>
        {(items) => {
          const filtered = items.filter((n) => !onlyNew || !n.read),
            actual = Math.min(
              page,
              Math.max(1, Math.ceil(filtered.length / 6)),
            );
          return (
            <>
              <p role="status">
                Непрочитанных: {items.filter((n) => !n.read).length}
              </p>
              <div className="student-stack">
                {filtered.slice((actual - 1) * 6, actual * 6).map((n) => (
                  <NoticeCard
                    key={`${n.id}-${n.version}`}
                    notice={n}
                    reload={state.reload}
                  />
                ))}
              </div>
              {!filtered.length && <p>Уведомлений пока нет.</p>}
              {filtered.length > 6 && (
                <Pager
                  page={actual}
                  pageSize={6}
                  total={filtered.length}
                  onPage={setPage}
                />
              )}
            </>
          );
        }}
      </Load>
      <Button
        variant="secondary"
        onClick={() => {
          state.reload();
          invitations.reload();
        }}
      >
        Обновить события
      </Button>
      {demo && (
        <p className="student-note">
          Пример назначения куратора:{" "}
          <Link to={`${base}/projects/${publicationIds.project}/team`}>
            открыть проект
          </Link>
          .
        </p>
      )}
      {!demo && <PublicationDemoLink to="/demo/student/notifications" />}
    </>
  );
}
