import { expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { Pager } from "./shared";
import { studentRoutes } from "./routes";
import { readDashboardSignals } from "./dashboardSignals";
const open = (path: string) =>
  render(
    <RouterProvider
      router={createMemoryRouter(studentRoutes, { initialEntries: [path] })}
    />,
  );
it("hides single-page pagination and separates page count from record count", async () => {
  const change = vi.fn();
  const { rerender } = render(
    <Pager page={1} pageSize={20} total={2} onPage={change} />,
  );
  expect(
    screen.queryByRole("navigation", { name: "Страницы списка" }),
  ).not.toBeInTheDocument();
  rerender(<Pager page={2} pageSize={3} total={8} onPage={change} />);
  expect(screen.getByText("Страница 2 из 3")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Далее" }));
  expect(change).toHaveBeenCalledWith(3);
});
it("shows an activity dashboard instead of duplicate menu cards", async () => {
  open("/demo/student");
  expect(
    await screen.findByRole("heading", { name: "Активные кейсы" }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("heading", { name: "Ожидающие приглашения" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Ближайшие сроки подачи" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "Портфолио" }),
  ).not.toBeInTheDocument();
});
it("keeps profile edits when staying and requires explicit discard before leaving", async () => {
  const actor = userEvent.setup();
  open("/demo/student/profile");
  const nickname = await screen.findByLabelText("Никнейм");
  await actor.clear(nickname);
  await actor.type(nickname, "unsaved_nickname");
  await actor.click(screen.getByRole("link", { name: "Мои участия" }));
  let dialog = await screen.findByRole("dialog", {
    name: "Несохранённые изменения профиля",
  });
  expect(
    within(dialog).getByRole("button", { name: "Остаться" }),
  ).toHaveFocus();
  await actor.click(within(dialog).getByRole("button", { name: "Остаться" }));
  expect(screen.getByLabelText("Никнейм")).toHaveValue("unsaved_nickname");
  await actor.click(screen.getByRole("link", { name: "Мои участия" }));
  dialog = await screen.findByRole("dialog");
  await actor.click(
    within(dialog).getByRole("button", { name: "Уйти без сохранения" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Мои участия" }),
  ).toBeInTheDocument();
});
it("allows leaving after saving and closes the menu with Escape", async () => {
  const actor = userEvent.setup();
  open("/demo/student/profile");
  const nickname = await screen.findByLabelText("Никнейм");
  await actor.clear(nickname);
  await actor.type(nickname, "saved_nickname");
  await actor.click(screen.getByRole("button", { name: "Сохранить профиль" }));
  await screen.findByText("Профиль сохранён");
  await actor.click(screen.getByRole("link", { name: "Мои участия" }));
  expect(
    await screen.findByRole("heading", { name: "Мои участия" }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  const menu = screen.getByRole("button", { name: "Разделы" });
  await actor.click(menu);
  await actor.keyboard("{Escape}");
  expect(menu).toHaveAttribute("aria-expanded", "false");
  expect(menu).toHaveFocus();
});
it("filters expired and decided invitations from dashboard signals", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        items: [
          {
            id: "pending",
            teamName: "Команда",
            caseTitle: "Кейс",
            status: "PENDING",
            expiresAt: "2099-01-01T00:00:00Z",
          },
          {
            id: "expired",
            status: "PENDING",
            expiresAt: "2000-01-01T00:00:00Z",
          },
          {
            id: "accepted",
            status: "ACCEPTED",
            expiresAt: "2099-01-01T00:00:00Z",
          },
        ],
        page: 1,
        pageSize: 20,
        total: 21,
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        id: "case",
        title: "Кейс",
        status: "REGISTRATION_OPEN",
        registrationDeadline: "2099-01-01T00:00:00Z",
      }),
    );
  vi.stubGlobal("fetch", fetch);
  try {
    const data = await readDashboardSignals(["case"]);
    expect(data.pending.map((x) => x.id)).toEqual(["pending"]);
    expect(data.pendingPageOnly).toBe(true);
    expect(data.deadlines.map((x) => x.id)).toEqual(["case"]);
  } finally {
    vi.unstubAllGlobals();
  }
});
