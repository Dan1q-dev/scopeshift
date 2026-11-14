# Арсен: Real Project Mode UI

## Готовая точка интеграции

Общие DTO и Zod-схемы находятся в `src/types/real-project.ts`; REST и примеры в `REAL_PROJECT_API.md`, продуктовые правила в `REAL_PROJECT_MODE_SPEC.md`. Backend и reference integration капитан развивает в `codex/real-project-mode`. Доступность конкретного endpoint проверяй по итоговому сообщению капитана, а не по одному наличию документа.

Не создавай второй несовместимый API/state layer. Если на ветке уже есть reference UI нового режима, развивай его по тем же контрактам. Существующие Practice/Results и незакоммиченные изменения Gemini сохраняются.

## Твоя зона

- Новая страница `src/app/real-projects/**`.
- Новые компоненты `src/components/real-projects/**`.
- Отдельный адаптер `src/lib/client/real-project-api.ts`.
- Минимальный согласованный entry link **Real Project Mode** и доступный переход обратно в Practice. Текущую landing pricing и `layout.tsx` не меняй без согласования.

Типы, AI, repository, расчеты, `/api/real-projects/**` и migrations принадлежат Даниле. JSON shapes не дублируй в frontend. Тестовые fixture-ответы помечай как тестовые и не используй вместо работающего API в production.

## Последовательность экранов

1. **Projects / Create project**. Название, agreed fee в USD, estimated hours, исходная дата, agreement text, optional amendments. Надпись о серверном сохранении. Возможность вставить и отредактировать текст до анализа. Synthetic sample заполняет форму, но не запускает AI автоматически.
2. **Client request / Analyze**. Текст сообщения, disclosure обработки OpenAI, явный consent и кнопка Analyze. Показывай pending/error; отключай повторный запуск во время работы. UUID request сохраняй для точного retry.
3. **Review**. Originally agreed, Newly requested, Potential changes, Needs clarification. Каждая строка содержит полную classification label, explanation, реальные цитаты договора и сообщения, unknowns и вопросы. Цитату можно найти в displayed canonical source. У модели нет произвольных процентов confidence. Для correction нужен reason; Confirm сохраняет весь набор items.
4. **Calculate proposed impact**. Доступен после review. Пользователь сам вводит часы, fixed delta или hourly rate, дополнительные расходы, удаляемый scope и часы, календарное продление, assumptions. Показать исходные и proposed fee/hours/date/rates. Rate - выручка до расходов/налогов; отдельный incremental after-expenses не называть общей прибылью.
5. **Respond**. Выбор friendly/professional/firm, явная Generate draft, editable textarea, Save edits и Copy. Видны proposed terms и unresolved questions. Отдельный Proposed change order с Copy. Не показывать Send или Accepted: автоматической отправки/принятия нет.
6. **History / Delete**. Список проектов и предыдущих запросов, открытие сохраненных результатов, удаление конкретного проекта с подтверждением. Полная source data подгружается для выбранного проекта. Stale revision требует нового анализа до использования текущих оценок.
7. **Practice negotiating a change request**. Ссылка `/simulation`; реальные договоры/сообщения в Practice не передаются.

## Состояния и ошибки

- Loading projects/project/history, analyzing, confirming, calculating, generating, saving edits, deleting.
- Понятные inline validation messages для USD/hours/date/empty text.
- `SESSION_REQUIRED`: bootstrap через `/api/session`; объяснить потерю доступа при удалении cookie.
- `STALE_SOURCE`/`STALE_REVIEW`/`CONFLICT`: обновить серверные данные и попросить повторный review/расчет, не применять stale результат молча.
- `ANALYSIS_IN_PROGRESS`/`DRAFT_IN_PROGRESS`: операция еще не завершена; не создавать новый UUID автоматически.
- `AI_UNAVAILABLE`/`RATE_LIMITED`/`STORAGE_UNAVAILABLE`: показать честную ошибку и разрешенное сервером действие; не подставлять fabricated analysis.
- Старые drafts могут оставаться в истории, но их связь с прежними source/review/impact должна быть видна.

## Приемка UI

Новый пользователь проходит synthetic create -> analyze -> correction -> confirm -> impact -> draft -> edit/copy -> reload history -> delete. Проверь мобильный viewport, клавиатурный фокус и live/error announcements. Ни один AI-вызов не выполняется при простом вводе текста. Чужой UUID не открывает данные. После удаления исчезает весь проектный history. Исходная Practice симуляция, Replay и Compare продолжают работать.

Перед PR: Node 22, typecheck/lint/unit/build и согласованный E2E. В отчете отделяй mocked UI-проверку от настоящего OpenAI и опубликованного flow. Укажи commit, API revision, какие состояния не проверены. Не отправляй реальные договоры команды в AI для теста.
