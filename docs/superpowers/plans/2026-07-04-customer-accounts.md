# Customer Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Email + password customer accounts on the storefront — verified-email registration, login, logout, session — reusing the backend's bcrypt/JWT helpers with a separate cookie.

**Architecture:** New `/api/auth/*` router (own `customer_token` cookie, JWT `{role:"customer",sub:userId}`); `User` + `EmailVerification` models; a `verificationCodeEmail`. Storefront gets an `AuthContext`, `/login` + `/register` routes, and an auth-aware avatar menu.

**Tech Stack:** Express + Mongoose + Vitest (backend); React 18 + React Router + shadcn + Vitest (storefront).

## Global Constraints

- **Repos:** backend tasks in `/home/salah/Projects/issa-beauty-backend`; storefront in `/home/salah/Projects/issa-beauty`. Both already on branch `feat/customer-accounts`.
- **Do NOT touch admin auth** (`signToken`, `requireAuth`, `COOKIE_NAME`, admin router). Add customer functions alongside.
- **Cookie:** name `customer_token`; `httpOnly`, `sameSite:"lax"`, `secure` in prod, `maxAge: TOKEN_MAX_AGE_MS`. Skip rate limiters when `process.env.NODE_ENV === "test"` (match existing pattern).
- **Values (verbatim):** code = 6-digit numeric, hashed with `hashPassword`, 15-min expiry, max 5 attempts; password min length 8; email normalized = trim + lowercase; duplicate registered email → HTTP 409; login failure → generic "Invalid email or password".
- **Envelope:** all responses `{ success: boolean, message?, data? }`. Frontend calls go through `request`/`ApiResult` from `@/common/data/ApiClient`.
- **Commits:** worker subagents implement + run tests/typecheck but DO NOT commit; the orchestrator reviews and commits each task.

---

## Task BA1: Customer-auth helpers (pure)

**Repo:** backend. **Files:** Create `src/customerAuth.ts`; Test `src/customerAuth.test.ts`.

**Produces:** `CODE_TTL_MS`, `MAX_CODE_ATTEMPTS`, `MIN_PASSWORD_LEN`, `generateCode(): string`, `normalizeEmail(e): string`, `validateEmail(e): boolean`, `validatePassword(pw): { valid: boolean; error?: string }`.

- [ ] **Step 1 — failing tests** (`src/customerAuth.test.ts`):

```ts
import { generateCode, normalizeEmail, validateEmail, validatePassword, MIN_PASSWORD_LEN } from "./customerAuth.js";

describe("generateCode", () => {
  it("returns a 6-digit numeric string", () => {
    for (let i = 0; i < 50; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});
describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
});
describe("validateEmail", () => {
  it("accepts a valid address and rejects junk", () => {
    expect(validateEmail("a@b.co")).toBe(true);
    expect(validateEmail("nope")).toBe(false);
    expect(validateEmail("")).toBe(false);
  });
});
describe("validatePassword", () => {
  it("rejects short passwords", () => {
    expect(validatePassword("short").valid).toBe(false);
    expect(validatePassword("x".repeat(MIN_PASSWORD_LEN)).valid).toBe(true);
  });
});
```

- [ ] **Step 2 — run, expect FAIL:** `pnpm test -- src/customerAuth.test.ts`.
- [ ] **Step 3 — implement `src/customerAuth.ts`:**

```ts
import crypto from "crypto";

export const CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const MIN_PASSWORD_LEN = 8;

export function generateCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(pw: unknown): { valid: boolean; error?: string } {
  if (typeof pw !== "string" || pw.length < MIN_PASSWORD_LEN) {
    return { valid: false, error: `Password must be at least ${MIN_PASSWORD_LEN} characters` };
  }
  return { valid: true };
}
```

- [ ] **Step 4 — run, expect PASS.** **Step 5 — commit:** `feat(auth): customer-auth pure helpers`.

---

## Task BA2: User + EmailVerification models, auth.ts customer additions, email builder

**Repo:** backend. **Files:** Modify `src/models.ts`, `src/auth.ts`, `src/email.ts`. Test: none new (exercised via BA3 routes; typecheck only).

**Interfaces produced:**
- Models `User` (`{ email, passwordHash, emailVerified }`) and `EmailVerification` (`{ email, codeHash, expiresAt, attempts }`), added to the `export { ... }`.
- `auth.ts`: `CUSTOMER_COOKIE = "customer_token"`, `signUserToken(userId: string): string`, `requireUser(req,res,next)` setting `req.userId`.
- `email.ts`: `verificationCodeEmail(code: string): { subject: string; html: string }`.

- [ ] **Step 1 — models** (`src/models.ts`): follow the file's existing `Schema`/`model` style. Add:

```ts
// User (customer account)
export interface IUser {
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    emailVerified: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// EmailVerification (pending registration code)
export interface IEmailVerification {
  email: string;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
}
const emailVerificationSchema = new Schema<IEmailVerification>({
  email: { type: String, required: true, index: true, lowercase: true, trim: true },
  codeHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0 },
});
emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

Create the models next to the others (`const User = model<IUser>("User", userSchema);` etc. — match the existing `model(...)` call style, including any explicit collection-name argument pattern used by `AdminAuth`) and add `User, EmailVerification` to the `export { ... }` on line ~206.

- [ ] **Step 2 — auth.ts additions** (append; do not modify existing exports):

```ts
export const CUSTOMER_COOKIE = "customer_token";

export function signUserToken(userId: string): string {
  return jwt.sign({ role: "customer", sub: userId }, process.env.JWT_SECRET as string, {
    expiresIn: "30d",
  });
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[CUSTOMER_COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload || typeof payload === "string" || payload.role !== "customer") {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  (req as Request & { userId?: string }).userId = payload.sub as string;
  next();
}
```

(If TypeScript complains about `payload.role`/`payload.sub`, cast `payload as jwt.JwtPayload & { role?: string }`.)

- [ ] **Step 3 — email builder** (`src/email.ts`), following the existing builder style + `FROM`:

```ts
export function verificationCodeEmail(code: string): { subject: string; html: string } {
  return {
    subject: "Your ISSA Beauty verification code",
    html: `<p>Your verification code is <strong style="font-size:20px;letter-spacing:2px">${code}</strong>.</p><p>It expires in 15 minutes. If you didn't request this, you can ignore this email.</p>`,
  };
}
```

- [ ] **Step 4 — typecheck:** `pnpm exec tsc --noEmit` (or `pnpm build`) → no errors.
- [ ] **Step 5 — commit:** `feat(auth): User + EmailVerification models, customer token helpers, verification email`.

---

## Task BA3: `/api/auth` customer router + tests

**Repo:** backend. **Files:** Create `src/routes/customerAuth.ts`; Modify `src/app.ts` (mount); Test `src/routes/customerAuth.test.ts`.

**Consumes:** BA1 helpers, BA2 models + `signUserToken`/`CUSTOMER_COOKIE`, `hashPassword`/`verifyPassword`, `verificationCodeEmail`, `sendEmail`, `strictLimiter`.

- [ ] **Step 1 — failing route tests** (`src/routes/customerAuth.test.ts`). Mirror the app/DB setup used by `src/routes/public.orders.test.ts` (same `createApp`/supertest/mongo-memory harness). Mock email so tests don't send: `vi.mock("../email.js", ...)` keeping `verificationCodeEmail` real and `sendEmail` a no-op resolved promise. Capture the code by spying on `verificationCodeEmail`, OR (simpler) read the `EmailVerification` doc and drive `complete` by stubbing `hashPassword`/`verifyPassword`? — No: instead expose the code path by having the test call `register/start`, then look up the plaintext via a test-only approach: generate is random, so **spy on `sendEmail` args** to capture the emailed code from the rendered html. Concretely:

```ts
import { vi } from "vitest";
const sent: string[] = [];
vi.mock("../email.js", async (orig) => {
  const actual = await orig<typeof import("../email.js")>();
  return { ...actual, sendEmail: vi.fn(async ({ html }: { html: string }) => { sent.push(html); }) };
});
// helper: extract 6-digit code from the captured html
const lastCode = () => sent.at(-1)!.match(/(\d{6})/)![1];
```

Tests:
```ts
describe("POST /api/auth/register/start", () => {
  it("emails a code for a new email", async () => {
    const res = await request(app).post("/api/auth/register/start").send({ email: "New@X.com" });
    expect(res.status).toBe(200);
    expect(lastCode()).toMatch(/^\d{6}$/);
  });
  it("409s if a user already exists", async () => {
    await User.create({ email: "taken@x.com", passwordHash: "h" });
    const res = await request(app).post("/api/auth/register/start").send({ email: "taken@x.com" });
    expect(res.status).toBe(409);
  });
});
describe("register verify/complete", () => {
  it("verifies a good code and rejects a bad one", async () => {
    await request(app).post("/api/auth/register/start").send({ email: "flow@x.com" });
    const code = lastCode();
    expect((await request(app).post("/api/auth/register/verify").send({ email: "flow@x.com", code: "000000" })).status).toBe(400);
    expect((await request(app).post("/api/auth/register/verify").send({ email: "flow@x.com", code })).status).toBe(200);
  });
  it("completes registration, creates the user, and sets a cookie", async () => {
    await request(app).post("/api/auth/register/start").send({ email: "done@x.com" });
    const code = lastCode();
    const res = await request(app).post("/api/auth/register/complete").send({ email: "done@x.com", code, password: "password123" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"].join()).toMatch(/customer_token=/);
    expect(await User.findOne({ email: "done@x.com" })).not.toBeNull();
  });
  it("rejects a short password", async () => {
    await request(app).post("/api/auth/register/start").send({ email: "short@x.com" });
    const res = await request(app).post("/api/auth/register/complete").send({ email: "short@x.com", code: lastCode(), password: "x" });
    expect(res.status).toBe(400);
  });
});
describe("login / me / logout", () => {
  it("logs in a registered user and rejects bad credentials generically", async () => {
    await request(app).post("/api/auth/register/start").send({ email: "li@x.com" });
    await request(app).post("/api/auth/register/complete").send({ email: "li@x.com", code: lastCode(), password: "password123" });
    expect((await request(app).post("/api/auth/login").send({ email: "li@x.com", password: "wrong" })).status).toBe(401);
    const ok = await request(app).post("/api/auth/login").send({ email: "li@x.com", password: "password123" });
    expect(ok.status).toBe(200);
    expect(ok.headers["set-cookie"].join()).toMatch(/customer_token=/);
  });
  it("me returns null without a cookie", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });
});
```

(Import `User` from `../models.js`.)

- [ ] **Step 2 — run, expect FAIL** (404s): `pnpm test -- src/routes/customerAuth.test.ts`.
- [ ] **Step 3 — implement `src/routes/customerAuth.ts`:**

```ts
import express from "express";
import { User, EmailVerification } from "../models.js";
import { hashPassword, verifyPassword, signUserToken, CUSTOMER_COOKIE, TOKEN_MAX_AGE_MS } from "../auth.js";
import { generateCode, normalizeEmail, validateEmail, validatePassword, CODE_TTL_MS, MAX_CODE_ATTEMPTS } from "../customerAuth.js";
import { sendEmail, verificationCodeEmail } from "../email.js";
import { strictLimiter } from "../rateLimit.js";

export const customerAuthRouter = express.Router();

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: TOKEN_MAX_AGE_MS,
};
const limited: express.RequestHandler[] = process.env.NODE_ENV !== "test" ? [strictLimiter] : [];

// Load a non-expired verification and enforce the attempt cap. Returns the doc,
// or sends the appropriate error and returns null.
async function loadVerification(email: string, res: express.Response) {
  const v = await EmailVerification.findOne({ email });
  if (!v || v.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ success: false, message: "Code expired, request a new one" });
    return null;
  }
  if (v.attempts >= MAX_CODE_ATTEMPTS) {
    res.status(429).json({ success: false, message: "Too many attempts, request a new code" });
    return null;
  }
  return v;
}

customerAuthRouter.post("/register/start", ...limited, async (req, res) => {
  try {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    if (!validateEmail(email)) return res.status(400).json({ success: false, message: "Enter a valid email" });
    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: "This email already has an account. Please log in." });
    }
    const code = generateCode();
    const codeHash = await hashPassword(code);
    await EmailVerification.findOneAndUpdate(
      { email },
      { email, codeHash, expiresAt: new Date(Date.now() + CODE_TTL_MS), attempts: 0 },
      { upsert: true },
    );
    const { subject, html } = verificationCodeEmail(code);
    await sendEmail({ to: email, subject, html });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

customerAuthRouter.post("/register/verify", async (req, res) => {
  try {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const code = String(req.body?.code ?? "");
    const v = await loadVerification(email, res);
    if (!v) return;
    v.attempts += 1;
    await v.save();
    if (!(await verifyPassword(code, v.codeHash))) {
      return res.status(400).json({ success: false, message: "Invalid code" });
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

customerAuthRouter.post("/register/complete", async (req, res) => {
  try {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const code = String(req.body?.code ?? "");
    const pw = validatePassword(req.body?.password);
    if (!pw.valid) return res.status(400).json({ success: false, message: pw.error });
    const v = await loadVerification(email, res);
    if (!v) return;
    v.attempts += 1;
    await v.save();
    if (!(await verifyPassword(code, v.codeHash))) {
      return res.status(400).json({ success: false, message: "Invalid code" });
    }
    if (await User.findOne({ email })) {
      return res.status(409).json({ success: false, message: "This email already has an account. Please log in." });
    }
    const user = await User.create({ email, passwordHash: await hashPassword(req.body.password) });
    await EmailVerification.deleteOne({ email });
    res.cookie(CUSTOMER_COOKIE, signUserToken(String(user._id)), cookieOptions);
    res.status(200).json({ success: true, data: { email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

customerAuthRouter.post("/login", ...limited, async (req, res) => {
  try {
    const email = normalizeEmail(String(req.body?.email ?? ""));
    const password = String(req.body?.password ?? "");
    const user = await User.findOne({ email });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    res.cookie(CUSTOMER_COOKIE, signUserToken(String(user._id)), cookieOptions);
    res.status(200).json({ success: true, data: { email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});

customerAuthRouter.post("/logout", (_req, res) => {
  res.clearCookie(CUSTOMER_COOKIE, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.status(200).json({ success: true });
});

customerAuthRouter.get("/me", async (req, res) => {
  try {
    const token = req.cookies?.[CUSTOMER_COOKIE];
    const { verifyToken } = await import("../auth.js");
    const payload = token ? verifyToken(token) : null;
    if (!payload || typeof payload === "string" || (payload as { role?: string }).role !== "customer") {
      return res.status(200).json({ success: true, data: null });
    }
    const user = await User.findById((payload as { sub?: string }).sub);
    res.status(200).json({ success: true, data: user ? { email: user.email } : null });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});
```

(Prefer a top-level `import { verifyToken } from "../auth.js";` over the dynamic import if it reads cleaner.)

- [ ] **Step 4 — mount** in `src/app.ts`: import `customerAuthRouter` and add `app.use("/api/auth", customerAuthRouter);` after the public router.
- [ ] **Step 5 — run, expect PASS:** `pnpm test -- src/routes/customerAuth.test.ts`, then full `pnpm test`.
- [ ] **Step 6 — commit:** `feat(auth): /api/auth customer register/login/logout/me router`.

---

## Task FA1: Storefront auth client + AuthContext

**Repo:** storefront. **Files:** Modify `src/common/data/ApiClient.ts`; Create `src/features/auth/data/auth.ts`, `src/features/auth/data/AuthContext.tsx`; Modify `src/App.tsx` (wrap provider). Test: `src/features/auth/data/AuthContext.test.tsx`.

**Interfaces produced:** `useAuth(): { user: { email: string } | null; loading: boolean; login; logout; refresh }`; API fns `startRegistration`, `verifyCode`, `completeRegistration`, `login`, `logout`, `getMe`.

- [ ] **Step 1 — ApiClient**: add `withCredentials: true` to the `axios.create({ ... })` options in `src/common/data/ApiClient.ts` (so the `customer_token` cookie is sent).

- [ ] **Step 2 — `src/features/auth/data/auth.ts`:**

```ts
import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";

export type AuthUser = { email: string };

export const startRegistration = (email: string): Promise<ApiResult<null>> =>
  request({ url: "/api/auth/register/start", method: "POST", data: { email } });
export const verifyCode = (email: string, code: string): Promise<ApiResult<null>> =>
  request({ url: "/api/auth/register/verify", method: "POST", data: { email, code } });
export const completeRegistration = (email: string, code: string, password: string): Promise<ApiResult<AuthUser>> =>
  request({ url: "/api/auth/register/complete", method: "POST", data: { email, code, password } });
export const login = (email: string, password: string): Promise<ApiResult<AuthUser>> =>
  request({ url: "/api/auth/login", method: "POST", data: { email, password } });
export const logout = (): Promise<ApiResult<null>> =>
  request({ url: "/api/auth/logout", method: "POST" });
export const getMe = (): Promise<ApiResult<AuthUser | null>> =>
  request({ url: "/api/auth/me", method: "GET" });
```

- [ ] **Step 3 — `src/features/auth/data/AuthContext.tsx`:**

```tsx
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { AuthUser, getMe, login as apiLogin, logout as apiLogout } from "./auth";

type AuthValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await getMe();
    setUser(res.type === "success" ? res.data : null);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    if (res.type === "success") { setUser(res.data); return { ok: true }; }
    return { ok: false, message: res.type === "error" ? res.message : "Login failed" };
  }, []);

  const logout = useCallback(async () => { await apiLogout(); setUser(null); }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 4 — wrap App** in `src/App.tsx`: import `AuthProvider` and wrap the `RouterProvider` (inside `CartProvider` or as its sibling — put `AuthProvider` outermost).

- [ ] **Step 5 — failing test** (`AuthContext.test.tsx`): mock `./auth` (`vi.mock`) so `getMe` resolves to a user, render a tiny consumer that shows `user?.email`, and assert it appears; then a `logout` test where `getMe` returns null. Use `@testing-library/react` `render` + `waitFor`. Run `pnpm test -- AuthContext` → PASS after implementation.

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
vi.mock("./auth", () => ({
  getMe: vi.fn(async () => ({ type: "success", data: { email: "a@b.com" } })),
  login: vi.fn(), logout: vi.fn(async () => ({ type: "success", data: null })),
}));
import { AuthProvider, useAuth } from "./AuthContext";
function Show() { const { user } = useAuth(); return <span>{user?.email ?? "none"}</span>; }
it("loads the current user from getMe", async () => {
  render(<AuthProvider><Show /></AuthProvider>);
  await waitFor(() => expect(screen.getByText("a@b.com")).toBeInTheDocument());
});
```

- [ ] **Step 6 — run tests + `pnpm exec tsc -b` + `pnpm build`.** **Step 7 — commit:** `feat(auth): storefront auth client + AuthContext`.

---

## Task FA2: Login + Register pages and routes

**Repo:** storefront. **Files:** Create `src/features/auth/ui/LoginPage.tsx`, `src/features/auth/ui/RegisterPage.tsx`; Modify `src/App.tsx` (routes).

**Consumes:** `useAuth` (FA1), `startRegistration`/`verifyCode`/`completeRegistration` (FA1), shadcn `Input`/`Button`.

- [ ] **Step 1 — `LoginPage.tsx`** (mobile-first, centered card):

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { Input } from "@/common/ui/components/input";
import { useAuth } from "../data/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    const res = await login(email.trim(), password);
    setLoading(false);
    if (res.ok) navigate("/");
    else setError(res.message ?? "Invalid email or password");
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Log in</h1>
      <form onSubmit={submit} className="space-y-4">
        <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Logging in…" : "Log in"}</Button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        No account? <Link to="/register" className="font-medium text-foreground hover:underline">Sign up</Link>
      </p>
    </div>
  );
}
```

- [ ] **Step 2 — `RegisterPage.tsx`** (3-step state machine):

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { Input } from "@/common/ui/components/input";
import { useAuth } from "../data/AuthContext";
import { startRegistration, verifyCode, completeRegistration } from "../data/auth";

type Step = "email" | "code" | "password";

export default function RegisterPage() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const err = (r: { type: string; message?: string }, fallback: string) =>
    setError(r.type === "error" ? (r as { message?: string }).message ?? fallback : fallback);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const res = await startRegistration(email.trim());
    setLoading(false);
    if (res.type === "success") setStep("code");
    else err(res, "Could not start registration");
  };
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null); setLoading(true);
    const res = await verifyCode(email.trim(), code.trim());
    setLoading(false);
    if (res.type === "success") setStep("password");
    else err(res, "Invalid code");
  };
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    const res = await completeRegistration(email.trim(), code.trim(), password);
    setLoading(false);
    if (res.type === "success") { await refresh(); navigate("/"); }
    else err(res, "Could not create your account");
  };
  const resend = async () => { setError(null); await startRegistration(email.trim()); };

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Create account</h1>
      {step === "email" && (
        <form onSubmit={submitEmail} className="space-y-4">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Sending…" : "Send code"}</Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account? <Link to="/login" className="font-medium text-foreground hover:underline">Log in</Link>
          </p>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={submitCode} className="space-y-4">
          <p className="text-sm text-muted-foreground">We emailed a 6-digit code to {email}.</p>
          <Input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Checking…" : "Verify"}</Button>
          <button type="button" onClick={resend} className="w-full text-sm text-muted-foreground hover:underline">Resend code</button>
        </form>
      )}
      {step === "password" && (
        <form onSubmit={submitPassword} className="space-y-4">
          <Input type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Input type="password" placeholder="Confirm password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating…" : "Create account"}</Button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 3 — routes** in `src/App.tsx`: import both pages; add `{ path: "login", element: <LoginPage /> }` and `{ path: "register", element: <RegisterPage /> }` to the children array.

- [ ] **Step 4 — `pnpm exec tsc -b && pnpm build`** → succeeds. **Step 5 — commit:** `feat(auth): login + multi-step register pages and routes`.

---

## Task FA3: Auth-aware AccountMenu

**Repo:** storefront. **Files:** Modify `src/layout/ui/AccountMenu.tsx`.

**Consumes:** `useAuth` (FA1).

- [ ] **Step 1 — update `AccountMenu`**: import `useAuth` and `useNavigate`. Replace the placeholder "Log in / Sign up" toast item with auth-aware rendering, keeping the existing Cart, My Orders, and theme items:
  - `const { user, logout } = useAuth();`
  - Logged out: keep a single item `Log in / Sign up` that does `<Link to="/login">` (asChild), with `LogIn` icon.
  - Logged in: change the `DropdownMenuLabel` from `Guest` to `user.email`; add a `Log out` item (`LogOut` icon) that does `onSelect={async () => { await logout(); }}`.
  - Remove the `toast` import if it's now unused.

```tsx
// inside the component:
const { user, logout } = useAuth();
// label:
<DropdownMenuLabel className="truncate">{user ? user.email : "Guest"}</DropdownMenuLabel>
// ...cart, My Orders, theme unchanged...
<DropdownMenuSeparator />
{user ? (
  <DropdownMenuItem onSelect={() => { logout(); }}>
    <LogOut className="mr-2 h-4 w-4" />
    Log out
  </DropdownMenuItem>
) : (
  <DropdownMenuItem asChild>
    <Link to="/login">
      <LogIn className="mr-2 h-4 w-4" />
      Log in / Sign up
    </Link>
  </DropdownMenuItem>
)}
```

(Import `LogOut` from lucide-react; keep `LogIn`. Import `Link` from react-router-dom.)

- [ ] **Step 2 — `pnpm exec tsc -b && pnpm build && pnpm test`** → all green. **Step 3 — commit:** `feat(auth): auth-aware account menu (email + log out)`.

---

## Task FA4: End-to-end verification (manual)

- [ ] Start backend (`PORT=5002 pnpm dev`) + storefront (`pnpm dev`). Register a new email → check the code arrives (or read it from backend logs / the sent email) → set password → confirm you land logged in and the avatar menu shows your email + Log out. Log out, then log back in. Confirm `/me` persists across reload.

---

## Notes for the executor
- Order: BA1 → BA2 → BA3 (backend); FA1 → FA2 → FA3 (storefront). Backend and storefront tracks are independent and may run in parallel (separate repos). Worker subagents do NOT commit; the orchestrator commits per task after review.
- Do not modify admin auth. Reuse `hashPassword`/`verifyPassword`/`verifyToken`/`TOKEN_MAX_AGE_MS`.
