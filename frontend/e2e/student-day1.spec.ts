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
      "/demo/students/00000000-0000-4000-8000-000000000001",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByText("Загрузка данных", { exact: true }),
      ).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      if (width === 375 || width === 1280) {
        await page.screenshot({
          path: `test-results/screenshots/student-${width}-${path.split("/").pop()}.png`,
          fullPage: true,
        });
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("mobile menu works from keyboard and has a review screenshot", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/demo/student");
  const menu = page.getByRole("button", { name: "Разделы" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("navigation", { name: "Кабинет студента" }),
  ).toBeVisible();
  const profile = page.getByRole("link", { name: "Мой профиль", exact: true });
  await profile.focus();
  await page.screenshot({
    path: "test-results/screenshots/student-375-menu-keyboard.png",
    fullPage: true,
  });
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Мой профиль" }),
  ).toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded", "false");
});

test("loading, empty and forbidden screens have real desktop/mobile captures", async ({
  page,
}) => {
  const session = {
    user: {
      id: "00000000-0000-4000-8000-000000000001",
      email: "demo@example.invalid",
      fullName: "Демо Студент",
      globalRoles: ["STUDENT"],
      availableAreas: ["student"],
      permissions: [],
      companyMemberships: [],
    },
    session: { expiresAt: "2099-01-01T00:00:00Z" },
  };
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ status: 200, json: session }),
  );
  let release: () => void = () => {};
  let gate = Promise.resolve();
  let forbidden = false;
  await page.route("**/api/v1/me/case-participations?*", async (route) => {
    await gate;
    await route.fulfill(
      forbidden
        ? { status: 403, json: {} }
        : { status: 200, json: { items: [], page: 1, pageSize: 20, total: 0 } },
    );
  });
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    forbidden = false;
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.goto("/student/participations");
    await expect(
      page.getByText("Загрузка данных", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/screenshots/student-${width}-loading.png`,
      fullPage: true,
    });
    release();
    await expect(page.getByText("Участий пока нет")).toBeVisible();
    await page.screenshot({
      path: `test-results/screenshots/student-${width}-empty.png`,
      fullPage: true,
    });
    forbidden = true;
    await page.reload();
    await expect(
      page.getByText("Недостаточно прав. Данные и действия недоступны."),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/screenshots/student-${width}-forbidden.png`,
      fullPage: true,
    });
  }
});

test("profile institute can be cleared and remains absent after route navigation", async ({
  page,
}) => {
  await page.goto("/demo/student/profile");
  await page.getByLabel("Институт / факультет").selectOption("");
  await page.getByRole("button", { name: "Сохранить профиль" }).click();
  await expect(page.getByText("Несохранённые изменения профиля")).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: "Мои участия", exact: true }).click();
  await page.getByRole("link", { name: "Мой профиль", exact: true }).click();
  await expect(page.getByLabel("Институт / факультет")).toHaveValue("");
});
