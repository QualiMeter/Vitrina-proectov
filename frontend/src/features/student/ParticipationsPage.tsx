import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Button, ButtonLink } from "../../components/ui/Button";
import { EmptyState } from "../../components/feedback/States";
import { Load, Pager, Status } from "./shared";
import { useLoad, useStudent } from "./hooks";
import { loadAllPages } from "./loadAllPages";
import type { MyCaseParticipation } from "./contracts";
const isActive = (item: MyCaseParticipation) =>
  item.applicationStatus === "ADMITTED" &&
  !["ELIMINATED", "EXCLUDED"].includes(item.teamExecutionStatus ?? "") &&
  !["COMPLETED", "CANCELED", "FINAL_CLOSED"].includes(item.caseStatus ?? "");
export function ParticipationsPage() {
  const { api, base } = useStudent();
  const [query, setQuery] = useSearchParams();
  const [page, setPage] = useState(1);
  const filter = ["drafts", "active"].includes(query.get("filter") ?? "")
    ? query.get("filter")!
    : "all";
  const state = useLoad(
    () =>
      loadAllPages(
        (p) => api.participations(p),
        (item) =>
          item.applicationId ?? `${item.caseId}:${item.teamId ?? "solo"}`,
      ),
    "participations-all",
  );
  return (
    <>
      <h1>Мои участия</h1>
      <p className="student-lead">
        Заявки, черновики и активные кейсы в одном списке.
      </p>
      <div
        className="student-actions student-filter-tabs"
        role="group"
        aria-label="Фильтр участий"
      >
        {[
          ["all", "Все"],
          ["drafts", "Черновики"],
          ["active", "Активные"],
        ].map(([value, label]) => (
          <Button
            key={value}
            variant={filter === value ? "primary" : "secondary"}
            aria-pressed={filter === value}
            onClick={() => {
              setQuery(value === "all" ? {} : { filter: value });
              setPage(1);
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      <Load state={state}>
        {(items) => {
          const filtered = items.filter((item) =>
            filter === "drafts"
              ? item.applicationStatus === "DRAFT"
              : filter === "active"
                ? isActive(item)
                : true,
          );
          const actualPage = Math.min(
            page,
            Math.max(1, Math.ceil(filtered.length / 20)),
          );
          return (
            <>
              <p className="student-note">
                Всего участий: {items.length}
                {filter !== "all" && ` · Найдено: ${filtered.length}`}
              </p>
              <div className="student-grid">
                {filtered
                  .slice((actualPage - 1) * 20, actualPage * 20)
                  .map((item) => (
                    <Card
                      key={
                        item.applicationId ?? `${item.caseId}:${item.teamId}`
                      }
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
                        {isActive(item) && (
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
              {!filtered.length && (
                <EmptyState
                  title={
                    filter === "drafts"
                      ? "Черновиков пока нет"
                      : filter === "active"
                        ? "Активных участий пока нет"
                        : "Участий пока нет"
                  }
                  description="Выберите другой фильтр или откройте подходящий кейс."
                />
              )}
              <Pager
                page={actualPage}
                pageSize={20}
                total={filtered.length}
                onPage={setPage}
              />
            </>
          );
        }}
      </Load>
    </>
  );
}
