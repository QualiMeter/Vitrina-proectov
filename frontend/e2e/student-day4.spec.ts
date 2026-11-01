import { test, expect } from "@playwright/test";
const owner = "00000000-0000-4000-8000-000000000001";
const project = "00000000-0000-4000-8000-000000000020";
test("day 4 creates a work, protects unsaved input and submits it for moderation without a repository", async ({
  page,
}) => {
  await page.goto("/demo/student/portfolio");
  for (const name of [
    "Готовые работы",
    "Собственные активные проекты",
    "Подтверждённые кейсы",
    "Закрытые продуктовые проекты",
  ])
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  await page
    .getByRole("link", { name: "Добавить готовую работу", exact: true })
    .click();
  await expect(
    page
      .getByRole("combobox", { name: "Категория", exact: true })
      .locator("option"),
  ).toHaveCount(9);
  await page
    .getByLabel("Название", { exact: true })
    .fill("Исследование без репозитория");
  await page
    .getByLabel("Полученный результат")
    .fill("Построена модель и проверены гипотезы");
  await page
    .getByLabel("Личный вклад")
    .fill("Подготовил данные и выполнил анализ");
  await page.getByRole("link", { name: "← К портфолио", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Несохранённая публикация" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Остаться", exact: true }).click();
  await expect(page.getByLabel("Название", { exact: true })).toHaveValue(
    "Исследование без репозитория",
  );
  await page
    .getByLabel("Файл публикации", { exact: true })
    .setInputFiles({
      name: "preview.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGOIln0BAAI3AWFbJeubAAAAAElFTkSuQmCC",
        "base64",
      ),
    });
  await page
    .getByRole("button", { name: "Добавить файл", exact: true })
    .click();
  await expect(page.getByAltText("preview.png", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByAltText("preview.png", { exact: true })
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByText("Черновик сохранён", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Отправить на публичную модерацию",
      exact: true,
    })
    .click();
  await expect(page.getByText("На проверке", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "← К портфолио", exact: true }).click();
  await page
    .getByRole("link", { name: "Посмотреть публичное портфолио", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "student_demo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Исследование без репозитория", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/Уточните личный вклад/)).toHaveCount(0);
});
test("public catalog searches all pages, combines filters, resets and opens a full project", async ({
  page,
}) => {
  await page.goto("/demo/student-projects");
  await expect(
    page.getByText("Найдено проектов: 9", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Далее", exact: true }).click();
  await expect(
    page.getByText("Страница 2 из 2", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Поиск проектов", { exact: true }).fill("инициатива 9");
  await expect(
    page.getByText("Найдено проектов: 1", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Страницы списка" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Статус разработки", exact: true })
    .selectOption("IN_PROGRESS");
  await page
    .getByRole("combobox", { name: "Интересы проекта", exact: true })
    .selectOption("SEEK_MENTOR");
  await expect(
    page.getByText("Найдено проектов: 4", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Поиск проектов", { exact: true })
    .fill("неттакихпроектов");
  await expect(
    page.getByRole("heading", { name: "Проекты не найдены", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Сбросить фильтры", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Карта студенческих команд", exact: true })
    .click();
  for (const title of [
    "О проекте",
    "Текущая команда",
    "Открытые роли",
    "Публичный контакт автора",
  ])
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Подать заявку · Скоро", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("link", { name: "Связаться с автором", exact: true }),
  ).toHaveAttribute("rel", "noopener noreferrer");
});
test("creates an initiative with separate development status and never publishes it automatically", async ({
  page,
}) => {
  await page.goto("/demo/student/projects/new");
  await page
    .getByLabel("Название", { exact: true })
    .fill("Новая инициатива дня 4");
  await page
    .getByLabel("Краткое описание", { exact: true })
    .fill("Кратко о продукте");
  await page
    .getByLabel("Подробное описание", { exact: true })
    .fill("Подробное описание продукта");
  await page
    .getByLabel("Проблема", { exact: true })
    .fill("Проблема участников");
  await page
    .getByLabel("Цели", { exact: true })
    .fill("Создать полезный сервис");
  await page
    .getByRole("combobox", { name: "Статус разработки", exact: true })
    .selectOption("RECRUITING");
  await page
    .getByRole("checkbox", { name: "Ищу команду", exact: true })
    .check();
  await page
    .getByLabel("Публичная ссылка для связи", { exact: true })
    .fill("https://example.com/contact");
  await page
    .getByRole("button", { name: "Добавить открытую роль", exact: true })
    .click();
  await page.getByLabel("Название роли", { exact: true }).fill("Разработчик");
  await page
    .getByRole("button", { name: "Сохранить черновик", exact: true })
    .click();
  await expect(
    page.getByText("Черновик сохранён", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Отправить на публичную модерацию",
      exact: true,
    })
    .click();
  await expect(page.getByText("На проверке", { exact: true })).toBeVisible();
  await expect(
    page.locator(".student-tags").getByText("Поиск команды", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "← К моим проектам", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Каталог инициатив", exact: true })
    .click();
  await page
    .getByLabel("Поиск проектов", { exact: true })
    .fill("Новая инициатива дня 4");
  await expect(
    page.getByRole("heading", { name: "Проекты не найдены", exact: true }),
  ).toBeVisible();
});
test("public URLs never expose a draft and unconnected live catalog never fetches invented APIs", async ({
  page,
}) => {
  await page.goto(
    "/demo/student-projects/00000000-0000-4000-8000-000000000110",
  );
  await expect(
    page.getByText("Объект не найден или недоступен.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Непубличный проект автора", { exact: true }),
  ).toHaveCount(0);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) calls.push(r.url());
  });
  await page.goto("/student-projects");
  await expect(
    page.getByText(
      "Раздел пока недоступен. Можно открыть демонстрационный пример.",
      { exact: true },
    ),
  ).toBeVisible();
  expect(calls).toEqual([]);
});
test("day 4 layouts keep full-width fields and avoid horizontal scrolling", async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of [320, 375, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ["portfolio", "/demo/student/portfolio"],
      ["work-form", "/demo/student/portfolio/new"],
      ["project-form", "/demo/student/projects/new"],
      ["catalog", "/demo/student-projects"],
      ["project", `/demo/student-projects/${project}`],
      ["public-portfolio", `/demo/students/${owner}/portfolio`],
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expect(
        page.getByText("Загрузка данных", { exact: true }),
      ).toHaveCount(0);
      if (name === "work-form" || name === "project-form") {
        await expect(
          page.getByLabel("Название", { exact: true }),
        ).toBeVisible();
        const field = await page
          .getByLabel("Подробное описание", { exact: true })
          .boundingBox();
        expect(field!.width).toBeGreaterThan(width < 400 ? 180 : 250);
      }
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
      if (name === "catalog" && width === 320) {
        const pager = page.getByRole("navigation", { name: "Страницы списка" });
        const previous = await pager
          .getByRole("button", { name: "Назад", exact: true })
          .boundingBox();
        const next = await pager
          .getByRole("button", { name: "Далее", exact: true })
          .boundingBox();
        expect(Math.abs(previous!.y - next!.y)).toBeLessThanOrEqual(1);
      }
      if (width === 320 || width === 1280)
        await page.screenshot({
          path: `test-results/screenshots/day4-${width}-${name}.png`,
          fullPage: true,
        });
      if (
        width < 760 &&
        ["portfolio", "work-form", "project-form"].includes(name)
      ) {
        const menu = page.getByRole("button", { name: "Разделы", exact: true });
        await menu.focus();
        await page.keyboard.press("Enter");
        await expect(menu).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape");
        await expect(menu).toBeFocused();
      }
    }
  }
});
