import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import type * as C from "./contracts";
import { safeUrl, useAction, useStudent } from "./hooks";
export function ProfileEditor({
  profile,
  reference,
  onSaved,
  onDirty,
}: {
  profile: C.StudentProfilePrivate;
  reference: C.ReferenceDataResponse;
  onSaved: (profile: C.StudentProfilePrivate) => void;
  onDirty: (dirty: boolean) => void;
}) {
  const { api, base, demo } = useStudent();
  const action = useAction();
  const [form, setForm] = useState(profile);
  const dirty = JSON.stringify(form) !== JSON.stringify(profile);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  const patch = (values: Partial<C.StudentProfilePrivate>) => {
    setForm((prev) => ({ ...prev, ...values }));
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    await action.run(async () => {
      if (
        form.publicLinks.some((x) => !safeUrl(x.url)) ||
        form.achievements.some((x) => x.url && !safeUrl(x.url))
      )
        throw new Error("Допустимы только ссылки http и https.");
      const {
        fullName,
        nickname,
        instituteId,
        course,
        studyGroup,
        description,
        publicSummary,
        publicLinks,
        achievements,
        skillIds,
        technologyIds,
      } = form;
      const updated = await api.updateProfile({
        expectedVersion: profile.version,
        fullName: fullName.trim(),
        nickname: nickname.trim(),
        ...(instituteId !== profile.instituteId
          ? { instituteId: instituteId ?? null }
          : {}),
        course: course ?? profile.course,
        studyGroup,
        description,
        publicSummary,
        publicLinks,
        achievements,
        skillIds,
        technologyIds,
      });
      onSaved(updated);
    });
  }
  const toggle = (field: "skillIds" | "technologyIds", id: string) =>
    patch({
      [field]: form[field].includes(id)
        ? form[field].filter((x) => x !== id)
        : [...form[field], id],
    });
  return (
    <>
      <form
        className="student-form student-profile-form"
        onSubmit={save}
        onInvalidCapture={(event) => {
          const details = (event.target as HTMLElement).closest("details");
          if (details) details.open = true;
        }}
      >
        <section
          className="student-profile-section"
          aria-labelledby="profile-personal"
        >
          <h2 id="profile-personal">Личные и учебные данные</h2>
          <Input
            label="ФИО"
            required
            minLength={2}
            maxLength={200}
            value={form.fullName}
            onChange={(e) => patch({ fullName: e.target.value })}
          />
          <Input
            label="Никнейм"
            required
            minLength={2}
            maxLength={32}
            value={form.nickname}
            onChange={(e) => patch({ nickname: e.target.value })}
            hint="Никнейм виден всем. Уникальность проверяет сервер."
          />
          <label className="field">
            Институт / факультет
            <select
              value={form.instituteId ?? ""}
              onChange={(e) => patch({ instituteId: e.target.value || null })}
            >
              <option value="">Не указан</option>
              {reference.institutes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="Курс"
            type="number"
            required={profile.course !== undefined}
            min={1}
            max={6}
            value={form.course ?? ""}
            onChange={(e) =>
              patch({
                course: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
          <Input
            label="Группа"
            maxLength={64}
            value={form.studyGroup ?? ""}
            onChange={(e) => patch({ studyGroup: e.target.value })}
          />
          <p className="student-note">
            ФИО, курс и группа доступны уполномоченным представителям компаний;
            гости их не видят.
          </p>
        </section>
        <details className="student-profile-section">
          <summary>О себе</summary>
          <label className="field">
            Описание
            <textarea
              maxLength={5000}
              value={form.description ?? ""}
              onChange={(e) => patch({ description: e.target.value })}
            />
          </label>
          <label className="field">
            Публичное описание
            <textarea
              maxLength={2000}
              value={form.publicSummary ?? ""}
              onChange={(e) => patch({ publicSummary: e.target.value })}
            />
          </label>
        </details>
        <details className="student-profile-section">
          <summary>Навыки и технологии</summary>
          {(
            [
              ["skillIds", "Навыки", reference.competencies],
              ["technologyIds", "Технологии", reference.technologies],
            ] as const
          ).map(([field, title, values]) => (
            <fieldset key={field}>
              <legend>{title}</legend>
              {values.length ? (
                values.map((x) => (
                  <label key={x.id}>
                    <input
                      type="checkbox"
                      checked={form[field].includes(x.id)}
                      onChange={() => toggle(field, x.id)}
                    />
                    {x.name}
                  </label>
                ))
              ) : (
                <p>Справочник пока пуст.</p>
              )}
            </fieldset>
          ))}
        </details>
        <details className="student-profile-section">
          <summary>Публичные ссылки</summary>
          <p className="student-note">
            Добавляйте только те адреса, которые готовы показывать всем
            посетителям.
          </p>
          {form.publicLinks.map((link, index) => (
            <fieldset key={index}>
              <legend>Ссылка {index + 1}</legend>
              <Input
                label="Название ссылки"
                required
                maxLength={80}
                value={link.label}
                onChange={(e) =>
                  patch({
                    publicLinks: form.publicLinks.map((x, i) =>
                      i === index ? { ...x, label: e.target.value } : x,
                    ),
                  })
                }
              />
              <Input
                label="Адрес ссылки"
                type="url"
                required
                maxLength={2048}
                value={link.url}
                onChange={(e) =>
                  patch({
                    publicLinks: form.publicLinks.map((x, i) =>
                      i === index ? { ...x, url: e.target.value } : x,
                    ),
                  })
                }
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  patch({
                    publicLinks: form.publicLinks.filter((_, i) => i !== index),
                  })
                }
              >
                Убрать ссылку
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              patch({
                publicLinks: [...form.publicLinks, { label: "", url: "" }],
              })
            }
          >
            Добавить ссылку
          </Button>
        </details>
        <details className="student-profile-section">
          <summary>Достижения</summary>
          {form.achievements.map((item, index) => (
            <fieldset key={index}>
              <legend>Достижение {index + 1}</legend>
              <Input
                label="Название достижения"
                required
                maxLength={160}
                value={item.title}
                onChange={(e) =>
                  patch({
                    achievements: form.achievements.map((x, i) =>
                      i === index ? { ...x, title: e.target.value } : x,
                    ),
                  })
                }
              />
              <Input
                label="Описание достижения"
                maxLength={1000}
                value={item.description ?? ""}
                onChange={(e) =>
                  patch({
                    achievements: form.achievements.map((x, i) =>
                      i === index ? { ...x, description: e.target.value } : x,
                    ),
                  })
                }
              />
              <Input
                label="Подтверждающая ссылка"
                type="url"
                maxLength={2048}
                value={item.url ?? ""}
                onChange={(e) =>
                  patch({
                    achievements: form.achievements.map((x, i) =>
                      i === index
                        ? { ...x, url: e.target.value || undefined }
                        : x,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                type="button"
                onClick={() =>
                  patch({
                    achievements: form.achievements.filter(
                      (_, i) => i !== index,
                    ),
                  })
                }
              >
                Убрать достижение
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            disabled={form.achievements.length >= 50}
            onClick={() =>
              patch({ achievements: [...form.achievements, { title: "" }] })
            }
          >
            Добавить достижение
          </Button>
        </details>
        <div className="student-save-bar">
          <span role="status">
            {dirty ? "Есть несохранённые изменения" : "Изменения сохранены"}
          </span>
          {action.feedback}
          <Button disabled={action.busy || !dirty} type="submit">
            {action.busy ? "Сохранение…" : "Сохранить профиль"}
          </Button>
        </div>
      </form>
      <p>
        <Link to={`${demo ? "/demo" : ""}/students/${profile.userId}`}>
          Посмотреть публичный профиль
        </Link>{" "}
        · <Link to={`${base}/portfolio`}>Моё портфолио</Link>
      </p>
    </>
  );
}
