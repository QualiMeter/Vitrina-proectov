import { useEffect, useState, type FormEvent } from "react";
import { Link, useBlocker, useParams } from "react-router-dom";
import { ApiError } from "../../../api/client";
import { Button } from "../../../components/ui/Button";
import { Load } from "../shared";
import { useAction, useLoad, useStudent } from "../hooks";
import { ProfileLeaveDialog } from "../ProfileLeaveDialog";
import { DraftFields } from "./DraftFields";
import { MediaFields } from "./MediaFields";
import { PublicationStatus, PublicationDemoLink } from "./PublicationsUI";
import { usePublications } from "./context";
import {
  draftOf,
  emptyDraft,
  type Draft,
  type Publication,
  type Reference,
} from "./models";
import { editable, publicationErrors } from "./rules";
import { comparePublication } from "./conflict";
function Editor({
  kind,
  initial,
  reference,
}: {
  kind: Draft["kind"];
  initial?: Publication;
  reference: Reference;
}) {
  const { demo, base } = useStudent(),
    api = usePublications(demo),
    save = useAction(),
    review = useAction(),
    compare = useAction();
  const [document, setDocument] = useState(initial),
    [baseline, setBaseline] = useState<Draft>(() =>
      initial ? draftOf(initial) : emptyDraft(kind),
    ),
    [draft, setDraft] = useState<Draft>(() =>
      initial ? draftOf(initial) : emptyDraft(kind),
    );
  const [conflict, setConflict] = useState(false),
    [latest, setLatest] = useState<Publication>(),
    [ack, setAck] = useState(false),
    [uploadBusy, setUploadBusy] = useState(false),
    [pendingFile, setPendingFile] = useState(false);
  const dirty =
    JSON.stringify(draft) !== JSON.stringify(baseline) ||
    pendingFile ||
    uploadBusy;
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === "blocked" && !dirty) blocker.proceed();
  }, [blocker, dirty]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const readonly = !!document && !editable(document.moderation),
    busy = save.busy || review.busy || uploadBusy || compare.busy;
  const comparison = latest
    ? comparePublication(baseline, draft, draftOf(latest))
    : undefined;
  const listPath = kind === "WORK" ? `${base}/portfolio` : `${base}/projects`;
  const commit = (saved: Publication) => {
    setDocument(saved);
    const next = draftOf(saved);
    setBaseline(next);
    setDraft(next);
  };
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (readonly || busy || conflict || pendingFile) return;
    await save.run(async () => {
      try {
        commit(await api.save(draft, document?.id, document?.version));
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setConflict(true);
          setLatest(undefined);
          setAck(false);
        }
        throw error;
      }
    }, "Черновик сохранён");
  }
  return (
    <>
      {blocker.state === "blocked" && (
        <ProfileLeaveDialog
          title="Несохранённая публикация"
          onStay={() => blocker.reset()}
          onLeave={() => blocker.proceed()}
        />
      )}
      <Link to={listPath}>
        ← {kind === "WORK" ? "К портфолио" : "К моим проектам"}
      </Link>
      {document && <PublicationStatus item={document} />}
      {document?.moderationNotes && (
        <p className="publication-review">
          <strong>Замечания модерации:</strong> {document.moderationNotes}
        </p>
      )}
      {readonly && (
        <p role="status">
          Редактирование недоступно в текущем состоянии публикации.
        </p>
      )}
      <form
        className="student-form publication-form"
        noValidate
        onSubmit={submit}
      >
        <div className="student-save-bar">
          <span role="status">
            {dirty ? "Есть несохранённые изменения" : "Изменений нет"}
          </span>
          <Button
            type="submit"
            disabled={
              busy ||
              readonly ||
              conflict ||
              pendingFile ||
              (!dirty && !!document)
            }
          >
            Сохранить черновик
          </Button>
          {save.feedback}
        </div>
        <p className="student-note">
          Незавершённую форму можно сохранить как черновик. Перед публичной
          модерацией обязательные поля должны быть заполнены.
        </p>
        {conflict && (
          <section className="student-blocked publication-conflict">
            <h2>Конфликт версии публикации</h2>
            <p role="alert">
              Ваши изменения сохранены в форме. Сначала сравните их с актуальной
              версией.
            </p>
            <Button
              type="button"
              variant="secondary"
              disabled={compare.busy}
              onClick={() =>
                void compare.run(async () => {
                  if (!document) return;
                  setLatest(await api.getOwned(kind, document.id));
                  setAck(false);
                }, "Актуальная версия загружена")
              }
            >
              Сравнить версии
            </Button>
            {compare.feedback}
            {comparison && latest && (
              <>
                <p>
                  Серверная версия: {latest.version}. Поля, изменённые только на
                  сервере, будут сохранены.
                </p>
                {comparison.conflicts.map((f) => (
                  <div key={f.key}>
                    <h3>{f.label}</h3>
                    <p>Ваша версия:</p>
                    <pre>{f.mine}</pre>
                    <p>Серверная версия:</p>
                    <pre>{f.server}</pre>
                  </div>
                ))}
                {comparison.conflicts.length > 0 && (
                  <label className="publication-check">
                    <input
                      type="checkbox"
                      checked={ack}
                      onChange={(e) => setAck(e.target.checked)}
                    />
                    Оставить мои значения во всех показанных спорных полях
                  </label>
                )}
                <Button
                  type="button"
                  disabled={!!comparison.conflicts.length && !ack}
                  onClick={() => {
                    setDocument(latest);
                    setBaseline(draftOf(latest));
                    setDraft(comparison.merged);
                    setConflict(false);
                    save.clear();
                  }}
                >
                  Применить сравнение к форме
                </Button>
                <p className="student-note">
                  Затем проверьте форму и отдельно сохраните черновик.
                </p>
              </>
            )}
          </section>
        )}
        <fieldset
          className="publication-editor-fields"
          disabled={readonly || busy}
        >
          <DraftFields
            draft={draft}
            onChange={(next) => {
              setDraft(next);
              setAck(false);
            }}
            reference={reference}
          />
          <MediaFields
            demo={demo}
            items={draft.media}
            onChange={(media) => {
              setDraft((previous) => ({ ...previous, media }));
              setAck(false);
            }}
            onBusy={setUploadBusy}
            onPending={setPendingFile}
          />
        </fieldset>
      </form>
      <section className="publication-review-actions">
        <h2>Публичная модерация</h2>
        <p>Запись появится публично только после одобрения университетом.</p>
        {review.feedback}
        <Button
          disabled={
            !document ||
            dirty ||
            busy ||
            conflict ||
            !["DRAFT", "RETURNED", "REJECTED"].includes(
              document?.moderation ?? "",
            )
          }
          onClick={() =>
            void review.run(async () => {
              if (!document) return;
              const errors = publicationErrors(draft);
              if (errors.length) throw new Error(errors.join(" "));
              try {
                commit(
                  await api.submitForModeration(document.id, document.version),
                );
              } catch (error) {
                if (error instanceof ApiError && error.status === 409) {
                  setConflict(true);
                  setLatest(undefined);
                  setAck(false);
                }
                throw error;
              }
            }, "Публикация отправлена на проверку")
          }
        >
          Отправить на публичную модерацию
        </Button>
        {dirty && <p className="student-note">Сначала сохраните изменения.</p>}
      </section>
    </>
  );
}
export function PublicationEditorPage({ kind }: { kind: Draft["kind"] }) {
  const { demo } = useStudent(),
    api = usePublications(demo),
    { publicationId } = useParams();
  const state = useLoad(
    async () => ({
      reference: await api.reference(),
      initial: publicationId
        ? await api.getOwned(kind, publicationId)
        : undefined,
    }),
    `edit-${kind}-${publicationId ?? "new"}-${demo}`,
  );
  return (
    <>
      <h1>
        {kind === "WORK"
          ? publicationId
            ? "Редактирование готовой работы"
            : "Добавить готовую работу"
          : publicationId
            ? "Редактирование проекта"
            : "Создать студенческий проект"}
      </h1>
      <Load state={state}>
        {(data) => (
          <Editor
            key={`${kind}-${publicationId ?? "new"}`}
            kind={kind}
            initial={data.initial}
            reference={data.reference}
          />
        )}
      </Load>
      {!demo && (
        <PublicationDemoLink
          to={
            kind === "WORK"
              ? "/demo/student/portfolio/new"
              : "/demo/student/projects/new"
          }
        />
      )}
    </>
  );
}
