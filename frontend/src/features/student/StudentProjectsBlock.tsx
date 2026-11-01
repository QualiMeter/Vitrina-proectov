import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
const phases = {
  IDEA: "Идея",
  RECRUITING: "Поиск команды",
  IN_PROGRESS: "Разработка",
  PAUSED: "Приостановлен",
  COMPLETED: "Завершён",
} as const;
/** Presentation model for FE-A; adapt from the future approved initiatives DTO. */
export type StudentProjectPreview = {
  id: string;
  title: string;
  moderationStatus: "PUBLISHED" | "DRAFT" | "HIDDEN";
  developmentStatus: keyof typeof phases;
  technologies: string[];
  seekingTeam: boolean;
};
export function StudentProjectsBlock({
  projects,
  basePath = "/student-projects",
}: {
  projects: StudentProjectPreview[];
  basePath?: string;
}) {
  const visible = projects.filter((x) => x.moderationStatus === "PUBLISHED");
  return (
    <section aria-label="Проекты студентов">
      <div className="student-title-row">
        <h2>Проекты студентов</h2>
        <Link to={basePath}>Все проекты →</Link>
      </div>
      {visible.length ? (
        <div className="student-grid">
          {visible.map((project) => (
            <Card key={project.id}>
              <h3>
                <Link to={`${basePath}/${encodeURIComponent(project.id)}`}>
                  {project.title}
                </Link>
              </h3>
              <p>{phases[project.developmentStatus]}</p>
              <p>{project.technologies.join(" · ")}</p>
              {project.seekingTeam && (
                <span className="badge">Ищу команду</span>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <p>Опубликованных инициатив пока нет.</p>
      )}
    </section>
  );
}
