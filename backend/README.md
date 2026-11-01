# Vitrina Backend (.NET 10)

Модульный backend на ASP.NET Core 10, PostgreSQL и EF Core. Единый API-контракт: `../docs/api/openapi.yaml`.

## Реализовано

- Auth: opaque HttpOnly cookie sessions, CSRF double-submit, email verification and password reset.
- Companies: company creation, private access, paginated staff registry.
- Company invitations: create/list/preview/accept, single-use token hash, seven-day expiry, email delivery, existing/new account acceptance.
- Teams and applications: team membership/invitations/captain transfer, application lifecycle, selection and history.
- Student profiles: versioned self-edit, public profile, company-scoped academic profile, reference-data read endpoint and participation history.
- Execution: case stages/checkpoints, controlled execution start, participant workspace, company dashboard, manual selection, checkpoint/final intake closure and team exclusion.
- Submissions: immutable numbered versions, expected-last-version check, idempotency key, links and private file attachments.
- Files: private MinIO uploads, signature/size validation, metadata, stage-material binding and authorization on every download.
- NDA: versioned case policy, pre-submit preview and atomic captain/solo acceptance during application submission.

Смотрите `API-COVERAGE.md` для точных границ реализации и известных ограничений.

## Local run

Requires .NET SDK 10 and Docker Compose. For Visual Studio, open the repository-root `Vitrina.slnx` (Visual Studio 2022 17.14+).

```bash
docker compose -f backend/docker-compose.yml up -d postgres redis minio
dotnet restore Vitrina.slnx
dotnet run --project backend/Vitrina.Api/Vitrina.Api.csproj
```

In Development, `/scalar/v1` and `/openapi/v1.json` are enabled.

## Server deployment

Подробная инструкция Ubuntu 26.04, Docker Compose, PostgreSQL, Redis, MinIO, Nginx, HTTPS and frontend deployment: `../deploy/README-SERVER-RU.md`.

## Configuration

Use environment variables in production:

- `ConnectionStrings__Default`
- `Cors__Origins__0`
- `Email__Host`, `Email__Port`, `Email__UserName`, `Email__Password`, `Email__From`, `Email__FrontendBaseUrl`
- `Storage__Endpoint`, `Storage__AccessKey`, `Storage__SecretKey`, `Storage__Bucket`, `Storage__UseSsl`, `Storage__MaxFileSizeBytes`

Do not use development passwords in production. SMTP is required for email confirmation and company invitations.

## Database note

The current first-start bootstrap uses `EnsureCreated`. Before evolving a production database, add EF Core migrations, test them against a copy, then switch startup to `Database.Migrate()`. Never mix `EnsureCreated` with migrations on the same database.


## Stage 5: production infrastructure

- Redis distributed-cache provider and the SignalR backplane are registered when `ConnectionStrings:Redis` is configured; the current notification delivery path uses the backplane, while persisted notification data remains in PostgreSQL.
- Notifications are persisted in PostgreSQL and delivered through an outbox worker to `/hubs/notifications`.
- Notification REST endpoints are available under `/api/v1/notifications`.
- Database schema updates are EF Core migrations backed by versioned SQL resources. The Stage 5 migration is `Data/Migrations/005_stage5_notifications_outbox.sql` and is applied at startup.
- Automatic schema creation is disabled by default. For a brand-new empty database only, set `Database__BootstrapSchema=true` for the first start; in Production this additionally requires `Database__AllowProductionBootstrap=true`. Turn both flags off after initialization. Existing Stage 4 installations should keep bootstrap disabled.
- Health endpoints: `/health/live` (process liveness) and `/health/ready` (PostgreSQL readiness).

The Stage 5 unit and PostgreSQL-backed integration tests are in `Vitrina.Api.Tests`. The integration tests start PostgreSQL through Testcontainers; run them with Docker available using `dotnet test backend/Vitrina.Api.Tests/Vitrina.Api.Tests.csproj`.


## NuGet package management

All direct NuGet package versions are defined centrally in the `Directory.Packages.props`. Do not add `Version` attributes to `PackageReference` elements. Update the central versions together when upgrading dependencies. The selected versions are stable releases compatible with .NET 10; .NET 11 preview packages are intentionally excluded.
