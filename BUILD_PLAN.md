# IT Bank Banking Simulator — Build Plan

> **Reference file** — save and use to restore context if the conversation window is lost.
> All decisions below were confirmed with the project owner before finalisation.

---

## Confirmed Requirements (Q&A Summary)

| Topic | Decision |
|---|---|
| Navigation | 5 separate SPEC routes for customer (no combined pages) |
| Role switcher | Removed — users have one fixed role per login |
| Account types | Savings or Current; chosen by Customer when requesting, by Manager/Admin when creating directly |
| IBAN format | Auto-generated `IB` + 2 random digits + 16 alphanumeric chars, grouped: `IB12 XXXX XXXX XXXX XXXX XX` |
| Search bar | Functional, role-scoped; results in modal table with export (.pdf .csv .xls .xlsx .ods) |
| Change password | Modal dialog over current page; inline success/error messages |
| Transaction history | Dedicated nav-level page per role (customer: own data; manager: portfolio + client detail view; admin: system-wide) |
| Jira project | Skip — epics/stories already captured in `banking_simulator_jira_epics.md` |
| Milestone order | Follow SPEC milestone order; each milestone on a separate git branch; backend unit tests per milestone |
| Deposit UX | Tab within Transfer & Pay page (`/customer/transactions`) |
| Search scope | Customer → own accounts/cards/transactions; Manager → portfolio clients/accounts/transactions; Admin → all users/accounts/managers/transactions |
| Admin transaction history | System-wide page (`/admin/history`) |
| Export scope | Both search results modal AND transaction history pages |
| Transaction history milestone | Separate milestone (M5) |
| Login credentials display | Static informational text on login screen for 3 demo users; password for all seeded users: `pass` |
| Demo user credentials | Admin: `michael.scott` / Manager: `sofia.lang` / Customer: `anna.becker` — all `pass` |
| Unit tests | Backend only (Vitest + Supertest); Playwright E2E out of scope |
| DB reset button | Admin panel only; confirmation modal before reset; success/abort modals after |
| Dashboard routes | Added for Customer (`/customer/dashboard`) and Manager (`/manager/dashboard`) — not in original SPEC |

---

## Tech Stack

### Architecture
TypeScript monorepo — npm workspaces

```
banking-simulator/
├── packages/
│   └── shared-types/       ← Zod schemas + inferred TS types (enums, entities, API envelopes)
├── backend/                 ← REST API
├── frontend/                ← React SPA
├── docker-compose.yml       ← PostgreSQL 16
└── BUILD_PLAN.md            ← this file
```

### Frontend
| Concern | Choice |
|---|---|
| Language | TypeScript |
| Framework | React 18 |
| Build tool | Vite |
| Routing | React Router v6 |
| Server state | TanStack Query |
| HTTP client | Axios |
| Styling | TailwindCSS |

### Backend
| Concern | Choice |
|---|---|
| Language | TypeScript |
| Runtime | Node.js 20 |
| Framework | Express |
| ORM | Prisma |
| Validation | Zod |
| Auth | JWT (Bearer token), bcrypt (cost ≥ 12) |
| API docs | Swagger UI at `/api/v1/docs` |

### Database
| Concern | Choice |
|---|---|
| Engine | PostgreSQL 16 |
| Provisioning | Docker Compose (named volume) |
| Migrations | Prisma schema + migrations |
| Seed | Prisma seed script |
| Demo password | All seeded users: `pass` |

### Testing
| Concern | Choice |
|---|---|
| Backend unit tests | Vitest + Supertest (per milestone) |
| E2E | Out of scope |
| Test selectors | `data-testid` on all interactive/informational elements |
| DB reset | `POST /api/v1/test/reset` (disabled in production) |

---

## Design Direction

**1a · Ocean Header** — white sidebar (252px) + deep blue (`#0077B6`) top header.

### Design Tokens
**Colors**
- Brand deep / header: `#0077B6`
- Brand primary (logo "IT", buttons): `#0096C7`
- Brand bright (accents): `#00B4D8`
- Brand light (tints): `#90E0EF`
- Surface / text primary: `#FFFFFF` / `#0F172A`
- Muted text: `#5B6B7A`; faint text: `#8595A3`
- Borders: `#E3EEF3`, `#EEF4F7`; input border: `#CFE4ED`; outline button: `#BFE6F2`
- Tint backgrounds: `#F4FAFC`, `#F1F7FA`, `#E6F4F9`
- Status — success: `#2E7D5B` on `#E7F3EC`; warning: `#9A6B12` on `#FBF1E0`; danger: `#B0463C` on `#F6E9E8`; error banner: `#9C342C`/`#C2453D` on `#FCEDEB`

**Typography**
- Display/headings/logo: **Bitter** (slab serif) — loaded from Google Fonts
- UI/body: **Libre Franklin** — loaded from Google Fonts
- Numerics: `font-variant-numeric: tabular-nums`

**Spacing / Radius / Shadow**
- Content padding: `30px 34px`; card padding: `18–24px`; grid gaps: `16–18px`
- Radius: cards `14px`; shell `18px`; buttons `8–10px`; pills `999px`
- Shadow: cards `0 1px 2px rgba(2,32,71,.04)`

**Currency:** EUR only — format `€1,234.56`; negative: `€-340.00`

---

## Branching Strategy

- `main` — stable, always deployable
- Each milestone: `milestone/m{n}-{name}` cut from `main`
- PR opened when milestone is complete; merged into `main` after review
- Feature sub-branches within a milestone (`feat/...`) optional

### Definition of Done (per milestone)
- [ ] All features work end-to-end (frontend → backend → DB)
- [ ] Business rules enforced at API level
- [ ] All `data-testid` attributes present on interactive/informational elements
- [ ] Success and error messages visible for every action
- [ ] Backend unit tests pass
- [ ] No console errors in browser or server logs
- [ ] PR opened against `main`

---

## Milestone Overview

| # | Branch | SPEC Tasks | Description |
|---|---|---|---|
| M1 | `milestone/m1-foundation` | 01, 02, 03, 13 | Scaffolding, DB, auth, app shell, login |
| M2 | `milestone/m2-customer` | 04, 05, 06, 16 | All customer features |
| M3 | `milestone/m3-manager` | 07, 08, 09, 10 | All account manager features |
| M4 | `milestone/m4-admin` | 11, 12 | All admin features |
| M5 | `milestone/m5-history` | new | Transaction history (all roles) |
| M6 | `milestone/m6-search` | new | Global search + export |
| M7 | `milestone/m7-polish` | 14 | Validation, error handling, data-testid audit |

---

## M1 – Foundation
**Branch:** `milestone/m1-foundation`

### 1.1 Monorepo Scaffolding
- Root `package.json` with npm workspaces: `backend/`, `frontend/`, `packages/shared-types/`
- `docker-compose.yml` — PostgreSQL 16, named volume
- `CLAUDE.md` at root (project memory)
- `.env.example` for `backend/` and `frontend/`
- Root `README.md` with local setup instructions

### 1.2 Shared Types Package (`packages/shared-types/`)
- Zod schemas for all domain entities: `User`, `BankAccount`, `DebitCard`, `CreditCard`, `Transaction`, `Request`
- Enums: `Role`, `AccountType`, `AccountStatus`, `CardStatus`, `RequestType`, `RequestStatus`, `TransactionType`
- API envelope types: `ApiSuccess<T>`, `ApiError`
- Consumed by both `backend/` and `frontend/` via workspace reference

### 1.3 Database — Prisma Schema + Seed

**Tables:**

| Table | Key fields |
|---|---|
| `users` | id (UUID), username, password_hash, role, full_name, created_at |
| `customer_assignments` | customer_id → account_manager_id (PK: customer_id) |
| `bank_accounts` | id, customer_id, iban, type (savings\|current), status (active\|frozen\|closed), balance (DECIMAL 15,2), created_at |
| `debit_cards` | id, bank_account_id, customer_id, status, created_at |
| `credit_cards` | id, customer_id, status, credit_limit (DECIMAL 15,2), outstanding_balance (DECIMAL 15,2), created_at |
| `transactions` | id, type, from_account_id?, to_account_id?, from_card_id?, to_card_id?, debit_card_id?, amount, description?, created_at |
| `requests` | id, customer_id, account_manager_id?, type, status (pending\|approved\|rejected\|cancelled), payload (JSON), rejection_reason?, created_at, actioned_at? |

**IBAN format:** `IB` + 2 random digits + 16 random alphanumeric chars → displayed as `IB12 XXXX XXXX XXXX XXXX XX`

**Seed data (`prisma/seed.ts`):**
- 1 admin: `michael.scott` / `pass`
- 2 managers: `sofia.lang` / `pass`, `david.mertens` / `pass`
- 4 customers (2 per manager): `anna.becker`, `lukas.vogel`, `mara.klein`, `tomas.roth` — all `pass`
- Each customer: 1 savings account + 1 current account, 1 debit card per account, 1 credit card (limit €2,000), sample transactions

### 1.4 Backend Skeleton
- Express app: CORS, JSON body parser, global error handler (`{ error, code }`)
- `authenticate` middleware — validates Bearer JWT, attaches `req.user`
- `authorize(...roles)` middleware
- Swagger UI at `/api/v1/docs`
- `GET /api/v1/health`

### 1.5 Auth Endpoints
```
POST  /api/v1/auth/login     { username, password }  →  { token, user: { id, username, role, fullName } }
POST  /api/v1/auth/logout                            →  { message }
PUT   /api/v1/auth/password  { currentPassword, newPassword }  →  { message }
```
- Passwords: bcrypt cost ≥ 12
- JWT: `{ sub: userId, role, iat, exp }`, expires 8h

### 1.6 Frontend Skeleton
- Vite + React 18 + TypeScript + TailwindCSS
- Tailwind config with full design token set (colors, fonts, radius, shadow, spacing)
- Google Fonts: Bitter + Libre Franklin
- Axios instance with JWT Bearer interceptor + 401 redirect to `/login`
- TanStack Query `QueryClientProvider`
- React Router v6 with role-protected route wrapper

### 1.7 App Shell (Design 1a)
- **Layout:** 252px white sidebar + fluid main column (header 62px + scrollable content area)
- **Header (`#0077B6`):** page title (Bitter 600 18px white), search pill (placeholder — functional in M6), user block (initials avatar `#90E0EF`/`#024E73`, name white 13px, role `#BFE6F2` 11px), Sign out button
- **Sidebar:** IT Bank wordmark (Bitter bold italic, "IT" `#0096C7` / "Bank" `#0F172A`), nav list per role, "Change password" pinned bottom
- **Nav active state:** bg `#E6F4F9`, text `#0077B6`, weight 700; inactive: text `#4A5A67`, hover bg `#F4FAFC`
- **Nav per role:**
  - Customer: Dashboard · Accounts · Cards · Transfer & Pay · Spend · Transaction History · My Requests
  - Manager: Dashboard · My Clients · Approvals · Transaction History
  - Admin: Overview · Approvals · User Management · Transaction History
- Protected routes: unauthenticated → `/login`; wrong role → redirect to role's home
- **Change password modal:** current password + new password inputs; inline success/error; `data-testid`: `modal-change-password`, `input-current-password`, `input-new-password`, `btn-change-password`, `msg-success`, `msg-error`

### 1.8 Login Screen (`/login`)
- Centered 380px card on `linear-gradient(160deg,#F4FAFC,#E3F3F9)`
- IT Bank logo, "Sign in to your account", username input, password input, Sign in button
- Error message on failure
- Static demo credentials panel below the form:
  ```
  Demo accounts  ·  password: pass
  ─────────────────────────────────
  Admin     michael.scott
  Manager   sofia.lang
  Customer  anna.becker
  ```
- After login: redirect to role's dashboard

### 1.9 Routes added in M1
| Path | Role |
|---|---|
| `/login` | public |
| `/customer/dashboard` | customer |
| `/manager/dashboard` | account_manager |
| `/admin/overview` | admin |

### 1.10 Backend Unit Tests (M1)
- Login: success, wrong password (401), missing fields (400)
- JWT: valid accepted, missing (401), expired (401)
- Password change: success, wrong current (400), missing fields (400)

---

## M2 – Customer Features
**Branch:** `milestone/m2-customer` (cut from `main` after M1 merge)
**SPEC tasks:** 04, 05, 06, 16

### 2.1 Customer Dashboard (`/customer/dashboard`)
- Greeting: "Good [morning/afternoon/evening], [fullName]"
- 4 stat cards: Total Balance | Active Accounts | Cards | Pending Requests (amber count)
- Two-column: "Your accounts" list (IBAN, type, status badge, balance) + "Recent transactions" (last 5)
- Quick actions: Transfer money (primary), Deposit, Pay/Spend, New Request (outline)

### 2.2 Accounts Page (`/customer/accounts`)
- 3-col grid of account cards: type, status badge, IBAN, balance (Bitter 24px)
- Contextual buttons per status: Freeze / Unfreeze / Request Close
- "Request New Account" → modal: choose type (savings / current)
- Requests table: type, submitted, status, Cancel (pending), rejection reason (rejected)

**API:**
```
GET    /api/v1/accounts
POST   /api/v1/requests  { type: open_account|close_account|freeze_account|unfreeze_account, payload? }
DELETE /api/v1/requests/:id
```
**Rules:** close blocked if balance ≠ €0.00; unfreeze only for frozen; no duplicate pending same type+account

### 2.3 Cards Page (`/customer/cards`)
- **Debit cards:** gradient tiles (`135deg, #0077B6, #00B4D8`), masked IBAN, linked account, status pill; actions: Freeze / Unfreeze / Request Close / Request New (select active account)
- **Credit card:** dark `#0F172A` tile, credit limit, outstanding balance (overdraft in `#FFB4A8`), status pill; actions: Freeze / Unfreeze / Request Close / Request Increase Limit / Request Decrease Limit; self-service Top Up modal
- Requests section with cancel / rejection reason display

**API:**
```
GET  /api/v1/cards/debit
GET  /api/v1/cards/credit
POST /api/v1/requests  { type: issue_debit_card|close_debit_card|freeze_debit_card|unfreeze_debit_card
                               |issue_credit_card|close_credit_card|freeze_credit_card|unfreeze_credit_card
                               |increase_credit_limit|decrease_credit_limit, payload }
POST /api/v1/transactions/topup  { from_type: account|debit_card, from_id, to_card_id, amount }
```

### 2.4 Transfer & Pay Page (`/customer/transactions`)
Tabs: **Deposit | Transfer | Top-Up | Withdraw Request**

- **Deposit:** select account, amount → immediate balance update + transaction record
- **Transfer:** toggle same-customer / cross-customer; from/to selectors, amount, note
  - Same-customer insufficient funds: 422 → red banner + top-up sources (active = selectable, frozen = greyed with warning, closed = hidden)
  - Cross-customer (account→account only): 422 → error only, no top-up
- **Top-Up:** source (account or debit card) + credit card + amount → self-service instant
- **Withdraw Request:** account + amount → `withdraw_money` pending request

**API:**
```
POST /api/v1/transactions/deposit             { account_id, amount }
POST /api/v1/transactions/transfer            { from_type, from_id, to_type, to_id, amount, note? }
POST /api/v1/transactions/transfer/external   { from_account_id, to_account_id, amount }
POST /api/v1/transactions/topup               { from_type, from_id, to_card_id, amount }
POST /api/v1/requests                         { type: withdraw_money, payload: { account_id, amount } }
```

### 2.5 Spend Page (`/customer/spend`)
- Select instrument (account / debit card / credit card), amount, optional description
- Bank/debit insufficient funds → warning + top-up sources (frozen greyed, closed hidden; no sources → message)
- Credit card: overdraft always permitted, no insufficient funds warning

**API:**
```
POST /api/v1/transactions/spend  { source_type: account|debit_card|credit_card, source_id, amount, description? }
```
Insufficient funds 422: `{ error, code: INSUFFICIENT_FUNDS, available_balance, required_amount, top_up_sources[] }`

### 2.6 My Requests Page (`/customer/requests`)
- Table: Request | Submitted | Status | Action
- Status badges: Pending (amber), Approved (green), Rejected (red)
- Pending: Cancel button; Rejected: rejection reason inline

### 2.7 Backend Unit Tests (M2)
- Account requests: close with non-zero (422), duplicate pending (422), unfreeze non-frozen (422)
- Card requests: one credit card limit, debit requires active account, top-up > €0.00
- Deposit: balance updated, transaction recorded
- Transfer same-customer: atomic, frozen/closed blocked, no overdraft on bank/debit, overdraft on credit
- Transfer cross-customer: account→account only, no overdraft, no top-up in response
- Spend: bank/debit blocked when balance < amount; credit never blocked; debit draws from linked account
- Insufficient funds response: closed excluded, frozen flagged
- Request cancel: success when pending; 422 when approved/rejected

---

## M3 – Account Manager Features
**Branch:** `milestone/m3-manager` (cut from `main` after M2 merge)
**SPEC tasks:** 07, 08, 09, 10

### 3.1 Manager Dashboard (`/manager/dashboard`)
- "Account Manager workspace" + manager full name + client count
- 4 stat cards: Assigned Clients | Pending Approvals (amber) | Frozen Items | Awaiting Closure
- "Requests awaiting your action" list (latest 4): Approve + Reject per row

### 3.2 My Clients Page (`/manager/clients`)
- Table: Client (avatar + name) | Accounts | Total Balance | Status | View
- "+ Add Customer" → modal: full name, username, password → auto-assigned to this manager

### 3.3 Client Detail Page (`/manager/clients/:id`)
- Sections: Accounts, Debit Cards, Credit Card, Pending Requests
- Direct operations (no request needed): open/close/freeze/unfreeze accounts; issue/close/freeze/unfreeze debit+credit cards
- Account type chosen when opening directly (savings / current)
- Delete Client button: checks 4 conditions → if blocked: modal listing each unmet condition; if clear: confirm → delete → redirect

**API:**
```
GET    /api/v1/manager/clients
GET    /api/v1/manager/clients/:id
POST   /api/v1/manager/clients                             { fullName, username, password }
POST   /api/v1/manager/clients/:id/accounts                { type: savings|current }
PATCH  /api/v1/manager/clients/:id/accounts/:accountId     { status: active|frozen|closed }
POST   /api/v1/manager/clients/:id/debit-cards             { account_id }
PATCH  /api/v1/manager/clients/:id/debit-cards/:cardId     { status }
POST   /api/v1/manager/clients/:id/credit-cards            { credit_limit }
PATCH  /api/v1/manager/clients/:id/credit-cards/:cardId    { status }
DELETE /api/v1/manager/clients/:id
```

### 3.4 Approvals Page (`/manager/requests`)
- Table: Customer | Request | Submitted | Approve + Reject
- Reject: inline amber panel with mandatory textarea, Confirm Rejection + Cancel
- Tabs: Pending | Completed

**API:**
```
GET  /api/v1/manager/requests?status=pending|approved|rejected
POST /api/v1/manager/requests/:id/approve
POST /api/v1/manager/requests/:id/reject  { reason }  ← 400 if missing
```

**Approve side-effects (all 15 request types):**

| Request Type | Side Effect |
|---|---|
| `open_account` | Create bank account (type from payload) |
| `close_account` | Set status `closed` — blocked if balance ≠ €0.00 |
| `freeze_account` | Set status `frozen` |
| `unfreeze_account` | Set status `active` |
| `issue_debit_card` | Create debit card on specified account |
| `close_debit_card` | Set status `closed` |
| `freeze_debit_card` | Set status `frozen` |
| `unfreeze_debit_card` | Set status `active` |
| `issue_credit_card` | Create credit card |
| `close_credit_card` | Set status `closed` — blocked if balance < credit_limit |
| `freeze_credit_card` | Set status `frozen` |
| `unfreeze_credit_card` | Set status `active` |
| `increase_credit_limit` | Update `credit_limit` |
| `decrease_credit_limit` | Update `credit_limit` |
| `withdraw_money` | Deduct from account balance atomically + transaction record |

### 3.5 Backend Unit Tests (M3)
- Portfolio scoping: 403 for clients outside manager's portfolio
- New client auto-assigned to creating manager
- All 15 approve side-effects produce correct DB state
- `close_account` blocked when balance ≠ €0.00 (422)
- `close_credit_card` blocked when balance < credit_limit (422)
- Reject without reason returns 400
- Rejection reason stored and visible
- Client deletion: all 4 conditions checked independently; all unmet returned in single response
- Status transitions validated (cannot unfreeze closed, etc.)

---

## M4 – Admin Features
**Branch:** `milestone/m4-admin` (cut from `main` after M3 merge)
**SPEC tasks:** 11, 12

### 4.1 Admin Overview (`/admin/overview`)
- 4 stat cards: Total Users | Account Managers | Customers | Pending Requests (amber)
- Two columns: system-wide pending requests list + account managers list (name + client count)

### 4.2 Admin Approvals (`/admin/approvals`)
- Same layout as manager approvals
- Subtitle: "All pending requests across every Account Manager."
- Assigned manager shown beneath customer name
- Approve + Reject (mandatory reason) for any request system-wide

### 4.3 User Management (`/admin/users`)
Two side-by-side panels:

**Account Managers panel:**
- Rows: name + "N assigned clients"; Reassign All (outline) + Remove (danger — disabled when clients > 0)
- Reassign All → modal: select target manager → confirm → atomic bulk reassignment
- "+ Add Manager" → modal: full name, username, password

**Customers panel:**
- Rows: name + "Manager: [name]"; Reassign (outline) + Reset Password (outline)
- Reassign → modal: select new manager
- Reset Password → modal: new password only (no current password required)
- "+ Add Customer" → modal: full name, username, password, assign to manager dropdown

### 4.4 DB Reset Button (Admin panel)
1. Click "Reset Database" → Modal: explanation + **[OK]** / **[Cancel]**
2. Cancel → Modal: "Database reset operation terminated." **[OK]**
3. OK → `POST /api/v1/test/reset` → seed runs → Modal: "Database reset successfully." **[OK]**

**API:**
```
GET    /api/v1/admin/managers
POST   /api/v1/admin/managers                       { fullName, username, password }
DELETE /api/v1/admin/managers/:id                   (422 MANAGER_HAS_CLIENTS if has clients)
POST   /api/v1/admin/managers/:id/reassign          { toManagerId }
PATCH  /api/v1/admin/customers/:id/reassign         { toManagerId }
GET    /api/v1/admin/customers
POST   /api/v1/admin/customers                      { fullName, username, password, managerId }
PUT    /api/v1/admin/users/:id/password             { newPassword }
GET    /api/v1/admin/requests?status=pending
POST   /api/v1/admin/requests/:id/approve
POST   /api/v1/admin/requests/:id/reject            { reason }
POST   /api/v1/test/reset                           (disabled when NODE_ENV=production)
```

### 4.5 Backend Unit Tests (M4)
- Manager removal blocked when has clients (422 + `MANAGER_HAS_CLIENTS`)
- Bulk reassign is atomic
- Admin password reset: no current password needed
- Admin can approve/reject any request regardless of assigned manager
- Admin can perform direct account/card operations on any client
- DB reset: 404 when `NODE_ENV=production`

---

## M5 – Transaction History
**Branch:** `milestone/m5-history` (cut from `main` after M4 merge)

### 5.1 Customer History Page (`/customer/history`)
- Filters: date from, date to, transaction type, account/card, records per page
- Paginated table: Type | Instrument | Amount (€0.00 signed) | Counterpart | Date & Time
- Export: .pdf / .csv / .xls / .xlsx / .ods

### 5.2 Manager History Page (`/manager/history`)
- Combined transactions for all assigned customers
- Filters: date from, date to, customer (portfolio dropdown), transaction type, records per page
- Same table + export
- Also: transaction history section within `/manager/clients/:id` (account/card selector, date range, paginated)

### 5.3 Admin History Page (`/admin/history`)
- System-wide all transactions
- Filters: date from, date to, customer, manager, transaction type, records per page
- Same table + export

**API:**
```
GET /api/v1/transactions/history          (customer — own data)
GET /api/v1/manager/transactions/history  (manager — portfolio)
GET /api/v1/admin/transactions/history    (admin — system-wide)
```
Query params: `from`, `to`, `type`, `account_id`, `card_id`, `customer_id`, `manager_id`, `page`, `limit`
Response: `{ data: Transaction[], total, page, limit, totalPages }`

### 5.4 Backend Unit Tests (M5)
- Customer history: own transactions only
- Manager history: portfolio only
- Admin history: all
- Date filters applied correctly
- Pagination: total, page, limit returned correctly
- Empty results: `data: []`, `total: 0`

---

## M6 – Global Search
**Branch:** `milestone/m6-search` (cut from `main` after M5 merge)

### 6.1 Search Scopes

| Role | Searches across |
|---|---|
| Customer | Own accounts (IBAN, type), own cards, own transactions |
| Manager | Portfolio client names/usernames, portfolio accounts, portfolio transactions |
| Admin | All users (name, username, role), all accounts, all managers, all transactions |

### 6.2 Search API
```
GET /api/v1/search?q=&page=&limit=
```
- Role-scoped automatically via JWT
- Returns: `{ accounts: [], cards: [], transactions: [], users: [], managers: [] }`
- Minimum query length: 2 chars (400 if below)

### 6.3 Search UI
- Click search pill in header → input expands
- Debounced calls (300ms)
- Results in modal: grouped table sections per entity type, pagination, Export button (.pdf / .csv / .xls / .xlsx / .ods)
- Close on Escape or backdrop click

### 6.4 Backend Unit Tests (M6)
- Customer search: no other customers' data
- Manager search: limited to portfolio
- Admin search: all entity types
- Query < 2 chars → 400
- Empty results: grouped empty arrays

---

## M7 – Polish & Validation
**Branch:** `milestone/m7-polish` (cut from `main` after M6 merge)
**SPEC task:** 14

### 7.1 Backend
- Zod validation on every POST/PUT/PATCH (400 + field-level messages)
- HTTP codes: 400 (validation), 401 (auth), 403 (scope), 422 (business rule), 500 (unexpected)
- No unhandled promise rejections

### 7.2 Frontend
- Inline field-level validation errors below every form field
- Every action: `data-testid="msg-success"` or `data-testid="msg-error"` visible
- Loading states on all async buttons
- All amounts: `€0.00` with `font-variant-numeric: tabular-nums`
- Full `data-testid` audit against reference list in design handoff README

### 7.3 Final Test Pass
- Run full Vitest + Supertest suite
- Fix any failures
- Confirm all acceptance criteria from M1–M6 still pass

---

## Complete Route Reference

| Path | Role |
|---|---|
| `/login` | public |
| `/customer/dashboard` | customer |
| `/customer/accounts` | customer |
| `/customer/cards` | customer |
| `/customer/transactions` | customer (Transfer & Pay: Deposit / Transfer / Top-Up / Withdraw Request tabs) |
| `/customer/spend` | customer |
| `/customer/history` | customer |
| `/customer/requests` | customer |
| `/manager/dashboard` | account_manager |
| `/manager/clients` | account_manager |
| `/manager/clients/:id` | account_manager |
| `/manager/requests` | account_manager |
| `/manager/history` | account_manager |
| `/admin/overview` | admin |
| `/admin/approvals` | admin |
| `/admin/users` | admin |
| `/admin/history` | admin |

---

## Key Business Rules (Quick Reference)

- Bank account and debit card: never go below €0.00
- Credit card: overdraft permitted (balance may go below €0.00)
- Credit card closure: requires `balance >= credit_limit` (not just ≥ 0)
- Close account: requires `balance = €0.00`
- Issue debit card: linked account must be active
- Cross-customer transfers: account→account only; no top-up on insufficient funds
- Same-customer insufficient funds: block + warn + offer top-up (frozen = shown disabled, closed = hidden)
- Rejection reason: mandatory for every rejection; stored; visible to customer
- Customer may cancel any pending request; cannot cancel approved/rejected
- Client deletion (all 4 must be met): all debit cards disabled + all credit cards disabled + credit card balance ≥ credit_limit + all account balances = €0.00
- Manager removal (admin): only when 0 assigned customers
- Admin password reset: no current password required
- All transaction amounts must be > €0.00

---

## data-testid Reference (from design handoff)

**Screens:** `screen-customer-dashboard`, `screen-accounts`, `screen-transfer`, `screen-requests`, `screen-manager-dashboard`, `screen-clients`, `screen-approvals`, `screen-admin-dashboard`, `screen-users`

**Nav/auth:** `nav-sidebar`, `nav-link-*`, `btn-logout`, `user-display-name`, `login-card`, `login-username`, `login-password`, `login-submit`

**Data rows:** `account-row-{id}`, `account-balance-{id}`, `account-status-{id}`, `account-freeze-{id}`, `account-close-{id}`, `card-tile-{id}`, `card-status-{id}`, `credit-balance`, `tx-row-{id}`

**Stats:** `stat-total-balance`, `stat-pending-requests`, `stat-pending-approvals`, `stat-system-pending`

**Transfer/spend:** `transfer-from`, `transfer-to`, `transfer-amount`, `transfer-note`, `transfer-submit`, `transfer-simulate-insufficient`, `insufficient-funds-panel`, `insufficient-funds-warning`, `topup-source-{id}`, `topup-radio-{id}`, `topup-amount`, `topup-submit`

**Requests/approvals:** `request-row-{id}`, `request-status-{id}`, `request-reason-{id}`, `request-cancel-{id}`, `approval-row-{id}`, `approve-{id}`, `reject-{id}`, `rejection-reason-input`, `confirm-reject`, `cancel-reject`

**Admin/manager:** `client-row-{id}`, `client-view-{id}`, `add-customer`, `manager-row-{id}`, `reassign-{id}`, `remove-manager-{id}`, `customer-row-{id}`, `reassign-customer-{id}`, `reset-pw-{id}`, `add-manager`, `add-customer-admin`

**Messages:** `msg-success`, `msg-error`
