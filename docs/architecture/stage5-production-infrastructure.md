# Stage 5 — Production infrastructure

## Notifications and outbox

Notifications are stored in PostgreSQL. A notification and its `notification.created` outbox message are inserted in the same transaction that publishes case results. This prevents a successful publication from being committed without its notification event being persisted.

`OutboxWorker` claims messages using a conditional update. Multiple API instances can process the same queue without intentionally claiming the same message. A worker crash leaves a lock that can be reclaimed after two minutes. Failed deliveries are retried with exponential backoff, capped at one hour.

SignalR hub: `/hubs/notifications`.

- The hub requires a valid session cookie.
- Connections are assigned to a server-side group derived from the authenticated user ID.
- Event `notification.created` contains the notification ID. Clients should refresh the REST notification list after receiving it.
- Redis is configured as the SignalR backplane when `ConnectionStrings:Redis` is set.

REST endpoints:

- `GET /api/v1/notifications?page=1&pageSize=20&unreadOnly=false`
- `GET /api/v1/notifications/unread-count`
- `POST /api/v1/notifications/{notificationId}/read`
- `POST /api/v1/notifications/read-all`

## Database schema lifecycle

Stage 5 introduces EF Core migration `202611010001_Stage5NotificationsOutbox`. The SQL body is stored in `Data/Migrations/005_stage5_notifications_outbox.sql` and embedded into the API assembly.

The API applies pending EF migrations during startup. It no longer calls `EnsureCreated` unconditionally. `EnsureCreated` is available only as an explicit one-time bootstrap controlled by `Database:BootstrapSchema`; production additionally requires `Database:AllowProductionBootstrap=true`. Both flags must be disabled after a fresh installation has been initialized.

The previous Stage 2–4 schema predates EF migration history. Existing Stage 4 installations keep their current schema and receive the Stage 5 migration as the first tracked EF migration. Future schema changes should be added as EF Core migrations; do not modify already-applied migration files.

## Reliability and operations

- PostgreSQL connection retry is enabled for transient failures.
- Redis is configured for distributed cache and SignalR backplane; Redis is not exposed outside the Compose network.
- `/health/live` checks process liveness.
- `/health/ready` checks PostgreSQL and the configured distributed cache.
- Global per-IP token-bucket rate limiting is enabled; authentication endpoints use an additional stricter fixed-window policy.
- Forwarded client IP/protocol headers are processed before rate limiting. The API port remains bound to loopback on the host and is intended to be reached through the configured Nginx reverse proxy.
- Security response headers are added centrally.
- Backend CI builds the API and runs unit plus PostgreSQL Testcontainers integration tests.
