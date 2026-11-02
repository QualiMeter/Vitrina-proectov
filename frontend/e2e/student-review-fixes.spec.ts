import { test, expect } from "@playwright/test";

for (const width of [320, 1280]) {
  test(`profile conflict preserves draft and requires explicit reconciliation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const id = "00000000-0000-4000-8000-000000000001";
    let profile = {
      userId: id,
      fullName: "Демо Студент",
      nickname: "initial_nickname",
      instituteId: null,
      course: 2,
      studyGroup: "INITIAL-201",
      version: 1,
      skillIds: [],
      technologyIds: [],
      publicLinks: [],
      achievements: [],
      avatarUrl: null,
    };
    const patches: Record<string, unknown>[] = [];
    await page.route("**/api/v1/auth/me", (route) =>
      route.fulfill({
        json: {
          user: {
            id,
            email: "demo@example.invalid",
            fullName: profile.fullName,
            globalRoles: ["STUDENT"],
            availableAreas: ["student"],
            permissions: [],
            companyMemberships: [],
          },
          session: { expiresAt: "2099-01-01T00:00:00Z" },
        },
      }),
    );
    await page.route("**/api/v1/reference-data", (route) =>
      route.fulfill({
        json: {
          directions: [],
          competencies: [],
          technologies: [],
          institutes: [],
          portfolioCategories: [],
        },
      }),
    );
    await page.route("**/api/v1/auth/csrf", (route) =>
      route.fulfill({ json: { csrfToken: "test-csrf" } }),
    );
    await page.route("**/api/v1/me/student-profile", async (route) => {
      if (route.request().method() === "PATCH") {
        const patch = route.request().postDataJSON();
        patches.push(patch);
        if (patches.length === 1) {
          profile = {
            ...profile,
            version: 2,
            nickname: "server_nickname",
            studyGroup: "SERVER-202",
          };
          await route.fulfill({ status: 409, json: { title: "Conflict" } });
          return;
        }
        expect(patch).toEqual({ expectedVersion: 2, nickname: "my_nickname" });
        expect(route.request().headers()["x-csrf-token"]).toBe("test-csrf");
        profile = { ...profile, nickname: String(patch.nickname), version: 3 };
      }
      await route.fulfill({ json: profile });
    });
    await page.goto("/student/profile");
    await page.getByLabel("Никнейм").fill("my_nickname");
    await page.getByRole("button", { name: "Сохранить профиль" }).click();
    await expect(
      page.getByRole("heading", { name: "Профиль изменён на сервере" }),
    ).toBeVisible();
    await expect(page.getByLabel("Никнейм")).toHaveValue("my_nickname");
    await expect(
      page.getByRole("button", { name: "Сохранить профиль" }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Сравнить с серверной версией" })
      .click();
    await expect(
      page.getByText("server_nickname", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Применить выбор к форме" }),
    ).toBeDisabled();
    expect(patches).toHaveLength(1);
    await page.getByRole("radio", { name: /Оставить моё значение/ }).check();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/conflict-${width}.png`,
      fullPage: true,
    });
    await page.getByRole("button", { name: "Применить выбор к форме" }).click();
    await expect(page.getByLabel("Группа")).toHaveValue("SERVER-202");
    expect(patches).toHaveLength(1);
    await page.getByRole("button", { name: "Сохранить профиль" }).click();
    await expect(
      page.getByText("Профиль сохранён", { exact: true }),
    ).toBeVisible();
    expect(patches).toHaveLength(2);
  });
}
