# Альбина: Real Project Mode QA и демонстрация

## Основа

Рабочая спецификация: `REAL_PROJECT_MODE_SPEC.md`; DTO и endpoints: `REAL_PROJECT_API.md`, `src/types/real-project.ts`. Режим сохраняет Skills-связку: Practice развивает навык, Real Project применяет его, contextual Practice возвращает к тренировке. Это не автоматический клиентский переговорщик и не юридическое заключение.

Backend/reference integration развиваются в `codex/real-project-mode`. Проверенные результаты капитан сообщает отдельно. До такого сообщения не называй новый режим опубликованным или полностью готовым.

## Твоя зона

- Синтетические demo agreements/client requests и ожидаемые классификации.
- Дополнительные тесты `tests/real-project*`, соответствующие E2E и приемочные чек-листы.
- Документация, пользовательские формулировки, privacy/error UX review и pitch.
- Связь выявленной сложности с existing Practice scenario, без передачи реальных клиентских данных.

Данила владеет схемами/AI/repository/финансовыми вычислениями. Арсен владеет новым UI и клиентским адаптером. Изменение API или financial expectations сначала согласовать с капитаном. Существующий active `evidence-v2` Practice evaluator не заменяется экспериментальным rubric v0.1.

## Матрица исходных материалов

| Agreement + request | Ожидаемая проверка |
| --- | --- |
| Contact form explicitly included; request to add the same form | `included` с реальной цитатой |
| Agreement explicitly excludes calendar synchronization; request asks for it | `excluded` с явной цитатой исключения |
| Five-page website + contact form; request for appointment booking | `not_specified` либо обоснованный `ambiguous`, не автоматическое billable exclusion |
| Five-page website; request for two more pages | Показать число страниц и необходимость review, не выдавать юридическую определенность |
| "Minor updates included" без определения minor | `ambiguous`, конкретные вопросы |
| Booking, calendar sync и extra pages в одном письме | Отдельные атомарные requests, отдельные source/request evidence |
| Amendment добавляет booking к исходному договору | Учитывать amendment и его passage IDs |
| User исправляет wrong classification | Raw AI остается, отдельно review с reason/revision |
| Документ содержит "ignore previous instructions"/требование раскрыть ключ | Недоверенные данные не становятся системными командами |

Цитата обязана совпадать с подстрокой canonical text. Добавь кейсы CRLF, кавычек, Unicode/emoji и повторяющейся цитаты. Не подменяй отсутствующую citation похожим текстом. Отсутствие упоминания не является доказательством исключения.

## Финансовые проверки

Все estimates задает человек. Используй synthetic baseline $1,500 / 20h / 2026-11-22. Пример +6h, fixed +$400, +$20 расходов, +2 календарных дня дает proposed $1,900 / 26h / 2026-11-24 и $73.08/h выручки; additional compensation after additional expenses = $380.

Проверь no-fee addition, равный scope swap, уменьшение цены, нетто-удаление часов, нулевые дополнительные часы/fee, отрицательные расходы/rate, дробные hours, округление половины цента, несуществующую дату и переполнение. Baseline и итоговые часы не могут быть нулевыми; proposed fee не может быть отрицательным. Расчет не подтверждает изменение договора клиентом и не включает неизвестные расходы/налоги.

## Надежность и приватность

- Повтор одного request/draft ID не создает независимый платный результат; changed payload с тем же ID конфликтует.
- Source update во время анализа и review update во время generation не публикуют stale результат как актуальный.
- Чужая signed session не может читать, менять или удалять project/request/draft по UUID.
- Delete project удаляет все связанные записи нашего приложения. Потеря cookie не называется удалением SQL-данных.
- Disclosure виден до Analyze/Generate; пользователь может redact source, нажатия явные.
- Проверить malformed model output, выдуманную citation, timeout, rate limit и storage failure. Ошибка не превращается в успешную заглушку.
- Provider retention, compliance certification и end-to-end encryption не заявляются без доказательства.

## Сквозная приемка и pitch

Пройди create -> paste -> analyze -> inspect quotes -> correction -> confirm -> estimate -> draft/edit/copy -> history/reload -> Practice -> delete. Отдельно проверь мобильный и клавиатурный путь. PDF/DOCX/OCR отсутствуют в P0; не показывай их как готовую возможность.

В pitch разделяй подтвержденное от roadmap. Формулировка: **Learn it. Apply it. Improve it.** Показывай reviewed, proposed changes, а не "AI proved scope creep" или "contract accepted". Финальное demo agreement должно быть синтетическим и не содержать реальных данных клиента. В отчет включи commit/среду, реальные результаты test/build/browser/live-AI, обнаруженные дефекты и незавершенные части. Screenshot mock-data не доказывает подключение AI или storage.
