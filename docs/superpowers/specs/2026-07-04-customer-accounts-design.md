# Customer Accounts (email + password) — Design

_Date: 2026-07-04 · Repos: `issa-beauty` (storefront) + `issa-beauty-backend` · Branch: off `feat/order-tracking`_

## Overview

Add email + password customer accounts to the storefront: a verified-email
registration flow, login, logout, and session. No Google/OAuth (later). Built
alongside the existing admin auth, reusing its bcrypt/JWT helpers but with its
own cookie and token so the two never collide.

## Goals

- Register: email → emailed 6-digit code → set password → account created + logged in.
- Login: email + password.
- Logout; a persistent session the frontend can read.
- Avatar menu reflects auth state (logged out vs logged in).

## Non-goals (YAGNI)

- No OAuth/Google sign-in (future).
- **No order↔account linking or gating** — guest/localStorage order tracking
  stays exactly as-is. (Explicit follow-up.)
- No password reset / "forgot password" flow in this spec (future).
- No profile/account-settings page beyond logout.

## Backend (`issa-beauty-backend`)

### Models (new, in `src/models.ts`)
- `User`: `{ email: string (unique, lowercased, required), passwordHash: string, emailVerified: boolean (default true — only created after verification), timestamps }`. Exported as model `"User"` (matches the existing `Order.user` ref).
- `EmailVerification`: `{ email: string (indexed, lowercased), codeHash: string, expiresAt: Date, attempts: number (default 0) }`. TTL index on `expiresAt` (`expireAfterSeconds: 0`) for auto-cleanup. One doc per email (upsert on start).

### auth.ts additions (leave admin functions untouched)
- `CUSTOMER_COOKIE = "customer_token"`.
- `signUserToken(userId: string): string` → `jwt.sign({ role: "customer", sub: userId }, JWT_SECRET, { expiresIn: "30d" })`.
- `requireUser(req, res, next)` → reads `CUSTOMER_COOKIE`, verifies, on success sets `req.userId = payload.sub` (augment Express Request type), else 401.
- Reuse existing `hashPassword` / `verifyPassword`.

### Verification helpers (new `src/customerAuth.ts`, pure + testable)
- `generateCode(): string` → 6-digit numeric (crypto, zero-padded).
- `CODE_TTL_MS = 15 * 60 * 1000`, `MAX_CODE_ATTEMPTS = 5`, `MIN_PASSWORD_LEN = 8`.
- `normalizeEmail(email): string` → trim + lowercase.
- `validateEmail(email): boolean`, `validatePassword(pw): { valid: boolean; error?: string }`.

### Router (new `src/routes/customerAuth.ts`, mounted at `/api/auth`)
Cookie options identical to admin (`httpOnly`, `sameSite:"lax"`, `secure` in prod, `maxAge: TOKEN_MAX_AGE_MS`). Limiters skipped when `NODE_ENV==="test"`.

- `POST /register/start` `{ email }` — normalize; if a `User` with that email exists → `409 { message: "This email already has an account. Please log in." }`; else upsert `EmailVerification` with a fresh `generateCode()` (store `codeHash` via `hashPassword`, `expiresAt = now + CODE_TTL_MS`, `attempts = 0`) and email the code via Resend. `strictLimiter`.
- `POST /register/verify` `{ email, code }` — load verification; if missing/expired → `400 "Code expired, request a new one"`; increment `attempts`; if `attempts > MAX_CODE_ATTEMPTS` → `429 "Too many attempts"`; if `verifyPassword(code, codeHash)` fails → `400 "Invalid code"`; else `{ success: true }` (does not consume the code).
- `POST /register/complete` `{ email, code, password }` — re-validate code (same checks); validate password (`MIN_PASSWORD_LEN`); guard against a race where the `User` now exists (`409`); create `User { email, passwordHash }`; delete the `EmailVerification`; set cookie via `signUserToken(user._id)`; return `{ success: true, data: { email } }`.
- `POST /login` `{ email, password }` — normalize; find user; on missing user or bad password → `401 "Invalid email or password"` (generic); else set cookie; return `{ data: { email } }`. `strictLimiter`.
- `POST /logout` — clear `CUSTOMER_COOKIE`; `{ success: true }`.
- `GET /me` — if valid cookie → `{ data: { email } }`; else `{ data: null }` (200, not 401, so the client can render logged-out cleanly).

### Email
Add `verificationCodeEmail(code): { subject, html }` to `email.ts`; send via existing `sendEmail`. Copy: plain, states the 6-digit code and that it expires in 15 minutes.

## Frontend (`issa-beauty` storefront)

- **`src/common/data/ApiClient.ts`**: add `withCredentials: true` to the axios instance so the auth cookie is sent.
- **`src/features/auth/data/auth.ts`**: API client — `startRegistration(email)`, `verifyCode(email, code)`, `completeRegistration(email, code, password)`, `login(email, password)`, `logout()`, `getMe()` — all returning `ApiResult`.
- **`src/features/auth/data/AuthContext.tsx`**: `AuthProvider` fetches `/api/auth/me` on mount; exposes `{ user: {email}|null, loading, login, logout, refresh }`. Wrap `<App>` alongside `CartProvider`.
- **`/login`** (`features/auth/ui/LoginPage.tsx`): email + password; on success `refresh()` + navigate home; generic error on 401.
- **`/register`** (`features/auth/ui/RegisterPage.tsx`): single component, local `step` state machine `"email" | "code" | "password"`:
  - email → `startRegistration`; on 409 show "already registered — log in" with a link to `/login`.
  - code → `verifyCode`; resend link re-calls `startRegistration`.
  - password → two fields (must match, ≥8); `completeRegistration` → logged in → navigate home.
- **`AccountMenu`**: consume `useAuth()`. Logged out → "Log in / Sign up" → `/login`. Logged in → a label with the email, "My Orders", separator, **Log out** (calls `logout()` then `refresh()`). Cart + theme items unchanged.
- Routes added in `App.tsx`: `/login`, `/register`.

## Error handling
- Backend returns specific, non-leaky messages (generic login failure; specific code errors). All wrapped in the standard `{ success, message }` envelope.
- Frontend shows inline field errors; the register step machine keeps `email`/`code` in state so later steps can resubmit them.
- `getMe` failure (network) → treat as logged out; no crash.

## Testing
- **Backend unit** (`customerAuth.test.ts`): `generateCode` format, `normalizeEmail`, `validatePassword`, `validateEmail`.
- **Backend routes** (`routes/customerAuth.test.ts`): start (new + duplicate-email 409), verify (ok / bad code / expired / attempt cap), complete (creates user + sets cookie, rejects bad code, rejects short password), login (success + generic failure), me (with/without cookie), logout.
- **Storefront**: `AuthContext` state transitions (me→user, logout→null) and the register step machine (advance on success, stay + error on failure) as pure-ish tests.

## Open decisions (made; adjustable)
- Code: 6-digit numeric, hashed, 15-min expiry, 5-attempt cap.
- Password: min 8 chars, confirmed by a second field client-side.
- Session: 30-day JWT httpOnly cookie `customer_token`.
- Duplicate email on register → 409 (mild enumeration accepted for a small store).
