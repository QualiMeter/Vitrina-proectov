# Frontend CI и подготовка CD

## Локальные проверки

Используйте Node.js 22 LTS и npm. После получения изменений выполните:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

`npm run test` запускает unit и component тесты один раз, `npm run test:watch` — в режиме разработки. `npm run test:e2e` проверяет заранее собранный `dist/` через локальный Vite preview webServer на `127.0.0.1:4173`; сначала выполните `npm run build`. Backend и внешние сервисы не требуются. Сервер запускается автоматически и закрывается Playwright после тестов.

## Структура тестов и coverage

- `src/**/*.test.tsx` — Vitest и React Testing Library для существующих UI компонентов. `src/test/setup.ts` подключает jest-dom и очистку DOM между тестами.
- `e2e/smoke.spec.ts` — Chromium smoke тесты доступности главной страницы, навигации, реализованных маршрутов, мобильного меню, ширины 375 px, неизвестного маршрута и необработанных ошибок JavaScript.
- `vitest.config.ts` — jsdom и V8 coverage без минимального порога. Из отчёта исключены тесты, setup, generated и config файлы, входной файл приложения, заглушки API и демонстрационные данные. Покрытие относится к UI коду, где есть проверяемое поведение.

После `npm run test:coverage` сводка выводится в терминал, подробный отчёт находится в `coverage/index.html`, а `coverage/lcov.info` пригоден для внешнего анализатора. Папка `coverage/` не коммитится. Coverage показывает пробелы в тестировании, но процент сам по себе не заменяет проверку сценариев.

## GitHub Actions

`.github/workflows/frontend-ci.yml` запускается для PR и push в `frontend` и `main`, а также вручную. Jobs независимы, используют `npm ci`, npm cache, Node.js 22 LTS и доступ только на чтение к содержимому репозитория:

| Check | Что выполняет | Artifact |
| --- | --- | --- |
| `quality` | ESLint и TypeScript | — |
| `unit-tests` | Vitest и coverage | `frontend-coverage` |
| `build` | Production build Vite | `frontend-dist` |
| `e2e` | Production build, установка Chromium с системными библиотеками, Playwright | `frontend-playwright-report` при ошибке |

Ненулевой код любой команды завершает соответствующий job с ошибкой. Для PR новые запуски отменяют устаревшие. Workflow не содержит секретов и не выполняет деплой.

Artifacts доступны на странице репозитория **Actions → Frontend CI → нужный запуск → Artifacts**. При падении E2E скачайте `frontend-playwright-report`, откройте `playwright-report/index.html` и посмотрите screenshot и trace в `test-results/`. Локально можно открыть trace командой `npx playwright show-trace <путь-к-trace.zip>`. Сначала проверьте лог упавшего шага: он содержит название теста и ошибку.

## Правила для новых тестов

Тестируйте реализованное поведение и пользовательские роли/названия элементов. Используйте React Testing Library и `user-event` для действий. Новые маршруты и ключевые публичные сценарии добавляйте в Playwright smoke тесты. Не привязывайте тесты к реальному backend, сторонним сервисам, случайным задержкам или внутренней CSS разметке, если она не часть проверяемого поведения. Для будущих API сценариев используйте контролируемые ответы только после появления утверждённого контракта.

## Required status checks

Владелец репозитория должен включить branch protection или ruleset для `frontend`: требовать PR, актуальную ветку перед merge и успешные checks `quality`, `unit-tests`, `build`, `e2e` из **Frontend CI**. GitHub предложит имена checks после запуска workflow. Также назначьте обязательный review техлида согласно `CONTRIBUTING.md`. До включения защиты красный CI сам по себе не блокирует merge.

## Vercel Git Integration и окружения

Репозиторий `QualiMeter/Vitrina-proectov` уже подключён к Vercel. Текущая **Production Branch — `frontend`**; push в неё запускает production-деплой через Git Integration. PR получают Preview deployment. Этот workflow выполняет только проверки и не дублирует деплой.

Для существующего проекта проверьте настройки Vite: корневой каталог репозитория, install command `npm ci`, build command `npm run build`, output directory `dist`. `vercel.json` отправляет прямые запросы к клиентским маршрутам в `index.html`, чтобы React Router обработал их в браузере. Не импортируйте репозиторий повторно и не меняйте Production Branch в рамках этого PR.

Для каждого PR откройте Preview URL из Vercel и проверьте главную страницу, прямое открытие и обновление `/university`, `/mentor`, `/admin`, неизвестный маршрут и мобильную ширину 375 px. Preview может быть защищён Vercel Authentication; используйте доступ владельца проекта для ручной проверки.

При появлении утверждённого API контракта добавляйте необходимые переменные в **Project Settings → Environment Variables** с нужным scope для Preview и Production. Сейчас frontend не требует дополнительных переменных. Не храните значения и секреты в репозитории: `VITE_` переменные попадают в клиентскую сборку и не подходят для секретов.

Для production-деплоев из `frontend` настройте в Vercel **Deployment Checks** на обязательные GitHub checks и защитите `frontend` правилами выше. Тогда изменения не попадут на production-домен до успешных проверок. Будущий переход на monorepo и другая схема релизов пока не утверждены; менять ветки и окружения по этому документу не требуется.
