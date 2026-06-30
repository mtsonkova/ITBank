# Banking Simulator – User Requirements Document

**Project Type:** Web Application  
**Purpose:** Training project for test automation practice  
**Supported Currency:** EUR  
**Version:** 1.0  

---

## 1. Project Overview

The Banking Simulator is a web-based application that simulates core retail banking operations. It supports three distinct user roles — Customer, Account Manager, and Admin — each with clearly defined permissions and access boundaries. The application is intended exclusively as a training environment for practicing test automation.

---

## 2. General Requirements

### 2.1 Platform
- The application must be a web application accessible via a browser.
- No mobile application is required.

### 2.2 Currency
- The only supported currency is **EUR**.
- All account balances, transactions, and card limits must be denominated in EUR.

### 2.3 Authentication & Password Management
- All users (Customer, Account Manager, Admin) must be able to log in with a username and password.
- All users must be able to change their own password after logging in.
- Password changes must require the user to confirm their current password before setting a new one.

### 2.4 Data Visibility & Access Control
- **Customers** may only view and interact with their own banking data.
- **Account Managers** may only view and interact with the data of clients explicitly assigned to them.
- **Admins** have full visibility of all data across all users and roles.
- No role may access data outside its defined scope.

---

## 3. User Roles & Permissions

### 3.1 Customer

A Customer is an end-user of the banking simulator who manages their own financial products through requests and self-service actions.

#### 3.1.1 Bank Account Management
- A Customer may **submit a request** to open a new bank account.
- A Customer may **submit a request** to close an existing bank account.
- A Customer may **submit a request** to freeze an existing bank account.
- A Customer may **submit a request** to unfreeze a previously frozen bank account.

#### 3.1.2 Debit Card Management
- A Customer may **submit a request** to issue a debit card attached to a specific bank account.
- A Customer may **submit a request** to close a debit card.
- A Customer may **submit a request** to freeze a debit card.
- A Customer may **submit a request** to unfreeze a previously frozen debit card.

#### 3.1.3 Credit Card Management
- A Customer may **submit a request** for the bank to issue a credit card.
- A Customer may **submit a request** to close an existing credit card.
- A Customer may **submit a request** to freeze an existing credit card.
- A Customer may **submit a request** to unfreeze a previously frozen credit card.
- A Customer may **submit a request** to increase the credit limit on an existing credit card (raises the spending ceiling, e.g. from EUR 1000 to EUR 2000).
- A Customer may **submit a request** to decrease the credit limit on an existing credit card.
- A Customer may **top up** their credit card by transferring money onto it from a bank account or a debit card. This is a self-service action and does not require Account Manager approval. The top-up amount must be greater than EUR 0.00.

#### 3.1.4 Transactions
- A Customer may **spend** from a bank account directly.
- A Customer may **spend** using a debit card. Funds are drawn from the bank account linked to that debit card.
- A Customer may **spend** using a credit card. Funds are drawn from the credit card's current balance. The credit card balance may go below EUR 0.00 (overdraft is permitted).
- A Customer may **transfer money** between their own bank accounts.
- A Customer may **transfer money** from a credit card to a bank account or to top up another payment method. The credit card balance may go below EUR 0.00 as a result of this transfer (overdraft is permitted).
- A Customer may **transfer money to another customer's bank account** (cross-customer transfer). Only bank account → bank account transfers are permitted for cross-customer transactions. The source account must have sufficient funds; no overdraft is permitted. No top-up options are offered if the source account has insufficient funds.
- A Customer may **deposit money** into their own bank accounts.
- A Customer may **submit a request** to withdraw money from a bank account.
- All spending and transfer transactions are instant self-service actions and do not require Account Manager approval.

#### 3.1.5 Transaction History
- A Customer may **view the transaction history** for each of their bank accounts and cards.
- The transaction history must display: transaction type, amount in EUR, date and time, the counterpart account or card (if applicable, e.g. for transfers), and the payment instrument used (e.g. which debit card was used, where applicable).

#### 3.1.6 Insufficient Funds Handling
When a Customer attempts a spend or **same-customer** transfer and the selected payment method does not have sufficient funds to cover the transaction amount, the system must:

1. **Block the transaction immediately** — the transaction must not be processed.
2. **Display a warning message** clearly stating that the selected payment method has insufficient funds.
3. **Offer the Customer top-up options** — the system must present all other available payment methods the customer holds (bank accounts, debit cards, credit card) as potential funding sources to top up the selected payment method, so the transaction can be retried.

The following rules apply to the top-up options presented:
- If a payment method offered as a top-up source is **frozen**, it must still appear in the list but must be marked as frozen with a warning message. The Customer must not be able to select it as a funding source until it is unfrozen.
- If a payment method offered as a top-up source is **closed**, it must not appear in the list.
- The Customer may select an available (active) source, enter a transfer amount, and complete the top-up before retrying the original transaction.
- If no active funding sources are available, the system must display a message stating that no eligible payment methods are available to top up the selected method.

For **cross-customer transfers**, if the source bank account has insufficient funds, the transaction must be blocked with an insufficient funds error, but no top-up options are offered.

#### 3.1.7 Request Management
- A Customer may **view all requests** they have submitted, including their current status (pending, approved, or rejected).
- If a request was rejected, the Customer must be able to see the rejection reason provided by the Account Manager.
- A Customer may **cancel a pending request** before it has been actioned by the Account Manager. Once a request has been approved or rejected, it cannot be cancelled.

---

### 3.2 Account Manager

An Account Manager is a bank employee who manages a defined portfolio of assigned clients. They may only access data belonging to clients in their portfolio.

#### 3.2.1 Client Data Access
- An Account Manager may view the full banking profile of any client assigned to them.
- An Account Manager may **not** view data of clients assigned to other Account Managers.
- An Account Manager may **add a new Customer** to the system. The newly created Customer is automatically assigned to the Account Manager who created them.

#### 3.2.2 Bank Account Operations
- An Account Manager may **open** a new bank account for an assigned client, following a client request.
- An Account Manager may **close** a bank account for an assigned client. The account balance must be EUR 0.00 before closure; closure must be blocked otherwise.
- An Account Manager may **freeze** a bank account for an assigned client.
- An Account Manager may **unfreeze** a frozen bank account for an assigned client.

#### 3.2.3 Card Operations
- An Account Manager may **issue a new debit card** for an assigned client, in response to a client request.
- An Account Manager may **close a debit card** belonging to an assigned client.
- An Account Manager may **freeze a debit card** belonging to an assigned client.
- An Account Manager may **unfreeze a frozen debit card** belonging to an assigned client.
- An Account Manager may **issue a new credit card** for an assigned client, in response to a client request.
- An Account Manager may **close a credit card** belonging to an assigned client. The credit card balance must be equal to or greater than the credit limit (EUR 0.00 or above is not sufficient — the full credit limit must be restored) before closure; closure must be blocked otherwise and an appropriate error message displayed.
- An Account Manager may **freeze a credit card** belonging to an assigned client.
- An Account Manager may **unfreeze a frozen credit card** belonging to an assigned client.
- An Account Manager may take the above card actions both in response to a customer request and as a direct operation on a client's profile.

#### 3.2.4 Transaction Processing
- An Account Manager may **process a withdrawal request** submitted by an assigned client.
- An Account Manager may **view the full transaction history** for any bank account belonging to an assigned client.

#### 3.2.5 Request Rejection
- When rejecting any customer request, the Account Manager must provide a **rejection reason**.
- The rejection reason must be stored and made visible to the Customer.

#### 3.2.6 Client Deletion
An Account Manager may **delete a client record** only when all of the following conditions are simultaneously met:

1. All debit cards belonging to the client are **disabled** (closed or frozen such that they cannot be used).
2. All credit cards belonging to the client are **disabled** (closed or frozen such that they cannot be used).
3. The credit card balance is **fully restored to at least the credit limit**. The customer must not have a negative or below-limit balance on their credit card. The customer must not owe anything to the bank.
4. All bank accounts belonging to the client have a **zero balance** (EUR 0.00). All funds must have been withdrawn or transferred out before the account can be deleted.

If any of these conditions is not met, the deletion must be blocked and an appropriate message must be displayed, listing each unmet condition individually.

---

### 3.3 Admin

The Admin is a superuser with full privileges over the entire system.

#### 3.3.1 Account Manager Management
- The Admin may **add** new Account Managers to the system.
- The Admin may **remove** an Account Manager from the system, subject to the following conditions:
  - The Account Manager must have **no assigned customers** at the time of deletion.
  - Before deleting an Account Manager, the Admin must **reassign all of that manager's customers** to another Account Manager. The system must provide a reassignment flow for this purpose.
  - Removal must be blocked if the Account Manager still has any assigned customers, and an appropriate error must be displayed.
- The Admin may **reassign an individual customer** from one Account Manager to another at any time, without requiring a full bulk reassignment.
- The Admin may **reset the password** of any user (Customer or Account Manager) in the system. The reset must set a new password directly without requiring the current password of the target user.

#### 3.3.2 Customer Management
- The Admin may **add** new Customers to the system and assign them to an Account Manager at the point of creation.
- A newly created Customer must be assigned to exactly one Account Manager before the record can be saved.

#### 3.3.3 Full System Access
- The Admin may view all data for all users across all roles.
- The Admin may perform any action available to any other role.
- The Admin may view a **system-wide overview of all pending requests** across all Account Managers and Customers in a single view.
- The Admin may **approve or reject any pending request** in the system, regardless of which Account Manager the customer is assigned to.

---

## 4. Request & Approval Workflow

The following actions are **requests** initiated by the Customer and must be **actioned by the assigned Account Manager**:

| Request Type | Initiated By | Actioned By |
|---|---|---|
| Open bank account | Customer | Account Manager |
| Close bank account | Customer | Account Manager |
| Freeze bank account | Customer | Account Manager |
| Unfreeze bank account | Customer | Account Manager |
| Issue debit card | Customer | Account Manager |
| Close debit card | Customer | Account Manager |
| Freeze debit card | Customer | Account Manager |
| Unfreeze debit card | Customer | Account Manager |
| Issue credit card | Customer | Account Manager |
| Close credit card | Customer | Account Manager |
| Freeze credit card | Customer | Account Manager |
| Unfreeze credit card | Customer | Account Manager |
| Increase credit limit | Customer | Account Manager |
| Decrease credit limit | Customer | Account Manager |
| Withdraw money | Customer | Account Manager |

The system must maintain a visible record of pending requests so that Account Managers can review and process them. Customers must be able to view the status of all their requests and cancel any that are still pending.

---

## 5. Business Rules

### 5.1 Bank Accounts
- A bank account must be associated with exactly one Customer.
- A bank account must have a balance of EUR 0.00 before it can be closed.
- A frozen bank account must not allow deposits, withdrawals, or transfers.
- A frozen bank account may be unfrozen by the Account Manager, restoring it to active status.

### 5.2 Debit Cards
- A debit card must be linked to a specific bank account of the owning Customer.
- A debit card may only be issued if the linked bank account is active (not frozen or closed).
- A frozen or closed debit card must not be usable for transactions.
- A frozen debit card may be unfrozen by the Account Manager, restoring it to active status.

### 5.3 Credit Cards
- A credit card is associated with the Customer, not tied to a specific bank account.
- A Customer may hold one credit card at a time.
- A credit card has a **credit limit** (the maximum spending ceiling, e.g. EUR 1000) and a **current balance** (the amount of money currently loaded on the card). The balance starts at EUR 0.00 when the card is issued.
- The credit card balance may go **below EUR 0.00** as a result of spending or transfers out of the card (overdraft is permitted).
- Before a credit card can be closed, the credit card balance must be **equal to or greater than the credit limit**. If the balance is below the credit limit for any reason (including overdraft), closure must be blocked and an appropriate error displayed.
- A frozen or closed credit card must not be usable for spending or transfers.
- A frozen credit card may be unfrozen by the Account Manager, restoring it to active status.
- Credit card top-ups are self-service actions performed directly by the Customer and do not require Account Manager approval.

### 5.4 Spending & Transfers
- A Customer may spend from a bank account, a debit card, or a credit card. Spending is an instant self-service action requiring no approval.
- When spending with a **debit card**, funds are drawn from the bank account linked to that debit card.
- When spending with a **credit card**, funds are drawn from the credit card's current balance.
- When spending directly from a **bank account**, funds are drawn from that account's balance.
- A spend or transfer from a bank account or debit card is blocked if the available balance is less than the transaction amount. The system must display an insufficient funds warning and offer top-up options (see §3.1.6).
- A spend or transfer from a **credit card** is never blocked for insufficient funds — the credit card balance may go negative (overdraft).
- Transfers between the customer's own payment methods (bank account → credit card, credit card → bank account, debit card → bank account, etc.) are self-service and instant.
- **Cross-customer transfers** are permitted between bank accounts only (account → account). The source account must have sufficient funds; no overdraft and no top-up flow applies.
- Transfers from a bank account may not exceed the available balance of that account.
- A deposit increases the balance of a specified bank account.
- A withdrawal decreases the balance of a specified bank account and requires Account Manager approval.
- All transaction amounts must be greater than EUR 0.00.

### 5.5 Account Manager Assignment
- Every Customer must be assigned to exactly one Account Manager at all times.
- A Customer without an assigned Account Manager is in an invalid state.
- The Admin may reassign any Customer to a different Account Manager at any time.

### 5.6 Account Manager Deletion
- An Account Manager may only be deleted by the Admin when they have no assigned customers.
- The Admin must reassign all of the Account Manager's customers to another Account Manager before deletion is permitted.
- Deletion must be blocked if any customers remain assigned, and the system must display an appropriate error.

---

## 6. Constraints & Assumptions

- The application is for **training and test automation purposes only**; it does not connect to real financial systems.
- There is no requirement for email notifications, SMS, or any external communication.
- No multi-currency support is required; all values are in EUR.
- There is no requirement for interest calculation, fees, or scheduled transactions in this initial version.
- Session management and logout functionality are expected but not detailed here; they should follow standard web application security practices.
- The application must provide sufficient UI feedback (success messages, error messages, validation messages) to support test automation assertions.
- Every interactive element and every informational element relevant to test assertions (buttons, inputs, status badges, balance displays, error/success messages, table rows, top-up source items) must carry a **`data-testid` attribute**. All automated test selectors must use `data-testid` exclusively — no CSS class or visible-text selectors.

---

## 7. Glossary

| Term | Definition |
|---|---|
| Bank Account | A EUR-denominated account held by a Customer, used for deposits, withdrawals, transfers, and spending. |
| Debit Card | A card linked to a specific bank account. Spending with a debit card draws funds from the linked bank account. |
| Credit Card | A prepaid-style card issued to a Customer with a defined credit limit and a current balance. The balance can go negative (overdraft). |
| Credit Limit | The maximum spending ceiling on a credit card (e.g. EUR 1000). The card balance must equal or exceed this amount before the card can be closed. |
| Card Balance | The current amount of money loaded on a credit card. Starts at EUR 0.00 on issuance. May go below EUR 0.00 if the customer spends or transfers more than the available balance (overdraft). |
| Top-Up | A self-service transfer of funds onto a credit card to increase its balance. Does not require Account Manager approval. |
| Overdraft | A state where the credit card balance is below EUR 0.00, resulting from spending or transfers that exceed the available balance. Overdraft is permitted on credit cards. |
| Spend | An instant self-service transaction where the Customer uses a bank account, debit card, or credit card to make a payment. Reduces the balance of the selected payment method. |
| Insufficient Funds | A state where the selected payment method's balance is less than the transaction amount. Triggers a warning and top-up options (bank accounts and credit cards only — credit card overdraft is always permitted). |
| Account Manager | A bank employee responsible for managing a portfolio of assigned Customers. |
| Admin | A superuser with unrestricted access to all system data and operations. |
| Active | The normal operational status of an account or card — all transactions are permitted. |
| Frozen | A status applied to an account or card that prevents it from being used for transactions, without permanently closing it. A frozen account or card may be unfrozen. |
| Closed | A permanent terminal status applied to an account or card. A closed account or card cannot be reopened or used for any transactions. |
| Disabled | An account or card that is either frozen or closed and cannot be used for any transactions. |
| Request | An action initiated by a Customer that requires approval or processing by an Account Manager before it takes effect. |
| Rejection Reason | A mandatory explanation provided by an Account Manager when rejecting a Customer request, visible to the Customer. |
