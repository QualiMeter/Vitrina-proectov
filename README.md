# Витрина ИТ-проектов УУНиТ

Репозиторий АИС для совместной проектной работы студентов, университета и компаний. React frontend находится в `frontend/`, backend на ASP.NET Core 10 — в `backend/`. Frontend содержит публичную стартовую страницу, дизайн-систему и навигационную структуру кабинетов; часть служебных страниц пока остаётся заглушками. Backend реализует авторизацию, компании, кейсы, команды, заявки, выполнение проектов, сдачу работ, файлы, NDA, оценивание, результаты и уведомления.
Frontend B, первый день (FB-01–FB-06): добавлены студенческий кабинет, профиль, публичная карточка, участия и блок проектов для FE-A. Демонстрация — `/demo/student`, реальные маршруты — `/student`. Backend-интеграция не подтверждена; зависимости и проверки описаны в [передаче первого дня](docs/frontend-b-day1.md).

Репозиторий АИС для совместной проектной работы студентов, университета и компаний. Работающий React frontend находится в `frontend/`; каталог `backend/` зарезервирован для будущего ASP.NET Core приложения. Сейчас реализованы публичная стартовая страница, единая дизайн-система, навигационная структура кабинетов и базовый API/permissions слой. Служебные страницы являются заглушками, бизнес-операции и авторизация не подключены.

## Стек и запуск

React 19, TypeScript (strict), Vite, React Router, CSS design tokens.

```bash
cd frontend
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
```

Frontend и backend — отдельные приложения. Для backend добавлено решение Visual Studio `Vitrina.slnx`; корневого `package.json` и npm workspaces нет.

## Структура

```text
frontend/
  src/               React-приложение, маршруты, компоненты и API-клиент
  e2e/               Playwright smoke-тесты
  public/            статические ресурсы
  package.json       frontend-команды и зависимости
  vercel.json        SPA rewrites для React Router
backend/
  Vitrina.Api/       ASP.NET Core 10 API
  Vitrina.Api.Tests/ unit- и PostgreSQL integration tests
  Directory.Packages.props  централизованные версии NuGet
Vitrina.slnx          Visual Studio solution
.github/workflows/    GitHub Actions
docs/                 общая документация
```

Страницы университетского сотрудника, куратора и администратора добавляются в `frontend/src/pages/university`, `frontend/src/pages/mentor` и `frontend/src/pages/admin`; бизнес-функции размещаются в `frontend/src/features` по предметной области. Создавайте эти каталоги по мере появления реализации, без пустых файлов. Общие элементы остаются в `frontend/src/components`.

## Разработка страниц и функций

1. Создайте страницу в нужном `frontend/src/pages/<area>/<feature>` и подключите её в `frontend/src/app/router/router.tsx` вместо `PlaceholderPage`.
2. Состояние и действия предметной области держите в `frontend/src/features/<feature>`. Универсальные кнопки, поля и состояния берите из `frontend/src/components/ui` и `frontend/src/components/feedback`.
3. Цвета, отступы и радиусы берите из `frontend/src/app/styles/tokens.css`. **Все frontend-разработчики обязаны придерживаться общей дизайн-системы и не создавать конкурирующие наборы цветов, кнопок и отступов.**
4. Для новых API-запросов используйте `apiRequest<T>` только после утверждения backend-контракта. `VITE_API_BASE_URL` задаётся окружением; его пример находится в `frontend/.env.example`. Токены и приватные данные не храните в `localStorage`.
5. Разрешения приходят от backend. `PermissionGate` принимает набор разрешений и при необходимости разрешение действия над конкретным объектом. Наличие роли само по себе не разрешает операцию. Маршрут и API должны дополнительно проверяться сервером.

## Ветки и review

`main` — основная интеграционная и Production-ветка для frontend и backend. Создавайте временные ветки `feat/<scope>` или `chore/<scope>` от актуальной `main` и направляйте PR в `main`. После code review и успешных обязательных проверок объединение PR запускает Production Deployment фронтенда в Vercel. Review техлида для бизнес-изменений — правило команды, хотя GitHub Ruleset сейчас допускает 0 обязательных approvals. **Любой PR с изменениями `frontend/` мержит только `@Mouse-ai`; backend-владелец вправе самостоятельно мержить свои backend/API PR после проверок и предметного review.** Политика владельцев описана в `CONTRIBUTING.md`. Подробности — в [CONTRIBUTING.md](CONTRIBUTING.md).

Vercel использует Root Directory `frontend/` и не разворачивает `backend/`. Backend собирается и тестируется отдельным GitHub Actions workflow; серверный деплой выполняется через Docker Compose. Ветка `frontend` сохранена как историческая и больше не используется для разработки и релизов; новые PR в неё не направляем.

GitHub Ruleset `Main Integration Protection` защищает `main`: требует PR и успешные проверки `quality`, `unit-tests`, `build`, `e2e`, запрещает force push и удаление ветки. Прежний `Frontend Protection` остаётся на неиспользуемой ветке `frontend` до отдельной очистки. `CODEOWNERS` добавим после определения реального GitHub-аккаунта техлида.

## Бренд

Цвета и шрифт сверены с [официальным брендбуком УУНиТ](https://uust.ru/brandbook/) и [гайдбуком](https://uust.ru/static/New_files_ugatu/images/redesign/brandbook/guidebook.pdf). `frontend/public/uust-logo.png` — оригинальная основная версия PNG с сайта университета, без изменения изображения. Golos Text подключён как веб-шрифт через Google Fonts с системным sans-serif fallback. Лицензия Golos Text — SIL Open Font License 1.1.

Демонстрационные проекты находятся в `frontend/src/pages/public/HomePage/mockProjects.ts` и не являются реальными данными.

## Backend (.NET 10)

The complete backend project and its tests are under `backend/`. Open `Vitrina.slnx` in Visual Studio 2022 17.14 or newer (or Visual Studio 2026) with the .NET 10 SDK installed. The solution includes `Vitrina.Api` and `Vitrina.Api.Tests`.

### Run from Visual Studio

1. Start the local infrastructure from the repository root:

   ```bash
   docker compose -f backend/docker-compose.yml up -d postgres redis minio
   ```

2. Open `Vitrina.slnx` in Visual Studio.
3. Set `Vitrina.Api` as the startup project.
4. Select the `Vitrina.Api` launch profile and press F5. The API reference opens at `http://localhost:5080/scalar/v1`.
5. The local launch profile enables one-time schema bootstrap for the Development environment. Do not copy that setting to production.

To run tests, use Test > Run All Tests or:

```bash
dotnet test Vitrina.slnx
```

The PostgreSQL integration tests require Docker because they use Testcontainers. Package versions are centrally managed in `backend/Directory.Packages.props`.


## Этап 4 — оценивание и публикация результатов

Stage 4 реализует переход `FINAL_CLOSED -> EVALUATING -> COMPLETED`, отзывы компании по допущенным заявкам, необязательные оценки, ручные призовые места и номинации, публичную публикацию результатов и персональный просмотр своего отзыва. Правила конкурса (`allowSharedPlaces`, `prizePlaceCount`, `nominationNames`, optional `scoreRange`) задаются в черновике кейса и после отправки кейса на модерацию не редактируются.

Для обновления существующей БД Stage 3 примените `deploy/postgres/004_stage4_evaluation_results.sql`. Подробные команды находятся в `deploy/README-SERVER-RU.md`.


## Stage 5

Stage 5 adds persisted notifications, SignalR delivery through an outbox, Redis integration, database readiness/liveness checks, SQL migration `005_stage5_notifications_outbox.sql`, security response headers and backend CI tests. Server upgrade notes are in `deploy/README-SERVER-RU.md`.
