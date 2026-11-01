import {
  categories,
  developmentLabels,
  interestLabels,
  type Reference,
} from "./models";
import type { comparePublication, PublicationChoices } from "./conflict";
function readable(field: string, encoded: string, reference: Reference) {
  const value: unknown = JSON.parse(encoded);
  if (value === "" || value == null || (Array.isArray(value) && !value.length))
    return "Не указано";
  if (field === "category")
    return categories.find(([key]) => key === value)?.[1] ?? String(value);
  if (field === "developmentStatus")
    return (
      developmentLabels[value as keyof typeof developmentLabels] ??
      String(value)
    );
  if (field === "directionId")
    return (
      reference.directions.find((x) => x.id === value)?.name ??
      "Направление не указано"
    );
  if (field === "technologyIds" && Array.isArray(value))
    return value
      .map(
        (id) =>
          reference.technologies.find((x) => x.id === id)?.name ?? "Технология",
      )
      .join(", ");
  if (field === "interests" && Array.isArray(value))
    return value
      .map((x) => interestLabels[x as keyof typeof interestLabels] ?? String(x))
      .join(", ");
  if (Array.isArray(value))
    return value
      .map((x) => {
        if (!x || typeof x !== "object") return String(x);
        const item = x as Record<string, unknown>;
        if (field === "media") return `${item.name} (${item.contentType})`;
        if (field === "links") return `${item.label}: ${item.url}`;
        if (field === "vacancies")
          return `${item.title} · ${item.skills ?? ""}\n${item.tasks ?? ""} · ${item.active ? "Открыта" : "Закрыта"}`;
        return JSON.stringify(x);
      })
      .join("\n");
  return String(value);
}
export function PublicationConflictFields({
  comparison,
  choices,
  reference,
  onChoose,
}: {
  comparison: ReturnType<typeof comparePublication>;
  choices: PublicationChoices;
  reference: Reference;
  onChoose: (field: string, choice: "mine" | "server") => void;
}) {
  return (
    <>
      <p className="student-note">
        Выберите значение каждого спорного поля отдельно. Списки выбираются
        целиком: «Моё значение» заменит серверные ссылки, материалы или роли
        этого поля, без объединения элементов.
      </p>
      {comparison.conflicts.map((f) => (
        <fieldset key={f.key}>
          <legend>{f.label}</legend>
          {(["mine", "server"] as const).map((choice) => (
            <label className="publication-conflict-option" key={choice}>
              <input
                type="radio"
                name={`publication-conflict-${f.key}`}
                checked={choices[f.key] === choice}
                onChange={() => onChoose(f.key, choice)}
              />
              <span>
                {choice === "mine"
                  ? "Оставить моё значение"
                  : "Принять серверное значение"}
                <pre>
                  {readable(
                    f.key,
                    choice === "mine" ? f.mine : f.server,
                    reference,
                  )}
                </pre>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </>
  );
}
