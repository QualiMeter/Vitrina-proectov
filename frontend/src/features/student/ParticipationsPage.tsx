import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { ButtonLink } from "../../components/ui/Button";
import { EmptyState } from "../../components/feedback/States";
import { Load, Pager, Status } from "./shared";
import { useLoad, useStudent } from "./hooks";
export function ParticipationsPage({
  draftsOnly = false,
}: { draftsOnly?: boolean } = {}) {
  const { api, base } = useStudent();
  const [page, setPage] = useState(1);
  const [filterDrafts, setDrafts] = useState(false);
  const drafts = draftsOnly || filterDrafts;
  const state = useLoad(
    () => api.participations(page),
    `participations-${page}`,
  );
  return (
    <>
      <h1>{draftsOnly ? "Черновики заявок" : "Мои участия"}</h1>
      {draftsOnly && (
        <p className="student-note">
          Страницы относятся ко всем вашим участиям; здесь отображаются
          черновики полученной страницы.
        </p>
      )}
      <p className="student-lead">
        Продолжайте черновики и следите за выполнением кейсов.
      </p>
      {!draftsOnly && (
        <label className="student-check">
          <input
            type="checkbox"
            checked={drafts}
            onChange={(e) => setDrafts(e.target.checked)}
          />
          Только черновики на текущей странице
        </label>
      )}
      <Load state={state}>
        {(data) => (
          <>
            <p className="student-note">Всего участий: {data.total}</p>
            <div className="student-grid">
              {data.items
                .filter((x) => !drafts || x.applicationStatus === "DRAFT")
                .map((item) => (
                  <Card
                    key={item.applicationId ?? `${item.caseId}-${item.teamId}`}
                  >
                    <h2>{item.caseTitle}</h2>
                    <div className="student-tags">
                      <Status value={item.applicationStatus} />
                      <Status value={item.role} />
                      {item.teamExecutionStatus && (
                        <Status value={item.teamExecutionStatus} />
                      )}
                    </div>
                    {["REJECTED", "WITHDRAWN"].includes(
                      item.applicationStatus,
                    ) && (
                      <p>
                        Повторная заявка в этот кейс недоступна, в том числе в
                        другом составе.
                      </p>
                    )}
                    <div className="student-actions student-participation-actions">
                      <ButtonLink
                        variant={
                          item.applicationStatus === "DRAFT"
                            ? "primary"
                            : "secondary"
                        }
                        to={`${base}/cases/${item.caseId}/apply`}
                      >
                        {item.applicationStatus === "DRAFT"
                          ? "Продолжить заявку"
                          : "Посмотреть заявку"}
                      </ButtonLink>
                      {item.applicationStatus === "ADMITTED" && (
                        <ButtonLink
                          to={`${base}/cases/${item.caseId}/workspace`}
                        >
                          Рабочее пространство
                          <small aria-hidden="true"> · Скоро</small>
                        </ButtonLink>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
            {!data.items.filter(
              (x) => !drafts || x.applicationStatus === "DRAFT",
            ).length && (
              <EmptyState
                title={
                  draftsOnly
                    ? "На этой странице черновиков нет"
                    : "Участий пока нет"
                }
                description={
                  draftsOnly
                    ? "Просмотрите другие страницы списка участий."
                    : "Откройте подходящий кейс и подайте заявку."
                }
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
