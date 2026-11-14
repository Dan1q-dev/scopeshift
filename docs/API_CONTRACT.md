# API contract v1

Источник типов и Zod-схем: `src/types/scope.ts`. Денежные поля содержат целые центы USD: `150000` = $1,500. Часы допускают дробные значения, дни целочисленные. UI переводит центы в доллары только при отображении.

Это контракт основы проекта. Движок, AI, оценка и успешные переговоры пока не реализованы. Не показывать заглушку как работающую симуляцию.

## Общие типы

| Тип | Назначение |
| --- | --- |
| `Scenario` | Серверный сценарий с исходным договором и скрытыми `clientRules` |
| `ScenarioSummary` | Карточка сценария без скрытых правил |
| `PublicScenario` | Исходный договор и публичные события для интерфейса |
| `NegotiationAction` | Проверенный результат интерпретации текста: clarify, propose, accept, decline, unresolved |
| `Agreement` | Предложенное или принятое изменение, связанное с конкретным ходом |
| `ProjectState` | Пересчитанные деньги, часы, срок, активный объём и ID принятых соглашений |
| `NegotiationTurn` | Текст, интерпретация, ответ клиента и соглашение одного хода |
| `EvaluationResult` | Критерии, наблюдаемые доказательства и рекомендации |

Серверный сценарий экспортируется как `websiteProjectScenario` из `src/data/scenarios/website-project.ts`. Это начальная заготовка для Альбины: $1,500, 20 часов, 7 дней, три события. Правила вымышлены и требуют продуктовой проверки.

## GET /api/scenarios

Успех HTTP 200:

```json
{
  "scenarios": [{
    "id": "web-project-01",
    "title": "Sarah Mitchell - Website Project",
    "description": "Practice negotiating scope, delivery dates, and changes to a fixed-fee website project.",
    "clientName": "Sarah Mitchell",
    "currency": "USD",
    "initialFeeCents": 150000,
    "estimatedHours": 20,
    "deadlineDays": 7
  }]
}
```

Использовать `toScenarioSummary(scenario)`.

## GET /api/scenarios/[scenarioId]

HTTP 200: `{ "scenario": PublicScenario }`. Использовать `toPublicScenario(scenario)`, который перечисляет разрешённые поля явно.

`PublicScenario` содержит `id`, `title`, `description`, `clientName`, `currency`, `initialContract` и `events`. В договоре: `feeCents`, `estimatedHours`, `deadlineDays`, `scopeItems`. В событии: `id`, `title`, `clientMessage`, `availableScopeItems`, `learningObjectives`.

Каждый ScopeItem: `{ id, title, description, estimatedHours }`.

События являются публичным описанием задания, а не историей уже полученных сообщений. UI начинает с первого события; переход между событиями определяет серверный движок.

Не отправлять `Scenario` напрямую через JSON и не импортировать серверные данные в client components. Скрытые бюджеты, ограничения и правила оценки не входят в публичный ответ. Это учебная симуляция, исходный код публичный; данный фильтр отделяет клиентский payload от серверных правил, но не обеспечивает секретность открытого репозитория.

Неизвестный ID: HTTP 404, код `SCENARIO_NOT_FOUND`.

## POST /api/negotiate

Запрос:

```json
{
  "scenarioId": "web-project-01",
  "history": [{
    "turnId": "turn-1",
    "eventId": "booking-request",
    "userMessage": "I can add booking for an extra $400 and two more days. Would that work?"
  }]
}
```

`history` содержит всю ветку с начала сценария, включая последний пользовательский ход. `turnId` создаётся один раз через `crypto.randomUUID()` и сохраняется для повторной отправки. Максимум 50 ходов; текст 1-2000 символов после trim. Повторяющиеся `turnId` в одном запросе отклоняются.

При реализации сервер заново загружает неизменяемый исходный договор, проверяет порядок событий, интерпретирует историю и воспроизводит принятые соглашения. Браузер не передаёт доверенные суммы, принятые соглашения или действия. Неизвестные поля запрещены. Изменение применяется один раз, только после явного подтверждения допустимого предложения.

Replay отправляет префикс истории до выбранного момента и новый ход с новым ID. Это новая ветка, а не дополнение старого результата.

Повторная отправка не должна создавать второе соглашение. Перед подключением AI Данила должен обеспечить стабильность интерпретации старых ходов, например сохранением серверных результатов по паре scenarioId + turnId с проверкой совпадения текста. Один и тот же ID с другим текстом или префиксом нельзя молча переиспользовать. Сам по себе Zod-контракт не реализует такое хранилище.

Сейчас корректный запрос получает HTTP 501:

```json
{"error":{"code":"NOT_IMPLEMENTED","message":"Negotiation engine is not implemented yet."}}
```

Ошибочный JSON или схема: HTTP 400, `INVALID_REQUEST`. Семантически неверная история после реализации движка: HTTP 400, `INVALID_HISTORY`. Слишком большой payload: HTTP 413, `INVALID_REQUEST`. Недоступный AI: HTTP 503, `AI_UNAVAILABLE`; ограничение частоты: HTTP 429, `RATE_LIMITED`.

Будущий успешный ответ HTTP 200 задаёт `negotiateResponseSchema`:

```ts
{
  scenarioId: string;
  turns: NegotiationTurn[];
  project: ProjectState;
  evaluation: EvaluationResult;
  currentEventId: string | null;
  completed: boolean;
}
```

`ScopeChange` содержит `feeDeltaCents`, `deadlineDeltaDays`, `addScopeItemIds`, `removeScopeItemIds`. Дополнительные часы сервер вычисляет по реально добавленным и удалённым ScopeItem. LLM не задаёт часы или итоговую стоимость. Отрицательное изменение цены или срока допустимо в предложении, итог должен удовлетворять правилам сценария и положительной длительности.

`Agreement.status`: proposed, accepted, rejected, counteroffered. Договор меняет только accepted. `sourceTurnId` и `eventId` связывают решение с наблюдаемым действием. `effectiveHourlyRateCents` сервер вычисляет как `Math.round(totalFeeCents / estimatedHours)`; не суммировать округлённые ставки.

`EvaluationResult.criteria` содержит категорию, `earnedPoints`, `maxPoints`, evidence с `turnId`, `ruleId`, `observation` и практический advice. Каждый балл должен иметь проверяемое доказательство. Бесплатная правка или равноценный обмен сами по себе не означают ошибку.

## Формат ошибки

```ts
{ error: { code: string; message: string } }
```

Коды перечислены в `apiErrorSchema`. Не передавать stack trace, ключи провайдера или скрытые ограничения в ответе об ошибке.

## Правила совместимости

1. Данила владеет общими типами и API. Любое изменение формы сначала согласовать с Арсеном и Альбиной.
2. Арсен строит UI по публичным типам; заглушки показывает с явной отметкой и не выдаёт их за настоящий AI.
3. Альбина расширяет сценарий и тесты, сохраняя идентификаторы либо согласуя миграцию.
4. Ни один участник не дублирует определения типов локально.
