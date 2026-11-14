# Сообщения для синхронизации команды

Ниже два отдельных текста для пересылки участникам. PR #1 уже слит в основной репозиторий. OpenAI-режим развивается отдельно в backend-ветке и пока не входит в `main`.

## Арсену и его Claude

Арсен, frontend в твоем fork `arsengabdrahmanov7-ux/scopeshift-arsen` нужно соединить с рабочим backend из `Dan1q-dev/scopeshift:main`. Сохрани все свои экраны и компоненты. Не пересоздавай проект и не заменяй frontend файлами из `main`.

Сначала проверь `git status --short --branch` и `git remote -v`. Сохрани незакоммиченную собственную работу. `origin` обычно указывает на твой fork. Если remote `upstream` еще нет, добавь его:

```sh
git remote add upstream https://github.com/Dan1q-dev/scopeshift.git
```

Если `upstream` уже существует, проверь его адрес вместо повторного добавления. Затем в своей копии:

```sh
git fetch upstream
git switch feat/frontend-experience
git merge upstream/main
npm ci
npm run dev
```

При конфликтах сохрани frontend и общие backend-контракты. Не используй force push, `reset --hard` или массовый выбор одной стороны. Покажи капитану конкретный конфликт, если он затрагивает общий тип или API.

Подключи чат через существующий `src/lib/client/api.ts`. В `main` работает `rules-v1`, ключ для него не нужен. Реальный `POST /api/negotiate` должен возвращать HTTP 200 и менять показатели по ответу сервера. Убери production fixtures и устаревшую желтую плашку о неготовом backend после фактического подключения. Сам режим `rules-v1` не называй живым AI.

Проверь доплату, бесплатную работу, отказ, counteroffer, retry и переход между событиями. При `accepted` обновляй договор из `project`; при ошибке сохрани историю и предложи retry. Не выдумывай оценку, пока evaluator возвращает `pending`.

После `npm run typecheck`, `npm run lint`, `npm test` и `npm run build` закоммить свои изменения и отправь ветку в свой fork. Если `origin` действительно указывает на `arsengabdrahmanov7-ux/scopeshift-arsen`:

```sh
git push origin feat/frontend-experience
```

Открой PR между fork и основным репозиторием:

- Base repository: `Dan1q-dev/scopeshift`, branch `main`.
- Head repository: `arsengabdrahmanov7-ux/scopeshift-arsen`, branch `feat/frontend-experience`.

Для такого PR достаточно права записи в собственный fork. Дополнительное право записи в основной репозиторий не является условием открытия PR из fork. Приглашение в общий репозиторий можно принять отдельно. Пришли капитану ссылку на PR, реальные результаты проверок и список того, что еще не подключено.

## Альбине и ее агенту

Альбина, PR #1 уже в `Dan1q-dev/scopeshift:main`. Подтяни рабочий backend в свою ветку, сохранив свою работу:

```sh
git fetch origin
git switch feat/scenarios-quality
git merge origin/main
npm ci
```

Если `origin` указывает не на общий репозиторий, сначала проверь remote и используй общий репозиторий как `upstream`. Не переписывай историю своей ветки и не заменяй свои сценарии или критерии чужими файлами целиком.

Сверь оценку с действующим `SimulationEvaluator` из `src/lib/simulation/evaluation-port.ts`. Он принимает `{ scenario, turns, project, completed }` и возвращает общий `EvaluationResult`. Реализуй совместимый экспорт в своей зоне `src/lib/evaluation/**` и передай Даниле имя функции для подключения. Каждый вывод связывай с наблюдаемым ходом и правилом; не изменяй финансовый результат и не оценивай бесплатную правку как ошибку автоматически.

Прогони содержательные случаи: платное и бесплатное дополнение, равноценный обмен scope, отклоненное предложение, допустимый counteroffer с явным принятием, невозможный срок, точный retry и альтернативный Replay. Убедись, что отклоненные условия не меняют договор, принятые изменения применяются один раз, а оценка объясняет реальные действия.

Когда PR frontend Арсена будет слит, обнови Playwright E2E под его фактические экраны вместо старой страницы-заготовки. Проверь полный путь от исходного договора до результата, загрузку, ошибку и retry. Режим `rules-v1` в `main` работает без API-ключа; OpenAI пока отдельная backend-ветка.

Перед PR выполни `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`. Пришли капитану PR из `feat/scenarios-quality` в общий `main`, результаты проверок и оставшиеся несоответствия контрактам. Фронтовые страницы и API не переписывай.
