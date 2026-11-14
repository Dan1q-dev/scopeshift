# ScopeShift

**Stop working for free. Learn to negotiate.**

Учебный симулятор переговоров для фрилансеров. Команда Beyond Horizon, Business Cup 2.0, трек Skills.

В `main` слиты PR #1 с рабочим backend и PR #2 с frontend Арсена: лендинг, рабочий стол, результаты и Replay UI. API использует прежние общие контракты, production fixtures удалены. В main работает ограниченный английский `rules-v1`; OpenAI-интеграция находится отдельно в `feat/backend-simulation`. Evaluator и облачный деплой пока не подключены. Проверка общего пользовательского потока продолжается.

## Быстрый старт

Нужны Git и Node.js 22 (>=22.12, в пределах ветки 22.x) с npm.

Клонирование открывает `main` с рабочим backend. Перед разработкой переключись на свою ветку по [командной инструкции](docs/TEAM_QUICKSTART.md), затем подтяни в нее `origin/main`.

```sh
git clone https://github.com/Dan1q-dev/scopeshift.git
cd scopeshift
npm ci
npm run dev
```

Открой `http://localhost:3000`. Для режима `rules-v1` ключ не нужен. Если копия уже существует, сохрани текущую работу, выполни `git fetch origin` и `git merge origin/main` в своей рабочей ветке.

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
- [Синхронизация fork Арсена и работы Альбины](docs/TEAM_SYNC_MESSAGE.md)
- [Общее описание продукта](docs/PROJECT_BRIEF.md)
- [API-контракт](docs/API_CONTRACT.md) и [общие типы](src/types/scope.ts)
- [Подключение backend и текущие ограничения](docs/BACKEND_INTEGRATION.md)
- [Локальная настройка OpenAI](docs/OPENAI_SETUP.md)
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
