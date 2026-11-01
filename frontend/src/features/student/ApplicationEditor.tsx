import { useApplicationDraft } from "./useApplicationDraft";
import { ApplicationDraftRecovery } from "./ApplicationDraftRecovery";
import { useEffect, useRef, useState } from "react";
import { Link, useBlocker } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import type * as C from "./contracts";
import { Status } from "./shared";
import { useAction, useStudent } from "./hooks";
import { appendPortfolioLink, submissionBlocks } from "./applicationRules";
export function ApplicationEditor({
  initial,
  details,
  profile,
  team,
  nda,
}: {
  initial: C.CaseApplication;
  details: C.CasePublicDetails;
  profile: C.StudentProfilePrivate;
  team?: C.CaseTeam;
  nda: C.NdaPolicy;
}) {
  const { api, user, base } = useStudent();
  const action = useAction();
  const draft = useApplicationDraft(initial, api, user.id, team?.captainUserId);
  const {
    app,
    setApp,
    letter,
    setLetter,
    saved,
    saving,
    current,
    owner,
    editable,
    dirty,
  } = draft;
  const saveError = draft.failure?.message ?? "";
  const [ndaAccepted, setNdaAccepted] = useState(false);
  const [portfolioLink, setPortfolioLink] = useState("");
  const keys = useRef(new Map<string, string>());
  const keyFor = (command: string) => {
    const name = `${command}:${app.id}:${current.current.version}`;
    let key = keys.current.get(name);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(name, key);
    }
    return key;
  };
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === "blocked" && !dirty && !saveError) blocker.proceed();
  }, [blocker, dirty, saveError]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  const blocks = submissionBlocks(details, profile, team);
  if (
    (details.coverLetterRequired || details.admissionMode === "SELECTIVE") &&
    !letter.trim()
  )
    blocks.push("Добавьте сопроводительное письмо.");
  if (nda.required && (!nda.version || !nda.documentText || !ndaAccepted))
    blocks.push("Прочитайте и подтвердите NDA.");
  if (saving || letter !== saved)
    blocks.push("Дождитесь сохранения черновика.");
  const submit = () =>
    action.run(async () => {
      if (draft.failure || draft.dirty)
        throw new Error("Сначала сохраните черновик.");
      const freshBlocks = submissionBlocks(details, profile, team);
      if (freshBlocks.length) throw new Error(freshBlocks.join(" "));
      const updated = await api.submitApplication(
        app.id,
        {
          expectedVersion: current.current.version,
          ...(nda.required && nda.version
            ? { ndaAcceptance: { accepted: true, version: nda.version } }
            : {}),
        },
        keyFor("submit"),
      );
      setApp(updated);
    }, "Заявка отправлена");
  return (
    <Card>
      <h2>
        Заявка · <Status value={app.status} />
      </h2>
      {blocker.state === "blocked" && (
        <section role="alertdialog" aria-label="Несохранённый черновик">
          <p>
            Черновик ещё сохраняется. Переход продолжится после сохранения. При
            ошибке можно остаться и скопировать текст.
          </p>
          <Button variant="secondary" onClick={() => blocker.reset()}>
            Остаться
          </Button>
          <Button variant="ghost" onClick={() => blocker.proceed()}>
            Уйти без сохранения
          </Button>
        </section>
      )}
      <p>
        Формат: <Status value={app.format} />
      </p>
      {team && (
        <p>
          Команда: <Link to={`${base}/teams/${team.id}`}>{team.name}</Link>
        </p>
      )}
      {!owner && (
        <p className="student-note">
          Только просмотр: изменять заявку может капитан команды.
        </p>
      )}
      {editable ? (
        <div className="student-form">
          <label className="field">
            Сопроводительное письмо
            {details.coverLetterRequired ||
            details.admissionMode === "SELECTIVE"
              ? " *"
              : ""}
            <textarea
              maxLength={5000}
              required={
                details.coverLetterRequired ||
                details.admissionMode === "SELECTIVE"
              }
              readOnly={draft.failure?.kind === "access"}
              value={letter}
              onChange={(e) => setLetter(e.target.value)}
            />
          </label>
          <p role="status" className="student-note">
            {saving
              ? "Сохранение…"
              : letter === saved
                ? "Черновик сохранён на сервере"
                : "Есть несохранённые изменения"}
          </p>
          {draft.failure && (
            <ApplicationDraftRecovery
              key={draft.failure.kind}
              failure={draft.failure}
              letter={letter}
              saving={saving}
              onRetry={draft.retry}
              onCompare={draft.compare}
              onResolve={draft.resolve}
            />
          )}
          <Input
            label="Ссылка на портфолио"
            type="url"
            maxLength={2048}
            disabled={draft.failure?.kind === "access"}
            value={portfolioLink}
            onChange={(e) => setPortfolioLink(e.target.value)}
            hint="По нажатию ссылка будет добавлена в текст письма и сохранена вместе с ним."
          />
          <Button
            variant="secondary"
            disabled={
              !portfolioLink.trim() ||
              action.busy ||
              draft.failure?.kind === "access"
            }
            onClick={() =>
              void action.run(async () => {
                setLetter(appendPortfolioLink(letter, portfolioLink));
                setPortfolioLink("");
              }, "Ссылка добавлена в письмо")
            }
          >
            Добавить ссылку в письмо
          </Button>
          {nda.required && (
            <section>
              <h2>Соглашение о конфиденциальности</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>
                {nda.documentText ||
                  "Текст NDA недоступен. Подача заявки заблокирована."}
              </p>
              <label className="student-check">
                <input
                  type="checkbox"
                  checked={ndaAccepted}
                  onChange={(e) => setNdaAccepted(e.target.checked)}
                  disabled={!nda.version || !nda.documentText}
                />
                Подтверждаю NDA версии {nda.version ?? "—"}{" "}
                {app.format === "TEAM"
                  ? "как капитан команды."
                  : "как индивидуальный заявитель."}
              </label>
            </section>
          )}
          {!!blocks.length && (
            <ul className="student-list">
              {blocks.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
          <Button
            disabled={
              action.busy ||
              Boolean(blocks.length) ||
              Boolean(saveError) ||
              !app.allowedActions.includes("submit")
            }
            onClick={() => {
              if (
                window.confirm(
                  "Отправить заявку? Состав команды будет зафиксирован.",
                )
              )
                void submit();
            }}
          >
            Отправить заявку
          </Button>
        </div>
      ) : (
        <>
          <p>{app.coverLetter || "Сопроводительное письмо не добавлено."}</p>
          {app.decisionReason && <p>Причина решения: {app.decisionReason}</p>}
          {["REJECTED", "WITHDRAWN"].includes(app.status) && (
            <p>
              Повторная подача в этот кейс запрещена для прежних участников,
              даже в другом составе.
            </p>
          )}
          {owner && app.allowedActions.includes("withdraw") && (
            <Button
              variant="secondary"
              disabled={action.busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Отозвать заявку? Повторное участие в этом кейсе будет невозможно.",
                  )
                )
                  void action.run(
                    async () =>
                      setApp(
                        await api.withdrawApplication(
                          app.id,
                          {
                            expectedVersion: app.version,
                          },
                          keyFor("withdraw"),
                        ),
                      ),
                    "Заявка отозвана",
                  );
              }}
            >
              Отозвать заявку
            </Button>
          )}
        </>
      )}
      {action.feedback}
    </Card>
  );
}
