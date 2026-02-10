# Matchpoint

Matchpoint is a tournament operations platform with two apps in one repository:

- **`server/`**: an Express + Prisma API for tournament administration, bracket management, scheduling, scoring, and public tournament data.
- **`frontend/`**: a Next.js (App Router) UI for tournament directors (`/td/*`) and public-facing displays (`/public/*`).

## Repository structure

```text
.
├── frontend/   # Next.js app (TypeScript, Tailwind, React Query)
└── server/     # Express API (CommonJS, Prisma, Postgres)
```

## Tech stack

### Frontend
- Next.js 16 + React 18
- TypeScript
- Tailwind CSS + Radix UI primitives
- TanStack Query for data fetching/caching

### Backend
- Node.js + Express 5
- Prisma ORM + PostgreSQL
- JWT authentication
- Jest/Supertest support and API verification scripts

## Prerequisites

- **Node.js** `>=18 <=20`
- **npm** `>=9 <=10`
- A running PostgreSQL database (for the API)

> Both `frontend/package.json` and `server/package.json` enforce the same Node/NPM engine range.

## Environment configuration

### Server (`server/.env`)

Create a `.env` file in `server/` with at least:

```bash
DATABASE_URL=postgresql://<user>:<password>@<host>:<port>/<database>
TD_EMAIL=director@example.com
TD_PASSWORD_HASH=<bcrypt-hash>
TD_JWT_SECRET=<long-random-secret>
# Optional
CORS_ALLOW_ORIGIN=http://localhost:3100
PORT=8080
```

Notes:
- Auth config is required at runtime (`TD_EMAIL`, `TD_PASSWORD_HASH`, `TD_JWT_SECRET`).
- In development, if `CORS_ALLOW_ORIGIN` is unset, server defaults to `http://localhost:3100`.

### Frontend (`frontend/.env.local`)

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

If omitted in development, the frontend also defaults to `http://localhost:8080`.

## Install dependencies

Install per workspace:

```bash
cd server && npm install
cd ../frontend && npm install
```

## Database setup (server)

From `server/`:

```bash
npx prisma migrate deploy
npx prisma generate
```

For local development where you control schema changes:

```bash
npx prisma migrate dev
```

Optional seed scripts:

```bash
npm run prisma:seed
node prisma/seedUser.js
```

## Run locally

Use two terminals.

### Terminal 1: API

```bash
cd server
npm run dev
```

Server starts on `http://localhost:8080` (unless `PORT` overrides it).

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

Open:
- `http://localhost:3000/login` for TD login
- `http://localhost:3000/td` for the tournament director console
- `http://localhost:3000/public/<tournament-slug>/players` (and `/standings`, `/table`, `/brackets`) for public views

## Common scripts

### Frontend (`frontend/`)

```bash
npm run dev
npm run build
npm run start
npm run lint
```

### Server (`server/`)

```bash
npm run dev
npm run start
npm test
npm run verify:api
npm run simulate:tournament
```

## API overview

Base path: `/api/v1`

Key route groups:
- `/auth` – login/token issuance
- `/tournaments` – tournament + division + bracket management
- `/teams`, `/players` – roster administration
- `/public/:slug/*` – public standings, players, queue/table, and bracket data

Health endpoint:

```http
GET /health
```

## Authentication model

- Login returns a JWT token (`/api/v1/auth/login`).
- TD routes are protected with bearer auth middleware.
- Frontend stores the token in `localStorage` and injects it into API calls.

## Suggested newcomer path

1. Read `server/prisma/schema.prisma` to understand core entities and relations.
2. Review `server/src/routes/tournaments.js` and `server/src/routes/brackets.js` for core admin flows.
3. Explore `frontend/src/app/td/*` for TD UX and `frontend/src/app/public/*` for display UX.
4. Follow data flow through `frontend/src/lib/api/*` and `frontend/src/hooks/*`.

## Troubleshooting

- **401 Unauthorized on TD routes**: verify login credentials and bearer token presence.
- **CORS errors**: confirm `CORS_ALLOW_ORIGIN` (server) matches frontend origin.
- **Database connection errors**: validate `DATABASE_URL` and ensure Postgres is running.
- **Missing auth configuration**: set `TD_EMAIL`, `TD_PASSWORD_HASH`, and `TD_JWT_SECRET`.

---

If you are extending functionality, keep backend domain logic in `server/src/services/` and keep route handlers focused on validation + orchestration.
