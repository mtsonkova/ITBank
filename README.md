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

### 4. Run migrations and seed

```bash
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
