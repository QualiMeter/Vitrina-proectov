# Участие в разработке

1. Обновите `main` и создайте от неё временную ветку `feat/<scope>` или `chore/<scope>`.
2. Делайте обычные функциональные PR в `main`. Заполните шаблон PR, приложите скриншоты изменений интерфейса и укажите ограничения.
3. Для изменений frontend из каталога `frontend/` запустите `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build` и `npm run test:e2e` перед PR. Дождитесь автоматических проверок `quality`, `unit-tests`, `build` и `e2e`. Подробности — в `docs/ci-cd.md`.
4. Запросите и дождитесь code review техлида по правилу команды. Rulesets `Main Integration Protection` и `Frontend Protection` допускают 0 approvals, поэтому review технически не обязателен. Не выполняйте прямой push в `main` или `frontend` и не включайте автоматический merge.
5. Используйте токены из `frontend/src/app/styles/tokens.css` и существующий UI kit. Новые визуальные паттерны добавляйте в общую систему после согласования с командой.
6. Не придумывайте backend endpoints и не имитируйте авторизацию. Новые контракты берите из согласованного OpenAPI. Разрешения проверяйте на уровне действия и объекта; сервер остаётся источником истины.
7. Не коммитьте секреты, `.env` и персональные данные.

## Выпуск в Production

После review объедините функциональный PR в `main` и проверьте интеграционную сборку. Для релиза создайте отдельный PR из `main` в `frontend`, дождитесь четырёх проверок и review, затем объедините PR. Vercel автоматически публикует Production только из `frontend`; push в `main` не является Production-релизом. Не вносите изменения напрямую в `frontend`.

Git-ветки содержат снимки всего репозитория. Каталог `backend/` в Production-ветке не запускает серверную часть: Vercel Root Directory — `frontend`. Backend-приложение, его CI и деплой появятся отдельно после согласования архитектуры.

Rulesets `Main Integration Protection` и `Frontend Protection` требуют PR и успешные проверки `quality`, `unit-tests`, `build`, `e2e` для `main` и `frontend` соответственно, запрещают force push и удаление веток. `CODEOWNERS` появится после определения GitHub-аккаунта реального техлида; число обязательных approvals рассматривается отдельно.
