import { test, expect } from "@playwright/test";
const application =
  "/demo/student/cases/00000000-0000-4000-8000-000000000012/apply";
test("accepted invitations become discoverable teams and member applications are read-only", async ({
  page,
}) => {
  await page.goto("/demo/student/teams");
  await expect(
    page.getByRole("heading", { name: "Демо-команда активного кейса" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Команда по приглашению" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Приглашения", exact: true }).click();
  await expect(page.getByRole("link", { name: "Открыть команду" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Принять", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Открыть команду" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Мои команды", exact: true }).click();
  await expect(page).toHaveURL(/\/demo\/student\/teams$/);
  await expect(
    page.getByRole("heading", { name: "Мои команды", exact: true }),
  ).toBeVisible();
  const card = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Команда по приглашению" }),
  });
  await card.getByRole("link", { name: "Открыть команду" }).click();
  await expect(page).toHaveURL(
    /\/teams\/00000000-0000-4000-8000-000000000033$/,
  );
  await expect(
    page.getByRole("heading", { name: "Команда кейса", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Посмотреть заявку" }).click();
  await expect(page).toHaveURL(
    /\/cases\/00000000-0000-4000-8000-000000000013\/apply$/,
  );
  await expect(
    page.getByText("Общая заявка команды по приглашению."),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Отозвать заявку" }),
  ).toHaveCount(0);
});
test("created teams are reachable before an application is created", async ({
  page,
}) => {
  const teamName = "ОченьДлинноеНазваниеКоманды".repeat(4);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto(application);
  await page.getByRole("radio", { name: "Командой" }).check();
  await page.getByLabel("Название команды").fill(teamName);
  await page
    .getByRole("button", { name: "Создать команду", exact: true })
    .click();
  await expect(
    page.getByText("Команда создана", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Разделы" }).click();
  await page.getByRole("link", { name: "Команды", exact: true }).click();
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: teamName }) });
  await expect(card.getByText("Заявка не создана")).toBeVisible();
  await expect(
    card.getByRole("link", { name: "Открыть команду" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/screenshots/teams-320-created-long-name.png",
    fullPage: true,
  });
});

test("participation filters include later API pages", async ({ page }) => {
  const id = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: id(1),
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
  await page.route("**/api/v1/me/case-participations?*", (route) => {
    const p = Number(new URL(route.request().url()).searchParams.get("page"));
    return route.fulfill({
      json: {
        items: [
          {
            caseId: id(p + 10),
            applicationId: id(p + 20),
            caseTitle:
              p === 1 ? "Активный кейс" : "Черновик со второй страницы",
            format: "SOLO",
            role: "SOLO",
            applicationStatus: p === 1 ? "ADMITTED" : "DRAFT",
            caseStatus: p === 1 ? "EXECUTING" : "REGISTRATION_OPEN",
          },
        ],
        page: p,
        pageSize: 1,
        total: 2,
      },
    });
  });
  await page.goto("/student/participations");
  await page.getByRole("button", { name: "Черновики", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Черновик со второй страницы" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Активный кейс" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Активные", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Активный кейс" }),
  ).toBeVisible();
});
test("teams tabs fit narrow screens and have review captures", async ({
  page,
}) => {
  for (const width of [320, 360, 375, 400, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ["teams", "/demo/student/teams"],
      ["invitations", "/demo/student/teams/invitations"],
      ["participations", "/demo/student/participations"],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByText("Загрузка данных", { exact: true }),
      ).toHaveCount(0);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/screenshots/teams-${width}-${name}.png`,
        fullPage: true,
      });
    }
  }
});
