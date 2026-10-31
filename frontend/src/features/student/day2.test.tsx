import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router-dom";
import { studentRoutes } from "./routes";
import { createDemoGateway } from "./demo";
import { demoCaseId } from "./day2Demo";
import { liveStudentGateway, type StudentGateway } from "./gateway";
import { ApplicationPage } from "./ApplicationPage";
import { ParticipationsPage } from "./ParticipationsPage";
import { InvitationsPage } from "./InvitationsPage";
import { StudentContext } from "./hooks";
import { ApiError } from "../../api/client";
import { appendPortfolioLink, submissionBlocks } from "./applicationRules";

afterEach(() => vi.unstubAllGlobals());
function open(path: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(studentRoutes, { initialEntries: [path] })}
    />,
  );
}
async function withApi(path: string, api: StudentGateway) {
  const { user } = await api.session();
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: "/student",
            element: (
              <StudentContext.Provider
                value={{ api, user, demo: true, base: "/student" }}
              >
                <Outlet />
              </StudentContext.Provider>
            ),
            children: [
              { path: "cases/:caseId/apply", element: <ApplicationPage /> },
              { path: "participations", element: <ParticipationsPage /> },
              { path: "invitations", element: <InvitationsPage /> },
            ],
          },
        ],
        { initialEntries: [path] },
      )}
    />,
  );
}

it("autosaves a portfolio link in the supported letter field, requires NDA and keeps withdrawal terminal", async () => {
  vi.stubGlobal("confirm", () => true);
  const actor = userEvent.setup();
  open(`/demo/student/cases/${demoCaseId}/apply`);
  await actor.click(
    await screen.findByRole("button", { name: "Создать черновик заявки" }),
  );
  await actor.type(
    await screen.findByLabelText(/Сопроводительное письмо/),
    "Хочу участвовать.",
  );
  await actor.type(
    screen.getByLabelText("Ссылка на портфолио"),
    "https://example.com/portfolio",
  );
  await actor.click(
    screen.getByRole("button", { name: "Добавить ссылку в письмо" }),
  );
  await waitFor(
    () =>
      expect(
        screen.getByText("Черновик сохранён на сервере"),
      ).toBeInTheDocument(),
    { timeout: 3000 },
  );
  expect(screen.getByLabelText(/Сопроводительное письмо/)).toHaveValue(
    "Хочу участвовать.\nПортфолио: https://example.com/portfolio",
  );
  expect(
    screen.getByRole("button", { name: "Отправить заявку" }),
  ).toBeDisabled();
  await actor.click(screen.getByRole("checkbox", { name: /Подтверждаю NDA/ }));
  await actor.click(screen.getByRole("button", { name: "Отправить заявку" }));
  await actor.click(
    await screen.findByRole("button", { name: "Отозвать заявку" }),
  );
  expect(
    await screen.findByText(/Повторная подача в этот кейс запрещена/),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Создать черновик заявки" }),
  ).not.toBeInTheDocument();
});

it("allows a draft before team confirmation but blocks final submit until pending invitations are removed", async () => {
  const actor = userEvent.setup();
  open(`/demo/student/cases/${demoCaseId}/apply`);
  await actor.click(await screen.findByRole("radio", { name: "Командой" }));
  await actor.type(screen.getByLabelText("Название команды"), "Новая команда");
  await actor.click(screen.getByRole("button", { name: "Создать команду" }));
  await actor.click(
    await screen.findByRole("link", {
      name: "Управлять составом и приглашениями",
    }),
  );
  await actor.type(await screen.findByLabelText("Найти студента"), "Демо");
  await actor.click(screen.getByRole("button", { name: "Найти" }));
  await actor.click(await screen.findByRole("button", { name: "Пригласить" }));
  expect(
    await screen.findByRole("button", { name: "Отозвать приглашение" }),
  ).toBeInTheDocument();
  await actor.click(screen.getByRole("link", { name: "Открыть заявку" }));
  await actor.click(
    await screen.findByRole("button", { name: "Создать черновик заявки" }),
  );
  await actor.type(
    await screen.findByLabelText(/Сопроводительное письмо/),
    "Команда готовит решение.",
  );
  await waitFor(
    () =>
      expect(
        screen.getByText("Черновик сохранён на сервере"),
      ).toBeInTheDocument(),
    { timeout: 3000 },
  );
  await actor.click(screen.getByRole("checkbox", { name: /Подтверждаю NDA/ }));
  expect(
    screen.getByRole("button", { name: "Отправить заявку" }),
  ).toBeDisabled();
  expect(screen.getByText(/Дождитесь подтверждения/)).toBeInTheDocument();
});

it("accepts only the current student invitation, retains history and gives the member no captain actions", async () => {
  const actor = userEvent.setup();
  open("/demo/student/invitations");
  await actor.click(await screen.findByRole("button", { name: "Принять" }));
  await actor.click(
    await screen.findByRole("link", { name: "Открыть команду" }),
  );
  expect(
    await screen.findByRole("cell", { name: "Участник" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Пригласить" }),
  ).not.toBeInTheDocument();
});

it("uses the server page, size and total rather than a local array size", async () => {
  const actor = userEvent.setup();
  const api = createDemoGateway();
  const sample = (await api.invitations(1)).items[0];
  api.invitations = vi.fn(async (page) => ({
    page,
    pageSize: 1,
    total: 2,
    items: [
      {
        ...sample,
        caseTitle: `Страница ${page} кейса`,
        status: "DECLINED" as const,
      },
    ],
  }));
  await withApi("/student/invitations", api);
  expect(await screen.findByText(/Страница 1 кейса/)).toBeInTheDocument();
  await actor.click(screen.getByRole("button", { name: "Далее" }));
  expect(await screen.findByText(/Страница 2 кейса/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Далее" })).toBeDisabled();
  expect(api.invitations).toHaveBeenLastCalledWith(2);
});

it("waits for in-flight autosave before navigating, then restores the actual saved draft", async () => {
  const actor = userEvent.setup();
  const api = createDemoGateway();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const save = api.saveApplication;
  api.saveApplication = vi.fn(async (id, body) => {
    await gate;
    return save(id, body);
  });
  await withApi(`/student/cases/${demoCaseId}/apply`, api);
  await actor.click(
    await screen.findByRole("button", { name: "Создать черновик заявки" }),
  );
  await actor.type(
    await screen.findByLabelText(/Сопроводительное письмо/),
    "Текст не должен потеряться",
  );
  await waitFor(() => expect(api.saveApplication).toHaveBeenCalled(), {
    timeout: 3000,
  });
  await actor.click(screen.getByRole("link", { name: /Мои участия/ }));
  expect(
    await screen.findByRole("alertdialog", { name: "Несохранённый черновик" }),
  ).toBeInTheDocument();
  release();
  expect(
    await screen.findByRole("heading", { name: "Мои участия" }),
  ).toBeInTheDocument();
  const card = (
    await screen.findByRole("heading", { name: "Открытый учебный кейс" })
  ).closest("article")!;
  await actor.click(
    within(card).getByRole("link", { name: "Продолжить заявку" }),
  );
  expect(await screen.findByLabelText(/Сопроводительное письмо/)).toHaveValue(
    "Текст не должен потеряться",
  );
});

it("preserves the edited text on a version conflict and never silently retries", async () => {
  const actor = userEvent.setup();
  const api = createDemoGateway();
  api.saveApplication = vi.fn(async () => {
    throw new ApiError("conflict", 409);
  });
  await withApi(`/student/cases/${demoCaseId}/apply`, api);
  await actor.click(
    await screen.findByRole("button", { name: "Создать черновик заявки" }),
  );
  await actor.type(
    await screen.findByLabelText(/Сопроводительное письмо/),
    "Мой несохранённый текст",
  );
  expect(
    await screen.findByText(/Состояние изменилось/, {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText(/Сопроводительное письмо/)).toHaveValue(
    "Мой несохранённый текст",
  );
  expect(api.saveApplication).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Отправить заявку" }),
  ).toBeDisabled();
});

it("checks deadline, FINAL_CLOSED, course and pending invitations before submit", async () => {
  const api = createDemoGateway(),
    details = await api.caseDetails(demoCaseId),
    profile = await api.profile();
  expect(
    submissionBlocks({ ...details, status: "FINAL_CLOSED" }, profile),
  ).toContain("Набор в кейс закрыт.");
  expect(
    submissionBlocks(
      { ...details, registrationDeadline: "2000-01-01T00:00:00Z" },
      profile,
    ),
  ).toContain("Срок подачи заявки истёк.");
  expect(submissionBlocks({ ...details, minCourse: 3 }, profile)).toContain(
    "Ваш курс не соответствует условиям кейса.",
  );
});

it("does not let an invitation recipient act for another person", async () => {
  const api = createDemoGateway();
  const team = await api.createTeam(demoCaseId, "Команда");
  const invite = await api.invite(
    team.id,
    "00000000-0000-4000-8000-000000000006",
  );
  await expect(api.decideInvitation(invite.id, "accept")).rejects.toMatchObject(
    { status: 403 },
  );
});

it("keeps idempotency keys stable for explicit retries and sends CSRF without adding unsupported fields", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ csrfToken: "csrf" }))
    .mockResolvedValueOnce(Response.json({ status: "SUBMITTED" }))
    .mockResolvedValueOnce(Response.json({ csrfToken: "new-csrf" }))
    .mockResolvedValueOnce(Response.json({ status: "SUBMITTED" }));
  vi.stubGlobal("fetch", fetch);
  const key = crypto.randomUUID(),
    body = {
      expectedVersion: 1,
      ndaAcceptance: { accepted: true as const, version: "v1" },
    };
  await liveStudentGateway.submitApplication("application", body, key);
  await liveStudentGateway.submitApplication("application", body, key);
  expect(fetch.mock.calls[1][1].headers["Idempotency-Key"]).toBe(key);
  expect(fetch.mock.calls[3][1].headers["Idempotency-Key"]).toBe(key);
  expect(fetch.mock.calls[3][1].headers["X-CSRF-Token"]).toBe("new-csrf");
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(body);
});

it("rejects repeat submission after withdrawal and locks a submitted team composition", async () => {
  const api = createDemoGateway();
  const team = await api.createTeam(demoCaseId, "Команда");
  const a = await api.createApplication(demoCaseId, {
    format: "TEAM",
    teamId: team.id,
  });
  const saved = await api.saveApplication(a.id, {
    expectedVersion: a.version,
    coverLetter: "Готовы участвовать",
  });
  const key = crypto.randomUUID();
  const body = {
    expectedVersion: saved.version,
    ndaAcceptance: { accepted: true as const, version: "demo-1" },
  };
  const submitted = await api.submitApplication(a.id, body, key);
  const retried = await api.submitApplication(a.id, body, key);
  expect(retried.version).toBe(submitted.version);
  expect((await api.team(team.id)).membershipLocked).toBe(true);
  await expect(api.invite(team.id, crypto.randomUUID())).rejects.toMatchObject({
    status: 409,
  });
  await api.withdrawApplication(a.id, { expectedVersion: submitted.version });
  await expect(
    api.createApplication(demoCaseId, { format: "SOLO" }),
  ).rejects.toMatchObject({ status: 409 });
});

it("uses UUIDs in typed fixtures and allows only safe links within the letter size", async () => {
  const api = createDemoGateway();
  const samples = [
    await api.profile(),
    await api.caseDetails(demoCaseId),
    await api.invitations(1),
    await api.participations(1),
  ];
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function inspect(value: unknown, key = "") {
    if (Array.isArray(value)) {
      for (const v of value) inspect(v, key.endsWith("Ids") ? "id" : "");
    } else if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) inspect(v, k);
    } else if (
      typeof value === "string" &&
      (key === "id" || key.endsWith("Id"))
    )
      expect(value).toMatch(uuid);
  }
  samples.forEach((value) => inspect(value));
  expect(() => appendPortfolioLink("текст", "javascript:alert(1)")).toThrow();
  expect(() =>
    appendPortfolioLink("a".repeat(4999), "https://example.com"),
  ).toThrow();
});
