# Участие в frontend-разработке

1. Обновите `frontend` и создайте от неё ветку `feat/<scope>` или `chore/<scope>`.
2. Делайте PR в `frontend`. Заполните шаблон PR, приложите скриншоты изменений интерфейса и укажите ограничения.
3. Из каталога `frontend/` запустите `npm ci`, `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build` и `npm run test:e2e` перед PR. После внедрения CI каждый frontend PR должен успешно пройти автоматические проверки `quality`, `unit-tests`, `build` и `e2e` до merge. Подробности — в `docs/ci-cd.md`.
4. Запросите и дождитесь code review техлида по правилу команды. GitHub Ruleset `Frontend Protection` пока допускает 0 approvals, поэтому review технически не обязателен. Не выполняйте прямой push в `main` или `frontend` и не включайте автоматический merge.
5. Используйте токены из `frontend/src/app/styles/tokens.css` и существующий UI kit. Новые визуальные паттерны добавляйте в общую систему после согласования с командой.
6. Не придумывайте backend endpoints и не имитируйте авторизацию. Новые контракты берите из согласованного OpenAPI. Разрешения проверяйте на уровне действия и объекта; сервер остаётся источником истины.
7. Не коммитьте секреты, `.env` и персональные данные.

Ruleset `Frontend Protection` уже требует PR и успешные проверки `quality`, `unit-tests`, `build`, `e2e` для ветки `frontend`. `main` пока не содержит актуальное frontend-приложение. `CODEOWNERS` появится после определения GitHub-аккаунта реального техлида; изменение ruleset и числа обязательных approvals рассматривается отдельно.
