import { Link } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { ButtonLink } from "../../components/ui/Button";
import { StudentProjectsBlock } from "./StudentProjectsBlock";
import { demoStudentProjects } from "./projectExamples";
import { Load } from "./shared";
import { useLoad, useStudent } from "./hooks";
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
      <p className="student-lead">
        Ваш профиль, команды и работа над кейсами — в одном месте.
      </p>
      <Load state={state}>
        {({ profile, participations }) => (
          <>
            <Card>
              <p className="student-note">Добро пожаловать</p>
              <h2>{profile.nickname}</h2>
              <p>
                {profile.publicSummary ||
                  "Добавьте информацию о себе в профиле."}
              </p>
              <div className="student-actions">
                <ButtonLink to={`${base}/profile`}>Открыть профиль</ButtonLink>
                <ButtonLink variant="secondary" to={`${base}/participations`}>
                  Мои участия · {participations.total}
                </ButtonLink>
              </div>
            </Card>
            <div className="student-grid">
              {[
                [
                  "invitations",
                  "Приглашения",
                  "Подтвердите участие в команде лично.",
                ],
                [
                  "portfolio",
                  "Портфолио",
                  "Готовые работы и подтверждённый опыт.",
                ],
                [
                  "projects",
                  "Мои проекты",
                  "Собственные инициативы и открытые роли.",
                ],
              ].map(([path, title, description]) => (
                <Card key={path}>
                  <h2>{title}</h2>
                  <p>{description}</p>
                  <Link to={`${base}/${path}`}>Перейти →</Link>
                </Card>
              ))}
            </div>
            {demo && (
              <StudentProjectsBlock
                projects={demoStudentProjects}
                basePath="/demo/student-projects"
              />
            )}
          </>
        )}
      </Load>
    </>
  );
}
