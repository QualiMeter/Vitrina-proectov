import { Input } from "../../../components/ui/Input";
import { Button } from "../../../components/ui/Button";
import {
  categories,
  developmentLabels,
  interestLabels,
  type Draft,
  type Reference,
  type Interest,
} from "./models";
export function DraftFields({
  draft: d,
  onChange,
  reference,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  reference: Reference;
}) {
  const patch = (values: Partial<Draft>) =>
    onChange({ ...d, ...values } as Draft);
  return (
    <>
      <section className="student-profile-section publication-section">
        <h2>Основные сведения</h2>
        <Input
          label="Название"
          required
          maxLength={200}
          value={d.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
        <label className="field">
          Категория
          <select
            value={d.category}
            onChange={(e) =>
              patch({ category: e.target.value as Draft["category"] })
            }
          >
            {categories.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Подробное описание
          <textarea
            maxLength={10000}
            required={d.kind === "PROJECT"}
            value={d.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </label>
        {d.kind === "WORK" ? (
          <>
            <label className="field">
              Полученный результат
              <textarea
                required
                maxLength={5000}
                value={d.result}
                onChange={(e) => onChange({ ...d, result: e.target.value })}
              />
            </label>
            <label className="field">
              Личный вклад
              <textarea
                required
                maxLength={5000}
                value={d.contribution}
                onChange={(e) =>
                  onChange({ ...d, contribution: e.target.value })
                }
              />
            </label>
            <Input
              label="Соавторы"
              maxLength={500}
              value={d.coauthors}
              onChange={(e) => onChange({ ...d, coauthors: e.target.value })}
            />
            <p className="student-note">
              Соавторы — текстовая подпись, без автоматического включения в
              команду.
            </p>
          </>
        ) : (
          <>
            <Input
              label="Краткое описание"
              required
              maxLength={500}
              value={d.summary}
              onChange={(e) => onChange({ ...d, summary: e.target.value })}
            />
            <label className="field">
              Проблема
              <textarea
                required
                maxLength={5000}
                value={d.problem}
                onChange={(e) => onChange({ ...d, problem: e.target.value })}
              />
            </label>
            <label className="field">
              Цели
              <textarea
                required
                maxLength={5000}
                value={d.goals}
                onChange={(e) => onChange({ ...d, goals: e.target.value })}
              />
            </label>
            <label className="field">
              Статус разработки
              <select
                value={d.developmentStatus}
                onChange={(e) =>
                  onChange({
                    ...d,
                    developmentStatus: e.target
                      .value as keyof typeof developmentLabels,
                  })
                }
              >
                {Object.entries(developmentLabels).map(([id, title]) => (
                  <option key={id} value={id}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
      </section>
      <details className="student-profile-section" open>
        <summary>Технологии и период</summary>
        <label className="field">
          Направление
          <select
            value={d.directionId}
            onChange={(e) => patch({ directionId: e.target.value })}
          >
            <option value="">Не указано</option>
            {reference.directions.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Технологии</legend>
          {reference.technologies.map((x) => (
            <label className="publication-check" key={x.id}>
              <input
                type="checkbox"
                checked={d.technologyIds.includes(x.id)}
                onChange={() =>
                  patch({
                    technologyIds: d.technologyIds.includes(x.id)
                      ? d.technologyIds.filter((v) => v !== x.id)
                      : [...d.technologyIds, x.id],
                  })
                }
              />
              {x.name}
            </label>
          ))}
        </fieldset>
        <Input
          label="Дата начала"
          type="date"
          value={d.startDate}
          onChange={(e) => patch({ startDate: e.target.value })}
        />
      </details>
      <details className="student-profile-section" open>
        <summary>Публичные ссылки</summary>
        <p className="student-note">
          Репозиторий и сайт необязательны. Добавляйте только сведения для
          публикации.
        </p>
        {d.links.map((l, i) => (
          <fieldset key={i}>
            <legend>Ссылка {i + 1}</legend>
            <Input
              label="Название ссылки"
              required
              maxLength={150}
              value={l.label}
              onChange={(e) =>
                patch({
                  links: d.links.map((x, j) =>
                    j === i ? { ...x, label: e.target.value } : x,
                  ),
                })
              }
            />
            <Input
              label="Адрес ссылки"
              type="url"
              required
              maxLength={2048}
              value={l.url}
              onChange={(e) =>
                patch({
                  links: d.links.map((x, j) =>
                    j === i ? { ...x, url: e.target.value } : x,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                patch({ links: d.links.filter((_, j) => j !== i) })
              }
            >
              Убрать ссылку {i + 1}
            </Button>
          </fieldset>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => patch({ links: [...d.links, { label: "", url: "" }] })}
        >
          Добавить публичную ссылку
        </Button>
      </details>
      {d.kind === "PROJECT" && (
        <>
          <details className="student-profile-section" open>
            <summary>Поиск и публичный контакт</summary>
            {Object.entries(interestLabels).map(([id, title]) => (
              <label className="publication-check" key={id}>
                <input
                  type="checkbox"
                  checked={d.interests.includes(id as Interest)}
                  onChange={() =>
                    onChange({
                      ...d,
                      interests: d.interests.includes(id as Interest)
                        ? d.interests.filter((x) => x !== id)
                        : [...d.interests, id as Interest],
                    })
                  }
                />
                {title}
              </label>
            ))}
            <Input
              label="Публичная ссылка для связи"
              type="url"
              maxLength={2048}
              value={d.publicContactUrl}
              onChange={(e) =>
                onChange({ ...d, publicContactUrl: e.target.value })
              }
            />
            <p className="student-note">
              Эта ссылка будет доступна всем после модерации. Личные контакты из
              профиля не подставляются.
            </p>
          </details>
          <details className="student-profile-section" open>
            <summary>Открытые роли</summary>
            <p className="student-note">
              Флаг «Ищу команду» и конкретные открытые позиции задаются
              отдельно.
            </p>
            {d.vacancies.map((v, i) => (
              <fieldset key={v.id}>
                <legend>Роль {i + 1}</legend>
                <Input
                  label="Название роли"
                  required
                  value={v.title}
                  onChange={(e) =>
                    onChange({
                      ...d,
                      vacancies: d.vacancies.map((x, j) =>
                        j === i ? { ...x, title: e.target.value } : x,
                      ),
                    })
                  }
                />
                <Input
                  label="Требуемые компетенции"
                  value={v.skills}
                  onChange={(e) =>
                    onChange({
                      ...d,
                      vacancies: d.vacancies.map((x, j) =>
                        j === i ? { ...x, skills: e.target.value } : x,
                      ),
                    })
                  }
                />
                <label className="field">
                  Задачи роли
                  <textarea
                    value={v.tasks}
                    onChange={(e) =>
                      onChange({
                        ...d,
                        vacancies: d.vacancies.map((x, j) =>
                          j === i ? { ...x, tasks: e.target.value } : x,
                        ),
                      })
                    }
                  />
                </label>
                <label className="publication-check">
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) =>
                      onChange({
                        ...d,
                        vacancies: d.vacancies.map((x, j) =>
                          j === i ? { ...x, active: e.target.checked } : x,
                        ),
                      })
                    }
                  />
                  Позиция открыта
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    onChange({
                      ...d,
                      vacancies: d.vacancies.filter((_, j) => j !== i),
                    })
                  }
                >
                  Убрать роль {i + 1}
                </Button>
              </fieldset>
            ))}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                onChange({
                  ...d,
                  vacancies: [
                    ...d.vacancies,
                    {
                      id: crypto.randomUUID(),
                      title: "",
                      skills: "",
                      tasks: "",
                      active: true,
                    },
                  ],
                })
              }
            >
              Добавить открытую роль
            </Button>
          </details>
        </>
      )}
    </>
  );
}
