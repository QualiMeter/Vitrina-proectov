import { useEffect, useState } from "react";
import { Button } from "../../components/ui/Button";
import { useAction } from "./hooks";
import type { CaseApplication } from "./contracts";
import type { DraftFailure } from "./useApplicationDraft";
import "./applicationDraft.css";
export function ApplicationDraftRecovery({
  failure,
  letter,
  saving,
  onRetry,
  onCompare,
  onResolve,
}: {
  failure: DraftFailure;
  letter: string;
  saving: boolean;
  onRetry: () => Promise<void>;
  onCompare: () => Promise<CaseApplication | undefined>;
  onResolve: (
    fresh: CaseApplication,
    choice: "mine" | "server",
  ) => Promise<void>;
}) {
  const action = useAction();
  const [fresh, setFresh] = useState<CaseApplication>(),
    [choice, setChoice] = useState<"mine" | "server">();
  useEffect(() => {
    setFresh(undefined);
    setChoice(undefined);
  }, [failure]);
  return (
    <section
      className="student-blocked student-draft-compare"
      aria-label="Восстановление черновика"
    >
      <p role="alert" className="student-error">
        {failure.message}
      </p>
      {failure.kind === "retry" ? (
        <>
          <p>
            Введённый текст сохранён в форме. Можно повторить сохранение без
            загрузки старого письма.
          </p>
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => void onRetry()}
          >
            Повторить сохранение
          </Button>
        </>
      ) : (
        <>
          <p>
            Ваш текст не заменён. Сравните его с серверным черновиком и выберите
            нужное значение.
          </p>
          <Button
            variant="secondary"
            disabled={action.busy || saving}
            onClick={() =>
              void action.run(async () => {
                setFresh(await onCompare());
                setChoice(undefined);
              }, "Проверка черновика завершена")
            }
          >
            {failure.kind === "access"
              ? "Проверить доступ к черновику"
              : "Сравнить с серверным черновиком"}
          </Button>
          {action.feedback}
          {fresh && (
            <>
              <p>Актуальная версия: {fresh.version}.</p>
              <fieldset disabled={saving || action.busy}>
                <legend>Сопроводительное письмо: выбор версии</legend>
                <label>
                  <input
                    type="radio"
                    name="application-letter-choice"
                    checked={choice === "mine"}
                    onChange={() => setChoice("mine")}
                  />
                  Оставить мой текст
                </label>
                <p className="student-preserve-draft">
                  {letter || "Пустое письмо"}
                </p>
                <label>
                  <input
                    type="radio"
                    name="application-letter-choice"
                    checked={choice === "server"}
                    onChange={() => setChoice("server")}
                  />
                  Принять серверный текст
                </label>
                <p className="student-preserve-draft">
                  {fresh.coverLetter || "Пустое письмо"}
                </p>
              </fieldset>
              <p className="student-note">
                Выбор «Оставить мой текст» сохранит письмо целиком с актуальной
                версией. Выбор серверного текста заменит форму только после
                подтверждения.
              </p>
              <Button
                disabled={!choice || saving || action.busy}
                onClick={() =>
                  void action.run(async () => {
                    if (choice) await onResolve(fresh, choice);
                  }, "Выбор применён")
                }
              >
                Применить выбранную версию письма
              </Button>
            </>
          )}
        </>
      )}
    </section>
  );
}
