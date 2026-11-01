import { ProjectsCatalog } from "./ProjectsCatalog";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { StudentContext } from "../hooks";
import { createDemoGateway } from "../demo";
import { ApiError } from "../../../api/client";
import {
  categories,
  emptyDraft,
  emptyQuery,
  type PublicationGateway,
  type WorkDraft,
  type ProjectDraft,
} from "./models";
import {
  createPublicationDemo,
  publicationIds,
  publicationDemoUserId,
} from "./demo";
import { PublicationContext, blockedPublicationGateway } from "./context";
import { PublicationEditorPage } from "./PublicationEditor";
import { PortfolioPage, PublicPortfolioPage } from "./PortfolioPage";
import { publicationErrors } from "./rules";
import { comparePublication } from "./conflict";
const validWork = (): WorkDraft => ({
  ...(emptyDraft("WORK") as WorkDraft),
  title: "Моя работа",
  result: "Разработан прототип",
  contribution: "Реализовал клиент",
});
const validProject = (): ProjectDraft => ({
  ...(emptyDraft("PROJECT") as ProjectDraft),
  title: "Новая инициатива",
  summary: "Краткое описание",
  description: "Подробное описание",
  problem: "Описание проблемы",
  goals: "Цели проекта",
});
async function mountEditor(
  api: PublicationGateway,
  kind: "WORK" | "PROJECT" = "WORK",
  id?: string,
) {
  const student = createDemoGateway(),
    user = (await student.session()).user;
  const element = (
    <PublicationContext.Provider value={api}>
      <StudentContext.Provider
        value={{ api: student, user, demo: true, base: "/demo/student" }}
      >
        <PublicationEditorPage kind={kind} />
      </StudentContext.Provider>
    </PublicationContext.Provider>
  );
  render(
    <RouterProvider
      router={createMemoryRouter(
        [
          { path: "/edit/:publicationId?", element },
          {
            path: "/demo/student/portfolio",
            element: <p>Portfolio destination</p>,
          },
          {
            path: "/demo/student/projects",
            element: <p>Projects destination</p>,
          },
        ],
        { initialEntries: [id ? `/edit/${id}` : "/edit"] },
      )}
    />,
  );
  await screen.findByLabelText("Название");
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("preserves all nine TZ categories and separates work from project validation", () => {
  expect(categories).toHaveLength(9);
  expect(categories.map((x) => x[1])).toContain("ВКР");
  expect(categories.map((x) => x[1])).toContain("Open-source");
  expect(publicationErrors(validWork())).toEqual([]);
  expect(publicationErrors({ ...validWork(), contribution: "" })).toContain(
    "Опишите личный вклад.",
  );
  expect(publicationErrors(validProject())).toEqual([]);
  expect(
    publicationErrors({
      ...validProject(),
      publicContactUrl: "javascript:alert(1)",
    }),
  ).toContain("Публичный контакт должен быть ссылкой http/https.");
});
it("keeps unfinished drafts private and requires content before moderation", async () => {
  const api = createPublicationDemo();
  const draft = await api.save(emptyDraft("WORK"));
  expect(draft.moderation).toBe("DRAFT");
  await expect(
    api.submitForModeration(draft.id, draft.version),
  ).rejects.toThrow(/название/);
  const saved = await api.save(validWork(), draft.id, draft.version);
  const submitted = await api.submitForModeration(saved.id, saved.version);
  expect(submitted.moderation).toBe("PENDING_MODERATION");
  expect(
    (await api.publicPortfolio(publicationDemoUserId)).works.some(
      (x) => x.id === saved.id,
    ),
  ).toBe(false);
});
it("does not publish an initiative merely by changing development status or requesting moderation", async () => {
  const api = createPublicationDemo();
  const saved = await api.save({
    ...validProject(),
    developmentStatus: "COMPLETED",
  });
  const submitted = await api.submitForModeration(saved.id, saved.version);
  expect(submitted.kind === "PROJECT" && submitted.developmentStatus).toBe(
    "COMPLETED",
  );
  expect(submitted.moderation).toBe("PENDING_MODERATION");
  await expect(api.publicProject(saved.id)).rejects.toMatchObject({
    status: 404,
  });
});
it("protects public projections, foreign drafts and confidential project summaries", async () => {
  const api = createPublicationDemo();
  await expect(
    api.publicProject(publicationIds.privateProject),
  ).rejects.toMatchObject({ status: 404 });
  const data = await api.publicPortfolio(publicationDemoUserId);
  expect(JSON.stringify(data)).not.toContain("moderationNotes");
  expect(JSON.stringify(data)).not.toContain("Личный черновик");
  expect(JSON.stringify(data)).not.toContain("Уточните личный вклад");
  expect(Object.keys(data.closedProjects[0]).sort()).toEqual(["id", "period"]);
  const foreign = createPublicationDemo("another-actor");
  await expect(
    foreign.getOwned("WORK", publicationIds.work),
  ).rejects.toMatchObject({ status: 403 });
  expect((await foreign.portfolio()).confirmedCases).toEqual([]);
});
it("filters the complete catalog before paging and honors filtered totals", async () => {
  const api = createPublicationDemo(),
    page = await api.catalog(emptyQuery, 2);
  expect(page.page).toBe(2);
  expect(page.pageSize).toBe(6);
  expect(page.items).toHaveLength(3);
  expect(page.total).toBe(9);
  const found = await api.catalog({ ...emptyQuery, q: "инициатива 9" }, 1);
  expect(found.total).toBe(1);
  expect(found.items[0].title).toBe("Студенческая инициатива 9");
  const none = await api.catalog({ ...emptyQuery, development: "DRAFT" }, 1);
  expect(none.total).toBe(0);
});
it("safely removes published work from public portfolio and prevents stale versions", async () => {
  const api = createPublicationDemo(),
    old = await api.getOwned("WORK", publicationIds.work);
  await expect(api.hideWork(old.id, 99)).rejects.toMatchObject({ status: 409 });
  await api.hideWork(old.id, old.version);
  expect(
    (await api.publicPortfolio(publicationDemoUserId)).works.some(
      (x) => x.id === old.id,
    ),
  ).toBe(false);
});
it("keeps live modules blocked without requests or demo fallback", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(
    blockedPublicationGateway.catalog(emptyQuery, 1),
  ).rejects.toThrow(/недоступен/);
  await expect(blockedPublicationGateway.save(validWork())).rejects.toThrow(
    /недоступен/,
  );
  expect(fetch).not.toHaveBeenCalled();
});
it("three-way comparison preserves server-only edits and identifies overlapping fields", () => {
  const base = validWork(),
    mine = { ...base, title: "Моя правка" },
    server = {
      ...base,
      title: "Чужая правка",
      description: "Новое описание с сервера",
    };
  const diff = comparePublication(base, mine, server);
  expect(diff.conflicts.map((x) => x.label)).toEqual(["Название"]);
  expect(diff.merged.description).toBe(server.description);
  expect(diff.merged.title).toBe(mine.title);
});
it("saves and submits a work without a mandatory repository", async () => {
  const api = createPublicationDemo(),
    save = vi.spyOn(api, "save");
  await mountEditor(api);
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText("Название"), "Работа без репозитория");
  await actor.type(
    screen.getByLabelText("Полученный результат"),
    "Создана модель",
  );
  await actor.type(
    screen.getByLabelText("Личный вклад"),
    "Провёл исследование",
  );
  await actor.click(screen.getByRole("button", { name: "Сохранить черновик" }));
  await screen.findByText("Черновик сохранён");
  expect(save.mock.calls[0][0].links).toEqual([]);
  await actor.click(
    screen.getByRole("button", { name: "Отправить на публичную модерацию" }),
  );
  await screen.findByText("Публикация отправлена на проверку");
  expect(screen.getByText("На проверке", { exact: true })).toBeVisible();
  expect(screen.getByLabelText("Название")).toBeDisabled();
});
it("guards unsaved forms and retains typed content after cancelled navigation", async () => {
  await mountEditor(createPublicationDemo());
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText("Название"), "Не потерять");
  await actor.click(screen.getByRole("link", { name: "← К портфолио" }));
  const dialog = await screen.findByRole("dialog", {
    name: "Несохранённая публикация",
  });
  await actor.click(within(dialog).getByRole("button", { name: "Остаться" }));
  expect(screen.getByLabelText("Название")).toHaveValue("Не потерять");
});
it("recovers from a save network error without clearing the draft", async () => {
  const api = createPublicationDemo(),
    save = api.save;
  api.save = vi
    .fn()
    .mockRejectedValueOnce(new ApiError("network"))
    .mockImplementation(save);
  await mountEditor(api);
  const actor = userEvent.setup();
  await actor.type(screen.getByLabelText("Название"), "Мой черновик");
  await actor.click(screen.getByRole("button", { name: "Сохранить черновик" }));
  await screen.findByText("Нет связи с сервером. Проверьте подключение.");
  expect(screen.getByLabelText("Название")).toHaveValue("Мой черновик");
  await actor.click(screen.getByRole("button", { name: "Сохранить черновик" }));
  await screen.findByText("Черновик сохранён");
});
it("handles 409 with explicit comparison, preserving both local and server-only fields", async () => {
  const api = createPublicationDemo(),
    save = api.save;
  api.save = vi
    .fn()
    .mockImplementationOnce(async () => {
      const old = await api.getOwned("WORK", publicationIds.returnedWork);
      const { draftOf } = await import("./models");
      await save(
        {
          ...draftOf(old),
          title: "Серверное название",
          description: "Серверное описание",
        },
        old.id,
        old.version,
      );
      throw new ApiError("conflict", 409);
    })
    .mockImplementation(save);
  await mountEditor(api, "WORK", publicationIds.returnedWork);
  const actor = userEvent.setup();
  const title = screen.getByLabelText("Название");
  await actor.clear(title);
  await actor.type(title, "Моё название");
  await actor.click(screen.getByRole("button", { name: "Сохранить черновик" }));
  await actor.click(
    await screen.findByRole("button", { name: "Сравнить версии" }),
  );
  await screen.findByText(/Серверная версия: 2/);
  expect(api.save).toHaveBeenCalledTimes(1);
  await actor.click(
    screen.getByRole("checkbox", {
      name: "Оставить мои значения во всех показанных спорных полях",
    }),
  );
  await actor.click(
    screen.getByRole("button", { name: "Применить сравнение к форме" }),
  );
  expect(screen.getByLabelText("Подробное описание")).toHaveValue(
    "Серверное описание",
  );
  expect(screen.getByLabelText("Название")).toHaveValue("Моё название");
  await actor.click(screen.getByRole("button", { name: "Сохранить черновик" }));
  await screen.findByText("Черновик сохранён");
  expect((api.save as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[2]).toBe(2);
});
it("shows moderation remarks in the private portfolio", async () => {
  const api = createPublicationDemo(),
    student = createDemoGateway(),
    user = (await student.session()).user;
  const router = createMemoryRouter(
    [
      {
        path: "/private",
        element: (
          <PublicationContext.Provider value={api}>
            <StudentContext.Provider
              value={{ api: student, user, demo: true, base: "/demo/student" }}
            >
              <PortfolioPage />
            </StudentContext.Provider>
          </PublicationContext.Provider>
        ),
      },
      {
        path: "/students/:id/portfolio",
        element: (
          <PublicationContext.Provider value={api}>
            <PublicPortfolioPage demo />
          </PublicationContext.Provider>
        ),
      },
    ],
    { initialEntries: ["/private"] },
  );
  render(<RouterProvider router={router} />);
  expect(await screen.findByText(/Уточните личный вклад/)).toBeVisible();
});
it("accepts demo attachments, rejects unsupported files and foreign media references", async () => {
  const api = createPublicationDemo();
  await expect(
    api.upload(
      new File(["x"], "x.exe", { type: "application/octet-stream" }),
      "MATERIAL",
    ),
  ).rejects.toThrow(/учебном/);
  const file = new File(["image"], "screen.png", { type: "image/png" }),
    media = await api.upload(file, "IMAGE");
  expect(await api.mediaBlob(media.id)).toBe(file);
  const saved = await api.save({ ...validWork(), media: [media] });
  expect(saved.media).toHaveLength(1);
  await expect(
    api.save({ ...validWork(), media: [{ ...media, id: "foreign" }] }),
  ).rejects.toMatchObject({ status: 403 });
});

it("resets the old search before applying consecutive catalog filters", async () => {
  const api = createPublicationDemo();
  const router = createMemoryRouter(
    [
      {
        path: "/catalog",
        element: (
          <PublicationContext.Provider value={api}>
            <ProjectsCatalog demo />
          </PublicationContext.Provider>
        ),
      },
    ],
    { initialEntries: ["/catalog?q=инициатива+9"] },
  );
  render(<RouterProvider router={router} />);
  await screen.findByText("Найдено проектов: 1");
  const actor = userEvent.setup();
  await actor.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
  await actor.selectOptions(
    await screen.findByRole("combobox", { name: "Статус разработки" }),
    "IN_PROGRESS",
  );
  await actor.selectOptions(
    await screen.findByRole("combobox", { name: "Интересы проекта" }),
    "SEEK_MENTOR",
  );
  await screen.findByText("Найдено проектов: 4");
  const params = new URLSearchParams(router.state.location.search);
  expect(params.get("q")).toBeNull();
  expect(params.get("development")).toBe("IN_PROGRESS");
  expect(params.get("interest")).toBe("SEEK_MENTOR");
});
