import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { ApiError } from "../../api/client";
import { createDemoGateway } from "./demo";
import { demoCaseId } from "./day2Demo";
import { StudentContext } from "./hooks";
import { ApplicationEditor } from "./ApplicationEditor";
import type { StudentGateway } from "./gateway";
import type { CaseApplication } from "./contracts";
async function fixture() {
  const api = createDemoGateway(),
    app = await api.createApplication(demoCaseId, { format: "SOLO" });
  return { api, app };
}
async function mount(api: StudentGateway, app: CaseApplication) {
  const [details, profile, nda, { user }] = await Promise.all([
    api.caseDetails(app.caseId),
    api.profile(),
    api.nda(app.caseId),
    api.session(),
  ]);
  render(
    <RouterProvider
      router={createMemoryRouter([
        {
          path: "/",
          element: (
            <StudentContext.Provider
              value={{ api, user, demo: true, base: "/student" }}
            >
              <ApplicationEditor
                initial={app}
                details={details}
                profile={profile}
                nda={nda}
              />
            </StudentContext.Provider>
          ),
        },
      ])}
    />,
  );
}
for (const error of [new ApiError("network"), new ApiError("server", 500)])
  it(`retries ${error.kind} without replacing the letter and resumes autosave`, async () => {
    const { api, app } = await fixture(),
      original = api.saveApplication;
    const save = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockImplementation(original);
    api.saveApplication = save;
    await mount(api, app);
    const actor = userEvent.setup();
    const input = screen.getByLabelText(/Сопроводительное письмо/);
    await actor.type(input, "Не потерять мой текст");
    await actor.click(
      await screen.findByRole(
        "button",
        { name: "Повторить сохранение" },
        { timeout: 3000 },
      ),
    );
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText("Черновик сохранён на сервере")).toBeVisible(),
    );
    expect(input).toHaveValue("Не потерять мой текст");
    expect(save.mock.calls[0][1]).toEqual(save.mock.calls[1][1]);
    await actor.type(input, " плюс");
    await waitFor(() => expect(save).toHaveBeenCalledTimes(3), {
      timeout: 3000,
    });
    expect(save.mock.calls[2][1]).toEqual({
      expectedVersion: 2,
      coverLetter: "Не потерять мой текст плюс",
    });
  });
it("resolves 409 explicitly and saves subsequent edits with the next version", async () => {
  const { api, app } = await fixture(),
    original = api.saveApplication;
  const save = vi
    .fn()
    .mockImplementationOnce(async () => {
      await original(app.id, {
        expectedVersion: 1,
        coverLetter: "Текст с сервера",
      });
      throw new ApiError("conflict", 409);
    })
    .mockImplementation(original);
  api.saveApplication = save;
  await mount(api, app);
  const actor = userEvent.setup();
  await actor.type(
    screen.getByLabelText(/Сопроводительное письмо/),
    "Моя версия",
  );
  await actor.click(
    await screen.findByRole(
      "button",
      { name: "Сравнить с серверным черновиком" },
      { timeout: 3000 },
    ),
  );
  await screen.findByText("Текст с сервера");
  expect(screen.getByLabelText(/Сопроводительное письмо/)).toHaveValue(
    "Моя версия",
  );
  expect(save).toHaveBeenCalledTimes(1);
  expect(
    screen.getByRole("button", { name: "Применить выбранную версию письма" }),
  ).toBeDisabled();
  await actor.click(screen.getByRole("radio", { name: "Оставить мой текст" }));
  await actor.click(
    screen.getByRole("button", { name: "Применить выбранную версию письма" }),
  );
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
  expect(save.mock.calls[1][1]).toEqual({
    expectedVersion: 2,
    coverLetter: "Моя версия",
  });
  await waitFor(() =>
    expect(screen.getByText("Черновик сохранён на сервере")).toBeVisible(),
  );
  await actor.type(screen.getByLabelText(/Сопроводительное письмо/), " ещё");
  await waitFor(() => expect(save).toHaveBeenCalledTimes(3), { timeout: 3000 });
  expect(save.mock.calls[2][1].expectedVersion).toBe(3);
});
it("accepts server text only after an explicit choice without issuing another PATCH", async () => {
  const { api, app } = await fixture(),
    original = api.saveApplication;
  api.saveApplication = vi.fn().mockImplementationOnce(async () => {
    await original(app.id, {
      expectedVersion: 1,
      coverLetter: "Серверный вариант",
    });
    throw new ApiError("conflict", 409);
  });
  await mount(api, app);
  const actor = userEvent.setup();
  await actor.type(
    screen.getByLabelText(/Сопроводительное письмо/),
    "Локальный вариант",
  );
  await actor.click(
    await screen.findByRole(
      "button",
      { name: "Сравнить с серверным черновиком" },
      { timeout: 3000 },
    ),
  );
  await actor.click(
    await screen.findByRole("radio", { name: "Принять серверный текст" }),
  );
  expect(screen.getByLabelText(/Сопроводительное письмо/)).toHaveValue(
    "Локальный вариант",
  );
  await actor.click(
    screen.getByRole("button", { name: "Применить выбранную версию письма" }),
  );
  expect(screen.getByLabelText(/Сопроводительное письмо/)).toHaveValue(
    "Серверный вариант",
  );
  expect(api.saveApplication).toHaveBeenCalledTimes(1);
});
it("keeps input typed during an in-flight save and serializes the next PATCH", async () => {
  const { api, app } = await fixture(),
    original = api.saveApplication;
  let finish: ((app: CaseApplication) => void) | undefined;
  const first = new Promise<CaseApplication>((resolve) => {
    finish = resolve;
  });
  const save = vi.fn().mockReturnValueOnce(first).mockImplementation(original);
  api.saveApplication = save;
  await mount(api, app);
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText(/Сопроводительное письмо/), "Первый");
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1), { timeout: 3000 });
  await actor.type(screen.getByLabelText(/Сопроводительное письмо/), " новый");
  expect(save).toHaveBeenCalledTimes(1);
  await act(async () =>
    finish!(
      await original(app.id, { expectedVersion: 1, coverLetter: "Первый" }),
    ),
  );
  expect(screen.getByLabelText(/Сопроводительное письмо/)).toHaveValue(
    "Первый новый",
  );
  await waitFor(() => expect(save).toHaveBeenCalledTimes(2), { timeout: 3000 });
  expect(save.mock.calls[1][1]).toEqual({
    expectedVersion: 2,
    coverLetter: "Первый новый",
  });
});
it("keeps a forbidden draft readable and permits explicit access recheck without clearing it", async () => {
  const { api, app } = await fixture(),
    original = api.saveApplication;
  api.saveApplication = vi
    .fn()
    .mockRejectedValueOnce(new ApiError("forbidden", 403))
    .mockImplementation(original);
  await mount(api, app);
  const actor = userEvent.setup();
  await actor.type(
    screen.getByLabelText(/Сопроводительное письмо/),
    "Сохранить для копирования",
  );
  await actor.click(
    await screen.findByRole(
      "button",
      { name: "Проверить доступ к черновику" },
      { timeout: 3000 },
    ),
  );
  await actor.click(
    await screen.findByRole("radio", { name: "Оставить мой текст" }),
  );
  await actor.click(
    screen.getByRole("button", { name: "Применить выбранную версию письма" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Черновик сохранён на сервере")).toBeVisible(),
  );
  expect(screen.getByLabelText(/Сопроводительное письмо/)).toHaveValue(
    "Сохранить для копирования",
  );
});
