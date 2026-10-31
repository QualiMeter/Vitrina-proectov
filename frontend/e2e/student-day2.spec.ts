import { test, expect } from "@playwright/test";

const application =
  "/demo/student/cases/00000000-0000-4000-8000-000000000012/apply";

test("day 2 autosaves a draft, requires NDA and keeps withdrawal terminal", async ({
  page,
}) => {
  await page.goto(application);
  await page.getByRole("button", { name: "Создать черновик заявки" }).click();
  await page
    .getByLabel(/Сопроводительное письмо/)
    .fill("Готов участвовать в разработке.");
  await expect(page.getByText("Черновик сохранён на сервере")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отправить заявку" }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /Подтверждаю NDA/ }).check();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Отправить заявку" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Отозвать заявку" }).click();
  await expect(
    page.getByText(/Повторная подача в этот кейс запрещена/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Создать черновик заявки" }),
  ).toHaveCount(0);
});

test("day 2 pending invitation blocks submission, but not creation of a draft", async ({
  page,
}) => {
  await page.goto(application);
  await page.getByRole("radio", { name: "Командой" }).check();
  await page.getByLabel("Название команды").fill("Команда браузерной проверки");
  await page
    .getByRole("button", { name: "Создать команду", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Управлять составом и приглашениями" })
    .click();
  await page.getByLabel("Найти студента").fill("Демо");
  await page.getByRole("button", { name: "Найти", exact: true }).click();
  await page.getByRole("button", { name: "Пригласить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Отозвать приглашение" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Открыть заявку" }).click();
  await page.getByRole("button", { name: "Создать черновик заявки" }).click();
  await page.getByLabel(/Сопроводительное письмо/).fill("Командная заявка.");
  await expect(page.getByText("Черновик сохранён на сервере")).toBeVisible();
  await page.getByRole("checkbox", { name: /Подтверждаю NDA/ }).check();
  await expect(
    page.getByRole("button", { name: "Отправить заявку" }),
  ).toBeDisabled();
  await expect(page.getByText(/Дождитесь подтверждения/)).toBeVisible();
});

test("day 2 incoming invitation is confirmed only by its recipient", async ({
  page,
}) => {
  await page.goto("/demo/student/invitations");
  await page.getByRole("button", { name: "Принять", exact: true }).click();
  await page.getByRole("link", { name: "Открыть команду" }).click();
  await expect(
    page.getByRole("cell", { name: "Участник", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Пригласить", exact: true }),
  ).toHaveCount(0);
});

test("day 2 pages fit desktop/mobile and produce review screenshots", async ({
  page,
}) => {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ["invitations", "/demo/student/invitations"],
      ["application", application],
      ["drafts", "/demo/student/drafts"],
      ["team", "/demo/student/teams/00000000-0000-4000-8000-000000000030"],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByText("Загрузка данных", { exact: true }),
      ).toHaveCount(0);
      if (name === "application") {
        await page
          .getByRole("button", { name: "Создать черновик заявки" })
          .click();
        await page
          .getByLabel(/Сопроводительное письмо/)
          .fill("Учебное письмо для визуальной проверки автосохранения.");
        await expect(
          page.getByText("Черновик сохранён на сервере"),
        ).toBeVisible();
      }
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: `test-results/screenshots/day2-${width}-${name}.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
