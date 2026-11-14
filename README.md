# ScopeShift

**Stop working for free. Learn to negotiate.**

Учебный симулятор переговоров для фрилансеров. Команда Beyond Horizon, Business Cup 2.0, трек Skills.

В `feat/backend-simulation` добавлен backend-срез: GET API каталога и сценария, детерминированный engine, обработка переговоров и воспроизведение истории. Корректный `POST /api/negotiate` возвращает HTTP 200 по прежнему контракту; клиентский адаптер готов к подключению UI. Английский интерпретатор `rules-v1` ограничен явными формулировками. Live LLM и evaluator не подключены, страницы остаются заготовками, Replay UI и деплой не готовы. До слияния PR `main` содержит прежний каркас.

## Быстрый старт

Нужны Git и Node.js 22 (>=22.12, в пределах ветки 22.x) с npm.

Для проверки backend-среза запусти именно его ветку. Арсен и Альбина работают в своих ветках по [командной инструкции](docs/TEAM_QUICKSTART.md) и получают backend после слияния PR в `main`.

```sh
git clone https://github.com/Dan1q-dev/scopeshift.git
cd scopeshift
git switch --track origin/feat/backend-simulation
npm ci
npm run dev
```

Открой `http://localhost:3000`. Для запуска ключ не нужен. Имена в `.env.example` зарезервированы для будущей серверной интеграции и пока не используются. Если репозиторий уже клонирован и локальная backend-ветка существует, используй `git switch feat/backend-simulation` после `git fetch origin`.

## Команда

| Участник | GitHub | Рабочая ветка | Зона |
| --- | --- | --- | --- |
| Данила | [Dan1q-dev](https://github.com/Dan1q-dev) | `feat/backend-simulation` | Backend, AI, engine, CI, интеграция |
| Арсен | [arsengabdrahmanov7-ux](https://github.com/arsengabdrahmanov7-ux) | `feat/frontend-experience` | Frontend и UX |
| Альбина | [albina2nik-crypto](https://github.com/albina2nik-crypto) | `feat/scenarios-quality` | Сценарии, оценка, QA, pitch |

`main` - общая ветка для слияния проверенных PR. Интеграцию ведет Данила.

## Документы

- [Правила для участников и AI-агентов](AGENTS.md)
- [Короткая инструкция команде](docs/TEAM_QUICKSTART.md)
- [Готовое сообщение для командного чата](docs/TEAM_MESSAGE.md)
- [Общее описание продукта](docs/PROJECT_BRIEF.md)
- [API-контракт](docs/API_CONTRACT.md) и [общие типы](src/types/scope.ts)
- [Подключение backend и текущие ограничения](docs/BACKEND_INTEGRATION.md)
- Задания: [Данила](docs/tasks/danila.md), [Арсен](docs/tasks/arsen.md), [Альбина](docs/tasks/albina.md)

## Проверки

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Для HTTP smoke-проверки backend сначала запусти сервер, затем в другом терминале:

```sh
node scripts/smoke-backend.mjs http://127.0.0.1:3000
```

Опциональная smoke-проверка каркаса в браузере:

```sh
npx playwright install chromium
npm run test:e2e
```

Серверные секреты настраивает капитан. Ключи не передаются в браузер и не попадают в Git.
