import { test, expect, type Page } from "@playwright/test";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
async function setup(
  page: Page,
  mode: "network" | "server" | "conflict" | "member" | "captain",
) {
  const me = uid(1),
    caseId = uid(12),
    appId = uid(50),
    teamId = uid(30),
    teamMode = ["member", "captain"].includes(mode);
  const app = {
    id: appId,
    caseId,
    format: teamMode ? "TEAM" : "SOLO",
    teamId: teamMode ? teamId : undefined,
    soloApplicantUserId: teamMode ? undefined : me,
    status: "DRAFT",
    version: 1,
    participantUserIds: mode === "member" ? [me, uid(2)] : [me],
    coverLetter: "",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    allowedActions: ["edit", "submit", "withdraw"],
  };
  const team = {
    id: teamId,
    caseId,
    name: "Команда проверки",
    captainUserId: mode === "member" ? uid(2) : me,
    members: [
      {
        userId: me,
        displayName: "Демо Студент",
        isCaptain: mode !== "member",
        joinedAt: "2026-01-01T00:00:00Z",
      },
    ],
    pendingInvitations: [],
    membershipLocked: false,
    createdAt: "2026-01-01T00:00:00Z",
  };
  if (mode === "member")
    team.members.push({
      userId: uid(2),
      displayName: "Капитан команды",
      isCaptain: true,
      joinedAt: "2026-01-01T00:00:00Z",
    });
  const patches: { expectedVersion: number; coverLetter: string }[] = [];
  await page.unroute("**/api/v1/**");
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    let json: unknown;
    if (path.endsWith("/auth/me"))
      json = {
        user: {
          id: me,
          email: "demo@example.invalid",
          fullName: "Демо Студент",
          globalRoles: ["STUDENT"],
          availableAreas: ["student"],
          permissions: [],
          companyMemberships: [],
        },
        session: { expiresAt: "2099-01-01T00:00:00Z" },
      };
    else if (path.endsWith("/auth/csrf")) json = { csrfToken: "csrf" };
    else if (path.includes("/public/cases/"))
      json = {
        id: caseId,
        companyId: uid(99),
        companyName: "Демо-компания",
        title: "Кейс проверки",
        description: "Описание",
        status: "REGISTRATION_OPEN",
        participationFormat: "BOTH",
        admissionMode: "SELECTIVE",
        registrationDeadline: "2099-01-01T00:00:00Z",
        directionIds: [],
        technologyIds: [],
        minTeamSize: 1,
        maxTeamSize: 5,
      };
    else if (path.endsWith("/me/student-profile"))
      json = {
        userId: me,
        fullName: "Демо Студент",
        nickname: "student_demo",
        course: 2,
        version: 1,
        skillIds: [],
        technologyIds: [],
        publicLinks: [],
        achievements: [],
        avatarUrl: null,
      };
    else if (path.endsWith("/teams/mine"))
      json = { items: teamMode ? [team] : [] };
    else if (path.endsWith("/applications/mine")) json = { items: [app] };
    else if (path.endsWith("/nda"))
      json = {
        caseId,
        required: true,
        version: "test-1",
        documentText: "Прочитайте соглашение перед подачей.",
      };
    else if (path.endsWith(`/teams/${teamId}`)) json = team;
    else if (path.endsWith(`/applications/${appId}`)) {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        patches.push(body);
        if (patches.length === 1 && mode === "network") {
          await route.abort("failed");
          return;
        }
        if (patches.length === 1 && mode === "server") {
          await route.fulfill({ status: 500, json: {} });
          return;
        }
        if (patches.length === 1 && mode === "conflict") {
          app.version = 2;
          app.coverLetter = "Серверное письмо";
          await route.fulfill({ status: 409, json: {} });
          return;
        }
        expect(body.expectedVersion).toBe(app.version);
        app.coverLetter = body.coverLetter;
        app.version++;
      }
      json = app;
    } else {
      await route.fulfill({ status: 404, json: {} });
      return;
    }
    await route.fulfill({ json });
  });
  return { patches, url: `/student/cases/${caseId}/apply` };
}
for (const mode of ["network", "server"] as const)
  test(`application ${mode} retry preserves input and resumes autosave`, async ({
    page,
  }) => {
    const { patches, url } = await setup(page, mode);
    await page.goto(url);
    const letter = page.getByLabel(/Сопроводительное письмо/);
    await letter.fill("Не потерять письмо");
    await page
      .getByRole("button", { name: "Повторить сохранение", exact: true })
      .click();
    await expect(
      page.getByText("Черновик сохранён на сервере", { exact: true }),
    ).toBeVisible();
    await expect(letter).toHaveValue("Не потерять письмо");
    expect(patches[1]).toEqual(patches[0]);
    await letter.fill("Следующая правка");
    await expect.poll(() => patches.length).toBe(3);
    expect(patches[2]).toEqual({
      expectedVersion: 2,
      coverLetter: "Следующая правка",
    });
  });
test("application 409 requires a choice, uses the new version and keeps autosave working", async ({
  page,
}) => {
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const { patches, url } = await setup(page, "conflict");
    await page.goto(url);
    const letter = page.getByLabel(/Сопроводительное письмо/);
    await letter.fill("Моё письмо");
    await page
      .getByRole("button", {
        name: "Сравнить с серверным черновиком",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Серверное письмо", { exact: true }),
    ).toBeVisible();
    await expect(letter).toHaveValue("Моё письмо");
    expect(patches).toHaveLength(1);
    await expect(
      page.getByRole("button", {
        name: "Применить выбранную версию письма",
        exact: true,
      }),
    ).toBeDisabled();
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/screenshots/application-conflict-${width}.png`,
      fullPage: true,
    });
    await page
      .getByRole("radio", { name: "Оставить мой текст", exact: true })
      .check();
    await page
      .getByRole("button", {
        name: "Применить выбранную версию письма",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Черновик сохранён на сервере", { exact: true }),
    ).toBeVisible();
    expect(patches[1]).toEqual({
      expectedVersion: 2,
      coverLetter: "Моё письмо",
    });
    await letter.fill("Новое письмо после конфликта");
    await expect.poll(() => patches.length).toBe(3);
    expect(patches[2].expectedVersion).toBe(3);
  }
});
test("application team members are read-only while captains have editing controls", async ({
  page,
}) => {
  for (const mode of ["member", "captain"] as const)
    for (const width of [320, 375, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const { patches, url } = await setup(page, mode);
      await page.goto(url);
      await expect(
        page.getByRole("heading", { name: "Кейс проверки", exact: true }),
      ).toBeVisible();
      if (mode === "member") {
        await expect(
          page.getByText(
            "Только просмотр: изменять заявку может капитан команды.",
            { exact: true },
          ),
        ).toBeVisible();
        await expect(page.getByLabel(/Сопроводительное письмо/)).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: "Отправить заявку", exact: true }),
        ).toHaveCount(0);
      } else {
        await expect(page.getByLabel(/Сопроводительное письмо/)).toBeVisible();
        await expect(
          page.getByRole("checkbox", { name: /как капитан команды/ }),
        ).toBeVisible();
      }
      expect(patches).toHaveLength(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/screenshots/application-${mode}-${width}.png`,
        fullPage: true,
      });
    }
});
