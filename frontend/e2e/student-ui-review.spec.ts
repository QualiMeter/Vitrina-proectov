import { test, expect } from "@playwright/test";

test("profile guards unsaved edits and keeps the form after cancelling navigation", async ({
  page,
}) => {
  await page.goto("/demo/student/profile");
  await page.getByLabel("Никнейм").fill("unsaved_preview");
  await page.getByRole("link", { name: "Мои участия", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Несохранённые изменения профиля",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Остаться" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Никнейм")).toHaveValue("unsaved_preview");
  await page.getByRole("button", { name: "Сохранить профиль" }).click();
  await expect(
    page.getByText("Профиль сохранён", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Мои участия", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Мои участия" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Страницы списка" }),
  ).toHaveCount(0);
  await expect(page.getByText("Всего участий: 2")).toBeVisible();
});

test("320-400px cabinet has a compact keyboard menu and readable forms", async ({
  page,
}) => {
  test.setTimeout(60000);
  for (const width of [320, 360, 375, 400]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/demo/student",
      "/demo/student/profile",
      "/demo/student/participations",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByText("Загрузка данных", { exact: true }),
      ).toHaveCount(0);
      if (path === "/demo/student")
        await expect(
          page.getByRole("heading", { name: "Ожидающие приглашения" }),
        ).toBeVisible();
      if (path.endsWith("profile")) {
        await page.getByText("О себе", { exact: true }).click();
        await page
          .getByLabel("Публичное описание")
          .fill(
            "Длинное описание для проверки переноса текста на узком экране: ".repeat(
              5,
            ),
          );
      }
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/screenshots/ui-${width}-${path.split("/").pop()}.png`,
        fullPage: true,
      });
      const menu = page.getByRole("button", { name: "Разделы" });
      await menu.focus();
      await page.keyboard.press("Enter");
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      const nav = page.getByRole("navigation", { name: "Кабинет студента" });
      if (path === "/demo/student") {
        await page.keyboard.press("Tab");
        await expect(
          nav.getByRole("link", { name: "Мой профиль", exact: true }),
        ).toBeFocused();
      }
      await expect(
        nav.getByRole("link", { name: "Каталог инициатив" }),
      ).toBeVisible();
      await page.screenshot({
        path: `test-results/screenshots/ui-${width}-${path.split("/").pop()}-menu.png`,
        fullPage: true,
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(menu).toBeFocused();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      if (path.endsWith("profile")) {
        await page.getByRole("button", { name: "Сохранить профиль" }).click();
        await expect(
          page.getByText("Профиль сохранён", { exact: true }),
        ).toBeVisible();
      }
    }
  }
});

test("long case titles wrap on 320px without hiding participation actions", async ({
  page,
}) => {
  const id = "00000000-0000-4000-8000-000000000001";
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id,
          email: "demo@example.invalid",
          fullName: "Демо Студент",
          globalRoles: ["STUDENT"],
          availableAreas: ["student"],
          permissions: [],
          companyMemberships: [],
        },
        session: { expiresAt: "2099-01-01T00:00:00Z" },
      },
    }),
  );
  await page.route("**/api/v1/me/case-participations?*", (route) =>
    route.fulfill({
      json: {
        items: [
          {
            caseId: id,
            caseTitle: "ОченьДлинноеНазваниеКейсаБезПробелов".repeat(5),
            format: "TEAM",
            role: "CAPTAIN",
            applicationStatus: "ADMITTED",
            caseStatus: "EXECUTING",
            teamExecutionStatus: "ACTIVE",
          },
        ],
        page: 1,
        pageSize: 20,
        total: 1,
      },
    }),
  );
  await page.goto("/student/participations");
  await expect(
    page.getByRole("link", { name: /Рабочее пространство/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/ui-320-long-title.png",
    fullPage: true,
  });
});
