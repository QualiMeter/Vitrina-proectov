# Развёртывание Vitrina на Ubuntu 26.04

Инструкция использует Docker Compose для API, PostgreSQL, Redis и MinIO; Nginx и Certbot работают на хосте. Замените `vitrina.example.com` на ваш домен и направьте DNS A/AAAA на IP сервера.

## 1. Подготовка сервера

**На сервере, от root:**

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx ufw
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $VERSION_CODENAME stable" > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker nginx
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Проверьте DNS: `dig +short vitrina.example.com`.

## 2. Загрузка проекта

**На локальном компьютере:** распакуйте архив и передайте папку `vitrina` на сервер (пример для SSH-пользователя `deploy`):

```bash
scp -r vitrina deploy@SERVER_IP:/home/deploy/
```

**На сервере, от root:**

```bash
mkdir -p /var/www/vitrina
rsync -a --delete /home/deploy/vitrina/ /var/www/vitrina/
chown -R root:root /var/www/vitrina
cd /var/www/vitrina/deploy
cp .env.example .env
chmod 600 .env
nano .env
```

Замените пароль PostgreSQL (пользователь БД — `postgres`), пароль MinIO, SMTP-параметры, `FRONTEND_ORIGIN`, `FRONTEND_BASE_URL`. Секрет можно сгенерировать: `openssl rand -base64 48`.

## 3. Запуск контейнеров

**На сервере, от root:**

```bash
cd /var/www/vitrina/deploy
docker compose up -d --build
docker compose ps
docker compose logs -f api
curl -i http://127.0.0.1:5080/health
```

API опубликован только на `127.0.0.1:5080`; PostgreSQL, Redis и MinIO не открыты наружу.

**Важно о схеме БД:** текущий bootstrap использует EF Core `EnsureCreated` при старте, чтобы новая база создалась автоматически. Это не механизм версионирования схемы. До эксплуатации с важными данными необходимо добавить EF Core migrations, проверить их на копии БД и перейти на `Database.Migrate()`. Не смешивайте `EnsureCreated` и migrations на одной базе.

## 4. Nginx и HTTPS

**На сервере, от root:**

```bash
cp /var/www/vitrina/deploy/nginx/vitrina.conf /etc/nginx/sites-available/vitrina
nano /etc/nginx/sites-available/vitrina
ln -sfn /etc/nginx/sites-available/vitrina /etc/nginx/sites-enabled/vitrina
nginx -t
systemctl reload nginx
certbot --nginx -d vitrina.example.com
curl -I https://vitrina.example.com/health
```

Перед Certbot замените домен в конфигурации. Production cookie использует `Secure`, `HttpOnly`, `SameSite=Lax` и `__Host-`.

## 5. Первый сотрудник университета

Публичная регистрация всегда создаёт обычного студента. Для первого сотрудника университета:

1. Зарегистрируйте аккаунт через сайт.
2. Подтвердите email по письму.
3. **На сервере, от root**, откройте SQL внутри PostgreSQL:

```bash
cd /var/www/vitrina/deploy
docker compose exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

4. Выполните содержимое `deploy/bootstrap-university-staff.sql`, заменив email на адрес созданного аккаунта. Либо выполните SQL-файл с хоста:

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /var/www/vitrina/deploy/bootstrap-university-staff.sql
```

5. Выйдите из аккаунта и войдите снова. Не выдавайте `PLATFORM_ADMIN` обычным сотрудникам; шаблон присваивает `UNIVERSITY_STAFF` и ограниченный набор permissions.

## 6. Обновление

**На сервере, от root:**

```bash
mkdir -p /var/backups/vitrina
cd /var/www/vitrina/deploy
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /var/backups/vitrina/db-$(date +%F-%H%M).sql
```

После передачи новых файлов, если это обновление с Stage 2, сначала примените SQL-изменения.

**На сервере, от root:**

```bash
cd /var/www/vitrina/deploy
docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /var/www/vitrina/deploy/postgres/003_stage3_execution_submissions_files.sql
```

Для новой пустой БД этот скрипт вручную применять не нужно. `EnsureCreated` не обновляет существующую схему.

После успешного применения SQL (или сразу для новой БД):

```bash
cd /var/www/vitrina/deploy
docker compose up -d --build
docker compose logs --tail=200 api
```

Резервная копия SQL не содержит объекты MinIO; volumes файлового хранилища резервируются отдельно.

## 7. Особенности Stage 3

- Для регистрации и приглашений нужен рабочий SMTP.
- Приглашение компании одноразовое, токен хранится в БД только в виде SHA-256-хеша, срок — 7 дней.
- Справочники читаются из `ReferenceEntries`; API управления справочниками пока отсутствует.
- Stage 3 подключает приватные файлы материалов и сдач к MinIO. MinIO не должен публиковаться в интернет; скачивание идёт через авторизованный API.
- Загрузка ограничена настройкой `STORAGE_MAX_FILE_SIZE_BYTES` (по умолчанию 25 MiB), лимитом multipart и Kestrel в API и `client_max_body_size 26m` в Nginx. При увеличении лимита согласованно увеличьте эти значения. Проверяются расширение и базовая сигнатура. Антивирусного сканирования в этом этапе нет; для production следует добавить scanner/quarantine pipeline.
- Redis пока не задействован в runtime.
- Scalar/OpenAPI доступны только в Development. Не открывайте их публично в production.


## Обновление до Stage 4

Если сервер уже работает на Stage 3, перед обновлением.

**На сервере, от root:**

1. Создайте резервную копию PostgreSQL и MinIO.
2. Загрузите и распакуйте архив Stage 4 поверх отдельного каталога релиза.
3. Выполните SQL от пользователя PostgreSQL с правами владельца базы.

**На сервере, от root:**

```bash
cd /var/www/vitrina/deploy
docker compose exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < /var/www/vitrina/deploy/postgres/004_stage4_evaluation_results.sql
```

4. Пересоберите API и frontend из каталога deploy.

**На сервере, от root:**

```bash
docker compose up -d --build api frontend
docker compose ps
docker compose logs -f api
```

SQL Stage 4 запускается только после Stage 3 (`003_stage3_execution_submissions_files.sql`). Для чистой новой базы таблицы создаются из текущей EF-модели при первом запуске; вручную запускать `004` не требуется.


## Обновление до Stage 5

Stage 5 добавляет Redis backplane для SignalR, центр уведомлений, transactional outbox, фонового обработчика событий, readiness/liveness endpoints и EF Core-миграцию с версионируемым SQL-скриптом.

### Существующий сервер Stage 4

1. Сделайте резервные копии PostgreSQL и MinIO.
2. Замените файлы проекта содержимым нового архива, сохранив `deploy/.env`.
3. Убедитесь, что `DATABASE_BOOTSTRAP_SCHEMA=false` и `DATABASE_ALLOW_PRODUCTION_BOOTSTRAP=false`.
4. Запустите обновление:

```bash
cd /var/www/vitrina/deploy
docker compose up -d --build api frontend
docker compose ps
docker compose logs --tail=200 api
```

При старте API применит EF Core-миграцию `202611010001_Stage5NotificationsOutbox` (SQL-файл `005_stage5_notifications_outbox.sql`). Redis должен быть запущен и доступен в сети Compose.

### Новая пустая база данных

При первой установке с пустой базой временно задайте в `deploy/.env`:

```dotenv
DATABASE_BOOTSTRAP_SCHEMA=true
DATABASE_ALLOW_PRODUCTION_BOOTSTRAP=true
```

Запустите API один раз, дождитесь сообщения об успешном применении миграции, затем верните оба значения в `false` и перезапустите API. Это bootstrap существующей модели, а не режим для последующих обновлений. Не запускайте bootstrap против базы с данными.

### Проверка состояния

- `https://ВАШ-ДОМЕН/health/live` — процесс API запущен.
- `https://ВАШ-ДОМЕН/health/ready` — API может выполнить запрос к PostgreSQL.
- SignalR hub: `/hubs/notifications`. Клиент должен подключаться с cookie-сессией.
- REST уведомлений: `/api/v1/notifications`, `/api/v1/notifications/unread-count`, `POST /api/v1/notifications/{id}/read`, `POST /api/v1/notifications/read-all`.

### Проверка сборки и тестов

На локальном компьютере с .NET 10:

```bash
dotnet restore backend/Vitrina.Api/Vitrina.Api.csproj
dotnet build backend/Vitrina.Api/Vitrina.Api.csproj -c Release
dotnet test backend/Vitrina.Api.Tests/Vitrina.Api.Tests.csproj -c Release
```

Не публикуйте порт Redis, PostgreSQL или MinIO в интернет. Доступ к ним должен оставаться только внутри Docker-сети.


## Исправление схемы результатов и пользователь PostgreSQL

В этой версии добавлена EF Core-миграция `202611010002_CaseAwardsPublications`. Она создаёт таблицы `CaseAwards` и `CaseResultPublications`, которые использует модуль публикации результатов. На уже обновлённой Stage 5 базе миграция применится автоматически при старте API. Не запускайте её вручную, если EF Core уже отметил её применённой.

Для новых установок в `.env` используется `POSTGRES_USER=postgres`. Если volume PostgreSQL был создан предыдущей версией с `POSTGRES_USER=vitrina`, изменение `.env` само по себе не переименует существующую роль: переменные `POSTGRES_USER` применяются только при первой инициализации volume. Для стандартного предыдущего Compose-варианта, где суперпользователем был `vitrina`, сначала подключитесь к существующей БД от старого пользователя (при старом Compose-файле):

```bash
cd /var/www/vitrina/deploy
docker compose exec postgres psql -U vitrina -d vitrina
```

В открытой консоли PostgreSQL переименуйте роль — так сохранятся владельцы базы и таблиц (замените пароль):

```sql
ALTER ROLE vitrina RENAME TO postgres;
ALTER ROLE postgres WITH PASSWORD 'REPLACE_WITH_STRONG_PASSWORD';
```

После этого задайте этот же пароль в `POSTGRES_PASSWORD` в `.env` и пересоздайте сервисы. Если роль `postgres` уже существует, не выполняйте `RENAME`: проверьте владельцев БД и таблиц и предоставьте этому логину необходимые права/владение.

Не удаляйте существующий volume и не запускайте `docker compose down -v` при обновлении.


## Исправление Stage 5 для ошибок CaseAward и CaseResultPublication

Если при сборке появлялись `CS0246` для `CaseAward` и `CaseResultPublication`, эта версия добавляет обе сущности в `Domain/Entities.cs`. Для уже существующей базы Stage 5 добавлена миграция `202611010002_CaseAwardsPublications`, которая создаёт необходимые таблицы и индексы. Она запускается автоматически при старте API после миграции Stage 5. Ручной запуск SQL не требуется.
