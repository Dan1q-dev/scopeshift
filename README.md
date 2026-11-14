# ScopeShift

**Practice client negotiations. Understand scope changes. Protect your time.**

ScopeShift is a negotiation simulator and project workspace for freelancers working on fixed-fee projects. Practice responding to extra requests, then turn a real client's request into a clear proposal with a defined scope, price and delivery date.

**[Try the live demo](https://scopeshift.vercel.app)** | [Practice](https://scopeshift.vercel.app/simulation) | [Real Project](https://scopeshift.vercel.app/real-projects)

No registration is required. The public demo uses OpenAI and PostgreSQL.

## Practice

Negotiate with a fictional client who asks for more work, an earlier deadline or a scope swap.

- Reply in your own words and receive an English client response.
- See the agreed fee, estimated hours, deadline and effective hourly rate change when an agreement is accepted.
- Get feedback tied to your actual reply and the resulting project decisions.
- Use **Improve this reply** or **Replay from here** to create a separate attempt, rewrite your response and compare outcomes.

For example, a $1,500 project estimated at 20 hours starts at **$75/hour**. Accepting six extra hours for free reduces that to **$57.69/hour**. Agreeing on an extra $400 instead produces **$73.08/hour** over 26 hours. ScopeShift makes these trade-offs visible.

## Real Project

Apply the same discipline to your own project before replying to a client.

1. Paste the agreed scope and any approved amendments, then add the client's new request.
2. Review each requested change alongside exact quotations from your source text. Correct the AI's classifications where needed.
3. Enter your own effort estimates, price adjustment, expenses, removed work and delivery extension.
4. Calculate proposed terms, generate an English response, edit it, and copy the reply or proposed Change Order.

Analysis, calculation and draft generation do not record client acceptance. You decide what to propose and what to send. Real Project currently accepts pasted text, not PDF, DOCX or image uploads.

## How it works

OpenAI interprets messages and writes client dialogue. A deterministic TypeScript engine checks the Practice scenario rules and calculates project outcomes. Only accepted agreements change the Practice contract, and retrying a saved turn does not apply it twice.

In Real Project, the server verifies that cited text exists in the supplied sources. Classifications require your review, and financial calculations use the estimates and terms you enter. The analysis is planning assistance, not a legal conclusion.

History is private to an anonymous browser session. Clearing its cookie, switching browsers or losing the session can prevent recovery. Accounts and cross-device recovery are not available.

## Run locally

Requires **Node.js 22.12 or later within Node 22.x**, npm and Git.

```sh
git clone https://github.com/Dan1q-dev/scopeshift.git
cd scopeshift
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000).

The default `rules` mode needs no API key or database. It runs Practice with a bounded English interpreter and scripted client replies. OpenAI dialogue and Real Project require the server configuration below.

### Enable OpenAI and persistent history

Set these server-side values in `.env.local`:

```dotenv
SCOPESHIFT_AI_MODE=openai
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-5.4-mini
SCOPESHIFT_SESSION_SECRET=your_random_secret_of_at_least_32_characters
SCOPESHIFT_STORAGE=postgres
SCOPESHIFT_DATABASE_URL=postgresql://user:password@host/database
SCOPESHIFT_DAILY_AI_CALL_LIMIT=200
```

Create a random session secret, for example:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Apply both database migrations before starting the app:

```sh
node --env-file=.env.local scripts/migrate-postgres.mjs --real-project-mode
npm run dev
```

Migrations require a direct PostgreSQL connection, not a pooler URL. The application can use a pooled connection after migration. Keep the session secret stable across deployments and keep credentials on the server. `.env.local` is excluded from Git.

## Development

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

Browser tests use Playwright:

```sh
npx playwright install chromium
npm run test:e2e
```

Database integration tests run when `SCOPESHIFT_TEST_DATABASE_URL` points to a dedicated test database. They are skipped otherwise. Use a disposable test database for these checks.

## Project structure

| Directory | Contents |
| --- | --- |
| `src/app` | Pages and HTTP API routes |
| `src/components` | Practice, Results and Real Project interfaces |
| `src/lib/ai` | OpenAI adapters and rules-based interpretation |
| `src/lib/simulation` | Negotiation engine, session history and replay storage |
| `src/lib/real-projects` | Source verification, proposals, calculations and persistence |
| `src/lib/evaluation` | Evidence-based Practice feedback |
| `src/types` | Shared TypeScript types and validation schemas |
| `tests` | API, scenario and browser tests with fictional fixtures |
| `migrations` | PostgreSQL schema migrations |
| `scripts` | Database, deployment and smoke-check utilities |

Built with Next.js, React, TypeScript, Tailwind CSS, Zod, OpenAI and PostgreSQL. The public demo is hosted on Vercel with Neon Postgres.

## Team

Built by **Beyond Horizon** for Business Cup 2.0, Skills track.

- **Danila**: backend, simulation engine, AI integration and deployment.
- **Arsen**: frontend, user experience, Replay and comparison.
- **Albina**: scenarios, evaluation and quality assurance.
