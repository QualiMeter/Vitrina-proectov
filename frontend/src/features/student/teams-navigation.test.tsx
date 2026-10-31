import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { studentRoutes } from "./routes";
import { createDemoGateway } from "./demo";
import { liveStudentGateway } from "./gateway";
import { StudentContext } from "./hooks";
import { ParticipationsPage } from "./ParticipationsPage";
import { loadAllPages } from "./loadAllPages";
import { demoCaseId } from "./day2Demo";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const open = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(studentRoutes, { initialEntries: [path] })}
    />,
  );

it("filters the complete participation dataset, including drafts on later server pages", async () => {
  const actor = userEvent.setup(),
    api = createDemoGateway(),
    { user } = await api.session();
  const all = (await api.participations(1)).items;
  api.participations = vi.fn(async (page) => ({
    items: [all[page - 1]],
    page,
    pageSize: 1,
    total: 2,
  }));
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: "/student/participations",
            element: (
              <StudentContext.Provider
                value={{ api, user, demo: true, base: "/student" }}
              >
                <ParticipationsPage />
              </StudentContext.Provider>
            ),
          },
        ],
        { initialEntries: ["/student/participations"] },
      )}
    />,
  );
  await screen.findByRole("heading", {
    name: "Учебный кейс по веб-разработке",
  });
  await actor.click(screen.getByRole("button", { name: "Черновики" }));
  expect(
    screen.getByRole("heading", { name: "Учебный кейс по веб-разработке" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Сервис для студенческих команд" }),
  ).not.toBeInTheDocument();
  await actor.click(screen.getByRole("button", { name: "Активные" }));
  expect(
    screen.getByRole("heading", { name: "Сервис для студенческих команд" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Учебный кейс по веб-разработке" }),
  ).not.toBeInTheDocument();
  expect(api.participations).toHaveBeenCalledTimes(2);
  expect(api.participations).toHaveBeenLastCalledWith(2);
});
it("does not present a partial or unstable paginated list as globally filtered", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({
      items: [{ id: "one" }],
      page: 1,
      pageSize: 1,
      total: 2,
    })
    .mockResolvedValueOnce({
      items: [{ id: "two" }],
      page: 2,
      pageSize: 1,
      total: 3,
    });
  await expect(loadAllPages(read, (x: { id: string }) => x.id)).rejects.toThrow(
    /Список изменился/,
  );
});
it("keeps pending teams out of My teams, then exposes accepted membership independently of inbox history", async () => {
  const actor = userEvent.setup();
  open("/demo/student/teams");
  await screen.findByRole("heading", { name: "Демо-команда активного кейса" });
  const nav = screen.getByRole("navigation", { name: "Кабинет студента" });
  expect(
    within(nav).queryByRole("link", { name: "Черновики" }),
  ).not.toBeInTheDocument();
  expect(
    within(nav).queryByRole("link", { name: "Приглашения" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Команда по приглашению" }),
  ).not.toBeInTheDocument();
  await actor.click(screen.getByRole("link", { name: "Приглашения" }));
  await screen.findByRole("button", { name: "Принять" });
  expect(
    screen.queryByRole("link", { name: "Открыть команду" }),
  ).not.toBeInTheDocument();
  await actor.click(screen.getByRole("button", { name: "Принять" }));
  await screen.findByRole("link", { name: "Открыть команду" });
  await actor.click(screen.getByRole("link", { name: "Мои команды" }));
  const card = (
    await screen.findByRole("heading", { name: "Команда по приглашению" })
  ).closest("article")!;
  expect(
    within(card).getByText("Участник", { exact: true }),
  ).toBeInTheDocument();
  expect(within(card).getByText("Демо Капитан · капитан")).toBeInTheDocument();
  expect(
    within(card).getByRole("link", { name: "Открыть команду" }),
  ).toBeInTheDocument();
});
it("lists a newly created captain team even before any application exists", async () => {
  const actor = userEvent.setup();
  open(`/demo/student/cases/${demoCaseId}/apply`);
  await actor.click(await screen.findByRole("radio", { name: "Командой" }));
  await actor.type(
    screen.getByLabelText("Название команды"),
    "Новая капитанская команда",
  );
  await actor.click(screen.getByRole("button", { name: "Создать команду" }));
  await screen.findByText("Команда создана");
  await actor.click(screen.getByRole("link", { name: "Команды" }));
  const card = (
    await screen.findByRole("heading", { name: "Новая капитанская команда" })
  ).closest("article")!;
  expect(
    within(card).getByText("Капитан", { exact: true }),
  ).toBeInTheDocument();
  expect(within(card).getByText("Заявка не создана")).toBeInTheDocument();
});
it("allows confirmed members to view but never edit, submit or withdraw the team application", async () => {
  const actor = userEvent.setup();
  open("/demo/student/teams/invitations");
  await actor.click(await screen.findByRole("button", { name: "Принять" }));
  await actor.click(
    await screen.findByRole("link", { name: "Открыть команду" }),
  );
  await actor.click(
    await screen.findByRole("link", { name: "Посмотреть заявку" }),
  );
  expect(
    await screen.findByText("Общая заявка команды по приглашению."),
  ).toBeInTheDocument();
  expect(screen.getByText(/Только просмотр/)).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Отправить заявку" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Отозвать заявку" }),
  ).not.toBeInTheDocument();
});
it("rejects private team/application access before acceptance and member mutations after acceptance", async () => {
  const api = createDemoGateway();
  await expect(api.team(uid(33))).rejects.toMatchObject({ status: 403 });
  await expect(api.application(uid(23))).rejects.toMatchObject({ status: 403 });
  await api.decideInvitation(uid(40), "accept");
  expect((await api.myTeams(1)).items.some((x) => x.teamId === uid(33))).toBe(
    true,
  );
  expect((await api.application(uid(23))).coverLetter).toBeTruthy();
  await expect(
    api.saveApplication(uid(23), {
      expectedVersion: 1,
      coverLetter: "Нет права",
    }),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    api.withdrawApplication(uid(23), { expectedVersion: 1 }),
  ).rejects.toMatchObject({ status: 403 });
});
it("uses the authenticated global my-teams read endpoint", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json({ items: [], page: 2, pageSize: 20, total: 0 }),
    );
  vi.stubGlobal("fetch", fetch);
  try {
    await liveStudentGateway.myTeams(2);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/me/teams?page=2&pageSize=20");
    expect(fetch.mock.calls[0][1].credentials).toBe("same-origin");
  } finally {
    vi.unstubAllGlobals();
  }
});
