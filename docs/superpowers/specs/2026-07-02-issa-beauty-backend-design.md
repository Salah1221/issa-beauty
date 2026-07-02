# Issa Beauty — Unified Backend (`issa-beauty-backend`) Design

**Date:** 2026-07-02
**Status:** Draft for review
**Author:** Salah (with Claude)

## 1. Goal

Eliminate the duplicated, drift-prone backend code currently copied across the
storefront repo (`issa-beauty`) and the dashboard repo (`issa-beauty-dashboard`)
by extracting a **single TypeScript backend** that both frontends consume. The
two frontends stay in their own repos and are repointed at the new API. No new
customer/admin features are added beyond a few proportionate security hardenings.

Today the same Mongoose models, DB connection, email logic, and public GET routes
exist in two places and can silently diverge (they already differ slightly). One
backend makes that whole class of bug impossible by construction.

## 2. Locked decisions

| Decision | Choice |
| --- | --- |
| Scope | **Backend-only.** New repo holds the API only; both frontends stay in their repos, repointed. |
| Language | **TypeScript** (both current backends are JS). |
| Repo name | `issa-beauty-backend`. |
| Structure | Single-package TS project (no workspace — there is only one app). |
| Serving model | **Dedicated API subdomain** `api.issabeauty.org`. Frontends keep serving their own static bundles; only their API base URL (and the dashboard's route paths) change. |
| Cross-origin | CORS allowlist + credentials. Cookie stays **`SameSite=Lax`** (api/dashboard are same *site*). |
| Roadmap features | Out of scope (inventory, order tracking, analytics, multi-user admin) — separate specs later. |

## 3. Repo structure

```
issa-beauty-backend/
├── src/
│   ├── index.ts          # bootstrap: connect DB → seed admin → listen
│   ├── app.ts            # express app: middleware, mount routers, error handler
│   ├── config.ts         # parse + validate env once (fail fast on missing vars)
│   ├── db.ts             # mongoose connection
│   ├── models.ts         # all schemas + TS interfaces (the superset — see §7)
│   ├── orders.ts         # order validation / numbering / totals (from storefront)
│   ├── email.ts          # customer-confirm + store-alert + status-update templates
│   ├── auth.ts           # jwt + bcrypt + requireAuth middleware
│   ├── bootstrapAuth.ts  # seed admin password on first boot (skips if AdminAuth exists)
│   ├── imagekit.ts       # imagekit client + upload/delete helpers
│   └── routes/
│       ├── public.ts     # store API (no auth)
│       └── admin.ts      # admin API (requireAuth; login excepted)
├── tests/                # *.test.ts, ported from BOTH repos (vitest + supertest)
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── package.json
└── .github/workflows/deploy.yml
```

- Build: `tsc` → `dist/`; production runs `node dist/index.js` (no runtime TS dep).
  `tsx` used for local dev only.
- `tsconfig.json`: `strict: true`, `module: NodeNext`, `moduleResolution: NodeNext`,
  `target: ES2022`, `outDir: dist`, `rootDir: src`, `esModuleInterop: true`.

## 4. API surface

The public and admin surfaces currently **collide** (both repos define
`GET /api/products` etc. with different handlers). Resolution: public routes keep
their existing paths (so the storefront client needs no path changes); admin
routes move under `/api/admin/*`.

```
PUBLIC  /api/*                       (no auth — storefront; paths UNCHANGED)
  GET  /api/products                 (shopper: filtered/paginated + price facet)
  GET  /api/products-price-range
  GET  /api/products-by-category
  GET  /api/products/:id
  GET  /api/categories
  GET  /api/banner-images
  POST /api/orders                   (create order + send customer/store emails)

ADMIN   /api/admin/*                 (requireAuth on all except login — dashboard)
  POST   /api/admin/auth/login
  GET    /api/admin/auth/check
  POST   /api/admin/auth/logout
  PUT    /api/admin/auth/password
  GET    /api/admin/products                     (management view)
  POST   /api/admin/products                     (ImageKit upload)
  PUT    /api/admin/products/:id                 (ImageKit upload)
  DELETE /api/admin/products/:id
  GET    /api/admin/categories
  POST   /api/admin/categories
  PUT    /api/admin/categories/:id
  DELETE /api/admin/categories/:id
  GET    /api/admin/banner-images
  POST   /api/admin/banner-images                (ImageKit upload)
  DELETE /api/admin/banner-images/:id
  GET    /api/admin/orders
  GET    /api/admin/orders/pending-count
  PATCH  /api/admin/orders/:id/status            (sends status-update email)
```

**Dropped:** storefront's `POST /api/upload` (multer local disk) and the local
`/uploads` static mount — verified unused by the storefront client; uploads happen
only in the dashboard via ImageKit. The new backend serves **JSON only** — no
static file serving, no SPA catch-all (those stay with the frontends).

## 5. Serving & networking

- Backend runs as its own PM2 process on a port (see env), reachable at
  `https://api.issabeauty.org`.
- Storefront (`https://issabeauty.org`) and dashboard (`https://dashboard.issabeauty.org`)
  keep serving their own static bundles exactly as today; only their client API
  base URL changes (dashboard also changes route paths).

### CORS (required — cross-origin)

Backend uses the `cors` middleware with a **credentialed allowlist** that echoes
the exact request origin (wildcard is invalid with credentials):

- Allowed origins: `https://issabeauty.org`, `https://www.issabeauty.org`,
  `https://dashboard.issabeauty.org`, and `https://www.dashboard.issabeauty.org`,
  sourced from env (`STOREFRONT_ORIGIN` and `DASHBOARD_ORIGIN` each accept both
  their apex and `www` forms as comma-separated lists).
- `credentials: true`; allow methods `GET,POST,PUT,PATCH,DELETE,OPTIONS`; allow
  header `Content-Type`. Preflight (`OPTIONS`) must be handled for `POST /api/orders`
  (JSON) and the dashboard's multipart uploads.

### Cookie (verified: `SameSite=Lax` is sufficient)

`SameSite` keys off the registrable domain (eTLD+1). `.org` is a public suffix, so
the site is `issabeauty.org`; `api.` and `dashboard.` subdomains are **same-site**
(cross-origin). `SameSite=Lax` cookies are sent on same-site `fetch`/XHR, so the
dashboard's existing cookie config is kept:

- `httpOnly: true`, `sameSite: "lax"`, `secure: true` (production), host-only
  (no `Domain` attribute — the cookie is set by and sent to `api.issabeauty.org`
  only; the dashboard page never reads it).
- `None` is **not** used (it would be less secure and isn't needed). Lax keeps
  CSRF protection against genuinely cross-site origins; admin mutations are
  POST/PUT/PATCH/DELETE (not top-level GET navigations), so CSRF exposure is low.

### TLS / DNS — resolved

`api.issabeauty.org` DNS record is already added, and a **wildcard certificate**
for the domain already covers it. No further TLS/DNS work needed; whatever
terminates TLS / routes the existing domains will route `api.` to the backend port.

## 6. Security hardening (in scope)

| Concern | Measure |
| --- | --- |
| Forged prices/totals | Already safe — `buildOrderDoc` (orders.js) computes `unitPrice`/`discount`/`lineTotal`/`subtotal`/`total` from the DB; the client sends only `productId` + `quantity`. Preserve this exactly. |
| Spam orders | `express-rate-limit` — **strict** limiter on `POST /api/orders`. |
| Scrape / GET flooding | `express-rate-limit` — **loose** limiter on public GET routes. |
| Brute-force admin login | `express-rate-limit` — **strict** limiter on `POST /api/admin/auth/login`. |
| Large-payload DoS | `express.json({ limit: "10kb" })` body cap. |
| Missing security headers | `helmet()` (one line). |
| Data leakage | Public responses expose catalog fields only; **orders are never publicly readable** — no `GET /api/orders*` on the public router. A future order-tracking feature MUST use an unguessable token, not `GET /api/orders/:id`. |
| Bots/captcha | Explicitly **not now** (YAGNI); revisit only if real spam appears. |

Two dashboard code smells fixed while porting:
- Dead `changeOrigin:` label statement (dashboard app.js ~line 169).
- Unawaited `products.map(updateProduct)` (dashboard app.js ~line 256) → `await Promise.all(...)`.

## 7. Data model reconciliation

The dashboard's models are effectively a **superset** of the storefront's
(verified by diff). `src/models.ts` = the dashboard schemas, ported to TS with an
interface per document:

- `Product` — includes `imageFileId` (ImageKit cleanup) beyond the storefront's fields.
- `Category`, `BannerImg`, `Order`, `OrderItem` — identical shapes; keep the
  `ORDER_STATUSES` exported constant.
- `AdminAuth` (`{ passwordHash }`) — dashboard-only; carried over.
- Cosmetic naming differences reconciled.

No data migration required — the backend connects to the **same MongoDB** both
apps already share.

## 8. Code consolidation map

Neither existing backend is a pure superset; cherry-pick by responsibility:

| New file | Source |
| --- | --- |
| `models.ts` | dashboard `models.js` (superset) → TS |
| `db.ts` | either (identical) → TS |
| `orders.ts` | storefront `orders.js` (order creation logic — dashboard has none) → TS |
| `email.ts` | storefront `email.js` (customer-confirm + store-alert) **+** dashboard `email.js` (status-update) merged → TS |
| `auth.ts`, `bootstrapAuth.ts` | dashboard (storefront has no auth) → TS |
| `imagekit.ts` | dashboard upload logic extracted → TS |
| `routes/public.ts` | storefront public GETs + `POST /api/orders` → TS |
| `routes/admin.ts` | dashboard admin routes, remounted under `/api/admin` → TS |

## 9. Testing strategy (TDD)

- Port both server suites to `*.test.ts` (vitest + supertest + `mongodb-memory-server`,
  all already in use).
- The admin-path move (`/api/*` → `/api/admin/*`) is done **red → green**: update
  the affected test paths first, watch them fail, then wire the routes to pass —
  proving the reshuffle broke nothing.
- New tests: CORS preflight behavior; rate-limit returns 429 past threshold;
  public router rejects any attempt to read orders.
- Frontend test coverage is unchanged (still none) — out of scope.

## 10. Deployment & CI (kept seamless)

New `.github/workflows/deploy.yml` in `issa-beauty-backend`, modeled on the existing
storefront workflow so ongoing deploys are **push-to-`main` and nothing else**:

1. Checkout, setup Node 22 + pnpm 10.
2. `pnpm install`, `pnpm run build` (`tsc` → `dist/`).
3. Write `.env` from GitHub secrets (same pattern as the current storefront workflow).
4. `rsync` `dist/`, `package.json`, `pnpm-lock.yaml`, `.env` → `/var/www/issa-beauty-backend/`
   (exclude `.git`, `node_modules`, `src`).
5. SSH: `pnpm install --prod`; `pm2 restart issa-beauty-backend --update-env ||
   NODE_ENV=production pm2 start dist/index.js --name issa-beauty-backend`.

Ongoing server work after setup: **none** (CI builds, ships `.env`, reloads PM2).

## 11. Environment variables — what to set (and where)

### New backend (`issa-beauty-backend`) — GitHub secrets → `.env`

| Var | Value / source |
| --- | --- |
| `PORT` | `5002`. The existing storefront/dashboard servers run on `5000` and `5001`, so `5002` is free and lets the backend run alongside them during rollout with no clash. |
| `MONGODB_URI` | Same connection string both apps use today (shared DB). |
| `JWT_SECRET` | Copy from the dashboard's current env (so existing sessions/passwords keep working). |
| `INITIAL_DASHBOARD_PASSWORD` | Only used if `AdminAuth` doesn't exist yet. Since it already exists in the shared DB, seeding is skipped and the current admin password keeps working — set it anyway as a fallback. |
| `IMAGEKIT_PUBLIC_KEY` | From dashboard env. |
| `IMAGEKIT_PRIVATE_KEY` | From dashboard env. |
| `IMAGEKIT_URL_ENDPOINT` | From dashboard env. |
| `RESEND` | From either env (same key). |
| `STORE_ORDER_EMAIL` | From storefront env. |
| `STOREFRONT_ORIGIN` | `https://issabeauty.org,https://www.issabeauty.org` — both storefront origins, CORS allowlist. |
| `DASHBOARD_ORIGIN` | `https://dashboard.issabeauty.org,https://www.dashboard.issabeauty.org` — both dashboard origins, CORS allowlist. |
| `NODE_ENV` | `production` (drives `secure` cookie). |

### Storefront repo (`issa-beauty`) — client build env

| Var | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://api.issabeauty.org` — new; wired into `ApiClient.ts`. |

After its server is retired: the storefront **server** env (`PORT`, `MONGODB_URI`,
`RESEND`, `STORE_ORDER_EMAIL`) is no longer needed.

### Dashboard repo (`issa-beauty-dashboard`) — client build env

| Var | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://api.issabeauty.org` — new; base for all admin calls. |

After its server is retired: the dashboard **server** env (`PORT`, `MONGODB_URI`,
`JWT_SECRET`, `INITIAL_DASHBOARD_PASSWORD`, `IMAGEKIT_*`, `RESEND`) is no longer
needed.

> When executing the plan I'll restate the exact vars to add/copy/remove at each
> step so nothing is missed.

## 12. Phased, reversible rollout

1. **Stand up the backend.** Build `issa-beauty-backend`, all tests green. Deploy
   as a new PM2 process on port `5002` (the old servers occupy `5000`/`5001`, so
   there's no clash), reachable at `api.issabeauty.org` (DNS + wildcard TLS already
   in place). Verify in isolation (curl public + admin endpoints). Nothing else
   touched yet.
2. **Cut over the dashboard.** Ship dashboard client with `VITE_API_BASE_URL` +
   `/api/admin/*` paths + interceptor fix. Verify login, CRUD, uploads, order
   status. Then strip the dashboard's server (API/DB code) to static-only.
3. **Cut over the storefront.** Ship storefront client with `VITE_API_BASE_URL`
   (paths unchanged). Verify browse, cart, checkout, emails. Then strip the
   storefront's server to static-only.

Each phase is independently verifiable; rollback = point the client base URL back
at the old same-origin `/api`. Retiring each old server is the last step per site
and can be deferred.

## 13. One-time infra prerequisites

- DNS for `api.issabeauty.org` — **done.**
- TLS for `api.issabeauty.org` — **done** (existing wildcard certificate covers it).
- GitHub secrets for the new repo (§11) — your action.
- First-time `pm2 start` on the VPS (subsequent deploys auto-restart) — your action.

## 14. Out of scope (future specs)

Inventory/stock quantities, customer order tracking page, analytics, multi-user
admin accounts, payment beyond COD, frontend test coverage.

## 15. Open items — all resolved

- Storefront origins: **both** `issabeauty.org` and `www.issabeauty.org`.
- TLS for the api subdomain: **done** (wildcard certificate); DNS also done.
- Backend `PORT`: **5002** (old servers are on `5000`/`5001`; no clash).
