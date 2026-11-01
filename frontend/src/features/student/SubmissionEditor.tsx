import { executionBlock } from "./executionRules";
import { ExternalLink } from "./shared";
import { readOwnHistory } from "./submissionHistory";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError } from "../../api/client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAction, useStudent, safeUrl } from "./hooks";
import { SubmissionFiles, type DraftAttachment } from "./SubmissionFiles";
import type * as C from "./contracts";
export function SubmissionEditor({
  caseId,
  applicationId,
  point,
  initialVersion,
  onSaved,
  onDirty,
}: {
  caseId: string;
  applicationId: string;
  point: C.WorkspaceCheckpoint;
  initialVersion: number;
  onSaved: (v: C.SubmissionVersion) => void;
  onDirty: (id: string, dirty: boolean) => void;
}) {
  const { api, user } = useStudent(),
    action = useAction(),
    compare = useAction();
  const [description, setDescription] = useState("");
  const [links, setLinks] = useState<C.SubmissionLink[]>([]);
  const [files, setFiles] = useState<DraftAttachment[]>([]);
  const [version, setVersion] = useState(initialVersion),
    [conflict, setConflict] = useState(false),
    [latest, setLatest] = useState<C.SubmissionVersionList>(),
    [denied, setDenied] = useState(false);
  const request = useRef<{ signature: string; key: string } | undefined>(
    undefined,
  );
  const [uncertain, setUncertain] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false),
    [pendingFile, setPendingFile] = useState(false);
  const dirty =
    pendingFile ||
    uploadBusy ||
    !!description ||
    links.length > 0 ||
    files.length > 0;
  useEffect(() => onDirty(point.id, dirty), [point.id, dirty, onDirty]);
  useEffect(() => () => onDirty(point.id, false), [point.id, onDirty]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    await action.run(async () => {
      if (denied || conflict || uploadBusy || pendingFile)
        throw new Error("Сначала проверьте актуальное состояние сдачи.");
      if (links.some((x) => !safeUrl(x.url)))
        throw new Error("Допустимы только ссылки http и https.");
      if (files.some((x) => x.status !== "READY"))
        throw new Error("Дождитесь проверки файлов или уберите их из сдачи.");
      const body: C.SubmitVersionRequest = {
        applicationId,
        expectedLastVersion: version,
        description,
        links,
        fileIds: files.map((x) => x.id),
      };
      const signature = JSON.stringify(body);
      if (uncertain && request.current?.signature !== signature)
        throw new Error(
          "Повторите исходную отправку, прежде чем менять результат.",
        );
      if (request.current?.signature !== signature)
        request.current = { signature, key: crypto.randomUUID() };
      try {
        const saved = await api.submitVersion(
          point.id,
          body,
          request.current!.key,
        );
        setVersion(saved.version);
        onSaved(saved);
        setDescription("");
        setLinks([]);
        setFiles([]);
        setUncertain(false);
        request.current = undefined;
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 409) {
            setConflict(true);
            setUncertain(false);
            setLatest(undefined);
          } else if (error.status === 403) {
            setDenied(true);
            setUncertain(false);
          } else if (error.kind === "network" || error.kind === "server") {
            setUncertain(true);
          }
        }
        throw error;
      }
    }, "Новая версия результата отправлена");
  }
  return (
    <form className="student-form student-submission-form" onSubmit={submit}>
      <h4>Новая версия результата</h4>
      <p>
        Следующая версия: {version + 1}. Предыдущие версии останутся в истории.
      </p>
      {Date.parse(point.deadline) < Date.now() && (
        <p className="student-note">
          Срок прошёл. Пока приём открыт, результат можно отправить с отметкой
          «Просрочено».
        </p>
      )}
      {denied && (
        <p role="alert">
          Доступ изменился (403). Текст сохранён в форме; отправка закрыта.
          Скопируйте нужные данные перед обновлением страницы.
        </p>
      )}
      {conflict && (
        <section className="student-blocked" aria-label="Конфликт версии сдачи">
          <p role="alert">
            Версия или состояние сдачи изменились (409). Ваш текст и файлы
            сохранены. Автоматической перезаписи нет.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={compare.busy || denied}
            onClick={() =>
              void compare.run(async () => {
                const access = await api.workspace(caseId);
                const current = access.stages
                  .flatMap((s) => s.checkpoints)
                  .find((p) => p.id === point.id);
                const app = await api.application(applicationId);
                const team = app.teamId
                  ? await api.team(app.teamId)
                  : undefined;
                if (
                  !current ||
                  executionBlock(access, app, team, user.id, current)
                ) {
                  setDenied(true);
                  throw new Error(
                    "Доступ или приём результатов изменились. Текст сохранён; отправка закрыта.",
                  );
                }
                setLatest(await readOwnHistory(api, point.id, applicationId));
              }, "История обновлена")
            }
          >
            Сравнить с актуальной сдачей
          </Button>
          {compare.feedback}
          {latest && (
            <>
              <p>
                На сервере версия {latest.latestVersion}; в форме — основа{" "}
                {version}.
              </p>
              <details>
                <summary>Последняя серверная версия</summary>
                <p className="student-preserve-text">
                  {latest.items.find((x) => x.version === latest.latestVersion)
                    ?.description ?? "Без описания"}
                </p>
                <ul className="student-list">
                  {latest.items
                    .find((x) => x.version === latest.latestVersion)
                    ?.links.map((link, i) => (
                      <li key={i}>
                        <ExternalLink url={link.url}>{link.label}</ExternalLink>
                      </li>
                    ))}
                </ul>
                <ul className="student-list">
                  {latest.items
                    .find((x) => x.version === latest.latestVersion)
                    ?.attachments.map((file) => (
                      <li key={file.id}>{file.displayName}</li>
                    ))}
                </ul>
              </details>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setVersion(latest.latestVersion);
                  setConflict(false);
                  request.current = undefined;
                  action.clear();
                }}
              >
                Сохранить мой текст для следующей версии
              </Button>
              <p className="student-note">
                После подтверждения проверьте форму и отдельно отправьте
                результат.
              </p>
            </>
          )}
        </section>
      )}
      {uncertain && (
        <p role="alert">
          Ответ не получен. Повторите ту же отправку: ключ запроса сохранён,
          чтобы не создать дубликат.
        </p>
      )}
      <fieldset disabled={action.busy || uploadBusy || uncertain}>
        <legend>Описание и ссылки</legend>
        <label className="field">
          Описание результата
          <textarea
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {links.map((link, i) => (
          <fieldset key={i}>
            <legend>Ссылка {i + 1}</legend>
            <Input
              label="Название ссылки"
              value={link.label}
              required
              maxLength={150}
              onChange={(e) =>
                setLinks(
                  links.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x,
                  ),
                )
              }
            />
            <Input
              label="Адрес ссылки"
              type="url"
              required
              maxLength={2048}
              value={link.url}
              onChange={(e) =>
                setLinks(
                  links.map((x, j) =>
                    j === i ? { ...x, url: e.target.value } : x,
                  ),
                )
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => setLinks(links.filter((_, j) => j !== i))}
            >
              Убрать ссылку {i + 1}
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="secondary"
          disabled={links.length >= 30}
          onClick={() => setLinks([...links, { label: "", url: "" }])}
        >
          Добавить ссылку на результат
        </Button>
      </fieldset>
      <SubmissionFiles
        caseId={caseId}
        checkpointId={point.id}
        applicationId={applicationId}
        items={files}
        onChange={setFiles}
        onBusy={setUploadBusy}
        onPending={setPendingFile}
        disabled={action.busy || uncertain || denied}
      />
      <div className="student-result-actions">
        {action.feedback}
        <p role="status">
          {dirty
            ? "Есть неотправленные изменения"
            : "Изменений для отправки нет"}
        </p>
        <Button
          type="submit"
          disabled={
            action.busy ||
            uploadBusy ||
            pendingFile ||
            compare.busy ||
            !dirty ||
            denied ||
            conflict ||
            files.some((x) => x.status !== "READY")
          }
        >
          {action.busy
            ? "Отправка…"
            : uncertain
              ? "Повторить отправку"
              : "Отправить новую версию"}
        </Button>
      </div>
    </form>
  );
}
