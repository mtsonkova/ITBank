# IT Bank — Banking Simulator

A web-based banking simulator for QA training. Supports three roles: **Customer**, **Account Manager**, and **Admin**.

> This is a dummy training project. It does not connect to any real bank, move real money, or hold real financial data.

## Prerequisites

- Node.js 20+
- Docker + Docker Compose

## Local Setup

### 1. Start the database

```bash
docker compose up -d
```

This starts PostgreSQL 16 on port `5432`.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` if your DB credentials differ from the defaults.

### 4. Generate the Prisma client, run migrations, and seed

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

### 5. Start the app

```bash
# Terminal 1 — backend (http://localhost:3000)
npm run dev:backend

# Terminal 2 — frontend (http://localhost:5173)
npm run dev:frontend
```

## Demo accounts

Password for all accounts: `Password123!`

| Role | Username |
|------|----------|
| Admin | michael.scott |
| Manager | sofia.lang |
| Manager | david.mertens |
| Customer | anna.becker |
| Customer | lukas.vogel |
| Customer | mara.klein |
| Customer | tomas.roth |

## API docs

Swagger UI available at [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs) when the backend is running.

## Database reset

Admins can reset the database to its seeded state via the Admin panel, or directly:

```bash
curl -X POST http://localhost:3000/api/v1/test/reset
```

> Disabled when `NODE_ENV=production`.

## Running tests

```bash
npm test
```

## Type checking & builds

```bash
cd backend && npm run build                # tsc
cd frontend && npm run typecheck           # tsc --noEmit
cd frontend && npm run build               # tsc && vite build
cd packages/shared-types && npm run typecheck
```

## Troubleshooting

- **`ECONNREFUSED` on backend startup** — Postgres isn't reachable. Check `docker compose ps` and confirm `DATABASE_URL` in `backend/.env` matches the container's credentials/port.
- **Prisma client errors ("did you forget to run generate?")** — run `npm run db:generate`.
- **Port already in use (3000 or 5173)** — find and stop the other process (`lsof -i:3000`), or change `PORT` in `backend/.env` (and `VITE_API_BASE_URL` in `frontend/.env` to match).
- **Login always fails** — confirm the DB was seeded (`npm run db:seed`) and that you're using `Password123!`.
