# Banking Simulator – Jira Epics & Stories (Draft for Review)

**Project:** Banking Simulator
**Source:** banking_simulator_requirements.md v1.0
**Status:** DRAFT — pending approval before upload to Jira

---

## EPIC 1: Authentication & Access Control

**Description:** Implement login, logout, password management, and role-based data visibility boundaries for Customer, Account Manager, and Admin roles.

**Acceptance Criteria:**
- Users can log in with username and password
- Users can change their own password, confirming current password first
- Customers see only their own data
- Account Managers see only assigned clients' data
- Admins see all data across the system
- No role can access data outside its defined scope

**Stories:**
1. As a user, I can log in with username and password
2. As a user, I can log out of the application
3. As a user, I can change my password by confirming my current password
4. As a system, I enforce that Customers can only view/interact with their own data
5. As a system, I enforce that Account Managers can only view/interact with assigned clients' data
6. As a system, I enforce that Admins have unrestricted data visibility

---

## EPIC 2: Customer – Bank Account Management

**Description:** Allow customers to request opening, closing, freezing, and unfreezing of their bank accounts.

**Acceptance Criteria:**
- Customer can submit open/close/freeze/unfreeze requests for bank accounts
- Close request blocked unless balance = EUR 0.00
- Frozen accounts block deposits, withdrawals, and transfers
- Unfreeze restores account to active status

**Stories:**
1. As a Customer, I can request to open a new bank account
2. As a Customer, I can request to close a bank account (blocked if balance ≠ €0.00)
3. As a Customer, I can request to freeze a bank account
4. As a Customer, I can request to unfreeze a frozen bank account
5. As a system, I block all transactions on frozen accounts

---

## EPIC 3: Customer – Debit Card Management

**Description:** Allow customers to request issuance, closure, freezing, and unfreezing of debit cards linked to their bank accounts.

**Acceptance Criteria:**
- Debit card request must reference an active bank account
- Frozen/closed debit cards are not usable for transactions
- Unfreeze restores card to active status

**Stories:**
1. As a Customer, I can request to issue a debit card linked to an active bank account
2. As a Customer, I can request to close a debit card
3. As a Customer, I can request to freeze a debit card
4. As a Customer, I can request to unfreeze a frozen debit card

---

## EPIC 4: Customer – Credit Card Management

**Description:** Allow customers to request issuance, closure, freezing, unfreezing, and limit changes for their credit card, plus self-service top-ups.

**Acceptance Criteria:**
- Customer may hold only one credit card at a time
- Credit card balance must be ≥ credit limit before closure is permitted
- Top-up is self-service, instant, amount must be > €0.00
- Increase/decrease credit limit are submitted as requests requiring approval

**Stories:**
1. As a Customer, I can request a new credit card (blocked if I already hold one)
2. As a Customer, I can request to close my credit card (blocked unless balance ≥ credit limit)
3. As a Customer, I can request to freeze my credit card
4. As a Customer, I can request to unfreeze my credit card
5. As a Customer, I can request to increase my credit limit
6. As a Customer, I can request to decrease my credit limit
7. As a Customer, I can top up my credit card from a bank account or debit card without approval

---

## EPIC 5: Customer – Transactions (Spend, Transfer, Deposit, Withdraw)

**Description:** Enable instant self-service spending and transfers, deposits, cross-customer account transfers, and withdrawal requests, plus transaction history.

**Acceptance Criteria:**
- Spend instantly from bank account, debit card, or credit card (no approval)
- Transfer between own payment methods (account↔account, account↔credit card, debit card→account)
- Credit card transactions permit overdraft; bank account/debit card never go below €0.00
- Cross-customer transfers limited to account→account, no overdraft, no top-up offered
- Deposits increase bank account balance immediately
- Withdrawals require Account Manager approval and don't deduct balance until approved
- Transaction history shows type, amount, date/time, counterpart, and instrument used

**Stories:**
1. As a Customer, I can deposit money into my own bank account
2. As a Customer, I can spend from a bank account
3. As a Customer, I can spend using a debit card (drawn from linked account)
4. As a Customer, I can spend using my credit card (overdraft permitted)
5. As a Customer, I can transfer money between my own bank accounts
6. As a Customer, I can transfer to/from my credit card (overdraft permitted)
7. As a Customer, I can transfer from a debit card to a bank account
8. As a Customer, I can transfer to another customer's bank account (account→account only, no overdraft, no top-up)
9. As a Customer, I can submit a request to withdraw money from a bank account
10. As a Customer, I can view transaction history for each account/card with type, amount, date/time, counterpart, and instrument

---

## EPIC 6: Insufficient Funds & Top-Up Flow

**Description:** Implement the block-warn-offer-top-up flow for same-customer insufficient-funds scenarios, with proper handling of frozen/closed/active sources.

**Acceptance Criteria:**
- Transaction blocked immediately when funds insufficient
- Warning message displayed clearly
- Top-up sources list: active = selectable, frozen = shown with warning and not selectable, closed = excluded
- If no active sources, display "no eligible payment methods" message
- Cross-customer transfers never offer top-up options

**Stories:**
1. As a Customer, I see a warning and blocked transaction when my source has insufficient funds
2. As a Customer, I see a list of eligible top-up sources (active, selectable) when funds are insufficient
3. As a system, I show frozen sources in the top-up list with a warning but prevent selection
4. As a system, I exclude closed sources from the top-up list entirely
5. As a Customer, I see a "no eligible payment methods" message when no active sources exist
6. As a system, I never offer top-up options for cross-customer transfer failures

---

## EPIC 7: Customer – Request Lifecycle Management

**Description:** Allow customers to track, view, and cancel their submitted requests.

**Acceptance Criteria:**
- Customer can view all submitted requests with status (pending/approved/rejected)
- Rejection reason visible to customer when rejected
- Customer can cancel a pending request; cannot cancel approved/rejected ones

**Stories:**
1. As a Customer, I can view all my submitted requests and their statuses
2. As a Customer, I can see the rejection reason for any rejected request
3. As a Customer, I can cancel a pending request before it's actioned

---

## EPIC 8: Account Manager – Client Portfolio & Onboarding

**Description:** Account Managers manage only their assigned client portfolio, including onboarding new customers.

**Acceptance Criteria:**
- Account Manager sees only assigned clients
- Account Manager cannot view clients assigned to others
- New customer created by Account Manager is auto-assigned to them

**Stories:**
1. As an Account Manager, I can view a list of my assigned clients
2. As an Account Manager, I can view the full banking profile of an assigned client
3. As an Account Manager, I can add a new customer who is automatically assigned to me
4. As a system, I block Account Managers from viewing clients outside their portfolio

---

## EPIC 9: Account Manager – Account & Card Operations

**Description:** Account Managers perform account/card lifecycle operations for assigned clients, both via request approval and as direct actions.

**Acceptance Criteria:**
- Open/close/freeze/unfreeze bank accounts for assigned clients
- Issue/close/freeze/unfreeze debit cards for assigned clients
- Issue/close/freeze/unfreeze credit cards for assigned clients
- Close account blocked unless balance = €0.00
- Close credit card blocked unless balance ≥ credit limit
- Actions available both via approving a request and as a direct profile action

**Stories:**
1. As an Account Manager, I can open a new bank account for an assigned client
2. As an Account Manager, I can close a bank account for an assigned client (blocked unless balance = €0.00)
3. As an Account Manager, I can freeze/unfreeze a bank account for an assigned client
4. As an Account Manager, I can issue a debit card for an assigned client
5. As an Account Manager, I can close/freeze/unfreeze a debit card for an assigned client
6. As an Account Manager, I can issue a credit card for an assigned client
7. As an Account Manager, I can close a credit card for an assigned client (blocked unless balance ≥ credit limit)
8. As an Account Manager, I can freeze/unfreeze a credit card for an assigned client
9. As an Account Manager, I can perform any of the above as a direct action outside the request flow

---

## EPIC 10: Account Manager – Request Processing

**Description:** Account Managers review, approve, and reject customer requests, with mandatory rejection reasons, and process withdrawals.

**Acceptance Criteria:**
- View pending requests from assigned clients
- Approve triggers the correct side-effect per request type
- Reject requires a mandatory reason, stored and visible to customer
- Withdrawal approval deducts balance atomically
- View full transaction history for assigned clients' accounts

**Stories:**
1. As an Account Manager, I can view all pending requests from my assigned clients
2. As an Account Manager, I can approve a request, triggering the correct side-effect
3. As an Account Manager, I can reject a request with a mandatory reason
4. As an Account Manager, I can process (approve) a withdrawal request, deducting the balance atomically
5. As an Account Manager, I can view the transaction history of any assigned client's account

---

## EPIC 11: Account Manager – Client Deletion

**Description:** Allow Account Managers to delete a client record only when all four deletion conditions are met, with clear blocked-state messaging.

**Acceptance Criteria:**
- All 4 conditions checked independently: cards disabled, credit balance ≥ limit, all account balances = €0.00
- Blocked deletion lists every unmet condition individually
- Successful deletion removes the user and all associated records

**Stories:**
1. As an Account Manager, I can attempt to delete a client record
2. As a system, I block deletion and list all unmet conditions when any condition fails
3. As a system, I successfully delete the client and all associated records when all conditions are met

---

## EPIC 12: Admin – Account Manager Management

**Description:** Admin can add/remove Account Managers and reassign customers, individually or in bulk.

**Acceptance Criteria:**
- Add new Account Managers
- Remove Account Manager blocked if they have assigned clients
- Bulk reassignment of all clients from one manager to another
- Individual customer reassignment to a different manager at any time
- Admin can reset any user's password without needing the current password

**Stories:**
1. As an Admin, I can add a new Account Manager
2. As an Admin, I can remove an Account Manager (blocked if they have assigned clients)
3. As an Admin, I can bulk-reassign all of a manager's clients to another manager
4. As an Admin, I can reassign an individual customer to a different manager
5. As an Admin, I can reset any user's password directly

---

## EPIC 13: Admin – Customer Management & System Oversight

**Description:** Admin can create customers with manager assignment, and has full system-wide visibility and override authority.

**Acceptance Criteria:**
- New customers must be assigned to exactly one manager at creation
- Admin can view all data across the system
- Admin can perform any action available to any other role
- Admin can view and action a system-wide pending requests view

**Stories:**
1. As an Admin, I can add a new customer and assign them to a manager at creation
2. As an Admin, I can view all customer data regardless of manager assignment
3. As an Admin, I can view a system-wide list of all pending requests
4. As an Admin, I can approve or reject any pending request regardless of assigned manager
5. As an Admin, I can perform any direct account/card operation available to Account Managers, on any client

---

## EPIC 14: Non-Functional – Test Automation Support

**Description:** Ensure the application is fully testable via automated tooling, with consistent UI feedback and selectors.

**Acceptance Criteria:**
- Every interactive/informational element relevant to test assertions has a `data-testid` attribute
- All automated test selectors use `data-testid` exclusively
- Every action produces a visible success or error message
- All monetary values formatted as `€0.00`

**Stories:**
1. As a QA engineer, I can rely on `data-testid` attributes on all interactive and informational UI elements
2. As a QA engineer, I see a visible success or error message after every user action
3. As a QA engineer, I see all monetary values consistently formatted in EUR

---

## Next Steps

1. Review and confirm this breakdown (or request edits)
2. Confirm Jira project key / target project
3. I'll connect to Jira and create these as Epics with linked Stories
