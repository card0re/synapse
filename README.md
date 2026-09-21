# Synapse

[![CI](https://github.com/card0re/synapse/actions/workflows/ci.yml/badge.svg)](https://github.com/card0re/synapse/actions/workflows/ci.yml)

A skill-exchange marketplace where the currency is time, not money. You teach
someone an hour of English, you earn 60 minutes; you spend those minutes
learning guitar from someone else. No payment rails, no subscription — the
ledger is minutes.

**Live: [synapse.tel](https://synapse.tel)** — in production, in Ukrainian, with real users.

<!-- A screenshot goes well here. -->

## What it does

- **Time-bank ledger.** Every account starts at 120 minutes. Deals freeze the
  price on creation and settle on completion, so nobody can spend the same
  minutes twice.
- **Three ways in.** Telegram bot, Google, or email + password. All three land
  on the same account model.
- **Real-time chat** over WebSockets, with pinning, blocking and unread counts.
- **AI moderation and matching.** Gemini screens new skill listings and
  suggests matches from a user's bio.
- **Calendar integration.** Accepted deals create a Google Calendar event with
  a Meet link for both sides.
- **Telegram bot** for login, deal notifications and lesson reminders.
- **Reviews, ratings, achievements and a leaderboard.**
- **Admin panel** for users, deals, skills, reports and news.

## Architecture

```
                         synapse.tel              api.synapse.tel
                              │                          │
                  ┌───────────▼──────────┐   ┌───────────▼───────────┐
                  │  skillswap-frontend  │   │    skillswap-api      │
                  │  Cloud Run + nginx   │──▶│  Cloud Run, Go + gin  │
                  │  React / Vite build  │   │  min-instances = 1    │
                  └──────────────────────┘   └───────────┬───────────┘
                                                         │
                             ┌───────────────────────────┼──────────────┐
                             │                           │              │
                   ┌─────────▼────────┐       ┌──────────▼───────┐  ┌───▼────────┐
                   │  Cloud SQL       │       │  Telegram Bot    │  │  Gemini,   │
                   │  Postgres        │       │  long-poll,      │  │  Calendar, │
                   │  (unix socket)   │       │  in-process      │  │  SMTP      │
                   └──────────────────┘       └──────────────────┘  └────────────┘
```

The Go service is laid out in layers: `internal/delivery/http` (handlers,
middleware, WebSocket), `internal/usecase` (business rules),
`internal/repository/postgres` (SQL), `internal/domain` (models and the
interfaces the layers talk through). Integrations — Gemini, SMTP — live in
`internal/service`.

## Stack

**Backend** — Go 1.26, gin, pgx + sqlx, golang-jwt, gorilla/websocket,
Telegram Bot API, Google Generative AI (Gemini), Google Calendar API, bcrypt.

**Frontend** — React 19, TypeScript, Vite, Tailwind, shadcn/radix,
framer-motion, react-router, PWA via vite-plugin-pwa.

**Infrastructure** — Cloud Run (two services), Cloud SQL Postgres, Secret
Manager, Docker, GitHub Actions.

## Running it locally

```bash
git clone https://github.com/card0re/synapse.git
cd synapse

cp .env.example .env          # fill in JWT_SECRET_KEY at minimum
docker compose up -d          # postgres on 5432, redis on 6379, adminer on 8081
go run ./cmd/api              # API on :8080

cd frontend
cp .env.example .env
npm ci && npm run dev         # UI on :5173
```

`JWT_SECRET_KEY` has no default and the server refuses to start without one —
that is deliberate, see below. Redis is optional: leave `REDIS_ADDR` empty and
the app logs a warning and runs without caching. Telegram, Gemini, Google
Calendar and email each switch themselves off when their variables are unset,
so a bare `.env` with a database URL and a JWT secret is enough to get the
site running.

```bash
go test ./...                 # unit tests, no database needed
```

## Notes from building it

Things that were not obvious up front, in case they are useful to someone else:

**One replica, on purpose.** The Telegram bot long-polls inside the API
process and a 5-minute cron runs in the same goroutine loop. Scaling past one
instance would double-fire reminders and race the bot on updates, so the
service runs on exactly one instance. Pulling the bot and the cron out into
their own service is the real fix; single-instance was the honest trade for a
project this size.

**Schema drift survives a migration.** Columns added by hand on the old
DigitalOcean database were never written into `migrations/`, so the Cloud SQL
cutover silently dropped them and the Telegram bot started failing days later
with `column "auth_code" does not exist`. There is now an idempotent
`ADD COLUMN IF NOT EXISTS` check at startup as well as a migration — belt and
braces, because the dump had already proved it could be incomplete.

**Passwords that were never hashed.** Two registration handlers existed;
only one hashed, and the route pointed at the other. The parameter was even
named `passwordHash`, which is what made it look right. Email login had been
broken for every account since — bcrypt cannot match plaintext — and the 401
was blamed on the login form for weeks. The fix included a startup pass that
re-hashes any stored value not starting with `$2`, so existing accounts
migrated without anyone resetting a password.

**A JWT fallback secret is not a convenience.** `getJWTSecret()` used to fall
back to a hardcoded string when the variable was missing, and that same string
was the real production secret — sitting in the source. Anyone could mint an
admin token. It now calls `log.Fatal` instead: refusing to boot is a better
failure than booting insecurely.

**Authorization belongs on the route table, not in the handler.** The
ownership check read `c.Param("id")` and so quietly did nothing on the routes
that named the parameter `:userId` or `:user_id` — which is how
`PUT /users/profile/:userId` ended up letting any logged-in user rewrite
anyone's profile. The middleware now takes the parameter name, and the tests
assert against the real route table rather than the middleware in isolation,
because the middleware was never the part that was broken.

## Security

This repository was audited before being published. Credentials that had been
committed — a Google OAuth client secret, a refresh token, an SMTP app
password, the JWT and Postgres secrets — were rotated and removed, and the
history was rewritten to drop them. The authorization bugs described above
were found in the same pass and are fixed.

Found something? Open an issue, or reach me through the site.

## License

MIT — see [LICENSE](LICENSE).
