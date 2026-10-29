# Витрина ИТ-проектов УУНиТ

Frontend-основа АИС для совместной проектной работы студентов, университета и компаний. Сейчас реализованы публичная стартовая страница, единая дизайн-система, навигационная структура кабинетов и базовый API/permissions слой. Служебные страницы являются заглушками, бизнес-операции и авторизация не подключены.

## Стек и запуск

React 19, TypeScript (strict), Vite, React Router, CSS design tokens.

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
```

## Структура

```text
src/
  app/router/         маршруты
  app/styles/         глобальные стили и design tokens
  pages/public/       публичные страницы и их mock-данные
  pages/              заглушки будущих кабинетов
  components/ui/      типизированный UI kit и PermissionGate
  components/layout/  публичный header и общий AppShell
  components/feedback/ общие состояния
  api/                HTTP-клиент и типы будущих контрактов
  types/              общие типы разрешений
```

Страницы университетского сотрудника, куратора и администратора добавляются в `pages/university`, `pages/mentor` и `pages/admin`; бизнес-функции размещаются в `features` по предметной области. Создавайте эти каталоги по мере появления реализации, без пустых файлов. Общие элементы остаются в `components`.

## Разработка страниц и функций

1. Создайте страницу в нужном `pages/<area>/<feature>` и подключите её в `src/app/router/router.tsx` вместо `PlaceholderPage`.
2. Состояние и действия предметной области держите в `features/<feature>`. Универсальные кнопки, поля и состояния берите из `components/ui` и `components/feedback`.
3. Цвета, отступы и радиусы берите из `src/app/styles/tokens.css`. **Все frontend-разработчики обязаны придерживаться общей дизайн-системы и не создавать конкурирующие наборы цветов, кнопок и отступов.**
4. Для новых API-запросов используйте `apiRequest<T>` только после утверждения backend-контракта. `VITE_API_BASE_URL` задаётся окружением; его пример находится в `.env.example`. Токены и приватные данные не храните в `localStorage`.
5. Разрешения приходят от backend. `PermissionGate` принимает набор разрешений и при необходимости разрешение действия над конкретным объектом. Наличие роли само по себе не разрешает операцию. Маршрут и API должны дополнительно проверяться сервером.

## Ветки и review

`main` — стабильная ветка, `frontend` — интеграционная ветка frontend. Feature-ветки создаются от `frontend` и отправляются PR обратно в `frontend`. Перед merge требуется review техлида. Прямой push в защищённые ветки и автоматический merge не используются. Подробности — в [CONTRIBUTING.md](CONTRIBUTING.md).

Настройте branch protection для `main` и `frontend` в GitHub: обязательный PR, review техлида и успешные проверки. `CODEOWNERS` добавляется после определения реального владельца, без выдуманных аккаунтов.

## Бренд

Цвета и шрифт сверены с [официальным брендбуком УУНиТ](https://uust.ru/brandbook/) и [гайдбуком](https://uust.ru/static/New_files_ugatu/images/redesign/brandbook/guidebook.pdf). `public/uust-logo.png` — оригинальная основная версия PNG с сайта университета, без изменения изображения. Golos Text подключён как веб-шрифт через Google Fonts с системным sans-serif fallback. Лицензия Golos Text — SIL Open Font License 1.1.

Демонстрационные проекты находятся в `src/pages/public/HomePage/mockProjects.ts` и не являются реальными данными.
