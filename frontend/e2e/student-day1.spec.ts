import { test, expect } from "@playwright/test";

test("day 1 profile can be edited and exposes only public fields", async ({
  page,
}) => {
  await page.goto("/demo/student/profile");
  await page.getByLabel("Никнейм").fill("updated_nick");
  await page.getByRole("button", { name: "Сохранить профиль" }).click();
  await expect(page.getByLabel("Никнейм")).toHaveValue("updated_nick");
  await page
    .getByRole("link", { name: "Посмотреть публичный профиль" })
    .click();
  await expect(
    page.getByRole("heading", { name: "updated_nick" }),
  ).toBeVisible();
  await expect(page.getByText("Демо Студент", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ДЕМО-201", { exact: true })).toHaveCount(0);
});

test("day 1 provides participation navigation but no day 2/3 actions", async ({
  page,
}) => {
  await page.goto("/demo/student/participations");
  await expect(page.getByText("Капитан", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Рабочее пространство" }).click();
  await expect(page.getByText("Раздел пока недоступен")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Отправить заявку" }),
  ).toHaveCount(0);
});

test("private data is not requested before authentication", async ({
  page,
}) => {
  const calls: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    calls.push(new URL(route.request().url()).pathname);
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.goto("/student/profile");
  await expect(
    page.getByText("Сессия завершилась. Войдите снова."),
  ).toBeVisible();
  expect(calls).toEqual(["/api/v1/auth/me"]);
});

test("day 1 pages fit mobile and desktop widths", async ({ page }) => {
  for (const width of [375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/demo/student",
      "/demo/student/profile",
      "/demo/student/participations",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
});
