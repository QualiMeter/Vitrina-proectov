import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ApiError } from "../../api/client";
import { createDemoGateway } from "./demo";
import { executionIds } from "./executionDemo";
import { executionBlock } from "./executionRules";
import { liveExecutionGateway } from "./executionGateway";
import { StudentContext } from "./hooks";
import { WorkspacePage } from "./WorkspacePage";
import { readOwnHistory } from "./submissionHistory";
import { downloadProtectedFile } from "./protectedFiles";
import type { StudentGateway } from "./gateway";
async function fixture() {
  const api = createDemoGateway();
  const workspace = await api.workspace(executionIds.case);
  const app = await api.application(workspace.applicationId);
  const team = await api.team(app.teamId!);
  const user = (await api.session()).user;
  return {
    api,
    workspace,
    app,
    team,
    user,
    point: workspace.stages[0].checkpoints[0],
  };
}
async function mount(api: StudentGateway, userId?: string) {
  const user = (await api.session()).user;
  if (userId) user.id = userId;
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          {
            path: "/student/cases/:caseId/workspace",
            element: (
              <StudentContext.Provider
                value={{ api, user, demo: false, base: "/student" }}
              >
                <WorkspacePage />
              </StudentContext.Provider>
            ),
          },
          {
            path: "/student/cases/:caseId/apply",
            element: <p>Application destination</p>,
          },
        ],
        { initialEntries: [`/student/cases/${executionIds.case}/workspace`] },
      )}
    />,
  );
  await screen.findByRole("heading", {
    name: "Сервис для студенческих команд",
  });
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("checks participant, role, NDA, admission, intake and execution independently", async () => {
  const { workspace: w, app: a, team: t, user, point: p } = await fixture();
  expect(executionBlock(w, a, t, user.id, p)).toBeUndefined();
  expect(
    executionBlock(w, a, { ...t, captainUserId: "other" }, user.id, p),
  ).toMatch(/капитан/);
  for (const myParticipationStatus of [
    "ELIMINATED",
    "EXCLUDED",
    "WITHDRAWN",
  ] as const)
    expect(
      executionBlock({ ...w, myParticipationStatus }, a, t, user.id, p),
    ).toMatch(/завершено/);
  expect(
    executionBlock({ ...w, status: "REGISTRATION_CLOSED" }, a, t, user.id, p),
  ).toMatch(/выполнения/);
  expect(
    executionBlock(
      { ...w, ndaAcceptedForApplication: false },
      a,
      t,
      user.id,
      p,
    ),
  ).toMatch(/NDA/);
  expect(
    executionBlock(w, { ...a, status: "SUBMITTED" }, t, user.id, p),
  ).toMatch(/допущена/);
  expect(
    executionBlock(w, a, t, user.id, { ...p, intakeStatus: "CLOSED" }),
  ).toMatch(/вручную/);
  expect(executionBlock(w, a, t, user.id, { ...p, canSubmit: false })).toMatch(
    /Сервер/,
  );
  const solo = {
    ...a,
    format: "SOLO" as const,
    teamId: undefined,
    soloApplicantUserId: user.id,
  };
  expect(executionBlock(w, solo, undefined, user.id, p)).toBeUndefined();
  expect(
    executionBlock(
      w,
      { ...solo, soloApplicantUserId: "other" },
      undefined,
      user.id,
      p,
    ),
  ).toMatch(/автор/);
});
it("does not expose early stage fields or fetch their history before execution", async () => {
  const { api, workspace } = await fixture();
  api.workspace = async () => ({ ...workspace, status: "REGISTRATION_CLOSED" });
  const history = vi.spyOn(api, "submissionHistory");
  await mount(api);
  expect(await screen.findByText("Кейс ещё не запущен")).toBeVisible();
  expect(
    screen.queryByText("Разработка прототипа", { exact: true }),
  ).not.toBeInTheDocument();
  expect(history).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: /Скачать/ }),
  ).not.toBeInTheDocument();
});
it("shows an active case and immutable versions, submits a late result, preserves earlier versions", async () => {
  const { api } = await fixture();
  await mount(api);
  const actor = userEvent.setup();
  await actor.type(
    await screen.findByLabelText("Описание результата"),
    "Версия с новой архитектурой",
  );
  await actor.click(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  );
  await screen.findByText("Новая версия результата отправлена");
  expect(screen.getByText(/Версия 2 ·.*Просрочено/)).toBeVisible();
  expect(screen.getByText(/Версия 1 ·/)).toBeVisible();
  expect(screen.getByLabelText("Описание результата")).toHaveValue("");
  const history = await api.submissionHistory(executionIds.checkpoint);
  expect(history.latestVersion).toBe(2);
  expect(history.items[0].description).toBe("Первый прототип сервиса");
});
it("offers a network retry with the same idempotency key and no lost text", async () => {
  const { api } = await fixture(),
    submit = api.submitVersion;
  const spy = vi
    .fn()
    .mockRejectedValueOnce(new ApiError("network"))
    .mockImplementation(submit);
  api.submitVersion = spy;
  await mount(api);
  const actor = userEvent.setup();
  await actor.type(
    await screen.findByLabelText("Описание результата"),
    "Keep this draft",
  );
  await actor.click(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  );
  const retry = await screen.findByRole("button", {
    name: "Повторить отправку",
  });
  expect(screen.getByLabelText("Описание результата")).toHaveValue(
    "Keep this draft",
  );
  await actor.click(retry);
  await screen.findByText("Новая версия результата отправлена");
  expect(spy.mock.calls[1][2]).toBe(spy.mock.calls[0][2]);
  expect(spy.mock.calls[1][1]).toEqual(spy.mock.calls[0][1]);
});
it("resolves 409 only after comparing versions and explicitly preserving the local draft", async () => {
  const { api } = await fixture(),
    submit = api.submitVersion;
  api.submitVersion = vi
    .fn()
    .mockImplementationOnce(async () => {
      await submit(
        executionIds.checkpoint,
        {
          applicationId: executionIds.application,
          expectedLastVersion: 1,
          description: "Другой результат",
        },
        "other-request",
      );
      throw new ApiError("conflict", 409);
    })
    .mockImplementation(submit);
  await mount(api);
  const actor = userEvent.setup();
  await actor.type(
    await screen.findByLabelText("Описание результата"),
    "Мой результат",
  );
  await actor.click(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  );
  await actor.click(
    await screen.findByRole("button", { name: "Сравнить с актуальной сдачей" }),
  );
  await screen.findByText(/На сервере версия 2/);
  expect(api.submitVersion).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText("Описание результата")).toHaveValue(
    "Мой результат",
  );
  await actor.click(
    screen.getByRole("button", {
      name: "Сохранить мой текст для следующей версии",
    }),
  );
  expect(api.submitVersion).toHaveBeenCalledTimes(1);
  await actor.click(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  );
  await screen.findByText("Новая версия результата отправлена");
  expect(
    (await api.submissionHistory(executionIds.checkpoint)).latestVersion,
  ).toBe(3);
});
it("keeps text but removes further submission after 403", async () => {
  const { api } = await fixture();
  api.submitVersion = vi.fn().mockRejectedValue(new ApiError("forbidden", 403));
  await mount(api);
  const actor = userEvent.setup();
  await actor.type(
    await screen.findByLabelText("Описание результата"),
    "Сохранить текст",
  );
  await actor.click(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  );
  await screen.findByText(/Доступ изменился \(403\)/);
  expect(screen.getByLabelText("Описание результата")).toHaveValue(
    "Сохранить текст",
  );
  expect(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  ).toBeDisabled();
});
it("does not render submission controls for ordinary members or eliminated participants", async () => {
  const { api, team, workspace } = await fixture();
  api.team = async () => ({ ...team, captainUserId: "other" });
  api.workspace = async () => ({
    ...workspace,
    myParticipationStatus: "ELIMINATED",
  });
  await mount(api);
  await screen.findByText(/Версия 1 ·/);
  expect(
    screen.queryByLabelText("Описание результата"),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Отправить новую версию" }),
  ).not.toBeInTheDocument();
  expect(await screen.findByText("Прошёл")).toBeVisible();
});
it("does not accept history for a different application", async () => {
  const { api } = await fixture();
  const history = await api.submissionHistory(executionIds.checkpoint);
  api.submissionHistory = async () => ({
    ...history,
    items: history.items.map((v) => ({ ...v, applicationId: "foreign" })),
  });
  await expect(
    readOwnHistory(api, executionIds.checkpoint, executionIds.application),
  ).rejects.toThrow(/не соответствует/);
});
it("keeps typed result when route navigation is cancelled", async () => {
  const { api } = await fixture();
  await mount(api);
  const actor = userEvent.setup();
  await actor.type(
    await screen.findByLabelText("Описание результата"),
    "Do not lose",
  );
  await actor.click(screen.getByRole("link", { name: "Посмотреть заявку" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Неотправленные изменения результата",
  });
  await actor.click(within(dialog).getByRole("button", { name: "Остаться" }));
  expect(screen.getByLabelText("Описание результата")).toHaveValue(
    "Do not lose",
  );
});
it("posts a fresh CSRF and idempotency key with version, and uploads scoped multipart without JSON headers", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(async () => Response.json({ csrfToken: "csrf" }));
  vi.stubGlobal("fetch", fetch);
  await liveExecutionGateway.submitVersion(
    executionIds.checkpoint,
    { applicationId: executionIds.application, expectedLastVersion: 2 },
    "stable-key",
  );
  expect(fetch.mock.calls[1][1]).toMatchObject({
    headers: { "X-CSRF-Token": "csrf", "Idempotency-Key": "stable-key" },
    method: "POST",
    cache: "no-store",
  });
  expect(JSON.parse(fetch.mock.calls[1][1].body).expectedLastVersion).toBe(2);
  await liveExecutionGateway.uploadSubmissionFile(
    executionIds.case,
    executionIds.checkpoint,
    executionIds.application,
    new File(["pdf"], "result.pdf", { type: "application/pdf" }),
  );
  const upload = fetch.mock.calls[3][1];
  expect(upload.body).toBeInstanceOf(FormData);
  expect(upload.body.get("purpose")).toBe("SUBMISSION_ATTACHMENT");
  expect(upload.body.get("checkpointId")).toBe(executionIds.checkpoint);
  expect(upload.headers["Content-Type"]).toBeUndefined();
});
it("reauthorizes protected downloads and never creates a blob URL after 403", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
  vi.stubGlobal("fetch", fetch);
  await expect(
    downloadProtectedFile(executionIds.file, "requirements.pdf"),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetch.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
  });
});
it("enforces demo file settings, rejects foreign attachments and replays successful keys once", async () => {
  const { api } = await fixture();
  await expect(
    api.uploadSubmissionFile(
      executionIds.case,
      executionIds.checkpoint,
      executionIds.application,
      new File(["exe"], "a.exe", { type: "application/octet-stream" }),
    ),
  ).rejects.toThrow(/PDF/);
  await expect(
    api.submitVersion(
      executionIds.checkpoint,
      {
        applicationId: executionIds.application,
        expectedLastVersion: 1,
        fileIds: ["foreign"],
      },
      "wrong-file",
    ),
  ).rejects.toMatchObject({ status: 403 });
  const body = {
    applicationId: executionIds.application,
    expectedLastVersion: 1,
    description: "same",
  };
  const one = await api.submitVersion(
    executionIds.checkpoint,
    body,
    "same-key",
  );
  expect(
    await api.submitVersion(executionIds.checkpoint, body, "same-key"),
  ).toEqual(one);
  expect(
    (await api.submissionHistory(executionIds.checkpoint)).latestVersion,
  ).toBe(2);
});

it("blocks unscanned attachments until metadata is READY", async () => {
  const { api } = await fixture();
  const id = "00000000-0000-4000-8000-000000000090";
  api.uploadSubmissionFile = vi
    .fn()
    .mockResolvedValue({
      fileId: id,
      status: "SCANNING",
      createdAt: new Date().toISOString(),
      stagedUntil: "2099-01-01T00:00:00Z",
    });
  api.fileMetadata = vi
    .fn()
    .mockResolvedValue({
      id,
      status: "READY",
      displayName: "result.pdf",
      contentType: "application/pdf",
      sizeBytes: 3,
      purpose: "SUBMISSION_ATTACHMENT",
      createdAt: new Date().toISOString(),
    });
  const submit = vi
    .fn()
    .mockResolvedValue({
      id: "saved",
      checkpointId: executionIds.checkpoint,
      applicationId: executionIds.application,
      version: 2,
      submittedByUserId: "me",
      submittedAt: new Date().toISOString(),
      isLate: true,
      links: [],
      attachments: [],
    });
  api.submitVersion = submit;
  await mount(api);
  const actor = userEvent.setup();
  await screen.findByLabelText("Описание результата");
  await actor.upload(
    screen.getByLabelText("Выберите файл"),
    new File(["pdf"], "result.pdf", { type: "application/pdf" }),
  );
  expect(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  ).toBeDisabled();
  await actor.click(screen.getByRole("button", { name: "Загрузить файл" }));
  await screen.findByText(/Проверка файла: SCANNING/);
  expect(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  ).toBeDisabled();
  await actor.click(
    screen.getByRole("button", { name: "Проверить статус result.pdf" }),
  );
  await screen.findByText(/Готов к отправке/);
  await actor.click(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  );
  await screen.findByText("Новая версия результата отправлена");
  expect(submit.mock.calls[0][1].fileIds).toEqual([id]);
});
it("rechecks closed intake after 409 without losing the local draft", async () => {
  const { api, workspace } = await fixture();
  api.submitVersion = vi.fn().mockRejectedValue(new ApiError("conflict", 409));
  let reads = 0;
  api.workspace = async () => {
    reads++;
    return reads > 1
      ? {
          ...workspace,
          stages: workspace.stages.map((s) => ({
            ...s,
            checkpoints: s.checkpoints.map((p) => ({
              ...p,
              intakeStatus: "CLOSED" as const,
              canSubmit: false,
            })),
          })),
        }
      : workspace;
  };
  await mount(api);
  const actor = userEvent.setup();
  await actor.type(
    await screen.findByLabelText("Описание результата"),
    "Draft remains",
  );
  await actor.click(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  );
  await actor.click(
    await screen.findByRole("button", { name: "Сравнить с актуальной сдачей" }),
  );
  await screen.findByText(/Доступ или приём результатов изменились/);
  expect(screen.getByLabelText("Описание результата")).toHaveValue(
    "Draft remains",
  );
  expect(
    screen.getByRole("button", { name: "Отправить новую версию" }),
  ).toBeDisabled();
});
