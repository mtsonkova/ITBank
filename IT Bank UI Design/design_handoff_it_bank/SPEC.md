
All projects
IT Bank
Create web app banking simulator with the following roles customer, account manager, admin. The customer can request creation, closing, freezing of bank accounts and debit cards attached to specific bank accounts. He can request the bank to issue him a credit card and to submit request for increasing the credit limit. Customer can move money between his accounts, can deposit money. Can request to withdraw money. Account manager - he can access only the data of the clients assigned to him. Can open new bank account after recceiving a request from the client. Can process withdrawal request. Can open, freeze, close bank accounts. Can freeze debit and credit cards, can issue new debit/credit cards per client request. Can delete existing clients only after all these conditions are met: 1. all credit and debit cards are disabled ; 2 The credit card is full. 3. All accounts of the client are empty/ all money are withdrawn. Admin - can add/remove account managers. Requirements to remove account manager - his clients have to be assigned to another account manager. All users have to be able to change their passwords. Customers can see only their own banking details. Account managers can see only the data of the clients assigned to them. Admin can see all information and has full priviledges. The supported currency for this projects is EUR. It is going to be only a web app. This is a training project that will not be published.
Show more

Claude Fable 5 is currently unavailable.
Learn more(opens in new tab)


How can I help you today?


Technical stack for banking simulator web app
Last message 17 minutes ago
Creating Jira epics from banking simulator requirements
Last message 3 hours ago
Updating banking simulator requirements from spec
Last message 19 hours ago
Updating SPEC.md with banking simulator requirements
Last message 19 hours ago
Expanding banking simulator requirements
Last message 20 hours ago
Project breakdown and development setup guide
Last message May 22
Instructions
Break down large tasks and ask clarifying questions if required.

Files
1% of project capacity used

banking_simulator_jira_epics.md
291 lines

md



banking_simulator_requirements.md
283 lines

md



SPEC.md
1,028 lines

md



SPEC.md


# Banking Simulator – Project Specification & Build Plan
 
> **Version:** 1.0  
> **Currency:** EUR only  
> **Purpose:** Training environment for test automation practice  
> **Stack recommendation:** React (frontend) · Node.js/Express (backend) · PostgreSQL (database)
 
---
 
## How to Use This File
 
- Use this file as the single source of truth when building with **Claude Code** (`claude` CLI).
- Each `## TASK` block maps to one focused Claude Code session or GitHub Issue.
- Copy a task block into Claude Code as your prompt, or create a GitHub Issue per task using the titles below.
- Complete tasks in order; later tasks depend on earlier ones.
---
 
## Project Structure (target)
 
```
banking-simulator/
├── SPEC.md                   ← this file
├── CLAUDE.md                 ← Claude Code project memory
├── frontend/                 ← React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/
│   │   └── context/
│   └── package.json
├── backend/                  ← Express REST API
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   └── db/
│   └── package.json
├── database/
│   ├── schema.sql
│   └── seed.sql
└── docker-compose.yml
```
 
---
 
## CLAUDE.md (copy this to project root)
 
```markdown
# Banking Simulator – Claude Code Project Memory
 
## Stack
- Frontend: React 18, React Router v6, Axios, TailwindCSS
- Backend: Node.js 20, Express 5, PostgreSQL 16, JWT auth
- Dev: Docker Compose for local DB
 
## Roles
- **Customer** – can submit requests; self-service deposits and transfers
- **Account Manager** – approves/rejects customer requests; manages assigned clients only
- **Admin** – full access; manages account managers
 
## Key Rules
- All values in EUR
- Customers submit requests; Account Managers action them
- Account Manager can only see their assigned clients
- Deletion of a client requires: all cards disabled, credit card balance ≥ credit limit, all account balances = 0
- Admin removal requires all clients to be reassigned first
- Overdraft is permitted on credit cards only; bank accounts and debit cards may never go below €0.00
- Credit card closure requires balance ≥ credit limit (fully restored), not merely ≥ 0
- Rejection of any request requires a mandatory rejection reason stored and visible to the customer
- Cross-customer transfers: bank account → bank account only; no top-up offered on insufficient funds
- Same-customer insufficient funds: block + warn + offer top-up from own other active payment methods
- Spending (bank account, debit card, credit card) is instant self-service; no approval required
- Customers may cancel any pending request before it is actioned
 
## API convention
- REST: /api/v1/...
- Auth: Bearer JWT in Authorization header
- Errors: { error: string, code: string }
- Success: { data: ..., message: string }
 
## Test automation support
- Every interactive element must have data-testid attributes
- Every action must produce a visible success or error message
- All validation errors must be displayed inline
```
 
---
 
## GitHub Labels to Create
 
| Label | Color | Use |
|---|---|---|
| `task` | #0075ca | Main build task |
| `auth` | #e4e669 | Authentication & sessions |
| `customer` | #a2eeef | Customer role features |
| `account-manager` | #d93f0b | Account Manager features |
| `admin` | #6f42c1 | Admin features |
| `workflow` | #0e8a16 | Request/approval flow |
| `business-rule` | #ee0701 | Validation & business logic |
| `infra` | #bfd4f2 | Setup, DB, config |
| `ui` | #f9d0c4 | Frontend/UX |
 
---
 
---
 
# TASKS
 
---
 
## TASK 01 – Project Scaffolding & Dev Environment
 
**GitHub label:** `infra`  
**Depends on:** nothing  
**Estimated effort:** S
 
### Goal
Set up the monorepo, Docker Compose database, and both frontend/backend skeletons so all later tasks have a working base.
 
### Acceptance Criteria
- [ ] `docker-compose.yml` starts a PostgreSQL 16 container with a named volume
- [ ] `backend/` is an Express 5 + Node 20 project with `npm run dev` (nodemon)
- [ ] `frontend/` is a Vite + React 18 project with `npm run dev`
- [ ] `.env.example` files exist for both packages with all required env vars documented
- [ ] `README.md` at root explains how to run the project locally
- [ ] CORS is configured so frontend dev server can reach backend
### Env vars needed (backend)
```
DATABASE_URL=postgres://...
JWT_SECRET=
JWT_EXPIRES_IN=8h
PORT=4000
```
 
---
 
## TASK 02 – Database Schema
 
**GitHub label:** `infra`  
**Depends on:** TASK 01  
**Estimated effort:** M
 
### Goal
Create the full relational schema for all entities.
 
### Tables
 
```sql
-- Users (all roles share this table)
users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username    VARCHAR(50) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        ENUM('customer','account_manager','admin') NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
)
 
-- Account Managers ↔ Customers assignment
customer_assignments (
  customer_id         UUID REFERENCES users(id),
  account_manager_id  UUID REFERENCES users(id),
  PRIMARY KEY (customer_id)
)
 
-- Bank Accounts
bank_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES users(id) NOT NULL,
  status      ENUM('active','frozen','closed') DEFAULT 'active',
  balance     NUMERIC(15,2) DEFAULT 0.00,
  created_at  TIMESTAMPTZ DEFAULT now()
)
 
-- Debit Cards
debit_cards (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id  UUID REFERENCES bank_accounts(id) NOT NULL,
  customer_id      UUID REFERENCES users(id) NOT NULL,
  status           ENUM('active','frozen','closed') DEFAULT 'active',
  created_at       TIMESTAMPTZ DEFAULT now()
)
 
-- Credit Cards
credit_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID REFERENCES users(id) NOT NULL,
  status          ENUM('active','frozen','closed') DEFAULT 'active',
  credit_limit    NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  outstanding_balance NUMERIC(15,2) DEFAULT 0.00,
  created_at      TIMESTAMPTZ DEFAULT now()
)
 
-- Transactions
transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type            ENUM('deposit','withdrawal','transfer','spend','topup'),
  from_account_id UUID REFERENCES bank_accounts(id),   -- nullable; source bank account
  to_account_id   UUID REFERENCES bank_accounts(id),   -- nullable; destination bank account
  from_card_id    UUID REFERENCES credit_cards(id),    -- nullable; credit card as source
  to_card_id      UUID REFERENCES credit_cards(id),    -- nullable; credit card as destination
  debit_card_id   UUID REFERENCES debit_cards(id),     -- nullable; debit card instrument used
  amount          NUMERIC(15,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
  -- Column usage by transaction type:
  -- deposit:   to_account_id
  -- withdrawal: from_account_id
  -- transfer (account→account): from_account_id, to_account_id
  -- transfer (account→credit):  from_account_id, to_card_id
  -- transfer (credit→account):  from_card_id, to_account_id
  -- transfer (debit→account):   debit_card_id, from_account_id (linked), to_account_id
  -- spend (bank account):       from_account_id
  -- spend (debit card):         debit_card_id, from_account_id (linked)
  -- spend (credit card):        from_card_id
  -- topup (account→credit):     from_account_id, to_card_id
)
 
-- Requests (customer → account manager workflow)
requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         UUID REFERENCES users(id) NOT NULL,
  account_manager_id  UUID REFERENCES users(id),
  type                ENUM(
                        'open_account','close_account','freeze_account','unfreeze_account',
                        'issue_debit_card','close_debit_card','freeze_debit_card','unfreeze_debit_card',
                        'issue_credit_card','close_credit_card','freeze_credit_card','unfreeze_credit_card',
                        'increase_credit_limit','decrease_credit_limit',
                        'withdraw_money'
                      ) NOT NULL,
  status              ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending',
  payload             JSONB,         -- e.g. { account_id, amount, credit_limit }
  rejection_reason    TEXT,          -- mandatory when status = 'rejected'; visible to customer
  created_at          TIMESTAMPTZ DEFAULT now(),
  actioned_at         TIMESTAMPTZ
)
```
 
### Acceptance Criteria
- [ ] `database/schema.sql` creates all tables cleanly on a fresh DB
- [ ] `database/seed.sql` creates: 1 admin, 2 account managers, 4 customers (2 per manager), sample accounts and cards
- [ ] All foreign keys and constraints are enforced at DB level
- [ ] `NUMERIC(15,2)` used for all monetary values — no floats
- [ ] `transactions` table has nullable FK columns for `from_card_id`, `to_card_id`, `debit_card_id`
- [ ] `requests` table ENUM covers all request types including unfreeze and credit card variants
- [ ] `requests` table has `rejection_reason TEXT` and `cancelled` status value
---
 
## TASK 03 – Authentication & Session Management
 
**GitHub label:** `auth`  
**Depends on:** TASK 01, TASK 02  
**Estimated effort:** M
 
### Goal
JWT-based login, logout, and password change for all three roles.
 
### API Endpoints
 
```
POST   /api/v1/auth/login
       Body: { username, password }
       Response: { token, user: { id, username, role } }
 
POST   /api/v1/auth/logout
       (client discards token; server can maintain a denylist if desired)
 
PUT    /api/v1/auth/password
       Auth required
       Body: { currentPassword, newPassword }
       Response: { message }
```
 
### Middleware
- `authenticate` – validates Bearer JWT, attaches `req.user`
- `authorize(...roles)` – checks `req.user.role` is in allowed list
### Acceptance Criteria
- [ ] Login returns 401 with `{ error: "Invalid credentials" }` on bad password
- [ ] JWT includes `{ sub: userId, role, iat, exp }`
- [ ] Password change requires correct current password; returns 400 if wrong
- [ ] All protected routes return 401 when token is missing or expired
- [ ] Passwords stored as bcrypt hashes (cost factor ≥ 12)
- [ ] Every response has a visible message or error string (test automation requirement)
### Frontend Pages
- `/login` – username + password form, error message on failure  
  `data-testid`: `input-username`, `input-password`, `btn-login`, `msg-error`
- Password change modal/page accessible from any authenticated view  
  `data-testid`: `input-current-password`, `input-new-password`, `btn-change-password`, `msg-success`, `msg-error`
---
 
## TASK 04 – Customer: Bank Account Management
 
**GitHub label:** `customer`  
**Depends on:** TASK 03  
**Estimated effort:** M
 
### Goal
Customers can view their bank accounts and submit open/close/freeze/unfreeze requests.
 
### API Endpoints
 
```
GET    /api/v1/accounts
       Auth: customer
       Response: { data: [BankAccount] }
 
POST   /api/v1/requests
       Auth: customer
       Body: { type: 'open_account' }
       Response: { data: Request, message }
 
POST   /api/v1/requests
       Body: { type: 'close_account', payload: { account_id } }
 
POST   /api/v1/requests
       Body: { type: 'freeze_account', payload: { account_id } }
 
POST   /api/v1/requests
       Body: { type: 'unfreeze_account', payload: { account_id } }
 
DELETE /api/v1/requests/:requestId
       Auth: customer
       Cancels a pending request; returns 422 if already approved or rejected
       Response: { message }
```
 
### Business Rules to Enforce
- A customer may not request closing an account with a non-zero balance (validate at submission)
- A customer may only reference their own accounts in requests
- A customer may not submit an unfreeze request for an account that is not frozen
- A pending request may only be cancelled while status = `pending`
### Frontend Page: `/customer/accounts`
- List of accounts with: ID (last 8 chars), status badge, balance in EUR
- Buttons: "Request New Account", "Request Close", "Request Freeze", "Request Unfreeze" per account (shown contextually based on current status)
- Pending requests shown with status badge and "Cancel" button
- Rejected requests show rejection reason
- `data-testid` on every button, badge, and balance cell
### Acceptance Criteria
- [ ] Accounts list only shows the logged-in customer's accounts
- [ ] Submitting a request creates a row in `requests` with status `pending`
- [ ] Cannot submit a close request for a non-zero balance account (error shown)
- [ ] Duplicate pending requests of the same type for the same account are blocked (or warn)
- [ ] Unfreeze request only available for frozen accounts
- [ ] Customer can cancel a pending request; cancelled request shows status `cancelled`
- [ ] Rejection reason is visible to the customer on rejected requests
---
 
## TASK 05 – Customer: Card Management
 
**GitHub label:** `customer`  
**Depends on:** TASK 04  
**Estimated effort:** M
 
### Goal
Customers can view and submit requests for debit and credit cards.
 
### API Endpoints
 
```
GET    /api/v1/cards/debit
GET    /api/v1/cards/credit
 
-- Debit card requests
POST   /api/v1/requests  { type: 'issue_debit_card', payload: { account_id } }
POST   /api/v1/requests  { type: 'close_debit_card', payload: { card_id } }
POST   /api/v1/requests  { type: 'freeze_debit_card', payload: { card_id } }
POST   /api/v1/requests  { type: 'unfreeze_debit_card', payload: { card_id } }
 
-- Credit card requests
POST   /api/v1/requests  { type: 'issue_credit_card' }
POST   /api/v1/requests  { type: 'close_credit_card', payload: { card_id } }
POST   /api/v1/requests  { type: 'freeze_credit_card', payload: { card_id } }
POST   /api/v1/requests  { type: 'unfreeze_credit_card', payload: { card_id } }
POST   /api/v1/requests  { type: 'increase_credit_limit', payload: { card_id, requested_limit } }
POST   /api/v1/requests  { type: 'decrease_credit_limit', payload: { card_id, requested_limit } }
```
 
### Business Rules to Enforce
- Debit card request must reference an active account owned by the customer
- A customer with an existing active/frozen credit card may not request a new one
- Unfreeze request only valid if card is currently frozen
- Close credit card request: balance must be ≥ credit limit at time of approval (enforced by Account Manager on approval, not at submission)
- Decrease credit limit: requested_limit must be > 0
### Frontend Page: `/customer/cards`
- Two sections: Debit Cards, Credit Card
- Debit card shows: linked account (last 8 chars), status, action buttons (shown contextually based on status)
- Credit card shows: limit, current balance, status, action buttons (shown contextually based on status)
- Pending requests shown with status badge and "Cancel" button
- Rejected requests show rejection reason
- `data-testid` on all interactive elements
### Acceptance Criteria
- [ ] Issuing a debit card requires selecting one of the customer's active accounts
- [ ] Credit card section hides "Request Credit Card" if one already exists and is active/frozen
- [ ] Unfreeze request only shown for frozen cards
- [ ] All requests land in `requests` table with `pending` status
- [ ] Customer can cancel any pending card request
- [ ] Rejection reason visible on rejected requests
---
 
## TASK 06 – Customer: Transfers, Deposits & Withdrawal Requests
 
**GitHub label:** `customer`  
**Depends on:** TASK 04  
**Estimated effort:** M
 
### Goal
Customers can deposit money, transfer between accounts and cards (same-customer and cross-customer account-to-account), top up their credit card, and submit withdrawal requests. Spending is handled separately in TASK 16.
 
### API Endpoints
 
```
-- Deposit (external → own bank account)
POST   /api/v1/transactions/deposit
       Body: { account_id, amount }
       Response: { data: Transaction, message }
 
-- Same-customer transfers
POST   /api/v1/transactions/transfer
       Body: { from_type: 'account'|'credit_card', from_id, to_type: 'account'|'credit_card', to_id, amount }
       Supports: account→account, account→credit_card, credit_card→account
       Credit card overdraft permitted; bank account may not go below €0.00
 
-- Debit card → bank account transfer (draws from linked account)
POST   /api/v1/transactions/transfer
       Body: { from_type: 'debit_card', from_id, to_type: 'account', to_id, amount }
       Records: debit_card_id + linked from_account_id + to_account_id
 
-- Cross-customer bank account transfer
POST   /api/v1/transactions/transfer/external
       Body: { from_account_id, to_account_id, amount }
       Only account→account; no overdraft; insufficient funds returns 422 with no top-up options
 
-- Credit card top-up (self-service, no approval)
POST   /api/v1/transactions/topup
       Body: { from_type: 'account'|'debit_card', from_id, to_card_id, amount }
       Amount must be > €0.00
 
-- Withdrawal request (requires Account Manager approval)
POST   /api/v1/requests
       Body: { type: 'withdraw_money', payload: { account_id, amount } }
 
-- Transaction history
GET    /api/v1/transactions?account_id=...
GET    /api/v1/transactions?card_id=...
       Returns transactions for a specific account or card
       Each record includes: type, amount (EUR), created_at, counterpart account/card (if applicable), instrument used (if debit card)
```
 
### Business Rules to Enforce
- Cannot transfer to/from a frozen or closed account or card
- Amount must be > €0.00
- Bank account and debit card transfers blocked if source balance < amount (no overdraft)
- Credit card transfers never blocked for insufficient funds (overdraft permitted)
- Same-customer insufficient funds: return 422 with `INSUFFICIENT_FUNDS` code and list of other active payment methods for top-up
- Cross-customer insufficient funds: return 422 with `INSUFFICIENT_FUNDS` code only — no top-up options returned
- Top-up source must be active (not frozen or closed)
- Withdrawal request does not immediately deduct balance (pending approval)
- Debit card transfer records both `debit_card_id` and the linked `from_account_id` for history visibility
### Frontend Page: `/customer/transactions`
- Tabs: Deposit / Transfer / Top-Up / Withdraw Request
- Transfer tab: toggle between same-customer and cross-customer (account→account only for cross)
- Dropdowns to select source and destination instruments, amount input, submit button
- Insufficient funds warning displayed inline; same-customer flow offers selectable top-up sources (frozen sources shown but disabled with warning; closed sources hidden)
- Transaction history table: type, amount (€0.00), date & time, counterpart, instrument used
- `data-testid` on all inputs, dropdowns, buttons, table rows, warning messages, and top-up option rows
### Acceptance Criteria
- [ ] Deposit immediately updates account balance and creates a transaction record
- [ ] Same-customer transfer atomically debits source and credits destination (DB transaction)
- [ ] Cross-customer transfer only permitted account→account; blocked with error if insufficient funds; no top-up offered
- [ ] Credit card overdraft: transfer proceeds even if credit card balance goes below €0.00
- [ ] Bank account / debit card: transfer blocked if balance < amount; insufficient funds flow shown
- [ ] Top-up is self-service, instant, and requires no approval
- [ ] Withdrawal creates a `pending` request; balance unchanged until approved
- [ ] Frozen/closed instrument shows error if selected
- [ ] Transaction history shows type, amount, date/time, counterpart, and instrument (debit card) where applicable
- [ ] Amount field rejects non-numeric and negative values with inline error
---
 
## TASK 07 – Account Manager: Client Dashboard
 
**GitHub label:** `account-manager`  
**Depends on:** TASK 03, TASK 04  
**Estimated effort:** M
 
### Goal
Account Managers see only their assigned clients, can add new clients, and can navigate to each client's full profile.
 
### API Endpoints
 
```
GET    /api/v1/manager/clients
       Auth: account_manager
       Response: { data: [Customer + summary] }
 
GET    /api/v1/manager/clients/:customerId
       Response: { data: { user, accounts, debitCards, creditCard, pendingRequests } }
 
POST   /api/v1/manager/clients
       Body: { username, password }
       Creates a new customer and automatically assigns them to the authenticated manager
       Response: { data: Customer, message }
```
 
### Acceptance Criteria
- [ ] Response only ever contains clients assigned to the authenticated manager
- [ ] Requesting a client not in the manager's portfolio returns 403
- [ ] Client detail view shows all accounts, cards, and current pending requests
- [ ] Newly created customer is automatically assigned to the creating manager
- [ ] New customer can immediately log in after creation
### Frontend Page: `/manager/clients`
- Client list: name, number of accounts, number of cards, pending request count
- "Add New Client" button opens a form (username + password)
- Click client row to open client detail page
- `data-testid`: `btn-add-client`, `input-username`, `input-password`, `btn-submit-client`, `msg-success`, `msg-error`
### Frontend Page: `/manager/clients/:id`
- Sections: Accounts, Debit Cards, Credit Card, Pending Requests
- `data-testid` on every section, row, and badge
---
 
## TASK 08 – Account Manager: Request Processing
 
**GitHub label:** `account-manager`, `workflow`  
**Depends on:** TASK 07  
**Estimated effort:** L
 
### Goal
Account Managers can view and action all pending requests from their assigned clients.
 
### API Endpoints
 
```
GET    /api/v1/manager/requests?status=pending
       Response: { data: [Request + customer info + payload detail] }
 
POST   /api/v1/manager/requests/:requestId/approve
POST   /api/v1/manager/requests/:requestId/reject
       Body: { reason }   ← mandatory; returns 400 if missing
```
 
### Side-effects on Approve (implement each separately)
 
| Request Type | Side Effect |
|---|---|
| `open_account` | Create new bank account for customer |
| `close_account` | Set account status → `closed` (only if balance = €0.00) |
| `freeze_account` | Set account status → `frozen` |
| `unfreeze_account` | Set account status → `active` |
| `issue_debit_card` | Create debit card linked to specified account |
| `close_debit_card` | Set debit card status → `closed` |
| `freeze_debit_card` | Set debit card status → `frozen` |
| `unfreeze_debit_card` | Set debit card status → `active` |
| `issue_credit_card` | Create credit card for customer |
| `close_credit_card` | Set credit card status → `closed` (only if balance ≥ credit_limit) |
| `freeze_credit_card` | Set credit card status → `frozen` |
| `unfreeze_credit_card` | Set credit card status → `active` |
| `increase_credit_limit` | Update `credit_limit` on credit card |
| `decrease_credit_limit` | Update `credit_limit` on credit card |
| `withdraw_money` | Deduct amount from account balance, create transaction record |
 
### Business Rules (block approval if violated)
- `close_account`: account balance must be €0.00
- `issue_debit_card`: linked account must be active
- `close_credit_card`: credit card balance must be ≥ credit_limit (fully restored); return 422 with clear message if not
- `withdraw_money`: account must be active; balance must be ≥ amount
### Frontend Page: `/manager/requests`
- Table of pending requests: type, customer name, date, payload summary
- "Approve" and "Reject" buttons per row
- Reject opens a modal with a mandatory reason text field
- Completed requests visible in separate tab (approved/rejected) showing rejection reason where applicable
- `data-testid` on every row, button, status badge, `input-rejection-reason`, `btn-confirm-reject`
### Acceptance Criteria
- [ ] Approving `open_account` creates a new account and marks request `approved`
- [ ] Approving `withdraw_money` deducts balance atomically
- [ ] Approving `close_credit_card` blocked with 422 if balance < credit_limit
- [ ] Unfreeze side-effects set status back to `active`
- [ ] Business rule violations on approve return 422 with clear error message
- [ ] Reject endpoint returns 400 if `reason` is missing or empty
- [ ] Rejection reason stored on request record and visible to customer
- [ ] Rejected requests are marked `rejected`; no side effects applied
---
 
## TASK 09 – Account Manager: Direct Client Operations
 
**GitHub label:** `account-manager`  
**Depends on:** TASK 07  
**Estimated effort:** M
 
### Goal
Account Managers can take direct actions on client accounts and cards (outside the request flow).
 
### API Endpoints
 
```
-- Bank accounts
POST   /api/v1/manager/clients/:customerId/accounts
       Body: {}   → creates new account
PATCH  /api/v1/manager/clients/:customerId/accounts/:accountId
       Body: { status: 'frozen' | 'active' | 'closed' }
       'active' = unfreeze; 'closed' requires balance = €0.00
 
-- Debit cards
POST   /api/v1/manager/clients/:customerId/debit-cards
       Body: { account_id }
PATCH  /api/v1/manager/clients/:customerId/debit-cards/:cardId
       Body: { status: 'frozen' | 'active' | 'closed' }
       'active' = unfreeze
 
-- Credit cards
POST   /api/v1/manager/clients/:customerId/credit-cards
       Body: { credit_limit }
PATCH  /api/v1/manager/clients/:customerId/credit-cards/:cardId
       Body: { status: 'frozen' | 'active' | 'closed' }
       'active' = unfreeze; 'closed' requires balance ≥ credit_limit
```
 
### Acceptance Criteria
- [ ] Manager cannot act on clients outside their portfolio (403)
- [ ] Closing an account with non-zero balance returns 422
- [ ] Closing a credit card with balance < credit_limit returns 422 with clear message
- [ ] Issuing a debit card to a frozen/closed account returns 422
- [ ] Setting status to `active` unfreezes the account or card
- [ ] All status transitions are validated (e.g. cannot unfreeze a closed card)
---
 
## TASK 10 – Account Manager: Client Deletion
 
**GitHub label:** `account-manager`, `business-rule`  
**Depends on:** TASK 09  
**Estimated effort:** S
 
### Goal
Account Managers can delete a client record only when all four conditions are met.
 
### API Endpoint
 
```
DELETE /api/v1/manager/clients/:customerId
```
 
### Deletion Conditions (all must be true)
1. All debit cards have status `closed` or `frozen`
2. All credit cards have status `closed` or `frozen`
3. Credit card balance ≥ credit_limit (fully restored; customer owes nothing to the bank)
4. All bank account balances = €0.00
### Response when blocked
 
```json
{
  "error": "Cannot delete client: unmet conditions",
  "code": "CLIENT_DELETION_BLOCKED",
  "unmet": [
    "debit_cards_not_disabled",
    "credit_card_balance_below_limit",
    "account_balance_not_zero"
  ]
}
```
 
### Frontend
- "Delete Client" button on client detail page (visible to manager)
- If blocked: show modal listing each unmet condition in plain language
- If allowed: confirmation dialog → delete → redirect to client list
- `data-testid`: `btn-delete-client`, `modal-deletion-blocked`, `msg-unmet-condition`
### Acceptance Criteria
- [ ] Each of the 4 conditions is checked independently
- [ ] All unmet conditions are returned in a single response (not just the first)
- [ ] Condition 3 checks balance ≥ credit_limit, not merely ≥ 0
- [ ] Successful deletion removes the user and all associated records (cascading)
---
 
## TASK 11 – Admin: Account Manager Management
 
**GitHub label:** `admin`  
**Depends on:** TASK 03  
**Estimated effort:** M
 
### Goal
Admin can add and remove Account Managers, with client reassignment enforced before removal.
 
### API Endpoints
 
```
GET    /api/v1/admin/managers
       Response: { data: [{ manager, clientCount }] }
 
POST   /api/v1/admin/managers
       Body: { username, password }
       Response: { data: Manager, message }
 
DELETE /api/v1/admin/managers/:managerId
       Must fail if manager has assigned clients
 
POST   /api/v1/admin/managers/:managerId/reassign
       Body: { toManagerId }
       Reassigns ALL clients from one manager to another atomically
 
PATCH  /api/v1/admin/customers/:customerId/reassign
       Body: { toManagerId }
       Reassigns a single customer to a different manager
```
 
### Frontend Page: `/admin/managers`
- Table: username, client count, created date, Remove button
- "Add Manager" form (username + password)
- Reassign all modal: select target manager from dropdown, confirm
- Individual reassign available from customer detail page (see TASK 12)
- `data-testid` on all elements
### Acceptance Criteria
- [ ] Removing a manager with assigned clients returns 422 with `MANAGER_HAS_CLIENTS` code
- [ ] Bulk reassign endpoint moves all clients atomically
- [ ] Individual reassign moves a single customer to the specified manager
- [ ] After full reassignment, manager can be deleted
- [ ] New manager can immediately log in after creation
---
 
## TASK 12 – Admin: Full System View
 
**GitHub label:** `admin`  
**Depends on:** TASK 11  
**Estimated effort:** M
 
### Goal
Admin can see all data across all users, perform any Account Manager action on any client, reset any user's password, add new customers, and view all pending requests system-wide.
 
### API Endpoints
 
```
GET    /api/v1/admin/customers
       All customers with their assigned manager
 
GET    /api/v1/admin/customers/:customerId
       Full profile (same shape as manager client detail)
 
POST   /api/v1/admin/customers
       Body: { username, password, managerId }
       Creates a new customer assigned to the specified manager
       Response: { data: Customer, message }
 
PUT    /api/v1/admin/users/:userId/password
       Body: { newPassword }
       Resets any user's password without requiring current password
       Response: { message }
 
GET    /api/v1/admin/requests?status=pending
       All pending requests across all managers and customers
 
-- Admin can reuse manager endpoints but without the portfolio restriction
-- Implement via middleware: if role=admin, skip the portfolio check
```
 
### Frontend Page: `/admin/overview`
- Summary cards: total customers, total managers, total pending requests
- Full customer list with search/filter
- "Add New Customer" form (username, password, assign to manager dropdown)
- Navigation to any customer detail page (same UI as manager view)
- Customer detail page includes: individual reassign control (select new manager + confirm), "Reset Password" button
- System-wide pending requests tab (all managers' queues in one view)
- `data-testid` on all interactive elements including `btn-reset-password`, `btn-reassign-customer`, `select-manager`, `btn-add-customer`
### Acceptance Criteria
- [ ] Admin sees all clients regardless of manager assignment
- [ ] Admin can approve/reject any pending request across all managers
- [ ] Admin can perform all Account Manager direct operations on any client
- [ ] Admin can create a new customer and assign them to any manager at creation time
- [ ] Admin can reset any user's password without supplying the current password
- [ ] Admin can reassign an individual customer to a different manager at any time
- [ ] New customer assigned to a manager who did not create them appears in that manager's portfolio immediately
---
 
## TASK 13 – UI Shell, Navigation & Role-Based Routing
 
**GitHub label:** `ui`  
**Depends on:** TASK 03  
**Estimated effort:** M
 
### Goal
Build the application shell: top nav, sidebar, and protected route logic.
 
### Routes
 
| Path | Role |
|---|---|
| `/login` | public |
| `/customer/accounts` | customer |
| `/customer/cards` | customer |
| `/customer/transactions` | customer |
| `/customer/spend` | customer |
| `/customer/requests` | customer |
| `/manager/clients` | account_manager |
| `/manager/requests` | account_manager |
| `/admin/managers` | admin |
| `/admin/overview` | admin |
 
### Requirements
- Redirect unauthenticated users to `/login`
- Redirect authenticated users away from `/login` to their role's home
- Wrong-role access redirects to role's own home (not a blank 403 page)
- Sidebar links match the current user's role
- Username and "Change Password" accessible from all authenticated views
- Logout clears token and redirects to `/login`
### `data-testid` requirements
- `nav-sidebar`, `nav-link-*`, `btn-logout`, `user-display-name`
### Acceptance Criteria
- [ ] Navigating to a route outside your role redirects correctly
- [ ] After login, user lands on their role's home page
- [ ] Logout works from any page
---
 
## TASK 14 – Error Handling, Validation & Test Automation Support
 
**GitHub label:** `business-rule`, `ui`  
**Depends on:** all feature tasks  
**Estimated effort:** M
 
### Goal
Harden the application with consistent error handling, input validation, and test automation hooks.
 
### Backend
- Global Express error handler that formats all errors as `{ error, code }`
- Input validation middleware (e.g. Zod or express-validator) on all POST/PUT/PATCH endpoints
- 400 for validation errors with field-level messages
- 401 for auth failures, 403 for role/scope violations, 422 for business rule failures, 500 for unexpected errors
### Frontend
- Every form field shows inline error below it (not just toast)
- Every successful action shows a visible success message (`data-testid="msg-success"`)
- Every failed action shows a visible error message (`data-testid="msg-error"`)
- Loading states on all async buttons (`data-testid="btn-*-loading"`)
- All amounts formatted as `€0.00`
### Acceptance Criteria
- [ ] No unhandled promise rejections in backend
- [ ] Submitting empty or invalid forms never crashes; all fields have visible errors
- [ ] All `data-testid` attributes are present on interactive and informational elements
- [ ] API error messages are surfaced to the UI (not swallowed)
---
 
## TASK 15 – End-to-End Smoke Test Suite (optional but recommended)
 
**GitHub label:** `task`  
**Depends on:** all tasks  
**Estimated effort:** L
 
### Goal
Write a Playwright (or Cypress) smoke test suite that validates the full happy path for each role.
 
### Test Scenarios
 
**Customer flow:**
1. Login as customer
2. Submit open account request
3. (As manager) approve it
4. Deposit €100
5. Transfer €50 to second own account
6. Spend €20 from bank account
7. Spend €30 using debit card
8. Spend €15 using credit card (verify overdraft permitted)
9. Trigger insufficient funds on bank account; verify top-up sources shown; top up and retry
10. Submit withdraw request for €20
11. (As manager) approve withdrawal
12. Submit a pending request; cancel it; verify status = cancelled
13. (As manager) reject a request with a reason; verify reason visible to customer
**Account Manager flow:**
1. Login as manager
2. Add a new customer (verify auto-assigned)
3. View pending requests
4. Approve account opening
5. Approve card issuance
6. Reject a request with a mandatory reason
7. Directly freeze a card; directly unfreeze it
8. Close a credit card (verify balance ≥ credit_limit enforced)
9. Delete a client (after satisfying all 4 conditions)
**Admin flow:**
1. Login as admin
2. Add a new account manager
3. Add a new customer assigned to that manager
4. Reassign all clients from one manager to another (bulk)
5. Reassign a single customer to a different manager
6. Reset a user's password; verify they can log in with new password
7. Approve a pending request from the system-wide requests view
8. Remove the old manager (after full reassignment)
### Acceptance Criteria
- [ ] All happy-path scenarios pass against a seeded database
- [ ] Tests use `data-testid` selectors only (no CSS class or text selectors)
- [ ] CI-ready: runnable with `npm test` from project root
---
 
## TASK 16 – Customer: Spending
 
**GitHub label:** `customer`, `business-rule`  
**Depends on:** TASK 05, TASK 06  
**Estimated effort:** M
 
### Goal
Customers can spend instantly from a bank account, debit card, or credit card (no approval required). Insufficient funds triggers a warning and, for same-customer contexts, a top-up flow.
 
### API Endpoints
 
```
-- Spend from bank account
POST   /api/v1/transactions/spend
       Body: { source_type: 'account', source_id, amount, description? }
       Blocked if account frozen/closed or balance < amount
       Response: { data: Transaction, message }
 
-- Spend from debit card (draws from linked bank account)
POST   /api/v1/transactions/spend
       Body: { source_type: 'debit_card', source_id, amount, description? }
       Records: debit_card_id + linked from_account_id
       Blocked if card or linked account frozen/closed or account balance < amount
 
-- Spend from credit card (overdraft permitted)
POST   /api/v1/transactions/spend
       Body: { source_type: 'credit_card', source_id, amount, description? }
       Never blocked for insufficient funds; balance may go below €0.00
       Blocked only if card is frozen or closed
 
-- Insufficient funds response (bank account / debit card)
       HTTP 422
       {
         "error": "Insufficient funds",
         "code": "INSUFFICIENT_FUNDS",
         "available_balance": 45.00,
         "required_amount": 120.00,
         "top_up_sources": [
           { "type": "account", "id": "uuid", "last8": "ABCD1234", "balance": 300.00, "status": "active" },
           { "type": "credit_card", "id": "uuid", "balance": 80.00, "status": "frozen", "warning": "This card is frozen and cannot be used as a top-up source" }
         ]
       }
       -- closed instruments omitted from top_up_sources entirely
       -- frozen instruments included but flagged with warning
```
 
### Business Rules to Enforce
- Bank account spend: blocked if balance < amount or account frozen/closed
- Debit card spend: blocked if card frozen/closed OR linked account frozen/closed OR account balance < amount
- Credit card spend: blocked only if card frozen/closed; overdraft always permitted
- Insufficient funds on bank account or debit card: return 422 with `top_up_sources` listing all other customer payment methods
  - Active instruments: selectable as top-up source
  - Frozen instruments: included in list, marked as frozen, not selectable
  - Closed instruments: excluded from list entirely
- If no active top-up sources available: return 422 with `top_up_sources: []` and message "No eligible payment methods available"
- Amount must be > €0.00
### Frontend Page: `/customer/spend`
- Select payment instrument (account / debit card / credit card) from dropdown
- Enter amount and optional description
- On submit:
  - Success: show transaction confirmation with updated balance
  - Insufficient funds (bank/debit): show warning inline with available balance; render top-up source list below
    - Active sources: selectable with amount input to top up, then retry spend
    - Frozen sources: shown with frozen badge and warning, greyed out
    - No sources: show "No eligible payment methods available" message
  - Frozen/closed instrument: show inline error
- `data-testid`: `select-spend-source`, `input-spend-amount`, `btn-spend`, `msg-insufficient-funds`, `msg-available-balance`, `list-topup-sources`, `topup-source-row`, `badge-frozen`, `btn-topup-and-retry`, `msg-no-sources`, `msg-success`, `msg-error`
### Acceptance Criteria
- [ ] Bank account spend immediately deducts balance and creates transaction record
- [ ] Debit card spend deducts from linked bank account; records both `debit_card_id` and `from_account_id`
- [ ] Credit card spend deducts from card balance; proceeds even if balance goes below €0.00
- [ ] Insufficient funds on bank/debit returns 422 with `top_up_sources` list
- [ ] Frozen instruments appear in top-up list with warning; cannot be selected
- [ ] Closed instruments do not appear in top-up list
- [ ] If no active top-up sources: message displayed, no list rendered
- [ ] Credit card spend never shows insufficient funds warning (overdraft always permitted)
- [ ] Frozen or closed instrument shows inline error if selected for spend
- [ ] All spend transactions appear in transaction history with correct type, instrument, and counterpart
---
 
## Milestone Summary
 
| Milestone | Tasks | Description |
|---|---|---|
| M1 – Foundation | 01, 02, 03 | Scaffold, DB schema, auth |
| M2 – Customer | 04, 05, 06, 16 | All customer features |
| M3 – Account Manager | 07, 08, 09, 10 | All manager features |
| M4 – Admin | 11, 12 | Admin management |
| M5 – Polish | 13, 14 | Shell, routing, validation |
| M6 – Testing | 15 | E2E smoke tests |
 
---
 
## Definition of Done (per task)
 
- [ ] Feature works end-to-end (frontend → backend → database)
- [ ] All business rules enforced at API level (not just frontend)
- [ ] All `data-testid` attributes present
- [ ] Success and error messages visible for every action
- [ ] No console errors in browser or server logs
- [ ] Committed to a feature branch, PR opened against `main`
 
