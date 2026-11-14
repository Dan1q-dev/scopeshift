# Real Project API v1

Источник истины: `src/types/real-project.ts`. Practice API и его типы не меняются. Все строки продукта на английском, суммы в integer cents USD. Примеры ниже синтетические. Для разработки UI импортируйте схемы, а не создавайте локальные копии DTO.

## Сессия и общие правила

Клиент сначала вызывает существующий `GET /api/session` и сохраняет браузерную cookie. Real Project endpoints требуют уже установленную подписанную сессию; owner/scope не принимается из JSON. Все ответы имеют `Cache-Control: private, no-store` и `Vary: Cookie`. Mutations должны проходить same-origin проверку. Любые UUID ресурса проверяются вместе с владельцем, чужой ресурс возвращает 404.

Errors: `{ "error": { "code": "INVALID_REQUEST", "message": "..." } }`, схема `realApiErrorSchema`. Основные коды: `SESSION_REQUIRED`, `NOT_FOUND`, `CONFLICT`, `STALE_SOURCE`, `STALE_REVIEW`, `REVIEW_REQUIRED`, `INVALID_EVIDENCE`, `ANALYSIS_IN_PROGRESS`, `DRAFT_IN_PROGRESS`, `IDEMPOTENCY_CONFLICT`, `AI_UNAVAILABLE`, `RATE_LIMITED`, `LIMIT_REACHED`, `FORBIDDEN`, `STORAGE_UNAVAILABLE`. Некорректный ввод - 400, запрещенный origin - 403, чужой/несуществующий ресурс - 404, stale/duplicate-in-progress - 409, квота - 429, недоступность AI/БД - 503. Точные значения кодов импортируются из schema.

## Ресурсы

| Метод и путь | Вход / schema | Успех |
| --- | --- | --- |
| `GET /api/real-projects` | нет | `projectListResponseSchema`: summaries без документов, максимум 10 |
| `POST /api/real-projects` | `realProjectCreateSchema` | 201, `projectResponseSchema` |
| `GET /api/real-projects/:projectId` | UUID | `projectResponseSchema`, включая canonical documents |
| `PATCH /api/real-projects/:projectId` | `realProjectUpdateSchema` | `projectResponseSchema`, новая source revision |
| `DELETE /api/real-projects/:projectId` | UUID, явное действие пользователя | `deleteProjectResponseSchema`: `{ deleted: true }` |
| `GET /api/real-projects/:projectId/requests` | UUID | `requestListResponseSchema`, bounded history |
| `POST /api/real-projects/:projectId/requests` | `clientRequestCreateSchema` | `requestResponseSchema` после анализа либо stored status/error |
| `GET /api/real-projects/:projectId/requests/:requestId` | UUID | `requestResponseSchema` |
| `PUT /api/real-projects/:projectId/requests/:requestId/review` | `scopeReviewInputSchema` | `requestResponseSchema` |
| `POST /api/real-projects/:projectId/requests/:requestId/impact` | `financialImpactInputSchema` | `impactResponseSchema`: `{ request, impact, changeOrder }` |
| `GET /api/real-projects/:projectId/requests/:requestId/drafts` | UUID | `draftListResponseSchema` |
| `POST /api/real-projects/:projectId/requests/:requestId/drafts` | `negotiationDraftInputSchema` | `draftResponseSchema` |
| `PATCH /api/real-projects/:projectId/requests/:requestId/drafts/:draftId` | `negotiationDraftEditSchema` | `draftResponseSchema` |

Реализация endpoints и production-проверки фиксируются в итоговом отчете капитана; наличие документа не означает, что каждый endpoint уже опубликован.

## Создать или обновить проект

```json
{
  "name": "Example website",
  "originalFeeCents": 150000,
  "originalEstimatedHours": 20,
  "originalDeadline": "2026-11-22",
  "agreementText": "Develop a responsive 5-page business website with a contact form for $1,500.",
  "amendmentsText": ""
}
```

Исходный fee/hours/deadline - введенный пользователем согласованный baseline. Модель не извлекает их как доверенные числа. Для PATCH передается тот же полный объект плюс `expectedSourceRevision`. Успешный update увеличивает ревизию и не переписывает исторические snapshots запросов.

`RealProject` добавляет `id`, `sourceRevision`, `documents`, `createdAt`, `updatedAt`. `RealProjectSummary` содержит те же поля без `documents`. Лимиты: agreement 24,000 символов, amendments 8,000, client message 6,000. Текущий baseline часов положителен и поддерживает 2 знака после запятой. Fee может быть нулевым. Даты строго `YYYY-MM-DD`.

## Запустить анализ

```json
{
  "requestId": "41f1bb80-0996-4ac6-a189-c5a99fa0c790",
  "clientMessage": "Could you also add appointment booking, calendar synchronization, and two more pages?",
  "aiConsent": true
}
```

`aiConsent: true` возникает только после явного действия пользователя с disclosure. Operation UUID создается один раз и сохраняется для точного повторения. Измененный текст или несовместимый source revision с тем же UUID отклоняются. Повтор не создает независимый анализ с дополнительными AI-вызовами.

`RealClientRequest` содержит `id`, `projectId`, `clientMessage`, `sourceRevision`, неизменяемый `projectSnapshot`, `requestDocument`, `status`, `analysis`, `review`, `impact`, `impactHash`, `error`, `createdAt`, `updatedAt`. Nullable-поля сохраняют `null` до соответствующего этапа. Status: `pending`, `ready`, `confirmed`, `failed`.

`ScopeAnalysis` содержит `id`, `version: "real-scope-v1"`, `sourceRevision`, `summary`, `items`, `limitations`, `createdAt`. Каждый item: `id`, `title`, `requestedWork`, одна из четырех classification, `contractEvidence`, `requestEvidence`, `explanation`, `unknowns`, `clarificationQuestions`, `userReviewRequired: true`. Item IDs создает сервер. Отсутствие элемента в документе не переводится автоматически в `excluded`.

Цитата имеет `{ documentId, passageId, start, end, quote }`. Модель возвращает только первые два ID и текст цитаты. Сервер проверяет точное вхождение и вычисляет offsets в `canonicalText`. Например, для `A contact form is included.` цитата `contact form` имеет start 2 и end 14. UTF-16 end не включается. Невалидная или выдуманная цитата не становится успешным analysis.

## Подтвердить или исправить трактовку

```json
{
  "sourceRevision": 1,
  "expectedReviewRevision": 0,
  "items": [
    { "itemId": "item_001", "classification": "not_specified", "reason": "I checked the agreement; booking is not explicitly described." }
  ]
}
```

Передается полный точный набор item IDs текущего анализа без повторений. Для измененной классификации причина обязательна; неизмененная может иметь пустую строку. Первый expected review revision - 0, следующий update использует текущую revision. Ответ хранит отдельный review с `revision`, `sourceRevision`, `items`, `confirmedAt`; raw AI items не изменяются. Новый review сбрасывает актуальность прежнего impact/draft. Это подтверждение пользователем своей трактовки, а не согласие клиента с оплатой.

## Рассчитать предложение

```json
{
  "reviewRevision": 1,
  "selectedItemIds": ["item_001"],
  "additionalEstimatedHours": 6,
  "removedScope": [],
  "pricing": { "mode": "fixed", "feeDeltaCents": 40000 },
  "additionalExpensesCents": 2000,
  "deadlineExtensionDays": 2,
  "assumptions": ["The client supplies available consultation slots."]
}
```

Значения 6h/$400 здесь введены пользователем для примера, а не предложены LLM как точная оценка труда. Hourly-альтернатива: `pricing: { mode: "hourly", hourlyRateCents: 10000 }`. Обмен добавляет `removedScope: [{ description, estimatedHours }]`.

`FinancialImpact` содержит input, source/review revision и детерминированные original/proposed fee, original/updated hours, removed/net additional hours, original/updated effective hourly rate, additional compensation/expenses/compensation after expenses и original/proposed deadline. Для приведенных данных: proposed fee $1,900, hours 26, date 2026-11-24, revenue rate $73.08/h, additional compensation after additional expenses $380. Это не прибыль всего проекта.

Суммы в cents, часы максимум с 2 знаками. Hourly fee округляется до цента один раз, половина цента от нуля для charges и credits. Updated hours должны остаться положительными, proposed fee неотрицателен. Calculation не обновляет согласованный baseline проекта. `impactHash` сервер вычисляет для текущего результата; он связывает draft с конкретными финансовыми условиями.

## Получить и редактировать draft

```json
{
  "draftId": "9b7d52d2-c201-4d2c-a3a3-a68f6936d2e1",
  "style": "professional",
  "reviewRevision": 1,
  "impactHash": "COPY_THE_CURRENT_64_CHARACTER_HASH_FROM_THE_REQUEST",
  "aiConsent": true
}
```

Строка impactHash в примере - placeholder, а не валидный digest; клиент копирует реальное значение из request. Style: `friendly`, `professional`, `firm`. Draft содержит source/review revision и impactHash, `generatedBody`, редактируемый `body`, timestamps и `status: "proposed"`. Для PATCH: `{ body, expectedUpdatedAt? }`. История исходного generatedBody сохраняется.

ChangeOrder - типизированный `{ projectId, requestId, sourceRevision, reviewRevision, impactHash, status: "proposed", title, body }`. Он появляется вместе с impact и не означает принятие клиентом. Copy/export не отправляет email.

## Практика и приватность

Кнопка Practice использует `/simulation` без реального текста в query/body. Ресурсы доступны только текущей подписанной анонимной сессии; cookie действует 30 дней с создания. Это не обещание автоматического удаления SQL-строк. Delete project удаляет связанные данные нашего приложения. Данные не называются end-to-end encrypted или zero-retention.
