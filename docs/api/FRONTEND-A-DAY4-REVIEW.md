# Проверка контракта перед Frontend A день 4

Проверен снимок main `1aa0858` от 3 ноября 2026: OpenAPI
`0.1.5-draft`, REQUEST-EXAMPLES.md, REVIEW-CHECKLIST.md, серверные обработчики
Execution/Submissions/Evaluation, сущности и EF-модель. Сверены ТЗ v5.1
и задачи FA-19–FA-24 плана v2.1. Это статический обзор области выполнения
и итогов, а не сертификация всех сценариев 98 операций.

## Подтверждённое состояние

- Независимый openapi-spec-validator 0.9.0 и scripts/validate_openapi.py:
  успешно, **98 операций, 84 URL, 155 схем**. Цифры 94/150 устарели.
- Сервер уже существует: Program.cs регистрирует Execution, Submissions,
  Files и ContractEvaluation. Утверждение «backend не реализован» устарело.
- `dotnet build Vitrina.slnx --no-restore`: успешно, 0 предупреждений и ошибок.
- Четыре теста SecurityAndNotificationsTests проходят.
- Docker daemon недоступен. Интеграционные тесты PostgreSQL/Testcontainers,
  приватное хранилище, конкурентные запросы и работа развёрнутого API
  не подтверждены. Успешная компиляция не означает готовность интеграции.

## Блокеры интеграции дня 4

| Приоритет | Наблюдение в коде | Необходимое согласование или исправление backend |
| --- | --- | --- |
| P1 | ExecutionEndpoints.ListStages возвращает items без обязательного CaseStageListResponse.caseVersion | Возвращать версию кейса вместе со списком; проверять ответ контрактным тестом |
| P1 | ToCheckpointDto возвращает null для selectionLimit/soloSelectionLimit/instructions. В CaseCheckpoint поля опциональны, но их присутствующее значение не допускает null | Выбрать omission либо явную nullable-схему. Не подменять null нулём на клиенте |
| P1 | CloseIntake возвращает CaseCheckpoint, хотя операция объявляет CheckpointClosure. CompleteSelection возвращает status/passingTeamIds/… без обязательного closedAt; additionalProperties=false | Вернуть согласованный DTO; списки прошедших и результат повторного запроса согласовать явно |
| P1 | Submissions.ForCompany отдаёт массив SubmissionVersion без пагинации. Контракт требует SubmissionOverviewList: latestVersion/isLatestLate/page/pageSize/total | Разделить обзор последних сдач и GET истории конкретной заявки |
| P1 | Dashboard.teams содержит teamId/captainUserId/status, но не applicationId, имя или причину исключения. Для SOLO есть только общее число | Зафиксировать безопасную агрегацию с applications/team DTO и отдельный источник истории исключения. ExecutionSnapshot в FE является только локальной UI-проекцией |
| P1 | Backend записывает CaseApplication.Status=ELIMINATED; enum CaseApplicationStatus содержит только DRAFT/SUBMITTED/ADMITTED/REJECTED/WITHDRAWN | Согласовать разделение статуса заявки и статуса исполнения. FE не расширяет согласованный enum самостоятельно |
| P1 | Create/UpdateCheckpoint проверяют лимиты SELECTION, но не запрещают присланные квоты для REGULAR/FINAL; схема CreateCheckpointRequest запрещает их | Ввести объектный валидатор, проверять конечное состояние при PATCH |
| P1 | CaseProject/CaseApplication Version не настроены как concurrency token в VitrinaDbContext. CloseFinalIntake выполняет ExecuteUpdateAsync до SaveChanges без общей явно заданной транзакции; ExcludeTeam аналогично обновляет ParticipationHistory | Подтвердить атомарность, concurrency guard и тесты гонок. Предварительная проверка expectedVersion в C# сама по себе не даёт гарантии атомарности |
| P2 | CloseIntake объявляет обязательный Idempotency-Key в OpenAPI, но обработчик не читает его | Согласовать сохранение ключа и отпечатка запроса, повторное закрытие и одинаковый ответ |
| P2 | REVIEW-CHECKLIST и PLAN-V2.1-ALIGNMENT содержат старые утверждения о количестве операций и отсутствии backend | Обновить после backend-review; frontend не выставляет чужие чекбоксы завершёнными |

## Реализуемость на ASP.NET Core

Guid для Id, DateTimeOffset для сроков, decimal? для оценки и отдельные request/response
DTO подходят текущему ASP.NET Core 10. EF уже содержит отдельные Stage,
Checkpoint, SubmissionVersion, ApplicationReview/Revision, CaseAward,
CaseResultPublication и TeamExecutionExclusion. Уникальный индекс версии сдачи,
concurrency tokens этапов/точек/отзывов и транзакции оценивания — полезная база.

До подключения UI нужны именованные response DTO вместо анонимных объектов,
единый маппинг enum и проверка required/null/additionalProperties. Регистрация
FluentValidation в DI не заменяет вызов валидатора в обработчике или фильтре.
У DTO записей без атрибутов ограничения OpenAPI автоматически не возникают.
Для PATCH нужно различать отсутствующее поле и явный null, там где это
предусмотрено контрактом; для ReviewDraftRequest UI посылает null явно,
чтобы убрать оценку. Приём, отбор, исключение и публикация требуют серверной
проверки объекта, версии и транзакции независимо от клиентской блокировки.

Документация Microsoft:
- https://learn.microsoft.com/en-us/aspnet/core/fundamentals/validation?view=aspnetcore-10.0
- https://learn.microsoft.com/en-us/dotnet/standard/serialization/system-text-json/missing-members

## Ограничения UI Ready

Реальные запросы не подключены. Типы запросов, ответов и вложений генерируются
из OpenAPI; условные ограничения проверяет mock-репозиторий. Авторизация
не имитируется. Используются только отдельные вымышленные кейсы дня 4;
начатый кейс демонстрации дня 3 не становится автоматически fixture дня 4.
Состояния сбрасываются при перезагрузке/смене сценария.

При закрытии финального приёма UI консервативно требует закрыть предыдущие
точки; backend CloseFinalIntake пока проверяет только наличие FINAL.
Это ограничение демонстрации нужно сверить при интеграции. Публикация
результатов и выставление Done (API) в эту работу не входят.
