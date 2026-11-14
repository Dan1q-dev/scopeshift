# Текст для командного чата

Ребята, общий репозиторий ScopeShift: https://github.com/Dan1q-dev/scopeshift

Примите приглашение GitHub, чтобы появился доступ к записи. Аккаунты: Арсен `arsengabdrahmanov7-ux`, Альбина `albina2nik-crypto`.

Работаем в своих ветках:

- Данила: `feat/backend-simulation`, backend, AI, engine и интеграция.
- Арсен: `feat/frontend-experience`, frontend и UX.
- Альбина: `feat/scenarios-quality`, сценарии, оценка, QA и pitch.
- `main` общая, туда сливаем через PR. Слияние ведет Данила.

Поставьте Node.js 22 (версию 22.12 или новее в ветке 22.x), клонируйте репозиторий, переключитесь на свою ветку, затем `npm ci` и `npm run dev`. Ключ для запуска не нужен.

Пошаговый старт: https://github.com/Dan1q-dev/scopeshift/blob/main/docs/TEAM_QUICKSTART.md

Задания и готовые вводные для вашего AI-агента:

- Арсен: https://github.com/Dan1q-dev/scopeshift/blob/main/docs/tasks/arsen.md
- Альбина: https://github.com/Dan1q-dev/scopeshift/blob/main/docs/tasks/albina.md

PR #1 слит в `main`: engine и POST с HTTP 200 уже доступны. Сохраните текущую работу и выполните в своих ветках `git fetch origin`, затем `git merge origin/main`. Для `rules-v1` ключ не нужен. Подключение OpenAI идет отдельно в backend-ветке, evaluator пока не подключен. Инструкция: https://github.com/Dan1q-dev/scopeshift/blob/main/docs/BACKEND_INTEGRATION.md

Сначала прочитайте AGENTS.md и docs/API_CONTRACT.md. Типы и API общие, чужие зоны файлов не переписываем. Не выдаем fixtures или `rules-v1` за живой AI.

Первый приоритет: соединить один полный сценарий. Отпишитесь в чат, когда проект запустится и будет первый небольшой PR.
