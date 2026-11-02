# Backend API coverage — staged implementation

Contract: `../docs/api/openapi.yaml` (94 operations at v0.1.5-draft). Coverage below distinguishes implemented business workflows from operations that are still deferred.

## Stage 1 — identity, company/case foundation, teams and applications

Implemented:
- Auth session foundation, registration/login/logout/me, email token confirmation and password reset flows.
- Company creation/read/list foundation.
- Case draft create/read/update and submit to moderation.
- Moderation queue and decisions (`APPROVE`, `REVISION`, `REJECT`).
- Registration open/close/reopen transitions.
- Team creation, membership, invite, accept/decline/revoke, candidate lookup, captain transfer.
- Application draft, listing, read/update, submit, withdraw, selective decision and immutable event history.
- Expected-version checks and participation history to prevent reapplication after rejection/withdrawal.

## Stage 2 — organization and student-facing workflows

Implemented:
- Company invitation creation, listing, preview and acceptance (existing account or new account).
- Cryptographically random single-use invitation tokens; only SHA-256 hashes are stored; expiry is seven days.
- Existing-account acceptance checks that the signed-in account email matches the invitation. New-account acceptance derives the email from the invitation and never accepts an email from the request body.
- Company membership creation is transactional with invitation acceptance. Invitations never grant global roles.
- Role-based permission assignment: OWNER receives company administration/invite/case permissions; MEMBER receives private company read and student-profile read. Only an owner or university administrator may invite another OWNER.
- Company-private read and company student-profile read enforce permissions on the server for every request.
- Student profile editing with optimistic `expectedVersion`, nickname uniqueness, institute/course/group fields, achievements and explicitly public links.
- Public profile response excludes full name, email, course, group and company membership. Academic data is returned only through the company-scoped endpoint with `students.read`.
- Read-only reference-data endpoint is backed by `ReferenceEntries`.
- Case participation list is populated from actual applications.
- Company registry is paginated and restricted to university staff/platform administrators.

Boundaries:
- Company membership/permission editing endpoints are not exposed by the current contract; permissions are assigned by invitation role.
- Reference-data management is not exposed by HTTP; administrators must populate `ReferenceEntries` through a controlled database process.
- Avatar upload remains deferred; `avatarUrl` is null until the profile-avatar workflow is implemented.
- SMTP delivery is required. If invitation delivery fails, the invitation is revoked and the endpoint returns 503.

## Stage 3 — execution, submissions, private files and NDA

Implemented endpoints:
- `GET/POST /api/v1/cases/{caseId}/stages`
- `PATCH/DELETE /api/v1/stages/{stageId}`
- `POST /api/v1/stages/{stageId}/checkpoints`
- `PATCH/DELETE /api/v1/checkpoints/{checkpointId}`
- `POST /api/v1/cases/{caseId}/start-execution`
- `GET /api/v1/cases/{caseId}/workspace`
- `GET /api/v1/cases/{caseId}/execution-dashboard`
- `POST /api/v1/checkpoints/{checkpointId}/close-intake`
- `POST /api/v1/checkpoints/{checkpointId}/complete-selection`
- `GET /api/v1/checkpoints/{checkpointId}/selection-result/mine`
- `POST /api/v1/cases/{caseId}/close-final-intake`
- `POST /api/v1/teams/{teamId}/exclude`
- `POST /api/v1/checkpoints/{checkpointId}/submissions`
- `GET /api/v1/checkpoints/{checkpointId}/submissions/mine`
- `GET /api/v1/checkpoints/{checkpointId}/submissions`
- `GET /api/v1/checkpoints/{checkpointId}/submissions/{applicationId}/versions`
- `POST /api/v1/files`, `GET /api/v1/files/{fileId}`, `GET /api/v1/files/{fileId}/content`
- `POST /api/v1/stages/{stageId}/materials`
- `GET/PUT /api/v1/cases/{caseId}/nda`

File upload is private MinIO storage. The initial implementation validates file extension/content signature and a configurable size limit. Unbound staged uploads are removed after 24 hours. It does not include malware scanning; operators must not treat signature validation as antivirus scanning. Files are not served through public MinIO URLs.

For an existing Stage 2 database, apply `deploy/postgres/003_stage3_execution_submissions_files.sql` once before starting the Stage 3 API. Fresh databases are created from the current EF model. `EnsureCreated` is not a schema migration mechanism.

## Stage 4 — evaluation and publication

Implemented according to the Stage 4 OpenAPI contract and `docs/architecture/case-evaluation-results.md`:
- Structured contest rules on the case draft: shared-place policy, number of prize places, allowed nominations and optional score range. Rules can only be changed while the case remains a draft/revision.
- Manual transition `FINAL_CLOSED -> EVALUATING`, guarded by case version and `Idempotency-Key`.
- Company-only evaluation progress and paginated review list.
- Text feedback for each eligible application; optional score constrained by the contest's published score range; optimistic review versions and immutable revision history.
- Manual placements and nominations; server validation against admitted applications, place count, shared-place rule and allowed nomination list.
- Explicit, idempotent publication `EVALUATING -> COMPLETED`. Review completeness is not a publication gate because the architecture document leaves mandatory review completeness as a product decision requiring confirmation.
- Public results expose a separate public result ID, display name, format, placements and nominations. They do not expose private application IDs, feedback, scores, files or contact details.
- Personal result endpoint exposes only the current participant's application and feedback.
- Append-only audit events for review changes, awards draft changes and publication.

Stage 4 endpoints:
- `POST /api/v1/cases/{caseId}/begin-evaluation`
- `GET /api/v1/cases/{caseId}/evaluation`
- `GET /api/v1/cases/{caseId}/reviews`
- `PUT /api/v1/cases/{caseId}/applications/{applicationId}/review`
- `GET/PUT /api/v1/cases/{caseId}/awards`
- `POST /api/v1/cases/{caseId}/publish-results`
- `GET /api/v1/public/cases/{caseId}/results`
- `GET /api/v1/cases/{caseId}/results/mine`
- `GET /api/v1/cases/{caseId}/evaluation-audit`

For an existing Stage 3 database, apply `deploy/postgres/004_stage4_evaluation_results.sql` after migration `003_stage3_execution_submissions_files.sql` and before starting the Stage 4 API. Fresh databases use the current EF model. The `CaseContestRules` structure is an implementation proposal documented in the repository; confirm its exact semantics with the project owner before production rollout.

## Stage 5 — production readiness and P1

- General-purpose durable idempotency, outbox/background jobs, SignalR notifications, Redis cache/locks.
- EF Core migrations, PostgreSQL integration tests, race-condition tests, backup/restore and deployment hardening.
- P1 portfolio, initiatives, recruiting, closed company projects, curator assignments, administration and analytics, after resolving their contract scope.

## Verification

The preparation environment does not contain the .NET 10 SDK or Docker engine. `dotnet build`, database migration execution, integration tests and live deployment could not be run here. XML/JSON/YAML parsing, C# delimiter checks and archive integrity checks were performed. Build and run the supplied deployment instructions in a .NET 10/Docker environment before production use. The server guide uses `EnsureCreated` only for first boot; migrations remain a required follow-up before evolving a live database schema.


## Stage 5 — Notifications and production infrastructure

- `GET /api/v1/notifications` — current user's notification page.
- `GET /api/v1/notifications/unread-count` — unread counter.
- `POST /api/v1/notifications/{notificationId}/read` — mark one notification as read.
- `POST /api/v1/notifications/read-all` — mark all current user's notifications as read.
- `/hubs/notifications` — authenticated SignalR hub; event `notification.created` prompts clients to refresh their notification list.
- `GET /health/live` and `GET /health/ready` — liveness and PostgreSQL readiness.
- Published case results enqueue participant notifications in the same PostgreSQL transaction; outbox delivery retries with exponential backoff.
