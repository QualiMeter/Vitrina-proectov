import { useContext, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { Button, ButtonLink } from "../../components/ui/Button";
import { EmptyState } from "../../components/feedback/States";
import { liveStudentGateway } from "./gateway";
import { DemoGatewayContext } from "./demoContext";
import { StudentProjectsBlock } from "./StudentProjectsBlock";
import { demoStudentProjects } from "./projectExamples";
import type * as C from "./contracts";
import { ExternalLink, Load, Pager, Status, StudentAvatar } from "./shared";
import { safeUrl, useAction, useLoad, useStudent } from "./hooks";

export function DashboardPage() {
  const { api, base, demo } = useStudent();
  const state = useLoad(
    async () => ({
      profile: await api.profile(),
      participations: await api.participations(1),
    }),
    "dashboard",
  );
  return (
    <>
      <h1>Мой кабинет</h1>
      <p className="student-lead">
        Ваш профиль, команды и работа над кейсами — в одном месте.
      </p>
      <Load state={state}>
        {({ profile, participations }) => (
          <>
            <Card>
              <p className="student-note">Добро пожаловать</p>
              <h2>{profile.nickname}</h2>
              <p>
                {profile.publicSummary ||
                  "Добавьте информацию о себе в профиле."}
              </p>
              <div className="student-actions">
                <ButtonLink to={`${base}/profile`}>Открыть профиль</ButtonLink>
                <ButtonLink variant="secondary" to={`${base}/participations`}>
                  Мои участия · {participations.total}
                </ButtonLink>
              </div>
            </Card>
            <div className="student-grid">
              {[
                [
                  "invitations",
                  "Приглашения",
                  "Подтвердите участие в команде лично.",
                ],
                [
                  "portfolio",
                  "Портфолио",
                  "Готовые работы и подтверждённый опыт.",
                ],
                [
                  "projects",
                  "Мои проекты",
                  "Собственные инициативы и открытые роли.",
                ],
              ].map(([path, title, description]) => (
                <Card key={path}>
                  <h2>{title}</h2>
                  <p>{description}</p>
                  <Link to={`${base}/${path}`}>Перейти →</Link>
                </Card>
              ))}
            </div>
            {demo && (
              <StudentProjectsBlock
                projects={demoStudentProjects}
                basePath="/demo/student-projects"
              />
            )}
          </>
        )}
      </Load>
    </>
  );
}

function ProfileEditor({
  profile,
  reference,
  refresh,
}: {
  profile: C.StudentProfilePrivate;
  reference: C.ReferenceDataResponse;
  refresh: () => void;
}) {
  const { api, base, demo } = useStudent();
  const action = useAction();
  const [form, setForm] = useState(profile);
  const [avatarFile, setAvatarFile] = useState<File>();
  const patch = (values: Partial<C.StudentProfilePrivate>) =>
    setForm((prev) => ({ ...prev, ...values }));
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
      await api.updateProfile({
        expectedVersion: profile.version,
        fullName: fullName.trim(),
        nickname: nickname.trim(),
        instituteId,
        course,
        studyGroup,
        description,
        publicSummary,
        publicLinks,
        achievements,
        skillIds,
        technologyIds,
      });
      refresh();
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
      <form className="student-form" onSubmit={save}>
        <h2>Личные и учебные данные</h2>
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
            onChange={(e) =>
              patch({ instituteId: e.target.value || undefined })
            }
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
        <h2>Публичные ссылки</h2>
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
        <h2>Достижения</h2>
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
                  achievements: form.achievements.filter((_, i) => i !== index),
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
        {action.feedback}
        <Button disabled={action.busy} type="submit">
          {action.busy ? "Сохранение…" : "Сохранить профиль"}
        </Button>
      </form>
      <hr className="student-divider" />
      <form
        className="student-form"
        onSubmit={(e) => {
          e.preventDefault();
          void action.run(async () => {
            if (!avatarFile) throw new Error("Выберите изображение.");
            await api.avatar(avatarFile);
            refresh();
          });
        }}
      >
        <h2>Аватар</h2>
        <p className="student-note">
          Изображение становится публичным после проверки сервером. Лимиты
          размера и формата уточняются с backend.
        </p>
        <Input
          label="Изображение профиля"
          type="file"
          accept="image/*"
          onChange={(e) => setAvatarFile(e.target.files?.[0])}
        />
        <div className="student-actions">
          <Button disabled={action.busy || !avatarFile || demo}>
            Загрузить аватар
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={action.busy || !profile.avatarUrl}
            onClick={() =>
              void action.run(async () => {
                await api.avatar();
                refresh();
              })
            }
          >
            Удалить аватар
          </Button>
        </div>
        {demo && (
          <p>
            В демонстрации загрузка изображения недоступна: нужен сервер
            обработки.
          </p>
        )}
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
export function ProfilePage() {
  const { api } = useStudent();
  const state = useLoad(
    async () => ({
      profile: await api.profile(),
      reference: await api.reference(),
    }),
    "profile",
  );
  return (
    <>
      <h1>Мой профиль</h1>
      <p className="student-lead">
        Укажите опыт и навыки, которые помогут найти команду.
      </p>
      <Load state={state}>
        {(data) => (
          <ProfileEditor
            key={data.profile.version}
            {...data}
            refresh={state.reload}
          />
        )}
      </Load>
    </>
  );
}

export function PublicProfilePage({ demo = false }: { demo?: boolean }) {
  const { id = "" } = useParams();
  const demoApi = useContext(DemoGatewayContext);
  const state = useLoad(async () => {
    if (demo && demoApi) return demoApi.publicProfile(id);
    return liveStudentGateway.publicProfile(id);
  }, `public-${id}-${demo}`);
  return (
    <main className="student-public">
      <Link to="/">← На главную</Link>
      {demo && (
        <p className="student-demo">Демонстрационный публичный профиль</p>
      )}
      <Load state={state}>
        {(profile) => (
          <>
            <StudentAvatar
              id={profile.studentId}
              present={Boolean(profile.avatarUrl)}
              nickname={profile.nickname}
              demo={demo}
            />
            <h1>{profile.nickname}</h1>
            <p>{profile.publicSummary}</p>
            <h2>Достижения</h2>
            {profile.achievements.length ? (
              <ul>
                {profile.achievements.map((x, i) => (
                  <li key={i}>
                    {x.title}
                    {x.description && <p>{x.description}</p>}
                    {x.url && (
                      <ExternalLink url={x.url}>Подробнее</ExternalLink>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Достижения пока не добавлены.</p>
            )}
            <h2>Публичные ссылки</h2>
            {profile.publicLinks.map((x, i) => (
              <p key={i}>
                <ExternalLink url={x.url}>{x.label}</ExternalLink>
              </p>
            ))}
            <p>
              <Link
                to={
                  demo
                    ? "/demo/student/portfolio"
                    : `/students/${encodeURIComponent(id)}/portfolio`
                }
              >
                Публичное портфолио
              </Link>
            </p>
          </>
        )}
      </Load>
    </main>
  );
}

export function ParticipationsPage() {
  const { api, base } = useStudent();
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState(false);
  const state = useLoad(
    () => api.participations(page),
    `participations-${page}`,
  );
  return (
    <>
      <h1>Мои участия</h1>
      <p className="student-lead">
        Продолжайте черновики и следите за выполнением кейсов.
      </p>
      <label className="student-check">
        <input
          type="checkbox"
          checked={drafts}
          onChange={(e) => setDrafts(e.target.checked)}
        />
        Только черновики на текущей странице
      </label>
      <Load state={state}>
        {(data) => (
          <>
            <div className="student-grid">
              {data.items
                .filter((x) => !drafts || x.applicationStatus === "DRAFT")
                .map((item) => (
                  <Card
                    key={item.applicationId ?? `${item.caseId}-${item.teamId}`}
                  >
                    <h2>{item.caseTitle}</h2>
                    <div className="student-tags">
                      <Status value={item.applicationStatus} />
                      <Status value={item.role} />
                      {item.teamExecutionStatus && (
                        <Status value={item.teamExecutionStatus} />
                      )}
                    </div>
                    {["REJECTED", "WITHDRAWN"].includes(
                      item.applicationStatus,
                    ) && (
                      <p>
                        Повторная заявка в этот кейс недоступна, в том числе в
                        другом составе.
                      </p>
                    )}
                    <div className="student-actions">
                      {item.applicationStatus === "ADMITTED" && (
                        <ButtonLink
                          to={`${base}/cases/${item.caseId}/workspace`}
                        >
                          Рабочее пространство
                        </ButtonLink>
                      )}
                    </div>
                  </Card>
                ))}
            </div>
            {!data.items.filter(
              (x) => !drafts || x.applicationStatus === "DRAFT",
            ).length && (
              <EmptyState
                title="Участий пока нет"
                description="Откройте подходящий кейс и подайте заявку."
              />
            )}
            <Pager page={page} total={data.total} onPage={setPage} />
          </>
        )}
      </Load>
    </>
  );
}
