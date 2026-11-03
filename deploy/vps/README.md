# Автоматический деплой Vitrina на VPS через GitHub Actions

Деплой запускается при каждом `push` в ветку `main`. До подключения к серверу GitHub Actions собирает и проверяет backend и frontend. Если проверки успешны, workflow отправляет готовые артефакты на VPS и запускает серверный скрипт.

## Фактическая конфигурация сервера

Настройки соответствуют текущему `vitrina.service`:

- Backend: `/var/www/vitrina/backend/Vitrina.Api.dll`
- Рабочий каталог backend: `/var/www/vitrina/backend`
- Пользователь процесса: `vitrinasvc:vitrinasvc`
- systemd unit: `vitrina`
- Переменные окружения: `/etc/vitrina/vitrina.env` и `/opt/vitrina-infra/.env`
- Frontend build: `/var/www/vitrina/frontend/dist`
- Проверка готовности API: `http://127.0.0.1:5100/health/ready`
- PostgreSQL backup: `/usr/local/sbin/vitrina-backup-postgresql`

Деплой не перезаписывает `.env`, `/var/lib/vitrina`, PostgreSQL, Redis или данные RustFS. Перед заменой файлов запускается существующий скрипт резервного копирования PostgreSQL. EF Core применяет миграции при старте API.

При обновлении существующего окружения проверьте переменные в `/etc/vitrina/vitrina.env` и `/opt/vitrina-infra/.env`: `Email__Routes__EmailConfirmationPath=/verify-email`, `Email__Routes__PasswordResetPath=/reset-password`, `Email__Routes__CompanyInvitationPath=/accept-invitation`. После изменения перезапустите API.

## 1. Установить серверный скрипт

Сначала добавьте файлы из этого архива в репозиторий и отправьте их в `main`. Затем на своём ПК из корня репозитория скопируйте скрипт на сервер:

```bash
scp deploy/vps/vitrina-deploy.sh root@188.120.228.58:/usr/local/sbin/vitrina-deploy
```

На сервере под `root`:

```bash
chown root:root /usr/local/sbin/vitrina-deploy
chmod 0750 /usr/local/sbin/vitrina-deploy

install -d -o deploy -g deploy -m 0750 /var/tmp/vitrina-deploy
install -d -o root -g root -m 0750 /var/www/vitrina/releases
```

Скрипт использует существующий `/usr/local/sbin/vitrina-backup-postgresql`. Если этого файла нет или он не исполняемый, сначала проверьте установку ежедневных резервных копий.

## 2. Разрешить deploy запускать только деплой

На сервере под `root`:

```bash
cat > /etc/sudoers.d/vitrina-deploy <<'SUDOERS'
deploy ALL=(root) NOPASSWD: /usr/local/sbin/vitrina-deploy
SUDOERS

chmod 0440 /etc/sudoers.d/vitrina-deploy
visudo -cf /etc/sudoers.d/vitrina-deploy
```

Скрипт должен оставаться доступным на запись только `root`. Пользователю `deploy` выдаётся право запускать только эту команду, а не произвольные команды от root.

## 3. Создать отдельный SSH-ключ для GitHub Actions

На доверенном локальном ПК (не на сервере и не в репозитории):

```bash
ssh-keygen -t ed25519 -C "github-actions-vitrina-deploy" -f vitrina_github_deploy
```

Добавьте содержимое `vitrina_github_deploy.pub` отдельной строкой в `/home/deploy/.ssh/authorized_keys` на сервере. На сервере под `root` подготовьте каталог и файл, если их ещё нет:

```bash
install -d -o deploy -g deploy -m 0700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys
```

Не перезаписывайте существующий `authorized_keys`: добавьте новый публичный ключ в конец файла.

Приватный ключ `vitrina_github_deploy` никому не отправляйте и не добавляйте в Git. Его содержимое будет сохранено в GitHub Secret.

## 4. Проверить SSH host key и добавить настройки GitHub

На сервере под `root` получите отпечаток публичного host key:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

На доверенном ПК получите строку known_hosts:

```bash
ssh-keyscan -p 22 -t ed25519 188.120.228.58
```

Сверьте отпечаток из `ssh-keyscan` с отпечатком, полученным непосредственно на сервере. Только после сверки используйте строку `ssh-keyscan`.

В GitHub откройте **Settings → Secrets and variables → Actions** и добавьте Repository variables:

| Variable | Значение |
|---|---|
| `DEPLOY_HOST` | `188.120.228.58` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_PORT` | `22` |

Добавьте Repository secrets:

| Secret | Значение |
|---|---|
| `DEPLOY_SSH_KEY` | Полное содержимое приватного файла `vitrina_github_deploy` |
| `DEPLOY_KNOWN_HOSTS` | Проверенная строка host key для `188.120.228.58` |

## 5. Включить workflow

Добавьте в репозиторий файлы:

- `.github/workflows/deploy-production.yml`
- `deploy/vps/vitrina-deploy.sh`
- `deploy/vps/README.md`

Сделайте commit и push в `main`. Затем откройте **GitHub → Actions → Deploy Vitrina to production**.

Workflow выполняет:

1. Restore, build, tests и publish backend.
2. Установку npm-зависимостей, lint, typecheck, unit tests, build и E2E frontend.
3. Передачу собранных артефактов по SSH.
4. PostgreSQL backup на сервере.
5. Замену файлов backend и frontend.
6. Перезапуск `vitrina` и ожидание `/health/ready`.

При ошибке после начала замены файлов скрипт пытается вернуть предыдущие backend/frontend файлы и запустить прежнюю версию API. База данных автоматически не восстанавливается: автоматический restore мог бы удалить пользовательские данные. Резервная копия PostgreSQL остаётся доступна для ручного восстановления.

## 6. Проверить результат

На сервере под `root`:

```bash
systemctl status vitrina --no-pager
curl -fsS http://127.0.0.1:5100/health/ready
```

Предыдущие версии файлов сохраняются в `/var/www/vitrina/releases/`.
