import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { useStudent, useLoad, useAction } from "../hooks";
import { Load, Pager } from "../shared";
import {
  PublicationStatus,
  PublicationDemoLink,
} from "../publications/PublicationsUI";
import {
  developmentLabels,
  type Publication,
  type Development,
} from "../publications/models";
import { editable } from "../publications/rules";
import { useProjectManagement } from "./context";
import "./projects.css";
export function AuthorProjectsPage() {
  const { demo, base } = useStudent(),
    api = useProjectManagement(demo),
    state = useLoad(() => api.projects(), "author-projects");
  const [filter, setFilter] = useState(""),
    [page, setPage] = useState(1);
  return (
    <>
      <h1>Мои проекты</h1>
      <p className="student-lead">Инициативы автора, команда и заявки.</p>
      <ButtonLink to={`${base}/projects/new`}>Создать проект</ButtonLink>
      <Load state={state}>
        {(items) => {
          const filtered = items.filter(
              (p) => !filter || p.moderation === filter,
            ),
            actual = Math.min(
              page,
              Math.max(1, Math.ceil(filtered.length / 6)),
            );
          return (
            <>
              <div className="student-filter">
                <label className="field">
                  Модерация
                  <select
                    value={filter}
                    onChange={(e) => {
                      setFilter(e.target.value);
                      setPage(1);
                    }}
                  >
                    <option value="">Все проекты</option>
                    {[...new Set(items.map((p) => p.moderation))].map(
                      (status) => (
                        <option key={status} value={status}>
                          {
                            {
                              DRAFT: "Черновики",
                              PUBLISHED: "Опубликованные",
                              RETURNED: "На доработке",
                              PENDING_MODERATION: "На проверке",
                              HIDDEN: "Скрытые",
                              REJECTED: "Отклонённые",
                            }[status]
                          }
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <p role="status">Проектов: {filtered.length}</p>
              <div className="student-grid">
                {filtered.slice((actual - 1) * 6, actual * 6).map((p) => (
                  <ProjectCard
                    key={`${p.id}-${p.version}`}
                    project={p}
                    onChanged={state.reload}
                  />
                ))}
              </div>
              {!filtered.length && <p>Проектов по выбранному фильтру нет.</p>}
              {filtered.length > 6 && (
                <div className="project-pagination">
                  <Pager
                    page={actual}
                    pageSize={6}
                    total={filtered.length}
                    onPage={setPage}
                  />
                </div>
              )}
            </>
          );
        }}
      </Load>
      {!demo && <PublicationDemoLink to="/demo/student/projects" />}
    </>
  );
}
function ProjectCard({
  project: p,
  onChanged,
}: {
  project: Publication;
  onChanged: () => void;
}) {
  const { demo, base } = useStudent(),
    api = useProjectManagement(demo),
    action = useAction(),
    [value, setValue] = useState<Development>(
      p.kind === "PROJECT" ? p.developmentStatus : "IDEA",
    ),
    [conflict, setConflict] = useState(false);
  return (
    <Card>
      <h2 className="publication-title">{p.title || "Без названия"}</h2>
      <PublicationStatus item={p} />
      <Link to={`${base}/projects/${p.id}/team`}>
        Команда, заявки и куратор
      </Link>
      <p>
        <Link to={`${base}/projects/${p.id}/edit`}>Редактировать описание</Link>
      </p>
      <div className="student-form">
        <label className="field">
          Статус разработки
          <select
            value={value}
            disabled={action.busy || conflict || !editable(p.moderation)}
            onChange={(e) => setValue(e.target.value as Development)}
          >
            {Object.entries(developmentLabels).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="student-note">
        Изменение разработки не публикует проект. В учебном примере правка
        опубликованной записи потребует повторной модерации.
      </p>
      <Button
        variant="secondary"
        disabled={
          action.busy ||
          conflict ||
          !editable(p.moderation) ||
          p.kind !== "PROJECT" ||
          value === p.developmentStatus
        }
        onClick={() =>
          void action.run(async () => {
            try {
              await api.changeDevelopment(p.id, value, p.version);
              onChanged();
            } catch (e) {
              if (
                e &&
                typeof e === "object" &&
                "status" in e &&
                (e.status === 409 || e.status === 403)
              )
                setConflict(true);
              throw e;
            }
          }, "Статус разработки изменён")
        }
      >
        Сохранить статус
      </Button>
      {action.feedback}
      {conflict && (
        <>
          <p>
            Выбранный статус оставлен в форме. Обновление загрузит актуальную
            карточку; решение потребуется принять заново.
          </p>
          <Button variant="secondary" onClick={onChanged}>
            Обновить карточки проектов
          </Button>
        </>
      )}
    </Card>
  );
}
