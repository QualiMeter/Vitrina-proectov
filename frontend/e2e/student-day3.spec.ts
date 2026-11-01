import { test, expect, type Page } from "@playwright/test";

import { createExecutionFixture, executionIds } from "./day3-fixtures";
const workspaceUrl = `/demo/student/cases/${executionIds.case}/workspace`;
test("day 3 submits a late version and protects unsent changes", async ({
  page,
}) => {
  await page.goto(workspaceUrl);
  await page
    .getByLabel("Описание результата")
    .fill("Готовый прототип и описание проверки");
  await page
    .getByRole("link", { name: "Посмотреть заявку", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Неотправленные изменения результата",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Остаться" }).click();
  await expect(page.getByLabel("Описание результата")).toHaveValue(
    "Готовый прототип и описание проверки",
  );
  await page
    .getByRole("button", { name: "Добавить ссылку на результат" })
    .click();
  await page.getByLabel("Название ссылки", { exact: true }).fill("Репозиторий");
  await page
    .getByLabel("Адрес ссылки", { exact: true })
    .fill("https://example.com/repository");
  await page.getByRole("button", { name: "Отправить новую версию" }).click();
  await expect(
    page.getByText("Новая версия результата отправлена", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Версия 2 ·.*Просрочено/)).toBeVisible();
  await expect(page.getByText(/Версия 1 ·/)).toBeVisible();
  await expect(page.getByLabel("Описание результата")).toHaveValue("");
});
test("workspace is readable from 320px to desktop with keyboard navigation", async ({
  page,
}) => {
  test.setTimeout(60000);
  for (const width of [320, 360, 375, 400, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(workspaceUrl);
    await expect(page.getByLabel("Описание результата")).toBeVisible();
    await expect(page.getByText("Прошёл", { exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/day3-${width}-workspace.png`,
      fullPage: true,
    });
    if (width < 760) {
      const menu = page.getByRole("button", { name: "Разделы" });
      await menu.focus();
      await page.keyboard.press("Enter");
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
    }
  }
});
async function mockWorkspace(
  page: Page,
  mode: "before" | "member" | "eliminated" | "closed" | "conflict" | "network",
) {
  const api = createExecutionFixture(),
    ids = executionIds;
  const workspace = await api.workspace(),
    app = await api.application(),
    team = await api.team();
  let attempts = 0;
  if (mode === "before") workspace.status = "REGISTRATION_CLOSED";
  if (mode === "member")
    team.captainUserId = "00000000-0000-4000-8000-000000000099";
  if (mode === "eliminated") workspace.myParticipationStatus = "ELIMINATED";
  if (mode === "closed")
    workspace.stages[0].checkpoints[0].intakeStatus = "CLOSED";
  const keys: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown;
    if (path.endsWith("/auth/me")) json = await api.session();
    else if (path.endsWith("/auth/csrf")) json = { csrfToken: "csrf" };
    else if (path.endsWith("/workspace")) json = workspace;
    else if (path.includes("/public/cases/")) json = await api.caseDetails();
    else if (path.endsWith(`/applications/${ids.application}`)) json = app;
    else if (path.endsWith(`/teams/${team.id}`)) json = team;
    else if (path.endsWith("/submissions/mine"))
      json = await api.submissionHistory(path.split("/")[4]);
    else if (path.endsWith("/selection-result/mine"))
      json = await api.selectionResult();
    else if (
      path.endsWith("/submissions") &&
      route.request().method() === "POST"
    ) {
      const body = route.request().postDataJSON(),
        key = route.request().headers()["idempotency-key"];
      keys.push(key);
      attempts++;
      if (attempts === 1 && mode === "network") {
        await route.abort("failed");
        return;
      }
      if (attempts === 1 && mode === "conflict") {
        await api.submitVersion(
          ids.checkpoint,
          {
            applicationId: ids.application,
            expectedLastVersion: 1,
            description: "Серверный результат",
          },
          "other-key",
        );
        await route.fulfill({ status: 409, json: { title: "Conflict" } });
        return;
      }
      json = await api.submitVersion(ids.checkpoint, body, key);
    } else {
      await route.fulfill({ status: 404, json: {} });
      return;
    }
    await route.fulfill({ json });
  });
  return keys;
}
for (const mode of ["before", "member", "eliminated", "closed"] as const)
  test(`workspace ${mode} hides authoring controls`, async ({ page }) => {
    await mockWorkspace(page, mode);
    await page.goto(`/student/cases/${executionIds.case}/workspace`);
    await expect(
      page.getByRole("heading", { name: "Сервис для студенческих команд" }),
    ).toBeVisible();
    if (mode === "before") {
      await expect(
        page.getByText("Кейс ещё не запущен", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("Разработка прототипа", { exact: true }),
      ).toHaveCount(0);
    } else await expect(page.getByText(/Версия 1 ·/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Отправить новую версию" }),
    ).toHaveCount(0);
    await page.screenshot({
      path: `test-results/screenshots/day3-${mode}.png`,
      fullPage: true,
    });
  });
test("workspace 409 preserves result until explicit comparison and resubmission", async ({
  page,
}) => {
  await mockWorkspace(page, "conflict");
  await page.goto(`/student/cases/${executionIds.case}/workspace`);
  await page.getByLabel("Описание результата").fill("Мой результат");
  await page.getByRole("button", { name: "Отправить новую версию" }).click();
  await page
    .getByRole("button", { name: "Сравнить с актуальной сдачей" })
    .click();
  await expect(page.getByText(/На сервере версия 2/)).toBeVisible();
  await expect(page.getByLabel("Описание результата")).toHaveValue(
    "Мой результат",
  );
  await page
    .getByRole("button", { name: "Сохранить мой текст для следующей версии" })
    .click();
  await page.getByRole("button", { name: "Отправить новую версию" }).click();
  await expect(page.getByText(/Версия 3 ·/)).toBeVisible();
});
test("workspace network retry reuses the request key", async ({ page }) => {
  const keys = await mockWorkspace(page, "network");
  await page.goto(`/student/cases/${executionIds.case}/workspace`);
  await page.getByLabel("Описание результата").fill("Не потерять текст");
  await page.getByRole("button", { name: "Отправить новую версию" }).click();
  await page.getByRole("button", { name: "Повторить отправку" }).click();
  await expect(
    page.getByText("Новая версия результата отправлена", { exact: true }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
