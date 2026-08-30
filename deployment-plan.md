# Deployment Plan — ITBank on Neon + Render + Netlify

This adapts `deploy-itbank-render-neon.md` to what's actually in this repo. The
guide is written generically (raw `pg`, a single-folder Node app, hand-rolled
SQL seeding); this repo uses **Prisma**, an **npm-workspaces monorepo**, and
**no Dockerfile**. Where the guide's steps don't fit, this plan says so and
gives the repo-specific replacement. All findings below were verified against
the actual code, not assumed from the guide.

## Phase 0 — Critical blocker: fixed and verified ✅

### 0.1 `packages/shared-types` shipped raw TypeScript as `main` — production start crashed

Verified by building and running the real production start path:

```bash
npm run build --workspace=backend
JWT_SECRET=x DATABASE_URL=postgresql://x PORT=4321 node backend/dist/index.js
# -> Error [ERR_MODULE_NOT_FOUND]: Cannot find module
#    '.../packages/shared-types/src/enums' imported from
#    '.../packages/shared-types/src/index.ts'
```

`packages/shared-types/package.json` had `"main": "./src/index.ts"`. That
only worked in local dev because `tsx watch` (backend) and Vite (frontend)
both transpile TypeScript on the fly, including inside `node_modules`.
Render's start command is plain `node dist/index.js` — plain Node cannot
execute a `.ts` file.

**First fix attempt (single CommonJS build) broke the frontend build.**
Pointing `main` at a single `tsc`-emitted CommonJS `dist/index.js` fixed the
backend boot, but `npm run build --workspace=frontend` then failed:
```
"LoginBodySchema" is not exported by "../packages/shared-types/dist/index.js"
```
Root cause: the barrel file (`index.ts`) uses `export * from './requestBodies'`
etc. In CommonJS output that compiles to a runtime property-copy loop
(`__exportStar`), not literal `exports.LoginBodySchema = ...` lines. Vite/
Rollup's static CJS-export detector (`cjs-module-lexer`) can't see through
that loop, so it doesn't know the re-exported names exist — even though
`tsc --noEmit` typechecks fine (types resolve from `.d.ts` files, unaffected)
and the backend boots fine (Node's real CJS `require()` runs the loop at
runtime and doesn't care about static analysis).

**Actual fix — dual ESM/CJS build**, so Vite gets a real static-export ESM
build and Node gets a working CJS build:
- `packages/shared-types/tsconfig.json` — base config (ES2020 target, ESM,
  bundler resolution — same as the original, used only for `tsc --noEmit`
  typechecking).
- `packages/shared-types/tsconfig.cjs.json` (new) — extends the base,
  overrides to `"module": "CommonJS"`, `"moduleResolution": "node"`,
  `"outDir": "./dist/cjs"`.
- `packages/shared-types/tsconfig.esm.json` (new) — extends the base,
  overrides only `"outDir": "./dist/esm"` (keeps ESM/bundler resolution).
- `packages/shared-types/package.json`:
  ```json
  "main": "./dist/cjs/index.js",
  "module": "./dist/esm/index.js",
  "types": "./dist/cjs/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/cjs/index.d.ts",
      "import": "./dist/esm/index.js",
      "require": "./dist/cjs/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.cjs.json && tsc -p tsconfig.esm.json",
    "typecheck": "tsc --noEmit"
  },
  ```
- Root `package.json` — added an orchestration script:
  ```json
  "build": "npm run build --workspace=packages/shared-types && npm run build --workspace=backend"
  ```

Verified end-to-end after the fix:
```bash
rm -rf packages/shared-types/dist backend/dist frontend/dist
npm run build                                    # shared-types (cjs+esm) + backend
JWT_SECRET=x DATABASE_URL=postgresql://x PORT=4321 node backend/dist/index.js
# -> "Server running on http://localhost:4321"    ✓ backend boots
npm run typecheck --workspace=frontend            # ✓ no errors
npm run build --workspace=frontend                # ✓ Vite build succeeds
npm test --workspace=backend                       # ✓ 103/103 tests pass
```

**Status: implemented on this branch.** No further action needed here.

## Phase 1 — Backend code changes (guide's Part 0, adapted)

### 1.1 PORT binding — already correct, no change
`backend/src/index.ts` already does `const port = Number(process.env.PORT) || 3000; app.listen(port, ...)`. Node's `http.Server.listen(port, cb)` without an
explicit host already binds all interfaces, so this satisfies Render's
requirement as-is.

### 1.2 DATABASE_URL — already correct, no change
`backend/prisma/schema.prisma` already reads `env("DATABASE_URL")` and
`backend/src/lib/prisma.ts` just does `new PrismaClient()`. The guide's
raw-`pg`-style `ssl: { rejectUnauthorized: false }` snippet does not apply
here — Prisma takes SSL from the connection string itself. When you set the
env var on Render, use Neon's **pooled** string with `?sslmode=require`.

### 1.3 CORS — currently wide open, tighten before going live ✅ implemented
`backend/src/app.ts` used to be `app.use(cors({ exposedHeaders: ['Content-Disposition'] }))` — no `origin` option meant it reflected any origin. Now reads an allowlist from an env var:
```ts
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins, exposedHeaders: ['Content-Disposition'] }));
```
The real frontend is at `https://preeminent-frangipane-6fec55.netlify.app`
(confirmed). Set on Render (Phase 4):
`CORS_ORIGINS=http://localhost:5173,https://preeminent-frangipane-6fec55.netlify.app`.
No `credentials: true` needed — auth is JWT-in-localStorage
(see `frontend/src/lib/axios.ts`), not cookies.

### 1.4 Frontend env var — the guide names the wrong one
The guide's Part 3.2 says set `VITE_API_URL`. This repo's
`frontend/src/lib/axios.ts:4` reads `import.meta.env.VITE_API_BASE_URL`
(matches `frontend/.env.example`). On Netlify you must set
**`VITE_API_BASE_URL`**, not `VITE_API_URL` — the wrong name means the build
silently falls back to `http://localhost:3000` in production, and you'll spend
time chasing what looks like a CORS problem.

### 1.5 Login error messaging — ✅ implemented (network-failure branch added)
`frontend/src/pages/LoginPage.tsx` already unwrapped the axios error and
showed the server's message on a 401, but didn't distinguish "no response at
all" (server unreachable, cold start not finished, or a CORS rejection) from
a real 401 — both fell through to the same generic "Login failed. Please try
again." Now split:
```ts
} catch (err) {
  if (axios.isAxiosError(err)) {
    if (!err.response) setError('Cannot reach the server. Try again in a moment.');
    else setError((err.response.data as { error?: string })?.error ?? 'Login failed. Please try again.');
  } else {
    setError('Login failed. Please try again.');
  }
}
```
This matters more here than in general, because Render's free tier cold-starts
after 15 minutes idle (guide's Part 2.8) — the first login after idle time
needs an honest message, which is the whole reason the guide exists per its
own Part 0.4.

## Phase 2 — Database reset for the public demo (replaces guide's Part 4 SQL approach)

The guide's `db/reset.sql` (hand-written `TRUNCATE` + `INSERT` with pasted
bcrypt hashes) doesn't fit this repo and shouldn't be added: `schema.prisma`
has 7 related tables with UUID primary keys, and there is already a working,
tested seeding path — `backend/src/lib/seedDatabase.ts` (bcryptjs cost 12,
`Password123!`, referential integrity, realistic transaction history) —
reused by both `backend/prisma/seed.ts` and the existing
`POST /api/v1/test/reset` route. Writing a second, parallel SQL seeding path
would drift from the Prisma schema the first time a column changes. Reuse
`seedDatabase()` instead of the guide's SQL file.

### 2.1 Decide how the scheduled reset triggers the reset — ✅ option (a) chosen and implemented
Confirmed with you: no credentials or reset mechanism should be exposed to
end users beyond the hardcoded demo logins shown in the UI. That rules out
(b) below (a public, secret-header-gated HTTP endpoint) — going with (a).
`backend/src/routes/testReset.ts:9-12` returns 404 whenever
`NODE_ENV === 'production'` (also documented in this repo's `CLAUDE.md` as
intentional: *"DB reset: `POST /api/v1/test/reset` — disabled when
`NODE_ENV=production`"*). The in-app "Reset Database" admin button
(`frontend/src/components/modals/ResetDatabaseModal.tsx`) calls this same
endpoint, so it will be a 404 in production as-is. Two options:

- **(a) Recommended — keep the endpoint disabled in prod, run the scheduled
  reset from GitHub Actions directly against Neon:**
  ```yaml
  - name: Reset to seed data
    working-directory: backend
    env:
      DATABASE_URL: ${{ secrets.NEON_DIRECT_URL }}
    run: npx tsx prisma/seed.ts
  ```
  Same `seedDatabase()` function, no SQL to maintain, no HTTP surface to
  secure. The admin "Reset Database" button stays 404'd in production, which
  matches the behavior already documented in `CLAUDE.md`.

- **(b) Alternative — let the admin button work in production too:** replace
  the flat `NODE_ENV === 'production'` 404 in `testReset.ts` with a check
  against a shared secret header (e.g. `X-Reset-Token`), and have GitHub
  Actions `curl -X POST .../api/v1/test/reset -H "X-Reset-Token: ..."` on the
  same schedule. More moving parts (a secret to manage on both Render and
  GitHub, an authenticated public endpoint) — only do this if you specifically
  want demo users to be able to self-serve a reset from the UI in production.

### 2.2 GitHub Actions workflow — ✅ implemented
Created `.github/workflows/reset-db.yml` (schedule `0 3 */10 * *` +
`workflow_dispatch`, checkout, `npm ci`, then the reset step, then a verify
step) using `npx tsx prisma/seed.ts` instead of the guide's `psql -f
db/reset.sql` — no `db/reset.sql` file needed. **Remaining action for you:**
add the secret in GitHub repo → Settings → Secrets and variables → Actions:
name it `NEON_DIRECT_URL`, value is Neon's **direct** (non-pooled) connection
string — same reasoning as the guide's 4.2 (pooled connections can misbehave
with the `deleteMany` calls `seedDatabase()` issues). The guide's two caveats
about `*/10` cron semantics and GitHub disabling stale scheduled workflows
after 60 days both apply unchanged.

## Phase 3 — Neon
Follow the guide's Part 1 as written (1.1 sign up, 1.2 create project in
Frankfurt, 1.3 save both pooled and direct connection strings), with one
substitution for 1.4/1.5 — this repo uses Prisma migrations, not a raw
`schema.sql`:
```bash
# from repo root, after `npm install`
DATABASE_URL="<neon-direct-url>?sslmode=require" npx prisma migrate deploy --schema=backend/prisma/schema.prisma
DATABASE_URL="<neon-direct-url>?sslmode=require" npx tsx backend/prisma/seed.ts
```
Then verify per the guide's 1.6:
```bash
psql "<neon-direct-url>?sslmode=require" -c "SELECT username, role FROM users;"
```
You should see `michael.scott` (admin), `sofia.lang` / `david.mertens`
(account_manager), and four customers — these are the real seeded usernames
from `seedDatabase.ts`, not the guide's placeholder `mtsonkova`/`jdoe`.

## Phase 4 — Render (backend) — monorepo-specific settings

The guide's Part 2.4 assumes either a Dockerfile or a self-contained Node app
living in its own folder, with **Root Directory: backend**. Neither fits: there's
no Dockerfile in this repo, and setting Root Directory to `backend` would run
`npm install` scoped to that subfolder, breaking npm workspace symlink
resolution for `@banking-simulator/shared-types` (which, per Phase 0, backend
now needs a real build of). Use the repo root instead:

| Field | Value |
|---|---|
| Name | `itbank-api` |
| Region | Frankfurt (EU Central) |
| Branch | `main` |
| Root Directory | *(leave blank — repo root)* |
| Runtime | Node |
| Build Command | `npm install && npm run db:generate --workspace=backend && npm run build` |
| Start Command | `node backend/dist/index.js` |
| Instance Type | Free |

(`npm run build` is the root script added in Phase 0.1.3 — it builds
shared-types, then backend, in the right order. `db:generate` runs
`prisma generate`; note `@prisma/client`'s own `postinstall` hook already
triggers this automatically on `npm install`, but listing it explicitly in
the Build Command makes the dependency visible and keeps the build
reproducible if that implicit behavior ever changes upstream.)

Environment variables (Render dashboard → Environment):

| Key | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** string, with `?sslmode=require` |
| `JWT_SECRET` | output of `openssl rand -hex 32` |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | `http://localhost:5173,https://preeminent-frangipane-6fec55.netlify.app` |

Leave `PORT` unset — Render injects it, and `index.ts` already reads it
(Phase 1.1). Then follow the guide's 2.6–2.8 unchanged: watch the log stream,
copy the service URL, `curl` the login endpoint directly before touching the
frontend, and expect a 50–60s cold start on the very first request.

## Phase 5 — Netlify (frontend)
Follow the guide's Part 3 exactly, with the variable-name correction from
Phase 1.4:
- Key: **`VITE_API_BASE_URL`** (not `VITE_API_URL`)
- Value: your Render URL, e.g. `https://itbank-api.onrender.com` — no
  trailing slash, `https` not `http`.
- **Deploys → Trigger deploy → Clear cache and deploy site** — mandatory,
  Vite bakes env vars into the bundle at build time.
- Verify via F12 → Network on login; a CORS error there means re-check
  Phase 1.3's `CORS_ORIGINS` value matches the Netlify origin exactly.

## Phase 6 — Before sharing the link
The guide's closing checklist (guide, "Before you share the link") applies as
written, plus one repo-specific item already checked:
- **No secrets in git history** — verified: `.gitignore` already excludes
  `backend/.env` and `frontend/.env`, and `git log` shows neither file was
  ever committed. Nothing to rotate.
- **Seeded passwords** — already fine, `Password123!` per `seedDatabase.ts`,
  not `admin/admin`.
- **`robots.txt`** — ✅ implemented. Added `frontend/public/robots.txt`
  (`User-agent: *` / `Disallow: /`) and `<meta name="robots" content="noindex">`
  in `frontend/index.html`'s `<head>`. Verified both appear in
  `npm run build --workspace=frontend`'s output (`frontend/dist/robots.txt`
  and the meta tag in `frontend/dist/index.html`). No `public/` folder
  existed before this — Vite copies it verbatim into the build output, so it
  needed creating from scratch, unlike a CRA app where it may already exist.

## Suggested order of work
1. ✅ **Phase 0** (shared-types dual build fix) — done, verified.
2. ✅ **Phase 1** (CORS allowlist, login error message) — done.
3. ✅ **Phase 2 code** (GitHub Actions reset workflow, option a) — done.
4. ✅ **Phase 6's robots.txt / noindex** — done.
5. **Review the diff and commit/push to `main`** — nothing has been
   committed yet; all of the above is unstaged in the working tree.
6. **What's left — all external account setup, needs your credentials:**
   - **Phase 3** (Neon): sign up, create the `itbank` project in Frankfurt,
     run migrations + seed, verify.
   - **Phase 4** (Render): create the web service with the settings above,
     set the four env vars (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`,
     `CORS_ORIGINS`), watch it deploy, `curl`-test login.
   - GitHub: add the `NEON_DIRECT_URL` repo secret (Phase 2.2) and confirm
     the `Reset demo database` workflow via **Actions → Run workflow**.
   - **Phase 5** (Netlify): set `VITE_API_BASE_URL` to the Render URL,
     clear-cache-and-redeploy.
   - Final smoke test: open the Netlify link, log in with a demo account,
     confirm the request reaches `onrender.com` (not `localhost`), confirm
     no CORS error.
