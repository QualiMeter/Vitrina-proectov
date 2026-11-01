import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import {
  createPublicationDemo,
  publicationIds,
  publicationDemoUserId,
} from "../publications/demo";
import { PublicationContext } from "../publications/context";
import {
  createProjectManagementDemo,
  createProjectManagementState,
  externalProjectId,
} from "./demo";
import {
  blockedProjectManagementGateway,
  ProjectManagementContext,
} from "./context";
import { ProjectTeamPage } from "./ProjectTeamPage";
import { ProjectApplicationPage } from "./ProjectApplicationPage";
import { FavoritesPage, NotificationsPage } from "./ActivityPages";
import { AuthorProjectsPage } from "./AuthorProjectsPage";
import { createDemoGateway } from "../demo";
import { StudentContext } from "../hooks";
import { ApiError } from "../../../api/client";
import { demoCaseId } from "../day2Demo";
import type { ProjectManagementGateway } from "./models";
const other = "00000000-0000-4000-8000-000000000002";
function fixture() {
  const pub = createPublicationDemo(),
    state = createProjectManagementState(),
    api = createProjectManagementDemo(pub, undefined, state);
  return { pub, state, api };
}
it("author decisions atomically add a member, reject stale repeats and notify only the candidate", async () => {
  const { api, state } = fixture();
  const before = await api.manage(publicationIds.project),
    a = before.applications[0];
  await api.decide(before.project.id, a.id, "ACCEPTED", before.version);
  const after = await api.manage(before.project.id);
  expect(after.members.some((m) => m.userId === other)).toBe(true);
  expect(after.applications[0].status).toBe("ACCEPTED");
  expect(after.version).toBe(2);
  await expect(
    api.decide(before.project.id, a.id, "REJECTED", before.version),
  ).rejects.toMatchObject({ status: 409 });
  expect(state.notices.filter((n) => n.userId === other)).toHaveLength(1);
  expect(
    (await api.notices()).some((n) => n.title === "Заявка в проект принята"),
  ).toBe(false);
});
it("rejecting does not add members and closed roles cannot be accepted", async () => {
  const { api, pub } = fixture(),
    before = await api.manage(publicationIds.project);
  await api.decide(before.project.id, before.applications[0].id, "REJECTED", 1);
  expect((await api.manage(before.project.id)).members).toHaveLength(2);
  const second = fixture(),
    p = await second.pub.getOwned("PROJECT", publicationIds.project);
  if (p.kind !== "PROJECT") throw new Error();
  p.vacancies = [];
  second.pub.getOwned = vi.fn().mockResolvedValue(p);
  await expect(
    second.api.decide(
      p.id,
      second.state.teams[p.id].applications[0].id,
      "ACCEPTED",
      1,
    ),
  ).rejects.toThrow(/Роль/);
  expect(second.state.teams[p.id].members).toHaveLength(2);
  expect(pub).toBeDefined();
});
it("denies non-author management, self-removal and foreign notification writes", async () => {
  const { api, pub, state } = fixture(),
    candidate = createProjectManagementDemo(pub, other, state);
  await expect(candidate.manage(publicationIds.project)).rejects.toMatchObject({
    status: 403,
  });
  await expect(
    api.remove(publicationIds.project, publicationDemoUserId, 1),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    candidate.markRead(state.notices[0].id, 1),
  ).rejects.toMatchObject({ status: 403 });
  expect("assignCurator" in api).toBe(false);
});
it("application submission requires a published project and open role, never reveals other applications", async () => {
  const { pub, state } = fixture(),
    candidate = createProjectManagementDemo(pub, other, state);
  const context = await candidate.applicationContext(publicationIds.project);
  expect(context.application?.userId).toBe(other);
  const current = createProjectManagementDemo(pub, undefined, state),
    external = await current.applicationContext(externalProjectId);
  expect(external.relation).toBe("CANDIDATE");
  await expect(
    current.apply(externalProjectId, "missing", "Письмо"),
  ).rejects.toThrow(/роль/);
  const app = await current.apply(
    externalProjectId,
    external.project.vacancies[0].id,
    "Мой вклад",
  );
  expect(app.status).toBe("PENDING");
  expect(state.teams[externalProjectId].members).toHaveLength(1);
  await expect(
    current.apply(
      externalProjectId,
      external.project.vacancies[0].id,
      "Дубликат",
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    current.applicationContext(publicationIds.privateProject),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    current.apply(publicationIds.project, "role", "Письмо"),
  ).rejects.toMatchObject({ status: 403 });
});
it("only the applicant can withdraw a pending version and resubmission is explicit terminal in the demo", async () => {
  const { pub, state, api } = fixture(),
    context = await api.applicationContext(externalProjectId),
    app = await api.apply(
      externalProjectId,
      context.project.vacancies[0].id,
      "Хочу участвовать",
    );
  const foreign = createProjectManagementDemo(pub, other, state);
  await expect(
    foreign.withdraw(externalProjectId, app.id, 1),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    api.withdraw(externalProjectId, app.id, 2),
  ).rejects.toMatchObject({ status: 409 });
  await api.withdraw(externalProjectId, app.id, 1);
  expect(
    (await api.applicationContext(externalProjectId)).application?.status,
  ).toBe("WITHDRAWN");
  await expect(
    api.apply(externalProjectId, context.project.vacancies[0].id, "Повтор"),
  ).rejects.toMatchObject({ status: 409 });
});
it("changing development neither approves moderation nor silently overwrites a concurrent version", async () => {
  const { api } = fixture();
  await expect(
    api.changeDevelopment(publicationIds.project, "COMPLETED", 9),
  ).rejects.toMatchObject({ status: 409 });
  const p = await api.changeDevelopment(publicationIds.project, "COMPLETED", 1);
  expect(p.moderation).toBe("RETURNED");
  expect(p.kind === "PROJECT" && p.developmentStatus).toBe("COMPLETED");
  await expect(api.applicationContext(p.id)).rejects.toMatchObject({
    status: 404,
  });
});
it("favorites and notices are user scoped, idempotent where appropriate and versioned for reads", async () => {
  const { api, pub, state } = fixture(),
    otherApi = createProjectManagementDemo(pub, other, state);
  await api.setFavorite(demoCaseId, true);
  await api.setFavorite(demoCaseId, true);
  expect(await api.favorites()).toHaveLength(1);
  expect(await otherApi.favorites()).toHaveLength(0);
  const n = (await api.notices())[0];
  await api.markRead(n.id, n.version);
  await expect(api.markRead(n.id, n.version)).rejects.toMatchObject({
    status: 409,
  });
  expect((await api.notices())[0].read).toBe(true);
  await api.setFavorite(demoCaseId, false);
  expect(await api.favorites()).toHaveLength(0);
});
it("blocked live gateway makes no invented requests and does not fall back to demo", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  await expect(blockedProjectManagementGateway.projects()).rejects.toThrow(
    /недоступен/,
  );
  await expect(
    blockedProjectManagementGateway.apply("x", "y", "z"),
  ).rejects.toThrow(/недоступен/);
  await expect(blockedProjectManagementGateway.favorites()).rejects.toThrow(
    /недоступен/,
  );
  expect(fetch).not.toHaveBeenCalled();
  fetch.mockRestore();
});
async function mount(
  api: ProjectManagementGateway,
  element: React.ReactNode,
  path = "/",
) {
  const student = createDemoGateway(),
    { user } = await student.session();
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: path.includes("/apply")
              ? "/projects/:projectId/apply"
              : path.includes("/team")
                ? "/projects/:projectId/team"
                : "/",
            element: (
              <StudentContext.Provider
                value={{
                  api: student,
                  user,
                  demo: true,
                  base: "/demo/student",
                }}
              >
                <ProjectManagementContext.Provider value={api}>
                  <PublicationContext.Provider value={createPublicationDemo()}>
                    {element}
                  </PublicationContext.Provider>
                </ProjectManagementContext.Provider>
              </StudentContext.Provider>
            ),
          },
        ],
        { initialEntries: [path] },
      )}
    />,
  );
}
it("preserves application input after network failure and saves only after an explicit retry", async () => {
  const { api } = fixture(),
    apply = api.apply;
  api.apply = vi
    .fn()
    .mockRejectedValueOnce(new ApiError("network"))
    .mockImplementation(apply);
  await mount(
    api,
    <ProjectApplicationPage />,
    `/projects/${externalProjectId}/apply`,
  );
  await screen.findByRole("heading", { name: "Студенческая инициатива 9" });
  const actor = userEvent.setup();
  await actor.selectOptions(
    screen.getByRole("combobox", { name: "Открытая роль" }),
    "00000000-0000-4000-8000-000000000308",
  );
  await actor.type(
    screen.getByLabelText("Сопроводительное письмо"),
    "Не потерять письмо",
  );
  await actor.click(
    screen.getByRole("button", { name: "Отправить заявку в проект" }),
  );
  await screen.findByText("Нет связи с сервером. Проверьте подключение.");
  expect(screen.getByLabelText("Сопроводительное письмо")).toHaveValue(
    "Не потерять письмо",
  );
  await actor.click(
    screen.getByRole("button", { name: "Отправить заявку в проект" }),
  );
  await screen.findByRole("heading", { name: "Ваша заявка" });
  expect(api.apply).toHaveBeenCalledTimes(2);
});
it("shows a 409 without repeating an author decision and refreshes before another choice", async () => {
  const { api } = fixture();
  api.decide = vi.fn().mockRejectedValue(new ApiError("conflict", 409));
  await mount(
    api,
    <ProjectTeamPage />,
    `/projects/${publicationIds.project}/team`,
  );
  const actor = userEvent.setup(),
    button = await screen.findByRole("button", {
      name: "Принять candidate_demo",
    });
  await actor.click(button);
  await screen.findByText(/Данные или права изменились/);
  expect(button).toBeDisabled();
  expect(api.decide).toHaveBeenCalledTimes(1);
  await actor.click(
    screen.getByRole("button", { name: "Обновить состав и заявки" }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Принять candidate_demo" }),
    ).not.toBeDisabled(),
  );
  expect(api.decide).toHaveBeenCalledTimes(1);
});
it("author dashboard filters the complete collection and separates moderation from development", async () => {
  const { api } = fixture();
  await mount(api, <AuthorProjectsPage />);
  await screen.findByText("Проектов: 10");
  const actor = userEvent.setup();
  await actor.selectOptions(
    screen.getByRole("combobox", { name: "Модерация" }),
    "DRAFT",
  );
  await screen.findByText("Проектов: 1");
  expect(
    screen.getByRole("heading", { name: "Непубличный проект автора" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("heading", { name: "Карта студенческих команд" }),
  ).not.toBeInTheDocument();
});
it("notifications show curator changes, preserve private case invitations and mark only an explicit item read", async () => {
  const { api } = fixture();
  await mount(api, <NotificationsPage />);
  await screen.findByRole("heading", {
    name: "Изменилось назначение куратора проекта",
  });
  await screen.findByText(/Ожидают решения:/);
  const actor = userEvent.setup();
  await actor.click(
    screen.getByRole("button", { name: "Отметить прочитанным" }),
  );
  await screen.findByText("Непрочитанных: 0");
  await actor.click(
    screen.getByRole("checkbox", { name: "Только непрочитанные" }),
  );
  await screen.findByText("Уведомлений пока нет.");
});
it("favorites removal and restoration work without creating a case application", async () => {
  const { api } = fixture();
  await mount(api, <FavoritesPage />);
  const actor = userEvent.setup();
  await actor.click(
    await screen.findByRole("button", { name: "Убрать из избранного" }),
  );
  await screen.findByText("Избранных кейсов пока нет.");
  await actor.click(
    screen.getByRole("button", { name: "Сохранить учебный кейс" }),
  );
  await screen.findByRole("heading", { name: "Учебный кейс для команд" });
});
