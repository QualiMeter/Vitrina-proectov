import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { useAction, useStudent } from "./hooks";
import type * as C from "./contracts";
import {
  conflictingProfileFields,
  profileFieldLabels,
  resolveProfileConflict,
  type ProfileField,
} from "./profileConflict";
export function ProfileConflictPanel({
  base,
  draft,
  reference,
  onResolve,
}: {
  base: C.StudentProfilePrivate;
  draft: C.StudentProfilePrivate;
  reference: C.ReferenceDataResponse;
  onResolve: (
    server: C.StudentProfilePrivate,
    merged: C.StudentProfilePrivate,
  ) => void;
}) {
  const { api } = useStudent();
  const load = useAction();
  const [server, setServer] = useState<C.StudentProfilePrivate>();
  const [selection, setSelection] = useState<{
    signature: string;
    choices: Partial<Record<ProfileField, "mine" | "server">>;
  }>({ signature: "", choices: {} });
  const conflicts = server ? conflictingProfileFields(base, draft, server) : [];
  const signature = JSON.stringify(
    conflicts.map((field) => [field, draft[field], server?.[field]]),
  );
  const choices = selection.signature === signature ? selection.choices : {};
  const display = (field: ProfileField, value: unknown) => {
    if (value == null || value === "") return "Не указано";
    if (field === "instituteId")
      return (
        reference.institutes.find((x) => x.id === value)?.name ?? String(value)
      );
    return typeof value === "string" || typeof value === "number"
      ? String(value)
      : JSON.stringify(value, null, 2);
  };
  return (
    <section
      className="student-blocked student-conflict"
      aria-labelledby="profile-conflict-title"
    >
      <h2 id="profile-conflict-title">Профиль изменён на сервере</h2>
      <p role="alert">
        Ваши правки сохранены в форме. Сравните версии перед повторным
        сохранением.
      </p>
      <Button
        type="button"
        variant="secondary"
        disabled={load.busy}
        onClick={() =>
          void load.run(async () => {
            setServer(await api.profile());
            setSelection({ signature: "", choices: {} });
          }, "Актуальная версия загружена")
        }
      >
        Сравнить с серверной версией
      </Button>
      {load.feedback}
      {server && (
        <>
          <p>
            Версия на сервере: {server.version}. Изменения полей, которые вы не
            редактировали, будут сохранены. Списки сравниваются целиком.
          </p>
          {conflicts.length ? (
            conflicts.map((field) => (
              <fieldset key={field}>
                <legend>{profileFieldLabels[field]}</legend>
                {(["mine", "server"] as const).map((choice) => (
                  <label className="student-conflict-choice" key={choice}>
                    <input
                      type="radio"
                      name={`conflict-${field}`}
                      checked={choices[field] === choice}
                      onChange={() =>
                        setSelection({
                          signature,
                          choices: { ...choices, [field]: choice },
                        })
                      }
                    />
                    <span>
                      {choice === "mine"
                        ? "Оставить моё значение"
                        : "Принять серверное значение"}
                      <code>
                        {display(
                          field,
                          choice === "mine" ? draft[field] : server[field],
                        )}
                      </code>
                    </span>
                  </label>
                ))}
              </fieldset>
            ))
          ) : (
            <p>
              Пересекающихся изменений нет: ваши правки можно объединить с
              актуальной версией.
            </p>
          )}
          <Button
            type="button"
            disabled={load.busy || conflicts.some((field) => !choices[field])}
            onClick={() =>
              onResolve(
                server,
                resolveProfileConflict(base, draft, server, choices),
              )
            }
          >
            Применить выбор к форме
          </Button>
          <p className="student-note">
            Это ещё не отправляет изменения. Проверьте форму и нажмите
            «Сохранить профиль».
          </p>
        </>
      )}
    </section>
  );
}
