# IT Bank Banking Simulator — Project Memory

Training project for manual and automation QA practice. Not connected to any real bank.

## Architecture

TypeScript monorepo — npm workspaces:
```
banking-simulator/
├── packages/shared-types/   ← Zod schemas + inferred TS types
├── backend/                  ← Express REST API (Node 20) + embedded SQLite database file
├── frontend/                 ← React 18 SPA (Vite)
└── BUILD_PLAN.md             ← source of truth for all decisions
```

## Key decisions (see BUILD_PLAN.md for full detail)

- **Database:** embedded SQLite (file: `backend/prisma/dev.db`) — no Docker/server dependency, Spring PetClinic-style. Prisma's SQLite connector doesn't support native enums or Json columns: role/status/type columns are plain strings validated via the Zod enums in `packages/shared-types`, and `Request.payload` is a JSON string serialized/parsed via `backend/src/lib/jsonPayload.ts`.
- **Roles:** customer | account_manager | admin — fixed per login, no role switcher
- **IBAN:** `IB` + 2 random digits + 16 random alphanumeric = 20 chars, displayed as `IB12 XXXX XXXX XXXX XXXX`
- **Auth:** JWT (8h, payload: `{ sub, role, jti, iat, exp }`), bcrypt cost ≥ 12
- **Logout:** in-memory blacklist keyed by `jti`, TTL = remaining token expiry
- **Passwords:** all seeded users use `Password123!`
- **E2E tests:** out of scope — backend unit tests only (Vitest + Supertest)
- **Swagger:** auto-generated OpenAPI at `/api/v1/docs`
- **DB reset:** `POST /api/v1/test/reset` — disabled when `NODE_ENV=production`

## Design

Direction **1a · Ocean Header**: white 252px sidebar + deep-blue `#0077B6` header.
Design tokens in `BUILD_PLAN.md §Design Direction`.
Fonts: Bitter (headings/logo) + Libre Franklin (UI) from Google Fonts.

## Demo credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | michael.scott | Password123! |
| Manager | sofia.lang | Password123! |
| Customer | anna.becker | Password123! |

## Running locally

```bash
npm install                   # install all workspaces
npm run db:migrate            # run Prisma migrations (creates backend/prisma/dev.db)
npm run db:seed               # seed demo data
npm run dev:backend           # backend on :3000
npm run dev:frontend          # frontend on :5173
```

## Milestone branches

| Milestone | Branch | Scope |
|-----------|--------|-------|
| M1 | milestone/m1-foundation | Scaffolding, DB, auth, app shell, login |
| M2 | milestone/m2-customer | Customer features |
| M3 | milestone/m3-manager | Account manager features |
| M4 | milestone/m4-admin | Admin features |
| M5 | milestone/m5-history | Transaction history (all roles) |
| M6 | milestone/m6-search | Global search + export |
| M7 | milestone/m7-polish | Validation, error handling, data-testid audit |
