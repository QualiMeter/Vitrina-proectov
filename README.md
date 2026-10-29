# Витрина ИТ-проектов УУНиТ

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

Frontend и будущий backend независимы: корневого `package.json`, npm workspaces и .NET solution нет.

## Структура

```text
frontend/
  src/               React-приложение, маршруты, компоненты и API-клиент
  e2e/               Playwright smoke-тесты
  public/            статические ресурсы
  package.json       frontend-команды и зависимости
  vercel.json        SPA rewrites для React Router
backend/
  README.md          планируемый стек, без реализации
.github/workflows/     GitHub Actions
docs/                   общая документация
```

Страницы университетского сотрудника, куратора и администратора добавляются в `frontend/src/pages/university`, `frontend/src/pages/mentor` и `frontend/src/pages/admin`; бизнес-функции размещаются в `frontend/src/features` по предметной области. Создавайте эти каталоги по мере появления реализации, без пустых файлов. Общие элементы остаются в `frontend/src/components`.

## Разработка страниц и функций

1. Создайте страницу в нужном `frontend/src/pages/<area>/<feature>` и подключите её в `frontend/src/app/router/router.tsx` вместо `PlaceholderPage`.
2. Состояние и действия предметной области держите в `frontend/src/features/<feature>`. Универсальные кнопки, поля и состояния берите из `frontend/src/components/ui` и `frontend/src/components/feedback`.
3. Цвета, отступы и радиусы берите из `frontend/src/app/styles/tokens.css`. **Все frontend-разработчики обязаны придерживаться общей дизайн-системы и не создавать конкурирующие наборы цветов, кнопок и отступов.**
4. Для новых API-запросов используйте `apiRequest<T>` только после утверждения backend-контракта. `VITE_API_BASE_URL` задаётся окружением; его пример находится в `frontend/.env.example`. Токены и приватные данные не храните в `localStorage`.
5. Разрешения приходят от backend. `PermissionGate` принимает набор разрешений и при необходимости разрешение действия над конкретным объектом. Наличие роли само по себе не разрешает операцию. Маршрут и API должны дополнительно проверяться сервером.

## Ветки и review

`main` — общая интеграционная ветка для frontend и будущего backend. Создавайте временные feature-ветки от `main` и направляйте обычные PR в `main`. `frontend` — стабильная Production-ветка Vercel: после проверки интеграционной сборки выпускайте изменения отдельным PR из `main` в `frontend`. Прямые изменения `frontend` не допускаются. Code review техлида — командное правило перед merge. Подробности — в [CONTRIBUTING.md](CONTRIBUTING.md).

До принятия PR по переходу на эту модель `main` содержала только исходную основу; PR переносит в неё актуальную структуру. Git-ветка хранит снимок всего репозитория: наличие каталога `backend/` в `frontend` не означает деплой backend на Vercel. Проект Vercel собирает только `frontend/`. Backend CI и деплой будут настроены отдельно после появления приложения и согласования архитектуры.

GitHub Ruleset `Frontend Protection` требует PR в `frontend` и успешные проверки `quality`, `unit-tests`, `build`, `e2e`. Сейчас ruleset допускает 0 approvals: review техлида ожидается по процессу команды, но технически не требуется GitHub. Аналогичная защита `main` включается после успешного выполнения этих проверок на PR в `main`; до этого прямые изменения `main` запрещены командным процессом. `CODEOWNERS` добавляется после определения реального владельца, без выдуманных аккаунтов.

## Бренд

Цвета и шрифт сверены с [официальным брендбуком УУНиТ](https://uust.ru/brandbook/) и [гайдбуком](https://uust.ru/static/New_files_ugatu/images/redesign/brandbook/guidebook.pdf). `frontend/public/uust-logo.png` — оригинальная основная версия PNG с сайта университета, без изменения изображения. Golos Text подключён как веб-шрифт через Google Fonts с системным sans-serif fallback. Лицензия Golos Text — SIL Open Font License 1.1.

Демонстрационные проекты находятся в `frontend/src/pages/public/HomePage/mockProjects.ts` и не являются реальными данными.
