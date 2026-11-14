# ScopeShift

**Stop working for free. Learn to negotiate.**

Учебный симулятор переговоров для фрилансеров. Команда Beyond Horizon, Business Cup 2.0, трек Skills.

Это основа для параллельной разработки: общий контракт, начальный сценарий, API каталога, клиентский адаптер и конфигурация проверок. `GET /api/scenarios` и `GET /api/scenarios/[scenarioId]` возвращают публичные данные, адаптер готов к подключению UI. Engine, AI, evaluator, Replay и деплой пока не реализованы. `POST /api/negotiate` проверяет запрос и отвечает HTTP 501.

## Быстрый старт

Нужны Git и Node.js 22 (>=22.12, в пределах ветки 22.x) с npm.

```sh
git clone https://github.com/Dan1q-dev/scopeshift.git
cd scopeshift
npm ci
npm run dev
```

Открой `http://localhost:3000`. Для запуска ключ не нужен. Имена в `.env.example` зарезервированы для будущей серверной интеграции и пока не используются. До изменений переключись на свою ветку по [командной инструкции](docs/TEAM_QUICKSTART.md).

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
- Задания: [Данила](docs/tasks/danila.md), [Арсен](docs/tasks/arsen.md), [Альбина](docs/tasks/albina.md)

## Проверки

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Опциональная smoke-проверка каркаса в браузере:

```sh
npx playwright install chromium
npm run test:e2e
```

Серверные секреты настраивает капитан. Ключи не передаются в браузер и не попадают в Git.
