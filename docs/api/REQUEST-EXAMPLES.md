# Примеры запросов для FE-A / FE-B / FE-C

**Статус:** проектные примеры к `docs/api/openapi.yaml` версии `0.1.4-draft`. Не обращаться к ним как к уже работающим API. Значения UUID условные.

В реальном клиенте перед изменяющим запросом запрашивается `GET /api/v1/auth/csrf`, а затем передаётся `X-CSRF-Token`. Cookie отправляется браузером автоматически на том же origin. Для операций `submit`, `withdraw`, `decision` клиент задаёт отдельный `Idempotency-Key` и использует **тот же ключ для сетевых повторов**.

## 1. Компания создаёт черновик кейса

`POST /api/v1/companies/{companyId}/cases`:

```json
{"title":"Создание платформы анализа данных"}
```

Ответ `201` — `CaseDraft` с `status: DRAFT`, `id`, `companyId`, `version: 1`.

## 2. Компания заполняет условия

`PATCH /api/v1/cases/{caseId}`:

```json
{
  "expectedVersion": 1,
  "description": "Разработать инструмент мониторинга показателей",
  "participationFormat": "BOTH",
  "admissionMode": "SELECTIVE",
  "registrationDeadline": "2026-11-10T18:00:00+05:00",
  "minTeamSize": 2,
  "maxTeamSize": 5,
  "maxAdmittedTeams": 5,
  "maxAdmittedSolo": 3,
  "rewardTerms": "Вознаграждение по условиям кейса",
  "resultRightsTerms": "Права на результаты регулируются опубликованными условиями"
}
```

Это только пример части полей. На `submit-moderation` сервер проверит полный набор обязательных условий из ТЗ. При устаревшем `expectedVersion` возвращает `409`.

## 3. Модерация сотрудником УУНиТ

`POST /api/v1/cases/{caseId}/moderation-decision`:

```json
{"action":"REQUEST_REVISION","reason":"Уточните условия использования результата","expectedVersion":3}
```

Для `REQUEST_REVISION` или `REJECT` причина обязательна. Для `APPROVE` можно не передавать `reason`. Действие доступно только модератору с объектными правами.

## 4. Капитан создаёт команду и приглашает

`POST /api/v1/cases/{caseId}/teams`:

```json
{"name":"Команда Альфа"}
```

`GET /api/v1/teams/{teamId}/invite-candidates?search=Иван` — поиск по разрешённым публичным данным. Email и телефон кандидата не раскрываются.

`POST /api/v1/teams/{teamId}/invitations`:

```json
{"inviteeUserId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
```

Приглашённый увидит запись в `GET /api/v1/me/team-invitations`; лично вызывает `POST /api/v1/team-invitations/{invitationId}/accept`. Только успешное принятие создаёт членство. После подачи командной заявки приглашение принять нельзя.

## 5. Передача капитанства

Текущий капитан вызывает `POST /api/v1/teams/{teamId}/captain-transfer`:

```json
{"toUserId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}
```

Новый капитан лично вызывает `POST /api/v1/teams/{teamId}/captain-transfer/{transferId}/decision`:

```json
{"action":"CONFIRM"}
```

Чтобы отказаться, передаёт `"action":"DECLINE"`. Пока новый капитан не подтвердил, роль не меняется. Переход прав должен быть атомарным, с аудитом.

## 6. Черновик командной заявки и отправка

`POST /api/v1/cases/{caseId}/applications`:

```json
{"format":"TEAM","teamId":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"}
```

`PATCH /api/v1/applications/{applicationId}`:

```json
{"expectedVersion":1,"coverLetter":"Наша команда готова выполнить задачу, имеем опыт разработки на ASP.NET Core."}
```

`POST /api/v1/applications/{applicationId}/submit` (`Idempotency-Key: submit-001-abcdef`):

```json
{"expectedVersion":2}
```

При `SELECTIVE` успешный ответ `200` содержит `status: SUBMITTED`. При `OPEN` — сразу `status: ADMITTED`, только если хватает квоты. Подача невозможна до подтверждения всех фактических участников и разрешения ожидающих приглашений.

## 7. Компания принимает заявку

`POST /api/v1/applications/{applicationId}/decision` (`Idempotency-Key: decide-001-abcdef`):

```json
{"action":"ADMIT","expectedVersion":3}
```

`200 ADMITTED`: занята **одна командная квота**, а не столько мест, сколько в команде. Второй конкурентный запрос на последнее место получает `409`.

## 8. Студент отзывает заявку

`POST /api/v1/applications/{applicationId}/withdraw` (`Idempotency-Key: withdraw-001-abcdef`):

```json
{"expectedVersion":4,"reason":"Не можем продолжать участие"}
```

При допустимом отзыве результат `WITHDRAWN`. Повторная попытка создать новую заявку на тот же кейс должна завершиться `409`, даже через другую команду или формат. История событий продолжает храниться.

## 9. Единый пример ошибки

```json
{
  "code": "case_quota_exceeded",
  "message": "Все места для выбранного формата участия заняты",
  "requestId": "req-42"
}
```

Машинные коды `case_quota_exceeded`, `application_already_withdrawn` и т. п. здесь — **предлагаемые**; финальный реестр codes нужно согласовать с backend, чтобы frontend не сравнивал человекочитаемые тексты.


---

## 8. Компания создаёт этап и отборочную контрольную точку

`POST /api/v1/cases/{caseId}/stages`:

```json
{
  "expectedCaseVersion": 4,
  "title": "Разработка прототипа",
  "sequence": 1,
  "kind": "WORK"
}
```

`POST /api/v1/stages/{stageId}/checkpoints`:

```json
{
  "expectedCaseVersion": 5,
  "title": "Отбор прототипов",
  "kind": "SELECTION",
  "deadline": "2026-11-12T18:00:00+05:00",
  "selectionLimit": 3,
  "instructions": "Покажите работающий прототип"
}
```

`SELECTION` требует `selectionLimit` (N); для `REGULAR` и `FINAL` поле запрещено.

## 9. Ручной старт и рабочее пространство

`POST /api/v1/cases/{caseId}/start-execution` при статусе `REGISTRATION_CLOSED`:

```json
{"expectedCaseVersion": 10}
```

Ответ — обновлённый `CaseDraft` со статусом `EXECUTING`.

`GET /api/v1/cases/{caseId}/workspace` выдаёт **только доступные этой команде** этапы и метаданные файлов. При проверке denied пользователь не должен узнать даже имена будущих приватных материалов.

## 10. Загрузка приватного файла для сдачи

`POST /api/v1/files` — `multipart/form-data` с параметрами `purpose=SUBMISSION_ATTACHMENT`, `caseId`, `applicationId`, `checkpointId`, `file`; CSRF-заголовок обязателен. Получаем `fileId`, затем дожидаемся `READY` (либо сервер немедленно возвращает `READY` после успешных проверок).

`POST /api/v1/checkpoints/{checkpointId}/submissions`:

```json
{
  "applicationId": "1d5455fb-3b42-4650-a2d6-4b12fe463746",
  "expectedLastVersion": 1,
  "description": "Вторая версия прототипа",
  "links": [{"label":"Репозиторий", "url":"https://github.com/example/prototype"}],
  "fileIds": ["00a59c68-9572-4ab5-ad4e-716d1ff28fb0"]
}
```

При успехе `201` содержит `version: 2`, `submittedAt`, `isLate` (от сервера), список доступных вложений. При сетевом повторе **тот же** `Idempotency-Key`; другое тело с тем же ключом — конфликт.

`GET /api/v1/files/{fileId}/content` возвращает **байты**, а не JSON; фронтенд скачивает через браузер с cookie по тому же origin и проверяет 401/403/404. Постоянного storage URL клиент не получает.

## 11. Компания завершает отбор вручную

`POST /api/v1/checkpoints/{checkpointId}/complete-selection`:

```json
{
  "expectedVersion": 7,
  "passingTeamIds": [
    "f9a78fb7-6c5d-4847-83d4-5597a11453c7",
    "b68d45d6-d4c3-46c6-b0f5-81fef59bfb8e"
  ]
}
```

Если опубликованный лимит N равен 2, третья команда недопустима; сервер обязан проверить допустимость команды и зафиксировать результат атомарно. После завершения отбора выбывшие команды не получают будущих закрытых материалов даже по прямому URL.

## 12. Ручное завершение финального приёма

`POST /api/v1/cases/{caseId}/close-final-intake`:

```json
{"expectedCaseVersion": 20}
```

`EXECUTING -> FINAL_CLOSED`. Новая финальная версия после закрытия — `409 Conflict`, а собственная история прежних версий остаётся.

**Неутверждённые вопросы:** отбор соло-участников и правила подписи NDA; до их решения нельзя обещать полностью рабочий сценарий для всех форматов участия.


## 13. Начало оценивания после завершения приёма

`POST /api/v1/cases/{caseId}/begin-evaluation` (с `Idempotency-Key`):

```json
{"expectedCaseVersion": 21}
```

После `200` кейс переходит `FINAL_CLOSED → EVALUATING`.

## 14. Текстовый отзыв и необязательная оценка

`PUT /api/v1/cases/{caseId}/applications/{applicationId}/review`:

```json
{
  "expectedReviewVersion": 0,
  "feedback": "Хорошая архитектура, стоит дополнить документацию тестирования.",
  "score": null
}
```

`expectedReviewVersion=0` — ещё нет отзыва; если отзыв существует, следует передать его текущую версию. Числовая оценка опциональна; `null` удаляет её.

## 15. Ручные места и номинации

`PUT /api/v1/cases/{caseId}/awards`:

```json
{
  "expectedAwardsVersion": 0,
  "placements": [
    {"applicationId":"a0f63cba-cbf8-4bf3-8d36-f729305a6676","place":1},
    {"applicationId":"de258e53-6d38-4402-a4d7-8f4cfe8ba52c","place":2}
  ],
  "nominations": [
    {"applicationId":"de258e53-6d38-4402-a4d7-8f4cfe8ba52c","nomination":"Лучший интерфейс"}
  ]
}
```

Все номера мест и названия номинаций допустимы **только** по опубликованным `contestRules`. Совместные места — если опубликован `allowSharedPlaces=true`. Баллы не назначают места.

## 16. Публикация и просмотр результата

`POST /api/v1/cases/{caseId}/publish-results` (с `Idempotency-Key`):

```json
{ "expectedCaseVersion": 23, "expectedAwardsVersion": 1, "confirm": true }
```

`GET /api/v1/public/cases/{caseId}/results` — открывается **только после** успешного перехода в `COMPLETED`. Приватные отзывы и баллы доступны лишь своей заявке через `GET /api/v1/cases/{caseId}/results/mine`.

**Важно:** эти примеры — документация проектируемого API, серверные маршруты ещё не существуют.


## P0 дополнение 0.1.4: профиль, участия и справочники

Следующие операции пока **не реализованы** на backend; схемы и поля требуют review TL и FE-B.

`GET /api/v1/me/student-profile` возвращает `StudentProfilePrivate` только для текущего пользователя, включая `version` и приватную учебную группу.

`PATCH /api/v1/me/student-profile` (cookie + `X-CSRF-Token`):

```json
{
  "expectedVersion": 1,
  "description": "Разрабатываю веб-приложения",
  "skillIds": [],
  "technologyIds": [],
  "publicSummary": "Участвую в командных ИТ-проектах",
  "publicLinks": [
    {"label": "GitHub", "url": "https://github.com/example"}
  ]
}
```

`GET /api/v1/public/students/{studentId}` возвращает `StudentProfilePublic` без email, учебной группы и закрытых данных.

`GET /api/v1/me/case-participations?page=1&pageSize=20` возвращает `MyCaseParticipationListResponse`: `items`, `page`, `pageSize`, `total`.

`GET /api/v1/reference-data` возвращает `ReferenceDataResponse` с опубликованными направлениями, технологиями, компетенциями, категориями портфолио и институтами. Названия девяти категорий берутся из утверждённого ТЗ/справочника, а не придумываются frontend.
