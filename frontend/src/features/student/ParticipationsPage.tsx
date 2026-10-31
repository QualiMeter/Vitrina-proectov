import { useState } from "react";
import { Card } from "../../components/ui/Card";
import { ButtonLink } from "../../components/ui/Button";
import { EmptyState } from "../../components/feedback/States";
import { Load, Pager, Status } from "./shared";
import { useLoad, useStudent } from "./hooks";
export function ParticipationsPage() {
  const { api, base } = useStudent();
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState(false);
  const state = useLoad(
    () => api.participations(page),
    `participations-${page}`,
  );
  return (
    <>
      <h1>Мои участия</h1>
      <p className="student-lead">
        Продолжайте черновики и следите за выполнением кейсов.
      </p>
      <label className="student-check">
        <input
          type="checkbox"
          checked={drafts}
          onChange={(e) => setDrafts(e.target.checked)}
        />
        Только черновики на текущей странице
      </label>
      <Load state={state}>
        {(data) => (
          <>
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
                    <div className="student-actions">
                      {item.applicationStatus === "ADMITTED" && (
                        <ButtonLink
                          to={`${base}/cases/${item.caseId}/workspace`}
                        >
                          Рабочее пространство
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
                title="Участий пока нет"
                description="Откройте подходящий кейс и подайте заявку."
              />
            )}
            <Pager page={page} total={data.total} onPage={setPage} />
          </>
        )}
      </Load>
    </>
  );
}
