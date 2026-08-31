# Banking Simulator — Technical Stack

> ⚠️ This is a dummy training project for manual and automation QA practice. It does not connect to any real bank, move real money, or hold real financial data.

## Project Type
Web application (browser-based SPA + REST API). No desktop or mobile component.

## Architecture
TypeScript monorepo using **npm workspaces**, with a shared types package consumed by both frontend and backend so request/response contracts can't silently drift between them.

```
banking-simulator/
├── packages/
│   └── shared-types/      ← Zod schemas + inferred TS types (enums, entities, API envelopes)
├── backend/                ← REST API (+ embedded SQLite database file)
├── frontend/                ← React SPA
└── SPEC.md / requirements   ← source-of-truth task breakdown
```

## Frontend
| Concern | Choice |
|---|---|
| Language | TypeScript |
| Framework | React 18 |
| Build tool | Vite |
| Routing | React Router v6 |
| Server state / data fetching | TanStack Query |
| HTTP client | Axios |
| Styling | TailwindCSS |

## Backend
| Concern | Choice |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 20 |
| Web framework | Express |
| ORM | Prisma |
| Validation | Zod |
| Auth | JWT (Bearer token), bcrypt password hashing (cost ≥ 12) |
| API docs | Swagger UI at `/api/v1/docs`, generated from an OpenAPI spec |

## Database
| Concern | Choice |
|---|---|
| Engine | SQLite (embedded, file-based) |
| Provisioning | None — `backend/prisma/dev.db` is created on first migration, no server or container to run |
| Schema/migrations | Prisma schema + migrations |
| Seed data | Prisma seed script — 1 admin, 2 account managers, 4 customers (2 per manager), each with a sample bank account, debit card, and credit card |
| Demo login | All seeded users share password `Password123!` |

## Testing & QA Support
| Concern | Choice |
|---|---|
| API-level tests | Vitest + Supertest |
| E2E tests | Out of scope |
| Test selectors | `data-testid` attributes on all interactive/informational UI elements (no CSS class or text selectors) |
| API exploration | Swagger UI for manually exercising endpoints |
| Test data reset | `POST /api/v1/test/reset` — re-seeds the database to a known state; disabled when `NODE_ENV=production` |

## Why TypeScript End-to-End
The domain is heavy with status/enum-driven business rules (account/card `active`/`frozen`/`closed`, 15 request types, overdraft rules that differ by instrument). A shared Zod/TypeScript types package means these rules are checked at compile time on both frontend and backend, rather than only discovered at runtime — which matters for a project whose purpose is being a realistic, bug-discoverable target for QA practice.

## Why a Monorepo (vs. separate repos)
One team, one product, no need for independent deploy cadence across services — the scenario where separate repos with a published contract package wins in real fintech orgs. A monorepo with a `shared-types` package gets the same type-safety benefit with far less infrastructure, and keeps the seed data, API routes, and frontend API client referencing the exact same enums and shapes.

## Why an embedded database (SQLite, not Postgres)
Originally the project ran on Postgres via Docker Compose for closer parity with a real banking backend. It was later switched to an embedded SQLite file (the Spring PetClinic model) to drop the Docker/server dependency entirely — clone, `npm install`, run — which matters more for a QA training project than concurrent-write realism. Trade-offs accepted: no native enum or JSON column types (enforced instead by the Zod schemas in `packages/shared-types`), and `mode: 'insensitive'` Prisma filters were removed in favor of SQLite's default case-insensitive `LIKE`.
