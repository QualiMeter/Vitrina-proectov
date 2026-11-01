import { test, expect } from "@playwright/test";
const project = "00000000-0000-4000-8000-000000000020",
  external = "00000000-0000-4000-8000-000000000128";
test("day 5 author accepts a candidate and explicitly removes a member without exposing an author removal action", async ({
  page,
}) => {
  await page.goto(`/demo/student/projects/${project}/team`);
  await expect(
    page.getByRole("heading", { name: "Назначенный куратор", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Исключить участника student_demo",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Принять candidate_demo", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Исключить участника candidate_demo",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Принять candidate_demo", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Исключить участника designer_demo",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Исключить участника designer_demo",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Исключить участника designer_demo",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Подтвердить исключение", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Исключить участника designer_demo",
      exact: true,
    }),
  ).toHaveCount(0);
  // Client routing preserves the explicit in-memory demo store.
  await page.getByRole("link", { name: "← Мои проекты", exact: true }).click();
  await page.getByRole("link", { name: "Каталог инициатив" }).click();
  await page
    .getByRole("link", { name: "Подробнее о проекте", exact: true })
    .first()
    .click();
  const team = page
    .getByRole("heading", { name: "Текущая команда", exact: true })
    .locator("..");
  await expect(team.getByText("candidate_demo", { exact: true })).toBeVisible();
  await expect(team.getByText("designer_demo", { exact: true })).toHaveCount(0);
});
test("day 5 candidate submits without external contact, protects a draft and withdraws explicitly", async ({
  page,
}) => {
  await page.goto(`/demo/student/projects/${external}/apply`);
  await page
    .getByRole("combobox", { name: "Открытая роль", exact: true })
    .selectOption("00000000-0000-4000-8000-000000000308");
  await page
    .getByLabel("Сопроводительное письмо", { exact: true })
    .fill("Хочу разработать интерфейс");
  await page
    .getByRole("link", { name: "← Публичная карточка проекта", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Несохранённая заявка проекта",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Остаться", exact: true }).click();
  await expect(
    page.getByLabel("Сопроводительное письмо", { exact: true }),
  ).toHaveValue("Хочу разработать интерфейс");
  await page
    .getByRole("button", { name: "Отправить заявку в проект", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ваша заявка", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Отозвать заявку", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Подтвердить отзыв", exact: true })
    .click();
  await expect(page.getByText("Отозвана", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Отправить заявку в проект",
      exact: true,
    }),
  ).toHaveCount(0);
});
test("day 5 favorites and notices work inside the existing cabinet", async ({
  page,
}) => {
  await page.goto("/demo/student/favorites");
  await page
    .getByRole("button", { name: "Убрать из избранного", exact: true })
    .click();
  await expect(
    page.getByText("Избранных кейсов пока нет.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сохранить учебный кейс", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Открыть условия участия", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Убрать кейс из избранного",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Уведомления", exact: true }).click();
  await expect(
    page.getByText("Непрочитанных: 1", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Отметить прочитанным", exact: true })
    .click();
  await expect(
    page.getByText("Непрочитанных: 0", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Только непрочитанные", exact: true })
    .check();
  await expect(
    page.getByText("Уведомлений пока нет.", { exact: true }),
  ).toBeVisible();
});
test("day 5 private states and author dashboards fit mobile and desktop", async ({
  page,
}) => {
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [screen, path, title] of [
      ["projects", "projects", "Мои проекты"],
      ["team", `projects/${project}/team`, "Команда и заявки проекта"],
      [
        "application",
        `projects/${external}/apply`,
        "Заявка в студенческий проект",
      ],
      ["favorites", "favorites", "Избранные кейсы"],
      ["notifications", "notifications", "Уведомления"],
    ]) {
      await page.goto(`/demo/student/${path}`);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText("UI Ready · демонстрационные данные", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Загрузка…", { exact: true })).toHaveCount(0);
      if (screen === "projects")
        await expect(
          page.getByText("Проектов: 10", { exact: true }),
        ).toBeVisible();
      if (screen === "team")
        await expect(
          page.getByText("curator_demo", { exact: true }),
        ).toBeVisible();
      if (screen === "application")
        await expect(
          page.getByRole("heading", {
            name: "Студенческая инициатива 9",
            exact: true,
          }),
        ).toBeVisible();
      if (screen === "favorites")
        await expect(
          page.getByRole("heading", {
            name: "Учебный кейс для команд",
            exact: true,
          }),
        ).toBeVisible();
      if (screen === "notifications")
        await expect(
          page.getByRole("heading", {
            name: "Изменилось назначение куратора проекта",
            exact: true,
          }),
        ).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/screenshots/day5-${width}-${screen}.png`,
        fullPage: true,
      });
    }
  }
});
test("day 5 live catalog never substitutes mock data for the missing project management contract", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: "00000000-0000-4000-8000-000000000001",
          email: "demo@example.invalid",
          fullName: "Студент",
          globalRoles: ["STUDENT"],
          availableAreas: ["student"],
          permissions: [],
          companyMemberships: [],
        },
        session: { expiresAt: "2099-01-01T00:00:00Z" },
      },
    }),
  );
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) requests.push(request.url());
  });
  await page.goto("/student/projects");
  await expect(
    page.getByText(
      "Раздел пока недоступен. Можно открыть демонстрационный пример.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Карта студенческих команд",
      exact: true,
    }),
  ).toHaveCount(0);
  expect(requests.every((url) => url.endsWith("/api/v1/auth/me"))).toBe(true);
});
