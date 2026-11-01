import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "../../../components/layout/Brand";
import { Button } from "../../../components/ui/Button";
import { DemoNotice, ExternalLink } from "../shared";
import {
  categories,
  developmentLabels,
  moderationLabels,
  type Publication,
  type PublicProject,
  type PublicWork,
  type Reference,
  type Media,
} from "./models";
import { usePublications } from "./context";
import "../student.css";
import "./publications.css";
export function CategoryName({ id }: { id: string }) {
  return (
    <>{categories.find(([key]) => key === id)?.[1] ?? "Категория не указана"}</>
  );
}
export function PublicationStatus({ item }: { item: Publication }) {
  return (
    <div className="student-tags">
      <span className="badge badge--brand">
        {moderationLabels[item.moderation]}
      </span>
      {item.kind === "PROJECT" && (
        <span className="badge">
          {developmentLabels[item.developmentStatus]}
        </span>
      )}
    </div>
  );
}
export function Technologies({
  ids,
  reference,
}: {
  ids: string[];
  reference: Reference;
}) {
  return (
    <div className="student-tags">
      {ids.map((id) => (
        <span className="badge" key={id}>
          {reference.technologies.find((x) => x.id === id)?.name ??
            "Технология"}
        </span>
      ))}
    </div>
  );
}
export function PublicFrame({
  demo,
  children,
}: {
  demo: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="student-app">
      <header className="student-header">
        <Brand compact />
        <Link
          className="button button--secondary"
          to={demo ? "/demo/student" : "/student"}
        >
          Кабинет
        </Link>
      </header>
      {demo && <DemoNotice />}
      <main className="student-public publication-public">
        <Link to="/">← На главную</Link>
        {children}
      </main>
    </div>
  );
}
export function PublicationLinks({
  item,
}: {
  item: { links: { label: string; url: string }[] };
}) {
  return item.links.length ? (
    <ul className="student-list">
      {item.links.map((l, i) => (
        <li key={i}>
          <ExternalLink url={l.url}>{l.label}</ExternalLink>
        </li>
      ))}
    </ul>
  ) : (
    <p className="student-note">Публичных ссылок пока нет.</p>
  );
}
export function MediaPreview({ item, demo }: { item: Media; demo: boolean }) {
  const api = usePublications(demo);
  const [state, setState] = useState<{ url?: string; error?: boolean }>({});
  useEffect(() => {
    let active = true,
      url: string | undefined;
    void api.mediaBlob(item.id).then(
      (blob) => {
        if (!active) return;
        url = URL.createObjectURL(blob);
        setState({ url });
      },
      () => {
        if (active) setState({ error: true });
      },
    );
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [api, item.id]);
  return (
    <div className="publication-media-item">
      {state.url && item.purpose === "IMAGE" ? (
        <img src={state.url} alt={item.name} />
      ) : null}
      <span>
        {item.name} · {Math.ceil(item.sizeBytes / 1024)} КБ
      </span>
      {state.error && <small>Предпросмотр недоступен.</small>}
    </div>
  );
}
export function PublicWorkCard({
  work,
  demo,
}: {
  work: PublicWork;
  demo: boolean;
}) {
  return (
    <article>
      <h3>{work.title}</h3>
      <p>
        <CategoryName id={work.category} />
      </p>
      <p className="student-preserve-text">{work.result}</p>
      <p>
        <strong>Личный вклад:</strong> {work.contribution}
      </p>
      {work.description && <p>{work.description}</p>}
      {work.coauthors && <p>Соавторы: {work.coauthors}</p>}
      <PublicationLinks item={work} />
      <div className="publication-media-grid">
        {work.media.map((item) => (
          <MediaPreview key={item.id} item={item} demo={demo} />
        ))}
      </div>
    </article>
  );
}
export function ProjectSummary({
  item,
  reference,
  path,
}: {
  item: PublicProject;
  reference: Reference;
  path: string;
}) {
  return (
    <>
      <h2>
        <Link to={`${path}/${item.id}`}>{item.title}</Link>
      </h2>
      <p>{item.summary}</p>
      <p>
        <CategoryName id={item.category} /> ·{" "}
        {developmentLabels[item.developmentStatus]}
      </p>
      <Technologies ids={item.technologyIds} reference={reference} />
    </>
  );
}
export function PublicationDemoLink({ to }: { to: string }) {
  return (
    <p>
      <Link to={to}>Открыть демонстрационный пример</Link>
    </p>
  );
}
export { Button };
