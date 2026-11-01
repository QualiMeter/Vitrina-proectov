import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Load } from "../shared";
import { useAction, useLoad, useStudent } from "../hooks";
import { usePublications } from "./context";
import {
  PublicationStatus,
  PublicFrame,
  PublicWorkCard,
  PublicationDemoLink,
} from "./PublicationsUI";
import { developmentLabels, type Portfolio, type Publication } from "./models";
function Works({ initial }: { initial: Publication[] }) {
  const { demo, base } = useStudent(),
    api = usePublications(demo),
    action = useAction();
  const [items, setItems] = useState(initial),
    [filter, setFilter] = useState("ALL");
  const update = (item: Publication) =>
    setItems((previous) => previous.map((x) => (x.id === item.id ? item : x)));
  return (
    <section aria-labelledby="works-heading">
      <div className="student-title-row">
        <h2 id="works-heading">Готовые работы</h2>
        <ButtonLink to={`${base}/portfolio/new`}>
          Добавить готовую работу
        </ButtonLink>
      </div>
      <label className="field publication-filter">
        Состояние работ
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">Все</option>
          <option value="DRAFT">Черновики</option>
          <option value="RETURNED">На доработку</option>
          <option value="PUBLISHED">Опубликованные</option>
          <option value="PENDING_MODERATION">На проверке</option>
        </select>
      </label>
      {action.feedback}
      <div className="student-grid">
        {items
          .filter((x) => filter === "ALL" || x.moderation === filter)
          .map((item) => (
            <Card key={item.id}>
              <h3 className="publication-title">{item.title}</h3>
              <PublicationStatus item={item} />
              {item.kind === "WORK" && <p>{item.result}</p>}
              {item.moderationNotes && (
                <p className="publication-review">
                  <strong>Замечания:</strong> {item.moderationNotes}
                </p>
              )}
              <div className="student-actions">
                <ButtonLink
                  variant="secondary"
                  to={`${base}/portfolio/works/${item.id}/edit`}
                >
                  {item.moderation === "PENDING_MODERATION" ||
                  item.moderation === "HIDDEN"
                    ? "Посмотреть"
                    : "Редактировать"}
                </ButtonLink>
                {["DRAFT", "RETURNED", "REJECTED"].includes(
                  item.moderation,
                ) && (
                  <Button
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(
                        async () =>
                          update(
                            await api.submitForModeration(
                              item.id,
                              item.version,
                            ),
                          ),
                        "Работа отправлена на проверку",
                      )
                    }
                  >
                    На публичную модерацию
                  </Button>
                )}
                {item.moderation === "PUBLISHED" && (
                  <Button
                    variant="ghost"
                    disabled={action.busy}
                    onClick={() =>
                      void action.run(
                        async () =>
                          update(await api.hideWork(item.id, item.version)),
                        "Работа скрыта из публичного портфолио",
                      )
                    }
                  >
                    Скрыть работу
                  </Button>
                )}
              </div>
            </Card>
          ))}
      </div>
      {!items.some((x) => filter === "ALL" || x.moderation === filter) && (
        <p>Работ с таким состоянием пока нет.</p>
      )}
    </section>
  );
}
function Evidence({
  data,
}: {
  data: Pick<Portfolio, "confirmedCases" | "closedProjects">;
}) {
  return (
    <>
      <section>
        <h2>Подтверждённые кейсы</h2>
        <p className="student-note">
          Подтверждение результата выдаёт компания, автор работы не может
          добавить его вручную.
        </p>
        <div className="student-grid">
          {data.confirmedCases.map((x) => (
            <Card key={x.id}>
              <h3 className="publication-title">{x.title}</h3>
              <span className="badge badge--brand">
                Проект подтверждён компанией
              </span>
              <p>{x.companyName}</p>
              <p>{x.result}</p>
            </Card>
          ))}
        </div>
        {!data.confirmedCases.length && <p>Подтверждённых кейсов пока нет.</p>}
      </section>
      <section>
        <h2>Закрытые продуктовые проекты</h2>
        <p className="student-note">
          Показаны только разрешённые сведения об участии.
        </p>
        {data.closedProjects.map((x) => (
          <Card key={x.id}>
            <h3 className="publication-title">
              Участие в закрытом проекте компании
            </h3>
            <p>Период: {x.period}</p>
          </Card>
        ))}
        {!data.closedProjects.length && <p>Участий пока нет.</p>}
      </section>
    </>
  );
}
export function PortfolioPage() {
  const { demo, base, user } = useStudent(),
    api = usePublications(demo);
  const state = useLoad(() => api.portfolio(), "portfolio");
  return (
    <>
      <h1>Моё портфолио</h1>
      <p className="student-lead">Работы, инициативы и подтверждённый опыт.</p>
      <Link to={`${demo ? "/demo" : ""}/students/${user.id}/portfolio`}>
        Посмотреть публичное портфолио
      </Link>
      <Load state={state}>
        {(data) => (
          <div className="student-stack">
            <Works initial={data.works} />
            <section>
              <h2>Собственные активные проекты</h2>
              <div className="student-grid">
                {data.projects
                  .filter(
                    (x) =>
                      x.kind === "PROJECT" &&
                      x.developmentStatus !== "COMPLETED",
                  )
                  .map((x) => (
                    <Card key={x.id}>
                      <h3 className="publication-title">{x.title}</h3>
                      <PublicationStatus item={x} />
                      <Link to={`${base}/projects/${x.id}/edit`}>
                        Открыть проект
                      </Link>
                    </Card>
                  ))}
              </div>
              <ButtonLink variant="secondary" to={`${base}/projects/new`}>
                Создать проект
              </ButtonLink>
            </section>
            <Evidence data={data} />
          </div>
        )}
      </Load>
      {!demo && <PublicationDemoLink to="/demo/student/portfolio" />}
    </>
  );
}
export function MyProjectList() {
  const { demo, base } = useStudent(),
    api = usePublications(demo);
  const state = useLoad(() => api.portfolio(), "my-projects");
  return (
    <>
      <h1>Мои проекты</h1>
      <p className="student-lead">Создание и редактирование инициатив.</p>
      <ButtonLink to={`${base}/projects/new`}>Создать проект</ButtonLink>
      <Load state={state}>
        {(data) => (
          <div className="student-grid">
            {data.projects.map((x) => (
              <Card key={x.id}>
                <h2>{x.title}</h2>
                <PublicationStatus item={x} />
                <ButtonLink
                  variant="secondary"
                  to={`${base}/projects/${x.id}/edit`}
                >
                  Открыть проект
                </ButtonLink>
              </Card>
            ))}
            {!data.projects.length && <p>Проектов пока нет.</p>}
          </div>
        )}
      </Load>
      {!demo && <PublicationDemoLink to="/demo/student/projects" />}
    </>
  );
}
export function PublicPortfolioPage({ demo = false }: { demo?: boolean }) {
  const { id = "" } = useParams(),
    api = usePublications(demo);
  const state = useLoad(
    () => api.publicPortfolio(id),
    `public-portfolio-${id}`,
  );
  return (
    <PublicFrame demo={demo}>
      <h1>Публичное портфолио</h1>
      <Load state={state}>
        {(data) => (
          <div className="student-stack">
            <h2>{data.nickname}</h2>
            <section>
              <h2>Опубликованные работы</h2>
              <div className="student-grid">
                {data.works.map((work) => (
                  <Card key={work.id}>
                    <PublicWorkCard work={work} demo={demo} />
                  </Card>
                ))}
              </div>
              {!data.works.length && <p>Опубликованных работ пока нет.</p>}
            </section>
            <section>
              <h2>Опубликованные инициативы</h2>
              <div className="student-grid">
                {data.projects.map((x) => (
                  <Card key={x.id}>
                    <h3 className="publication-title">
                      <Link
                        to={`${demo ? "/demo" : ""}/student-projects/${x.id}`}
                      >
                        {x.title}
                      </Link>
                    </h3>
                    <p>{developmentLabels[x.developmentStatus]}</p>
                  </Card>
                ))}
              </div>
            </section>
            <Evidence data={data} />
          </div>
        )}
      </Load>
      {!demo && (
        <PublicationDemoLink to="/demo/students/00000000-0000-4000-8000-000000000001/portfolio" />
      )}
    </PublicFrame>
  );
}
