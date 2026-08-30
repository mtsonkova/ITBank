# Deploying ITBank: Neon (database) + Render (backend) + Netlify (frontend)

**Architecture after this guide**

```
Browser
   |
   v
Netlify  (React frontend, already deployed)
   |  HTTPS  ->  VITE_API_URL
   v
Render   (Node/Express backend, from your Dockerfile)
   |  postgres://  ->  DATABASE_URL
   v
Neon     (managed PostgreSQL, seeded)

GitHub Actions (scheduled) ---> resets Neon back to the seed data
```

Your `docker-compose.yml` stays in the repo and remains the local-development
path. Nothing in this guide removes it.

---

## Part 0 — Prepare the repository

Do these edits locally and push before touching either platform. Deploying
first and fixing later means a lot of slow rebuild cycles.

### 0.1 Listen on the injected port

Render assigns a port through the `PORT` environment variable and expects your
process to bind to it on all interfaces. A hardcoded `3000` will make Render's
health check fail and the deploy will hang at "in progress".

```js
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`listening on ${PORT}`));
```

### 0.2 Read the database URL from the environment

Find every place with a hardcoded connection (`localhost:5432`, or a
docker-compose service name like `db` or `postgres`). Replace with:

```js
// pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
});
```

If you use Prisma, only the `.env` value changes — `datasource db { url =
env("DATABASE_URL") }` already does the right thing. Prisma needs
`?sslmode=require` on the URL instead of a `ssl` option.

### 0.3 CORS

```js
const allowed = [
  'http://localhost:5173',                              // local dev
  'https://preeminent-frangipane-6fec55.netlify.app',   // production
];

app.use(cors({ origin: allowed, credentials: true }));
```

Set `credentials: true` only if you use cookie sessions. If you use
JWT-in-localStorage, you can drop it.

### 0.4 Make login errors honest

The reason this whole problem was hard to diagnose is that a network failure
showed up as "invalid credentials". Fix it:

```js
try {
  const res = await api.post('/api/v1/auth/login', creds);
  // ...
} catch (err) {
  if (!err.response) setError('Cannot reach the server. Try again shortly.');
  else if (err.response.status === 401) setError('Invalid username or password.');
  else setError('Something went wrong.');
}
```

### 0.5 Create `db/reset.sql`

This is the file the scheduled job will run, and it is also what you will use
for the initial seed. It must be **destructive and idempotent** — safe to run
any number of times, always producing the same result.

```sql
BEGIN;

-- Wipe everything. CASCADE handles foreign keys; RESTART IDENTITY
-- resets sequences so IDs start from 1 again.
TRUNCATE TABLE
  transactions,
  accounts,
  users
RESTART IDENTITY CASCADE;

-- Re-insert the seed data. Use the password HASHES your app expects,
-- not plaintext — these must match what bcrypt/argon produces.
INSERT INTO users (username, email, password_hash, role) VALUES
  ('mtsonkova', 'm@example.com', '$2b$10$REPLACE_WITH_REAL_HASH', 'ADMIN'),
  ('jdoe',      'j@example.com', '$2b$10$REPLACE_WITH_REAL_HASH', 'USER');

INSERT INTO accounts (user_id, iban, balance, currency) VALUES
  (1, 'BG80BNBG96611020345678', 5000.00, 'BGN'),
  (2, 'BG18RZBB91550123456789', 1250.50, 'BGN');

COMMIT;
```

Two things to get right:

- **List every table** in the `TRUNCATE`. Any table you forget will accumulate
  rows forever, and foreign-key mismatches will start appearing after a few
  resets.
- **Password hashes, not plaintext.** Generate them once with
  `node -e "console.log(require('bcrypt').hashSync('password123', 10))"`
  and paste the output. If your existing seed data lives in a Docker init
  script, copy the hashes from there.

### 0.6 Seed automatically on startup (optional but recommended)

So a fresh database is never empty:

```js
async function ensureSeeded() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM users');
  if (rows[0].n === 0) {
    const sql = fs.readFileSync('./db/reset.sql', 'utf8');
    await pool.query(sql);
    console.log('database seeded');
  }
}
```

Run schema migrations before this. Commit and push everything.

---

## Part 1 — Neon (the database)

**1.1** Go to neon.tech and sign up with GitHub. No credit card.

**1.2** Create a project. Name it `itbank`. For region choose **Europe
(Frankfurt)** — closest to Sofia and to Render's Frankfurt region, which keeps
query latency low.

**1.3** After creation you land on a screen with connection strings. Copy
**both** and save them somewhere:

- The **pooled** string (contains `-pooler` in the hostname) — this is what
  your app uses.
- The **direct** string (no `-pooler`) — use this for schema changes,
  migrations, and the reset job. Pooled connections can behave oddly with DDL
  and `TRUNCATE`.

They look like:
`postgresql://user:PASSWORD@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require`

**1.4** Create the schema. From your machine, with the **direct** string:

```bash
psql "postgresql://...direct...?sslmode=require" -f db/schema.sql
```

Or run your migration tool against it:

```bash
DATABASE_URL="postgresql://...direct..." npx prisma migrate deploy
```

**1.5** Seed it:

```bash
psql "postgresql://...direct...?sslmode=require" -f db/reset.sql
```

**1.6** Verify before moving on. This is the step people skip and then spend an
hour blaming Render:

```bash
psql "postgresql://...direct...?sslmode=require" -c "SELECT username, role FROM users;"
```

You should see your seeded users. If not, stop and fix it here.

> No `psql` installed? On Windows use the PostgreSQL installer's command-line
> tools, or paste the SQL into Neon's built-in **SQL Editor** in the dashboard.

---

## Part 2 — Render (the backend)

**2.1** Go to render.com, sign up **with GitHub**. This matters: the GitHub
connection is what grants access to private repositories. The alternative
"public repo URL" field on the create screen only works for public repos.

**2.2** During the GitHub authorisation, grant access to the `ITBank`
repository specifically (or all repos — your choice).

**2.3** Dashboard → **New +** → **Web Service** → select `mtsonkova/ITBank`.

**2.4** Fill in the settings:

| Field | Value |
|---|---|
| Name | `itbank-api` |
| Region | Frankfurt (EU Central) |
| Branch | `main` (or `master`) |
| Root Directory | your backend folder, e.g. `backend` or `server` — leave blank if the backend is at repo root |
| Runtime | **Docker** if your backend folder has a Dockerfile, otherwise **Node** |
| Build Command | (Node only) `npm install` |
| Start Command | (Node only) `npm start` |
| Instance Type | **Free** |

If you pick Docker, Render builds your `Dockerfile` — it ignores
`docker-compose.yml` entirely, so the Postgres service defined there is never
started. That is expected; Neon is the database now.

**2.5** Scroll to **Environment Variables** and add:

| Key | Value |
|---|---|
| `DATABASE_URL` | your Neon **pooled** connection string |
| `JWT_SECRET` | a long random string — generate with `openssl rand -hex 32` |
| `NODE_ENV` | `production` |

Add anything else from your local `.env`. Missing variables cause failures that
look like unrelated bugs.

**2.6** Click **Create Web Service**. Watch the log stream. Success looks like
your `listening on 10000` line followed by Render reporting the service is
live. Failures are almost always: wrong root directory, missing env var, or
binding to the wrong port.

**2.7** Copy your service URL — `https://itbank-api.onrender.com`.

**2.8** Test it directly before involving the frontend:

```bash
curl -X POST https://itbank-api.onrender.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"mtsonkova","password":"password123"}'
```

The first call may take 50–60 seconds — free instances spin down after 15
minutes idle and cold-start on the next request. A token in the response means
the backend and database are working.

---

## Part 3 — Netlify (point the frontend at the backend)

**3.1** Netlify dashboard → your site → **Site configuration** →
**Environment variables** → **Add a variable**.

**3.2** Key: `VITE_API_URL` (Vite) or `REACT_APP_API_URL` (Create React App).
Value: `https://itbank-api.onrender.com` — **no trailing slash**, and `https`
not `http`, or the browser blocks it as mixed content.

**3.3** **Deploys** → **Trigger deploy** → **Clear cache and deploy site**.
This is mandatory. Both Vite and CRA bake environment variables into the bundle
at build time, so the existing deploy will keep calling localhost until you
rebuild.

**3.4** Open the site, F12 → Network, log in. The request should now go to
`onrender.com`. If you see a CORS error, revisit step 0.3 — the Netlify origin
must be in the allowed list exactly, including `https://`.

---

## Part 4 — Reset the database every 10 days

Render's cron jobs are a paid service type, so use **GitHub Actions** instead.
It is free, it lives in the same repo, and it needs no extra account.

**4.1** Create `.github/workflows/reset-db.yml`:

```yaml
name: Reset demo database

on:
  schedule:
    # 03:00 UTC on the 1st, 11th, 21st and 31st of each month
    - cron: '0 3 */10 * *'
  workflow_dispatch:   # lets you also trigger it manually from the Actions tab

jobs:
  reset:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install PostgreSQL client
        run: |
          sudo apt-get update
          sudo apt-get install -y postgresql-client

      - name: Reset to seed data
        env:
          DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
        run: |
          psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/reset.sql

      - name: Verify
        env:
          DATABASE_URL: ${{ secrets.NEON_DATABASE_URL }}
        run: |
          psql "$DATABASE_URL" -c "SELECT COUNT(*) AS users FROM users;"
```

**4.2** Add the secret: GitHub repo → **Settings** → **Secrets and variables**
→ **Actions** → **New repository secret**. Name it `NEON_DATABASE_URL`, paste
the Neon **direct** (non-pooled) connection string.

**4.3** Test it now rather than waiting: **Actions** tab → *Reset demo
database* → **Run workflow**. Create a junk account on the live site first, run
the workflow, then confirm the account is gone and the seed users are back.

### Two caveats about the schedule

**Cron cannot express "every 10 days" exactly.** `*/10` in the day-of-month
field means days 1, 11, 21, and 31 — so the gap across a month boundary is
shorter or longer than 10 days depending on month length. For a demo reset
that is almost certainly fine. If you need a strict 10-day interval, run the
job daily and have it check a stored timestamp:

```sql
-- run daily; only resets if 10+ days have passed
DO $$
BEGIN
  IF (SELECT MAX(run_at) FROM reset_log) < now() - interval '10 days'
     OR NOT EXISTS (SELECT 1 FROM reset_log) THEN
    -- truncate + insert here
    INSERT INTO reset_log (run_at) VALUES (now());
  END IF;
END $$;
```

**GitHub disables scheduled workflows in repositories with no activity for 60
days.** You get an email warning first. Any push re-enables it. Worth knowing
if this project goes quiet.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Login still says invalid credentials | Netlify not rebuilt after adding the env var | Clear cache and deploy |
| Request still goes to `localhost:3000` | Hardcoded URL remains somewhere | Grep the frontend for `localhost` |
| CORS error in console | Netlify origin not in allowed list | Check for trailing slash / `http` vs `https` |
| First login times out, second works | Free-tier cold start | Expected — warm it up before demoing |
| `no pg_hba.conf entry` | SSL not enabled | Add `?sslmode=require` or the `ssl` option |
| `relation "users" does not exist` | Schema never applied to Neon | Re-run step 1.4 |
| 502 from Render | App crashed on boot | Check Render logs; usually a missing env var |
| Reset job fails on `TRUNCATE` | Using the pooled connection string | Switch the secret to the direct string |

---

## Before you share the link

- `.env` is in `.gitignore`, and no secret was committed earlier in the git
  history. If one was, rotate it — deleting the file does not remove it from
  the log.
- Seeded demo passwords are not `admin/admin`.
- Add `robots.txt` with `Disallow: /` and a `<meta name="robots"
  content="noindex">` so the site stays out of search results.
- Warm the backend a minute before anyone opens the link.
