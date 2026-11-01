import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ApiError } from "../../api/client";
import { createDemoGateway } from "./demo";
import { StudentContext } from "./hooks";
import { ProfilePage } from "./ProfilePage";
import { StudentRoot } from "./StudentRoot";
import { readPendingInvitations, readCaseDeadlines } from "./dashboardSignals";
import { liveStudentGateway, type StudentGateway } from "./gateway";
import { DashboardPage } from "./DashboardPage";
import {
  conflictingProfileFields,
  profilePatch,
  resolveProfileConflict,
} from "./profileConflict";
import type * as C from "./contracts";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
async function mount(api: StudentGateway, element = <ProfilePage />) {
  const user = (await api.session()).user;
  render(
    <RouterProvider
      router={createMemoryRouter([
        {
          path: "/",
          element: (
            <StudentContext.Provider
              value={{ api, user, demo: false, base: "/student" }}
            >
              {element}
            </StudentContext.Provider>
          ),
        },
      ])}
    />,
  );
}
it("finds pending invitations beyond 25 historical decisions with a server filter and filtered total", async () => {
  const history = Array.from({ length: 25 }, (_, i) => ({
    id: `history-${i}`,
    status: "ACCEPTED",
  }));
  const pending = {
    id: "pending",
    teamName: "Team",
    caseTitle: "Case",
    status: "PENDING",
    expiresAt: "2099-01-01T00:00:00Z",
  };
  const fetch = vi.fn(async (path: string) => {
    const filtered =
      new URL(path, "https://example.invalid").searchParams.get("status") ===
      "PENDING";
    return Response.json({
      items: filtered ? [pending] : history.slice(0, 20),
      total: filtered ? 1 : 26,
      page: 1,
      pageSize: 20,
    });
  });
  vi.stubGlobal("fetch", fetch);
  expect(await readPendingInvitations()).toEqual({
    items: [
      { id: "pending", title: "Team · Case", expiresAt: pending.expiresAt },
    ],
    total: 1,
  });
  expect(fetch.mock.calls[0][0]).toContain("status=PENDING");
});
it("excludes expired and decided invitations defensively", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        items: [
          { id: "expired", status: "PENDING", expiresAt: "2000-01-01" },
          { id: "accepted", status: "ACCEPTED", expiresAt: "2099-01-01" },
        ],
        total: 0,
        page: 1,
        pageSize: 20,
      }),
    ),
  );
  expect((await readPendingInvitations()).items).toEqual([]);
});
it("bounds and deduplicates deadline requests while preserving partial results", async () => {
  const fetch = vi.fn(async (path: string) =>
    path.endsWith("/bad")
      ? new Response(null, { status: 503 })
      : Response.json({
          id: path.split("/").pop(),
          title: "Case",
          status: "REGISTRATION_OPEN",
          registrationDeadline: "2099-01-01T00:00:00Z",
        }),
  );
  vi.stubGlobal("fetch", fetch);
  const data = await readCaseDeadlines([
    "one",
    "one",
    "bad",
    "two",
    "three",
    "four",
    "five",
    "ignored",
  ]);
  expect(fetch).toHaveBeenCalledTimes(6);
  expect(data.unavailable).toBe(1);
  expect(data.items.map((x) => x.id)).toEqual([
    "one",
    "two",
    "three",
    "four",
    "five",
  ]);
});
it("keeps invitations visible when deadline requests fail", async () => {
  const api = createDemoGateway();
  api.dashboardInvitations = async () => ({
    items: [
      {
        id: "i",
        title: "Invitation remains visible",
        expiresAt: "2099-01-01T00:00:00Z",
      },
    ],
    total: 1,
  });
  api.dashboardDeadlines = async () => {
    throw new ApiError("server", 503);
  };
  await mount(api, <DashboardPage />);
  expect(await screen.findByText("Invitation remains visible")).toBeVisible();
  expect(await screen.findByText("Сервер временно недоступен.")).toBeVisible();
});
it("requires overlap choices and preserves server-only fields with atomic arrays", async () => {
  const base = await createDemoGateway().profile();
  const draft = { ...base, nickname: "mine", skillIds: ["local"] };
  const server = {
    ...base,
    version: 2,
    nickname: "server",
    studyGroup: "SERVER-202",
    skillIds: ["server"],
  };
  expect(conflictingProfileFields(base, draft, server)).toEqual([
    "nickname",
    "skillIds",
  ]);
  expect(() => resolveProfileConflict(base, draft, server, {})).toThrow();
  const merged = resolveProfileConflict(base, draft, server, {
    nickname: "mine",
    skillIds: "server",
  });
  expect(merged).toMatchObject({
    nickname: "mine",
    studyGroup: "SERVER-202",
    skillIds: ["server"],
  });
  expect(profilePatch(server, merged)).toEqual({
    expectedVersion: 2,
    nickname: "mine",
  });
  expect(profilePatch(base, { ...base, instituteId: null })).toEqual({
    expectedVersion: 1,
    instituteId: null,
  });
});
it("recovers from 409 without losing input or silently retrying a stale version", async () => {
  const api = createDemoGateway();
  const initial = await api.profile();
  const server = {
    ...initial,
    version: 2,
    nickname: "server_nickname",
    studyGroup: "SERVER-202",
  };
  api.profile = vi
    .fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValue(server);
  const update = vi
    .fn()
    .mockRejectedValueOnce(new ApiError("conflict", 409))
    .mockImplementation(async (body: C.StudentProfileUpdateRequest) => ({
      ...server,
      ...body,
      version: 3,
    }));
  api.updateProfile = update;
  await mount(api);
  const actor = userEvent.setup();
  const nickname = await screen.findByLabelText("Никнейм");
  await actor.clear(nickname);
  await actor.type(nickname, "my_nickname");
  await actor.click(screen.getByRole("button", { name: "Сохранить профиль" }));
  await screen.findByRole("heading", { name: "Профиль изменён на сервере" });
  expect(nickname).toHaveValue("my_nickname");
  expect(
    screen.getByRole("button", { name: "Сохранить профиль" }),
  ).toBeDisabled();
  await actor.click(
    screen.getByRole("button", { name: "Сравнить с серверной версией" }),
  );
  await screen.findByText("server_nickname");
  expect(update).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Применить выбор к форме" }),
  ).toBeDisabled();
  await actor.click(
    screen.getByRole("radio", { name: /Оставить моё значение/ }),
  );
  await actor.click(
    screen.getByRole("button", { name: "Применить выбор к форме" }),
  );
  expect(screen.getByLabelText("Никнейм")).toHaveValue("my_nickname");
  expect(screen.getByLabelText("Группа")).toHaveValue("SERVER-202");
  expect(update).toHaveBeenCalledTimes(1);
  await actor.click(screen.getByRole("button", { name: "Сохранить профиль" }));
  await screen.findByText("Профиль сохранён");
  expect(update).toHaveBeenLastCalledWith({
    expectedVersion: 2,
    nickname: "my_nickname",
  });
});
it("accepts the server value and keeps input on another conflict", async () => {
  const api = createDemoGateway();
  const initial = await api.profile();
  api.profile = vi
    .fn()
    .mockResolvedValueOnce(initial)
    .mockResolvedValue({ ...initial, version: 2, nickname: "server_value" });
  api.updateProfile = vi.fn().mockRejectedValue(new ApiError("conflict", 409));
  await mount(api);
  const actor = userEvent.setup();
  const nickname = await screen.findByLabelText("Никнейм");
  await actor.clear(nickname);
  await actor.type(nickname, "mine");
  await actor.click(screen.getByRole("button", { name: "Сохранить профиль" }));
  await actor.click(
    await screen.findByRole("button", { name: "Сравнить с серверной версией" }),
  );
  await actor.click(
    await screen.findByRole("radio", { name: /Принять серверное значение/ }),
  );
  await actor.click(
    screen.getByRole("button", { name: "Применить выбор к форме" }),
  );
  expect(screen.getByLabelText("Никнейм")).toHaveValue("server_value");
  expect(
    screen.getByRole("button", { name: "Сохранить профиль" }),
  ).toBeDisabled();
  await actor.clear(screen.getByLabelText("Никнейм"));
  await actor.type(screen.getByLabelText("Никнейм"), "mine_again");
  await actor.click(screen.getByRole("button", { name: "Сохранить профиль" }));
  expect(
    await screen.findByRole("heading", { name: "Профиль изменён на сервере" }),
  ).toBeVisible();
  expect(screen.getByLabelText("Никнейм")).toHaveValue("mine_again");
  expect(api.updateProfile).toHaveBeenLastCalledWith({
    expectedVersion: 2,
    nickname: "mine_again",
  });
});
it("keeps the session across navigation and same-user focus but clears on expiry", async () => {
  const api = createDemoGateway();
  const session = vi
    .spyOn(liveStudentGateway, "session")
    .mockImplementation(api.session);
  vi.spyOn(liveStudentGateway, "profile").mockImplementation(api.profile);
  vi.spyOn(liveStudentGateway, "reference").mockImplementation(api.reference);
  const router = createMemoryRouter(
    [
      {
        path: "/student",
        element: <StudentRoot />,
        children: [
          { path: "profile", element: <ProfilePage /> },
          { path: "other", element: <p>Other page</p> },
        ],
      },
    ],
    { initialEntries: ["/student/other"] },
  );
  render(<RouterProvider router={router} />);
  await screen.findByText("Other page");
  await act(() => router.navigate("/student/profile"));
  const nickname = await screen.findByLabelText("Никнейм");
  expect(session).toHaveBeenCalledTimes(1);
  const actor = userEvent.setup();
  await actor.clear(nickname);
  await actor.type(nickname, "unsaved_on_focus");
  await act(async () => window.dispatchEvent(new Event("focus")));
  expect(session).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("Никнейм")).toBe(nickname);
  expect(nickname).toHaveValue("unsaved_on_focus");
  session.mockRejectedValue(new ApiError("unauthorized", 401));
  await act(async () =>
    window.dispatchEvent(new Event("vitrina:session-expired")),
  );
  await screen.findByText("Сессия завершилась. Войдите снова.");
  expect(screen.queryByLabelText("Никнейм")).not.toBeInTheDocument();
});
it("remounts private views when the account changes and revokes lost access", async () => {
  const api = createDemoGateway();
  const current = await api.session();
  const session = vi
    .spyOn(liveStudentGateway, "session")
    .mockResolvedValue(current);
  const read = vi
    .spyOn(liveStudentGateway, "profile")
    .mockImplementation(api.profile);
  vi.spyOn(liveStudentGateway, "reference").mockImplementation(api.reference);
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: "/student",
            element: <StudentRoot />,
            children: [{ path: "profile", element: <ProfilePage /> }],
          },
        ],
        { initialEntries: ["/student/profile"] },
      )}
    />,
  );
  const old = await screen.findByLabelText("Никнейм");
  session.mockResolvedValue({
    ...current,
    user: { ...current.user, id: "another-user" },
  });
  await act(async () => window.dispatchEvent(new Event("focus")));
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  expect(await screen.findByLabelText("Никнейм")).not.toBe(old);
  session.mockResolvedValue({
    ...current,
    user: { ...current.user, availableAreas: ["company"] },
  });
  await act(async () => window.dispatchEvent(new Event("focus")));
  await screen.findByText("Кабинет студента недоступен");
  expect(screen.queryByLabelText("Никнейм")).not.toBeInTheDocument();
});
