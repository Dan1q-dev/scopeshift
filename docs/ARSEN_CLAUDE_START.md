# Инструкция для Claude Арсена

Ты frontend-разработчик Арсена (`arsengabdrahmanov7-ux`) в команде Beyond Horizon. Первый frontend-срез уже принят в общий main через PR #2. Сохрани готовые экраны, подтяни общий main и проверь интеграцию по `docs/TEAM_SYNC_MESSAGE.md`. Не создавай frontend заново. Команды ниже помогают запустить существующий проект и проверить его.

Репозиторий: https://github.com/Dan1q-dev/scopeshift

Твоя ветка: `feat/frontend-experience`. Не создавай новый репозиторий, отдельный проект или новый каркас через `create-next-app`.

Если frontend уже находится в fork `arsengabdrahmanov7-ux/scopeshift-arsen`, сохрани его и следуй разделу Арсена в `docs/TEAM_SYNC_MESSAGE.md`: общий репозиторий подключается как `upstream`, готовый frontend заново не создается.

## 1. Найди и открой проект

Проверь текущую папку и выполни:

```sh
git --version
node --version
npm --version
git status --short --branch
git remote -v
```

Нужен Node.js 22 версии не ниже 22.12 и ниже 23. Если ты еще не в проекте, найди существующую копию `scopeshift` среди доступных папок. Если ее нет, клонируй публичный репозиторий в свободную папку:

```sh
git clone https://github.com/Dan1q-dev/scopeshift.git
cd scopeshift
```

Публичное клонирование не требует приглашения или токена. Не объявляй репозиторий недоступным без попытки и фактической ошибки команды. Не удаляй файлы, не используй force и не генерируй проект заново. Сохраняй незакоммиченную работу; не коммить чужие изменения ради переключения ветки.

```sh
git fetch origin
git branch --list feat/frontend-experience
```

Если локальная ветка есть, выполни `git switch feat/frontend-experience`. Если нет, выполни `git switch --track origin/feat/frontend-experience`.

## 2. Прочитай основу и запусти

Прочитай `AGENTS.md`, `docs/PROJECT_BRIEF.md`, `docs/API_CONTRACT.md`, `docs/tasks/arsen.md`, `src/types/scope.ts` и `src/lib/client/api.ts`.

```sh
npm ci
npm run dev
```

Проверь `http://localhost:3000`. Ключ для запуска основы не нужен. Если запуск не удался, сообщи точную команду, ошибку и что проверил, затем продолжай независимую работу. Не заменяй диагностику общей фразой «нет доступа».

## 3. Проверь существующий frontend-срез

Проверь английский лендинг и рабочий стол симуляции: исходный договор, scope, бюджет, часы, срок, чат, ввод ответа, состояния загрузки и ошибки с повторной отправкой. Используй общие типы и готовые `getScenarios`, `getScenario`, `negotiate`, `ScopeShiftApiError` из клиентского адаптера.

Исходные $1,500, 20 часов и 7 дней бери из GET API. Денежные поля в центах USD. Не выдумывай показатели доверия или готовые результаты переговоров.

PR #1 уже слит в `main`: рабочий backend с `rules-v1` возвращает HTTP 200 по общему контракту. Сохрани свою работу и выполни `git fetch origin`, затем `git merge origin/main` в своей frontend-ветке. Если старый checkout еще отвечает 501, сначала проверь синхронизацию, не пересоздавай проект и не переписывай сервер. OpenAI подключается отдельно в backend-ветке. Не форсируй конфликты и не выдавай development fixtures за интеграцию.

Твоя зона: `src/app/page.tsx`, `src/app/simulation/**`, `src/app/results/**`, `src/app/globals.css`, `src/components/**`, `src/lib/client/**`. Не меняй общие типы, API, AI, engine, evaluator, сценарии, `package.json` и lockfile без согласования с капитаном. Motion и shadcn/ui могут быть еще не установлены.

## 4. Заверши проверяемым результатом

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Проверь `git diff`, добавь только свои файлы, проверь `git diff --cached`, сделай коммит и `git push origin feat/frontend-experience`. Открой PR в `main`, сливает капитан.

Для записи прими приглашение под аккаунтом `arsengabdrahmanov7-ux`: https://github.com/Dan1q-dev/scopeshift/invitations. Не проси у капитана токен. Если push недоступен, сохрани локальный коммит и сообщи точную ошибку; разработку можно продолжать.

Первый отчет: текущая ветка, успешный запуск или точная ошибка, реализованные экраны, реальные результаты проверок и ссылка на PR при наличии. Не заявляй проверки, которых не выполнял. Используй только обычный дефис, без длинных тире.
