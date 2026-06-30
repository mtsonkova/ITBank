# Handoff: IT Bank — Banking Simulator UI

## Overview
A web-based **Banking Simulator** for test-automation training. It supports three roles — **Customer**, **Account Manager**, and **Admin** — each with its own navigation and screens. This package contains a high-fidelity HTML design covering login, dashboards, accounts & cards, transfers (including the insufficient-funds top-up flow), requests, the approvals queue, and admin user management.

Full functional requirements are in `banking_simulator_requirements.md` (included). This README documents the **visual design**; the requirements doc is the source of truth for **behavior and business rules**.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look and behavior, **not production code to copy directly**.

- `IT Bank UI.dc.html` and `BankScreen.dc.html` are authored as "Design Components" (a streaming HTML format). They use a small custom runtime (`<x-dc>`, `<sc-if>`, `<sc-for>`, `<dc-import>`). **Do not** port that runtime. Read them for layout, structure, copy, and exact style values only.
- The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, Angular, etc.) using its established component library, routing, and state patterns. If no front end exists yet, choose an appropriate framework (React + a component library is a reasonable default) and implement there.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, and layout are final and should be reproduced closely. Recreate the UI using the target codebase's existing libraries/patterns, matching the documented tokens below.

## Chosen Direction: 1a · Ocean Header
**Implement direction 1a.** Light/white left sidebar + a deep-blue (`#0077B6`) top header bar with white text. (The other direction, 1b · Cyan Rail, also exists in the HTML for reference but is **not** the one to build.) The `screenshots/` folder contains a rendered PNG of every 1a screen — see "Screenshots" below.

Everything below (screen content, components, copy) is **the same in both**; only the shell chrome differs.

---

## Global Layout & Chrome

### App shell
- **Container:** white (`#FFFFFF`), `border: 1px solid #DCE7ED`, `border-radius: 18px`, `overflow: hidden`. Fixed demo height 812px; in a real app the main content scrolls.
- **Two-column:** fixed **sidebar 252px** + fluid **main column** (`flex: 1`, `min-width: 0`).
- **Main column** = top header (62px tall) + scrollable content area.

### Sidebar (252px)
Top → bottom: logo (1a only — see Logo), **role switcher** (segmented control), **nav list**, then a bottom-pinned **"Change password"** button (`margin-top: auto`, separated by a top border).

- Role switcher (segmented): 3 equal buttons `Customer / Manager / Admin`. Track padding 3px, radius 11px.
  - 1a track `#F1F7FA`; active pill `#FFFFFF` text `#0077B6` weight 700 + soft shadow; inactive text `#5B6B7A` weight 600.
  - 1b track `rgba(255,255,255,.14)`; active pill `#FFFFFF` text `#0077B6`; inactive text `rgba(255,255,255,.85)`.
- Nav items: full-width, left-aligned buttons, `padding: 11px 14px`, `border-radius: 10px`, 14px, gap 4px.
  - 1a active: bg `#E6F4F9`, text `#0077B6`, weight 700. Inactive: transparent, text `#4A5A67`, weight 600, hover bg `#F4FAFC`.
  - 1b active: bg `rgba(255,255,255,.18)`, text `#FFFFFF`, weight 700. Inactive: transparent, text `rgba(255,255,255,.78)`, weight 600, hover bg `rgba(255,255,255,.08)`.

### Top header (62px)
- **1a:** background `#0077B6`. Left: page title (Bitter 600, 18px, white). Right: a "Search…" pill (`rgba(255,255,255,.16)`, radius 999px), user block (34px avatar circle `#90E0EF` / text `#024E73`, name white 13px + role `#BFE6F2` 11px), and a **Sign out** outline button (white border `rgba(255,255,255,.5)`).
- **1b:** background `#FFFFFF`, `border-bottom: 1px solid #EDF3F6`. Left: logo + 1px divider + page title (Bitter 600, 17px, `#0F172A`) with a `2px solid #00B4D8` bottom border. Right: "Search…" pill (`#F1F7FA`), user block (34px avatar `#0096C7`/white, name `#0F172A`, role `#8595A3`), **Sign out** button (white bg, text `#0077B6`, border `#BFE6F2`).
- **Sign out** sets the screen to `login`; **Sign in** on the login screen returns to `dashboard`.

### Logo
Wordmark "**IT Bank**", **bold + italic**, font **Bitter**:
- "IT" in `#0096C7`, "Bank" in near-black `#0F172A`. Always rendered on a white surface for legibility.
- 1a: in the sidebar top (white). 1b: in the white top bar (and a plain white "IT Bank" wordmark on the blue login panel).

### Navigation per role
- **Customer:** Dashboard · Accounts & Cards · Transfer & Pay · My Requests
- **Account Manager:** Dashboard · My Clients · Approvals
- **Admin:** Overview · Approvals · User Management

Switching role resets the active screen to `dashboard` and clears the top-up demo state.

---

## Screens / Views

Content area padding: `30px 34px`, white background. Section/card pattern repeated throughout:
- **Card:** bg `#FFFFFF`, `border: 1px solid #E3EEF3`, `border-radius: 14px`, `padding: 18–24px`, `box-shadow: 0 1px 2px rgba(2,32,71,.04)`.
- **Stat card:** uppercase label (`#5B6B7A`, 12px, weight 600, letter-spacing .04em) + value in **Bitter** 700, 25px, `tabular-nums`.
- **Section title:** Bitter 700, 17–24px, `#0F172A`.
- **Table header row:** bg `#F4FAFC`, 12px uppercase `#5B6B7A` weight 700; body rows separated by `1px solid #EEF4F7`.

### 1. Login (`login`)
- **Purpose:** Authenticate. Username + password, "Sign in".
- **1a:** centered 380px card on a `linear-gradient(160deg,#F4FAFC,#E3F3F9)` backdrop; centered logo, "Sign in to your account", two inputs, full-width primary button.
- **1b:** split layout — left 46% panel `linear-gradient(185deg,#0077B6,#0096C7)` with white "IT Bank" + tagline; right white form (340px) "Welcome back".
- Inputs: `padding 11px 12px`, `border 1px solid #CFE4ED`, radius 9px. Primary button: bg `#0096C7`, white, radius 10px, hover `#0077B6`.
- Per requirements: changing a password requires confirming the current password (sidebar "Change password" entry is the hook for that flow — not yet designed as a screen).

### 2. Customer · Dashboard (`dashboard`, role=customer)
- Greeting "Good afternoon, Anna" (Bitter 700, 26px) + subtitle.
- **4 stat cards** (grid, 4 cols, gap 16px): Total balance `€17,120.50`; Active accounts `3`; Cards `3`; Pending requests `2` (value colored `#9A6B12`).
- **Two columns** (1.1fr / 1fr): "Your accounts" list (3 rows: name, IBAN, balance, status badge) and "Recent transactions" (5 rows: type, meta, signed amount, date).
- **Quick actions** row: Transfer money (primary `#0096C7`), Deposit / Pay / New request (outline `#0077B6` border `#BFE6F2`).

### 3. Customer · Accounts & Cards (`accounts`)
- "Bank accounts": 3-col grid of account cards — name, status badge, IBAN, balance (Bitter 24px), and actions **Freeze/Unfreeze** (outline) + **Request close** (danger outline `#B0463C`/`#E7C9C6`). Frozen account shows "Unfreeze" instead of "Freeze".
- "Cards": 3-col grid. Debit cards use `linear-gradient(135deg,#0077B6,#00B4D8)` tiles (white text, brand, masked number, linked account, status pill). Credit card uses a dark `#0F172A` tile showing limit `€2,000` and balance `€-340.00` (overdraft, shown in `#FFB4A8`); status pill in `#90E0EF`.

### 4. Customer · Transfer & Pay (`transfer`)
- **Left form card** (1.3fr): From (`<select>`), To (`<select>`), Amount (€ prefix input, value `650.00`), Note input, then **Review transfer** (primary) + a demo toggle button **"Simulate insufficient funds"**.
- **Right card** (.9fr): "Your balances" — funding sources list with status pills.
- **Insufficient-funds / top-up flow** (shown when the demo toggle is on — implement as the real insufficient-funds state):
  - Red warning banner (`#FCEDEB`, text `#9C342C`, circular `!` badge `#C2453D`): states the selected method lacks funds for the amount and to choose a source to top up, then retry.
  - "Top-up sources" — radio-select rows. **Active** sources selectable (white row, border `#CFE4ED`, "Available" green pill). A **frozen** source still appears but is **disabled** (greyed name `#8595A3`, row `#FCFAF4`, amber pill "Frozen — unfreeze to use", radio `disabled`, `cursor: not-allowed`). **Closed** sources are omitted entirely.
  - Top-up amount (€ input) + **Top up & retry** button (bg `#00B4D8`, hover `#0096C7`).
  - Per requirements: cross-customer transfers show the error but **no** top-up options; if no active source exists, show a "no eligible methods" message.

### 5. Customer · My Requests (`requests`)
- Table: **Request | Submitted | Status | Action** (grid `2fr 1fr 1fr 1.2fr`).
- Status badges: Pending (amber `#FBF1E0`/`#9A6B12`), Approved (green `#E7F3EC`/`#2E7D5B`), Rejected (red `#F6E9E8`/`#B0463C`).
- Pending rows show a **Cancel** button (danger outline). Rejected rows show the **rejection reason** inline (`#B0463C`). Approved/rejected rows cannot be cancelled.

### 6. Account Manager · Dashboard (`dashboard`, role=manager)
- "Account Manager workspace" + "Sofia Lang · 24 assigned clients".
- 4 stat cards: Assigned clients 24; Pending approvals 4 (`#9A6B12`); Frozen items 3; Awaiting closure 1.
- "Requests awaiting your action" list (4 rows) each with **Approve** (primary) + **Reject** (danger outline).

### 7. Account Manager · My Clients (`clients`)
- Header with **+ Add customer** (primary, right-aligned).
- Table: **Client | Accounts | Total balance | Status | Action** (grid `1.6fr 1fr 1.2fr 1fr .9fr`). Client cell has a 34px circular initials avatar (`#E6F4F9`/`#0077B6`). Action = **View** (outline).

### 8. Approvals Queue (`approvals`, role=manager OR admin)
- Subtitle differs by role: admin → "All pending requests across every Account Manager."; manager → "Requests from clients in your portfolio."
- Table: **Customer | Request | Submitted | Action** (grid `1.3fr 1.6fr 1fr 1.4fr`). Customer cell shows the assigned manager beneath the name. Each row: **Approve** (primary) + **Reject** (danger outline).
- **Rejection-reason block** (always shown at the bottom as the rejecting state): amber-tinted panel `#FCFAF4`, label "Rejecting … — a reason is required", a `<textarea>` (border `#E4D4AE`) pre-filled with an example reason, **Confirm rejection** (bg `#C2453D`) + **Cancel** (outline). Per requirements a rejection reason is mandatory and is shown back to the customer.

### 9. Admin · System Overview (`dashboard`, role=admin)
- 4 stat cards: Total users 312; Account managers 8; Customers 304; Pending requests 17 (`#9A6B12`).
- Two columns (1.4fr/1fr): "System-wide pending requests" (rows with customer · manager + "Pending" pill) and "Account managers" (name + client count).

### 10. Admin · User Management (`users`)
- Two side-by-side panels (1fr/1fr), each with a header + **+ Add** button.
  - **Account Managers:** rows with name + "N assigned clients", actions **Reassign** (outline) + **Remove**. Remove is **disabled** when the manager still has assigned clients (greyed `#B6C2CC`/`#E6ECF0`, `cursor: not-allowed`); enabled (danger outline) only at 0 clients — matching the requirement that all customers must be reassigned first.
  - **Customers:** rows with name + "Manager: …", actions **Reassign** + **Reset password** (admin resets without the current password).

---

## Interactions & Behavior
- **Role switch:** changes available nav + content; resets active screen to dashboard; clears top-up demo.
- **Nav click:** swaps the content view; active item highlighted per shell rules above.
- **Sign out / Sign in:** toggles between the `login` view and `dashboard`.
- **Insufficient funds:** blocks the transaction, shows the warning, and presents eligible top-up sources (frozen = visible but disabled; closed = hidden). See requirements §3.1.6 for full rules.
- **Hover states:** primary buttons darken `#0096C7 → #0077B6`; outline/nav items get a subtle tinted background.
- All interactive + assertable elements carry **`data-testid`** (see below). Per requirements, automated tests must select via `data-testid` only.

## State Management
- **Current role** (`customer | manager | admin`) — drives nav + content.
- **Active screen** (`login | dashboard | accounts | transfer | requests | clients | approvals | users`).
- **Top-up / insufficient-funds visible** (boolean) on the transfer screen.
- Real implementation will additionally need: authenticated user/session, account/card/transaction/request data per the requirements doc, request workflow status (pending/approved/rejected + reason), and role-scoped data access.

## Design Tokens
**Colors**
- Brand deep / header / sidebar: `#0077B6`
- Brand primary (logo "IT", primary buttons): `#0096C7`
- Brand bright (accents, top-up CTA, title underline): `#00B4D8`
- Brand light (tints, avatar, credit pill): `#90E0EF`
- Surface / page card: `#FFFFFF`; logo "Bank" + primary text: `#0F172A`
- Muted text: `#5B6B7A`; faint text: `#8595A3`
- Hairline borders: `#E3EEF3`, `#EEF4F7`, `#EDF3F6`; input border `#CFE4ED`; outline-button border `#BFE6F2`
- Light tint backgrounds: `#F4FAFC`, `#F1F7FA`, `#E6F4F9`
- Functional status (used sparingly): success `#2E7D5B` on `#E7F3EC`; warning/frozen `#9A6B12` on `#FBF1E0`; danger/rejected `#B0463C` on `#F6E9E8`; error banner `#9C342C`/`#C2453D` on `#FCEDEB`; closed/neutral `#64748B` on `#EFF1F3`

**Typography**
- Display / headings / logo: **Bitter** (slab serif). Logo = 700 italic. Headings 600–700.
- UI / body: **Libre Franklin**. Body 400–500; labels/buttons 600; emphasis 700.
- Numerics use `font-variant-numeric: tabular-nums`.

**Radius:** cards 14px; large shell 18px; buttons 8–10px; pills/badges 999px.
**Shadow:** cards `0 1px 2px rgba(2,32,71,.04)`; elevated `0 24px 60px -30px rgba(2,32,71,.45)`.
**Spacing:** content padding `30px 34px`; card padding 18–24px; grid gaps 16–18px.
**Currency:** EUR only; format `€1,234.56`; negative balances shown with `€-` (overdraft permitted on credit card).

## Assets
None external. The logo is a text wordmark (Bitter, bold italic). No icons or images are required — card tiles use CSS gradients; avatars are CSS circles with initials. Fonts load from Google Fonts (Bitter, Libre Franklin).

## Screenshots
Rendered PNGs of the chosen **1a · Ocean Header** direction live in `screenshots/`:
- `01-customer-dashboard.png`
- `02-customer-accounts-cards.png`
- `03-customer-transfer.png`
- `04-customer-transfer-insufficient-funds.png` (the top-up flow)
- `05-customer-requests.png`
- `06-manager-dashboard.png`
- `07-manager-clients.png`
- `08-approvals-queue.png`
- `09-admin-overview.png`
- `10-admin-user-management.png`
- `11-login.png`

## Files
- `IT Bank UI.dc.html` — parent design: both shell directions (1a/1b), login, role + screen switching, all data (accounts, cards, transactions, requests, clients, approvals, managers, funding/top-up sources).
- `BankScreen.dc.html` — all screen content blocks (dashboards, accounts, transfer + top-up, requests, clients, approvals, users) with `data-testid`s.
- `banking_simulator_requirements.md` — authoritative functional requirements & business rules.

### data-testid reference (selectors used in the design)
Screens: `screen-customer-dashboard`, `screen-accounts`, `screen-transfer`, `screen-requests`, `screen-manager-dashboard`, `screen-clients`, `screen-approvals`, `screen-admin-dashboard`, `screen-users`.
Nav/role (suffixed `-a`/`-b` per shell): `role-tab-{customer|manager|admin}-{a|b}`, `nav-{key}-{a|b}`, `page-title-{a|b}`, `sign-out-{a|b}`, `change-password-{a|b}`.
Login: `login-card-{a|b}`, `login-username-{a|b}`, `login-password-{a|b}`, `login-submit-{a|b}`.
Data rows/controls: `account-row-{id}`, `account-balance-{id}`, `account-status-{id}`, `account-card-{id}`, `account-freeze-{id}`, `account-close-{id}`, `card-tile-{id}`, `card-status-{id}`, `credit-balance`, `tx-row-{id}`, `stat-total-balance`, `stat-pending-requests`, `stat-pending-approvals`, `stat-system-pending`, `transfer-from`, `transfer-to`, `transfer-amount`, `transfer-note`, `transfer-submit`, `transfer-simulate-insufficient`, `insufficient-funds-panel`, `insufficient-funds-warning`, `topup-source-{id}`, `topup-radio-{id}`, `topup-flag-{id}`, `topup-amount`, `topup-submit`, `request-row-{id}`, `request-status-{id}`, `request-reason-{id}`, `request-cancel-{id}`, `client-row-{id}`, `client-view-{id}`, `add-customer`, `approval-row-{id}`, `approval-preview-{id}`, `approve-{id}`, `reject-{id}`, `rejection-reason-input`, `confirm-reject`, `cancel-reject`, `manager-row-{id}`, `reassign-{id}`, `remove-manager-{id}`, `customer-row-{id}`, `reassign-customer-{id}`, `reset-pw-{id}`, `add-manager`, `add-customer-admin`.

> Note: in this prototype, role + screen switching is local UI state and the `-a`/`-b` suffix distinguishes the two shell mockups. In the real app, drop the suffix and back the screens with routing + real data; keep the rest of the `data-testid` names.
