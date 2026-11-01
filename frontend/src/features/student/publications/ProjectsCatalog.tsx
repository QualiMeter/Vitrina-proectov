import { readPublicCatalog, readPublicProject } from "./publicReads";
import { useSearchParams, useParams, Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Button, ButtonLink } from "../../../components/ui/Button";
import { Load, Pager, ExternalLink } from "../shared";
import { useLoad } from "../hooks";
import { usePublications } from "./context";
import {
  categories,
  developmentLabels,
  interestLabels,
  emptyQuery,
  type ProjectQuery,
} from "./models";
import {
  PublicFrame,
  ProjectSummary,
  Technologies,
  CategoryName,
  PublicationLinks,
  PublicationDemoLink,
  MediaPreview,
} from "./PublicationsUI";
export function ProjectsCatalog({ demo = false }: { demo?: boolean }) {
  const api = usePublications(demo),
    [params, setParams] = useSearchParams();
  const query: ProjectQuery = {
    ...emptyQuery,
    ...Object.fromEntries(
      Object.keys(emptyQuery).map((key) => [key, params.get(key) ?? ""]),
    ),
  };
  const page = Math.max(1, Number(params.get("page")) || 1),
    path = `${demo ? "/demo" : ""}/student-projects`;
  const state = useLoad(
    async () => ({
      reference: await api.reference(),
      result: await readPublicCatalog(api, query, page),
    }),
    `catalog-${params.toString()}-${demo}`,
  );
  const change = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    setParams(next, { flushSync: true });
  };
  return (
    <PublicFrame demo={demo}>
      <h1>Проекты студентов</h1>
      <p className="student-lead">
        Опубликованные инициативы, команда и открытые роли.
      </p>
      <div className="student-actions">
        <ButtonLink
          variant="secondary"
          to={demo ? "/demo/student/projects/new" : "/student/projects/new"}
        >
          Создать проект
        </ButtonLink>
      </div>
      <div className="publication-catalog-search">
        <Input
          label="Поиск проектов"
          value={query.q}
          placeholder="Название или описание"
          onChange={(e) => change("q", e.target.value)}
        />
        <Button
          variant="secondary"
          onClick={() => setParams({}, { flushSync: true })}
        >
          Сбросить фильтры
        </Button>
      </div>
      <Load state={state}>
        {({ reference, result }) => (
          <>
            <div className="publication-filters">
              <label className="field">
                Категория
                <select
                  value={query.category}
                  onChange={(e) => change("category", e.target.value)}
                >
                  <option value="">Все категории</option>
                  {categories.map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Технология
                <select
                  value={query.technologyId}
                  onChange={(e) => change("technologyId", e.target.value)}
                >
                  <option value="">Все технологии</option>
                  {reference.technologies.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Направление
                <select
                  value={query.directionId}
                  onChange={(e) => change("directionId", e.target.value)}
                >
                  <option value="">Все направления</option>
                  {reference.directions.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Статус разработки
                <select
                  value={query.development}
                  onChange={(e) => change("development", e.target.value)}
                >
                  <option value="">Все статусы</option>
                  {Object.entries(developmentLabels).map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Интересы проекта
                <select
                  value={query.interest}
                  onChange={(e) => change("interest", e.target.value)}
                >
                  <option value="">Все интересы</option>
                  {Object.entries(interestLabels).map(([id, title]) => (
                    <option key={id} value={id}>
                      {title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="student-note">Найдено проектов: {result.total}</p>
            {result.items.length ? (
              <div className="student-grid">
                {result.items.map((item) => (
                  <Card key={item.id}>
                    <ProjectSummary
                      item={item}
                      reference={reference}
                      path={path}
                    />
                    <div className="student-tags">
                      {item.interests.map((flag) => (
                        <span className="badge" key={flag}>
                          {interestLabels[flag]}
                        </span>
                      ))}
                    </div>
                    <p>Автор: {item.author.nickname}</p>
                    <ButtonLink variant="secondary" to={`${path}/${item.id}`}>
                      Подробнее о проекте
                    </ButtonLink>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <h2>Проекты не найдены</h2>
                <p>Измените поиск или сбросьте фильтры.</p>
              </Card>
            )}
            <Pager
              page={result.page}
              pageSize={result.pageSize}
              total={result.total}
              onPage={(next) => {
                const p = new URLSearchParams(params);
                p.set("page", String(next));
                setParams(p, { flushSync: true });
              }}
            />
          </>
        )}
      </Load>
      {!demo && <PublicationDemoLink to="/demo/student-projects" />}
    </PublicFrame>
  );
}
export function ProjectDetails({ demo = false }: { demo?: boolean }) {
  const api = usePublications(demo),
    { projectId = "" } = useParams();
  const state = useLoad(
    async () => ({
      project: await readPublicProject(api, projectId),
      reference: await api.reference(),
    }),
    `project-${projectId}-${demo}`,
  );
  return (
    <PublicFrame demo={demo}>
      <Link to={`${demo ? "/demo" : ""}/student-projects`}>
        ← Каталог проектов
      </Link>
      <Load state={state}>
        {({ project: p, reference }) => (
          <div className="student-stack">
            <section>
              <h1>{p.title}</h1>
              <p className="student-lead">{p.summary}</p>
              <p>
                <CategoryName id={p.category} /> ·{" "}
                {developmentLabels[p.developmentStatus]}
              </p>
              <Technologies ids={p.technologyIds} reference={reference} />
              <p>
                Автор:{" "}
                <Link to={`${demo ? "/demo" : ""}/students/${p.author.id}`}>
                  {p.author.nickname}
                </Link>
              </p>
              <p>
                Направление:{" "}
                {reference.directions.find((x) => x.id === p.directionId)
                  ?.name ?? "Не указано"}
              </p>
              {p.startDate && <p>Начало: {p.startDate}</p>}
              <div className="student-tags">
                {p.interests.map((flag) => (
                  <span className="badge" key={flag}>
                    {interestLabels[flag]}
                  </span>
                ))}
              </div>
            </section>
            <Card>
              <h2>О проекте</h2>
              <p className="student-preserve-text">{p.description}</p>
              <h3>Проблема</h3>
              <p>{p.problem}</p>
              <h3>Цели</h3>
              <p>{p.goals}</p>
              <PublicationLinks item={p} />
              <div className="publication-media-grid">
                {p.media.map((item) => (
                  <MediaPreview key={item.id} item={item} demo={demo} />
                ))}
              </div>
            </Card>
            <Card>
              <h2>Текущая команда</h2>
              <ul className="student-list">
                {p.members.map((m, i) => (
                  <li key={i}>
                    <strong>{m.nickname}</strong> · {m.role}
                    <p>{m.competencies.join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <h2>Открытые роли</h2>
              {p.vacancies.length ? (
                p.vacancies.map((v) => (
                  <article key={v.id}>
                    <h3>{v.title}</h3>
                    <p>Компетенции: {v.skills || "Не указаны"}</p>
                    <p>{v.tasks}</p>
                  </article>
                ))
              ) : (
                <p>Открытых ролей пока нет.</p>
              )}
              <ButtonLink
                to={`${demo ? "/demo" : ""}/student/projects/${p.id}/apply`}
              >
                Подать заявку
              </ButtonLink>
              <p className="student-note">
                Заявку рассматривает автор проекта. Связаться по публичному
                контакту можно отдельно.
              </p>
            </Card>
            <Card>
              <h2>Публичный контакт автора</h2>
              {p.publicContactUrl ? (
                <ExternalLink url={p.publicContactUrl}>
                  Связаться с автором
                </ExternalLink>
              ) : (
                <p>Автор не опубликовал контакт.</p>
              )}
              <p className="student-note">
                Переход по ссылке не создаёт заявку и не добавляет вас в
                команду.
              </p>
            </Card>
          </div>
        )}
      </Load>
      {!demo && <PublicationDemoLink to="/demo/student-projects" />}
    </PublicFrame>
  );
}
