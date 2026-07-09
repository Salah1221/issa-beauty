# Saved Billing Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a logged-in customer's checkout details on their account and pre-fill the checkout form from them, so returning customers don't re-type their info.

**Architecture:** The backend stores an optional `profile` subdocument on the `User`, auto-refreshed from every order a logged-in user places (best-effort, never fails the order), and exposes it via the existing `GET /api/auth/me`. The storefront extends its `AuthUser` type with the profile and seeds the checkout form from it via a pure, unit-tested helper.

**Tech Stack:** Backend — Node/Express, Mongoose, Vitest + supertest + mongodb-memory-server. Frontend — React 18, Vite, TypeScript, Vitest + Testing Library.

## Global Constraints

- Backend model file: `issa-beauty-backend/src/models.ts`; routes under `issa-beauty-backend/src/routes/`.
- API responses use the envelope `{ success, data, message? }`; the storefront's `request()` unwraps `data`.
- Customer identity on requests comes from `optionalUser(req)` / `requireUser` in `issa-beauty-backend/src/auth.ts` (cookie `customer_token`).
- Stored phone format is the full string including dialing code, e.g. `"+961 12345678"` (same as what lands on the order today).
- Email is the account identity and is NOT part of the stored profile.
- Storefront path alias `@/` → `issa-beauty/src/`.
- Backend tests run with `pnpm test` (vitest run) from `issa-beauty-backend/`; storefront tests with `pnpm test` from `issa-beauty/`.
- Follow existing patterns: no new dependencies.

---

### Task 1: `profileFromOrder` helper + `User.profile` model field (backend)

**Files:**
- Create: `issa-beauty-backend/src/userProfile.ts`
- Create: `issa-beauty-backend/src/userProfile.test.ts`
- Modify: `issa-beauty-backend/src/models.ts` (IUser interface ~199-213 and userSchema)

**Interfaces:**
- Produces: `type SavedProfile = { fullName: string; phone: string; address: string; city: string; area?: string; notes?: string }`
- Produces: `profileFromOrder(order: Pick<IOrder, "customer" | "shipping">): SavedProfile`
- Produces: `IUser.profile?: { fullName?: string; phone?: string; address?: string; city?: string; area?: string; notes?: string }`

- [ ] **Step 1: Write the failing test**

Create `issa-beauty-backend/src/userProfile.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { profileFromOrder } from "./userProfile.js";

describe("profileFromOrder", () => {
  it("maps customer + shipping fields into a saved profile", () => {
    const p = profileFromOrder({
      customer: { fullName: "Jane", phone: "+961 12345678", email: "j@x.com" },
      shipping: { address: "1 St", city: "Beirut", area: "Hamra", notes: "call first" },
    } as never);
    expect(p).toEqual({
      fullName: "Jane",
      phone: "+961 12345678",
      address: "1 St",
      city: "Beirut",
      area: "Hamra",
      notes: "call first",
    });
  });

  it("omits optional area/notes when absent", () => {
    const p = profileFromOrder({
      customer: { fullName: "Jane", phone: "+961 12345678" },
      shipping: { address: "1 St", city: "Beirut" },
    } as never);
    expect(p).toEqual({
      fullName: "Jane",
      phone: "+961 12345678",
      address: "1 St",
      city: "Beirut",
      area: undefined,
      notes: undefined,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd issa-beauty-backend && pnpm test src/userProfile.test.ts`
Expected: FAIL — cannot resolve `./userProfile.js` / `profileFromOrder` is not defined.

- [ ] **Step 3: Create the helper**

Create `issa-beauty-backend/src/userProfile.ts`:

```ts
import type { IOrder } from "./models.js";

export type SavedProfile = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  area?: string;
  notes?: string;
};

// Distil the reusable checkout details from an order so they can be stored as
// the user's default profile. Email is intentionally excluded — it is the
// account identity, not a shipping detail.
export function profileFromOrder(
  order: Pick<IOrder, "customer" | "shipping">,
): SavedProfile {
  return {
    fullName: order.customer.fullName,
    phone: order.customer.phone,
    address: order.shipping.address,
    city: order.shipping.city,
    area: order.shipping.area,
    notes: order.shipping.notes,
  };
}
```

- [ ] **Step 4: Add the `profile` field to the User model**

In `issa-beauty-backend/src/models.ts`, extend the `IUser` interface:

```ts
export interface IUser {
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  profile?: {
    fullName?: string;
    phone?: string;
    address?: string;
    city?: string;
    area?: string;
    notes?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
}
```

Directly above `const userSchema = ...`, add the subdocument schema:

```ts
const userProfileSchema = new Schema(
  {
    fullName: { type: String, required: false },
    phone: { type: String, required: false },
    address: { type: String, required: false },
    city: { type: String, required: false },
    area: { type: String, required: false },
    notes: { type: String, required: false },
  },
  { _id: false },
);
```

Then add `profile` to the `userSchema` fields (alongside `emailVerified`):

```ts
    emailVerified: { type: Boolean, default: true },
    profile: { type: userProfileSchema, required: false, default: undefined },
```

(`default: undefined` keeps `profile` absent until the user's first order.)

- [ ] **Step 5: Run tests + typecheck to verify they pass**

Run: `cd issa-beauty-backend && pnpm test src/userProfile.test.ts && pnpm exec tsc -b`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
cd issa-beauty-backend
git add src/userProfile.ts src/userProfile.test.ts src/models.ts
git commit -m "feat: add User.profile field and profileFromOrder helper"
```

---

### Task 2: Auto-save the profile on order placement (backend)

**Files:**
- Modify: `issa-beauty-backend/src/routes/public.ts` (imports ~1-8; `POST /api/orders` handler ~189-248)
- Modify: `issa-beauty-backend/src/routes/public.orders.test.ts` (imports/model refs ~23,33; `beforeEach` ~40-45; add a `describe` block)

**Interfaces:**
- Consumes: `profileFromOrder` and `SavedProfile` from Task 1; `User` from `../models.js`; existing `optionalUser` from `../auth.js`.

- [ ] **Step 1: Write the failing tests**

In `issa-beauty-backend/src/routes/public.orders.test.ts`, add `User` to the imported models. Change line 23:

```ts
let app: Express, mongo: MongoMemoryServer, Product: any, Order: any, User: any;
```

and line 33:

```ts
  ({ Product, Order, User } = await import("../models.js"));
```

Add `await User.deleteMany({});` inside the existing `beforeEach` (after `await Order.deleteMany({});`).

Then add this block after the `describe("GET /api/orders/mine", ...)` block:

```ts
describe("logged-in order saves the user profile", () => {
  const cookieFor = (uid: string) => `customer_token=${signUserToken(uid)}`;

  it("writes the order's contact + shipping onto the user's profile", async () => {
    const u = await User.create({ email: "save@x.com", passwordHash: "h" });
    const p = await seed();
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", cookieFor(String(u._id)))
      .send({
        items: [{ productId: String(p._id), quantity: 1 }],
        customer: { fullName: "Jane", phone: "+961 12345678", email: "j@x.com" },
        shipping: { address: "1 St", city: "Beirut", area: "Hamra", notes: "call first" },
      });
    expect(res.status).toBe(201);
    const fresh = await User.findById(u._id);
    expect(fresh.profile).toMatchObject({
      fullName: "Jane",
      phone: "+961 12345678",
      address: "1 St",
      city: "Beirut",
      area: "Hamra",
      notes: "call first",
    });
  });

  it("overwrites the profile on a later order", async () => {
    const u = await User.create({
      email: "again@x.com",
      passwordHash: "h",
      profile: { fullName: "Old", phone: "+961 00000000", address: "Old St", city: "Old City" },
    });
    const p = await seed();
    await request(app)
      .post("/api/orders")
      .set("Cookie", cookieFor(String(u._id)))
      .send({
        items: [{ productId: String(p._id), quantity: 1 }],
        customer: { fullName: "New", phone: "+961 99999999" },
        shipping: { address: "New St", city: "New City" },
      });
    const fresh = await User.findById(u._id);
    expect(fresh.profile.fullName).toBe("New");
    expect(fresh.profile.address).toBe("New St");
  });

  it("does not create a profile for a guest order", async () => {
    const u = await User.create({ email: "guest-bystander@x.com", passwordHash: "h" });
    const p = await seed();
    await request(app)
      .post("/api/orders")
      .send({
        items: [{ productId: String(p._id), quantity: 1 }],
        customer: { fullName: "Jane", phone: "111" },
        shipping: { address: "1 St", city: "Beirut" },
      });
    const fresh = await User.findById(u._id);
    expect(fresh.profile).toBeUndefined();
  });

  it("still returns 201 if saving the profile throws", async () => {
    const u = await User.create({ email: "err@x.com", passwordHash: "h" });
    const p = await seed();
    const spy = vi.spyOn(User, "updateOne").mockRejectedValueOnce(new Error("boom"));
    const res = await request(app)
      .post("/api/orders")
      .set("Cookie", cookieFor(String(u._id)))
      .send({
        items: [{ productId: String(p._id), quantity: 1 }],
        customer: { fullName: "Jane", phone: "+961 12345678" },
        shipping: { address: "1 St", city: "Beirut" },
      });
    expect(res.status).toBe(201);
    spy.mockRestore();
  });
});
```

(`signUserToken` and `vi` are already imported in this file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd issa-beauty-backend && pnpm test src/routes/public.orders.test.ts`
Expected: FAIL — the profile is never written (`fresh.profile` is undefined in the first two tests).

- [ ] **Step 3: Wire the profile save into the order route**

In `issa-beauty-backend/src/routes/public.ts`, update the model + helper imports at the top:

```ts
import { Product, Category, BannerImg, Order, User } from "../models.js";
import { validateOrderInput, buildOrderDoc, generateOrderNumber, projectTrackedOrder } from "../orders.js";
import { profileFromOrder } from "../userProfile.js";
```

In the `POST /api/orders` handler, the code already computes `const userId = optionalUser(req);` before creating the order. After the `saved` order exists and before the email sends (i.e. right after the `for` retry loop that assigns `saved`), add:

```ts
    // Persist the logged-in customer's details as their default profile for
    // next time. Best-effort — a failure here must never fail the order.
    if (userId) {
      try {
        await User.updateOne(
          { _id: userId },
          { $set: { profile: profileFromOrder(saved!) } },
        );
      } catch (e) {
        console.error("saving user profile failed", e);
      }
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd issa-beauty-backend && pnpm test src/routes/public.orders.test.ts && pnpm exec tsc -b`
Expected: PASS (all four new tests + existing ones); no type errors.

- [ ] **Step 5: Commit**

```bash
cd issa-beauty-backend
git add src/routes/public.ts src/routes/public.orders.test.ts
git commit -m "feat: save logged-in customer profile on order placement"
```

---

### Task 3: Return the profile from `GET /api/auth/me` (backend)

**Files:**
- Modify: `issa-beauty-backend/src/routes/customerAuth.ts` (`/me` handler ~119-132)
- Modify: `issa-beauty-backend/src/routes/customerAuth.test.ts` (`login / me / logout` describe block ~71-85)

**Interfaces:**
- Produces: `/api/auth/me` returns `data: { email, profile? } | null`.

- [ ] **Step 1: Write the failing test**

In `issa-beauty-backend/src/routes/customerAuth.test.ts`, add this test inside the existing `describe("login / me / logout", ...)` block (after the "me returns null without a cookie" test):

```ts
  it("me returns the saved profile when present", async () => {
    await request(app).post("/api/auth/register/start").send({ email: "pf@x.com" });
    await request(app)
      .post("/api/auth/register/complete")
      .send({ email: "pf@x.com", code: lastCode(), password: "password123" });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "pf@x.com", password: "password123" });
    const cookie = login.headers["set-cookie"];
    await User.updateOne(
      { email: "pf@x.com" },
      { $set: { profile: { fullName: "Jane", phone: "+961 12345678", city: "Beirut" } } },
    );
    const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(res.body.data.email).toBe("pf@x.com");
    expect(res.body.data.profile).toMatchObject({ fullName: "Jane", city: "Beirut" });
  });
```

(`User` and the `lastCode()` helper are already available in this file.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd issa-beauty-backend && pnpm test src/routes/customerAuth.test.ts`
Expected: FAIL — `res.body.data.profile` is `undefined` (the `/me` payload only returns `email`).

- [ ] **Step 3: Include the profile in the `/me` response**

In `issa-beauty-backend/src/routes/customerAuth.ts`, change the `/me` success response line:

```ts
    res.status(200).json({
      success: true,
      data: user ? { email: user.email, profile: user.profile } : null,
    });
```

(When `profile` is `undefined`, JSON serialization omits it — the logged-out `data: null` case is unchanged.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd issa-beauty-backend && pnpm test src/routes/customerAuth.test.ts && pnpm exec tsc -b`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
cd issa-beauty-backend
git add src/routes/customerAuth.ts src/routes/customerAuth.test.ts
git commit -m "feat: include saved profile in /api/auth/me response"
```

---

### Task 4: `AuthUser.profile` type + `profileForm` helper (storefront)

**Files:**
- Modify: `issa-beauty/src/features/auth/data/auth.ts` (`AuthUser` type ~4)
- Create: `issa-beauty/src/features/checkout/data/profileForm.ts`
- Create: `issa-beauty/src/features/checkout/data/profileForm.test.ts`

**Interfaces:**
- Produces: `type UserProfile = { fullName?: string; phone?: string; address?: string; city?: string; area?: string; notes?: string }`
- Produces: `type AuthUser = { email: string; profile?: UserProfile }`
- Produces: `COUNTRY_CODES: readonly { code: string; label: string }[]`
- Produces: `type CheckoutFormState = { fullName: string; phone: string; email: string; address: string; city: string; area: string; notes: string }`
- Produces: `splitPhone(stored: string | undefined, codes?): { countryCode: string; phone: string }`
- Produces: `profileToForm(profile: UserProfile | undefined, email: string): { form: CheckoutFormState; countryCode: string }`

- [ ] **Step 1: Extend the `AuthUser` type**

In `issa-beauty/src/features/auth/data/auth.ts`, replace the `AuthUser` type (line 4):

```ts
export type UserProfile = {
  fullName?: string;
  phone?: string;
  address?: string;
  city?: string;
  area?: string;
  notes?: string;
};
export type AuthUser = { email: string; profile?: UserProfile };
```

- [ ] **Step 2: Write the failing test**

Create `issa-beauty/src/features/checkout/data/profileForm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { splitPhone, profileToForm } from "./profileForm";

describe("splitPhone", () => {
  it("splits a known dialing code from the number", () => {
    expect(splitPhone("+961 12345678")).toEqual({ countryCode: "+961", phone: "12345678" });
  });
  it("defaults to +961 with an empty number when nothing is stored", () => {
    expect(splitPhone(undefined)).toEqual({ countryCode: "+961", phone: "" });
  });
  it("keeps the whole string as the number when no code matches", () => {
    expect(splitPhone("03123456")).toEqual({ countryCode: "+961", phone: "03123456" });
  });
});

describe("profileToForm", () => {
  it("builds form state from a profile plus the account email", () => {
    const { form, countryCode } = profileToForm(
      { fullName: "Jane", phone: "+961 12345678", address: "1 St", city: "Beirut", area: "Hamra", notes: "call" },
      "jane@x.com",
    );
    expect(countryCode).toBe("+961");
    expect(form).toEqual({
      fullName: "Jane",
      phone: "12345678",
      email: "jane@x.com",
      address: "1 St",
      city: "Beirut",
      area: "Hamra",
      notes: "call",
    });
  });

  it("returns empty fields (but keeps the email) when there is no profile", () => {
    const { form, countryCode } = profileToForm(undefined, "jane@x.com");
    expect(countryCode).toBe("+961");
    expect(form).toEqual({
      fullName: "",
      phone: "",
      email: "jane@x.com",
      address: "",
      city: "",
      area: "",
      notes: "",
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd issa-beauty && pnpm test src/features/checkout/data/profileForm.test.ts`
Expected: FAIL — cannot resolve `./profileForm`.

- [ ] **Step 4: Create the helper**

Create `issa-beauty/src/features/checkout/data/profileForm.ts`:

```ts
import type { UserProfile } from "@/features/auth/data/auth";

// Supported dialing codes. Lebanon only for now; add entries here to extend.
// Lives here (not in CheckoutPage) so both the form and splitPhone share one list.
export const COUNTRY_CODES = [{ code: "+961", label: "🇱🇧 +961" }] as const;

export type CheckoutFormState = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  area: string;
  notes: string;
};

// Split a stored full phone ("+961 12345678") into a known dialing code and the
// national remainder. Falls back to the default code when nothing matches so the
// select always has a valid value.
export function splitPhone(
  stored: string | undefined,
  codes: readonly { code: string }[] = COUNTRY_CODES,
): { countryCode: string; phone: string } {
  const fallback = codes[0].code;
  const trimmed = (stored ?? "").trim();
  if (!trimmed) return { countryCode: fallback, phone: "" };
  const match = codes.find((c) => trimmed.startsWith(c.code));
  if (!match) return { countryCode: fallback, phone: trimmed };
  return { countryCode: match.code, phone: trimmed.slice(match.code.length).trim() };
}

// Build the checkout form's initial state from a saved profile plus the account
// email (email is not part of the profile — it is the account identity).
export function profileToForm(
  profile: UserProfile | undefined,
  email: string,
): { form: CheckoutFormState; countryCode: string } {
  const { countryCode, phone } = splitPhone(profile?.phone);
  return {
    countryCode,
    form: {
      fullName: profile?.fullName ?? "",
      phone,
      email: email ?? "",
      address: profile?.address ?? "",
      city: profile?.city ?? "",
      area: profile?.area ?? "",
      notes: profile?.notes ?? "",
    },
  };
}
```

- [ ] **Step 5: Run test + typecheck to verify they pass**

Run: `cd issa-beauty && pnpm test src/features/checkout/data/profileForm.test.ts && pnpm exec tsc -b`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**

```bash
cd issa-beauty
git add src/features/auth/data/auth.ts src/features/checkout/data/profileForm.ts src/features/checkout/data/profileForm.test.ts
git commit -m "feat: add UserProfile type and checkout profileForm helper"
```

---

### Task 5: Pre-fill the checkout form from the saved profile (storefront)

**Files:**
- Modify: `issa-beauty/src/features/checkout/ui/CheckoutPage.tsx` (imports ~1-19; `COUNTRY_CODES` const ~21-22; component state ~28-42; add a seeding effect)
- Create: `issa-beauty/src/features/checkout/ui/CheckoutPage.test.tsx`

**Interfaces:**
- Consumes: `COUNTRY_CODES`, `profileToForm` from Task 4; `useAuth` from `@/features/auth/data/AuthContext`.

- [ ] **Step 1: Write the failing test**

Create `issa-beauty/src/features/checkout/ui/CheckoutPage.test.tsx`:

```ts
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { vi } from "vitest";

vi.mock("@/features/cart/data/CartContext", () => ({
  useCart: () => ({
    items: [
      { productId: "p1", name: "Lipstick", quantity: 1, price: 10, discountPercentage: 0 },
    ],
    subtotal: 10,
    clear: vi.fn(),
  }),
  discountedPrice: (price: number) => price,
}));

const mockUser = {
  email: "jane@x.com",
  profile: {
    fullName: "Jane Doe",
    phone: "+961 12345678",
    address: "1 Main St",
    city: "Beirut",
    area: "Hamra",
    notes: "call first",
  },
};
vi.mock("@/features/auth/data/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, loading: false, login: vi.fn(), logout: vi.fn(), refresh: vi.fn() }),
}));

import CheckoutPage from "./CheckoutPage";

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CheckoutPage />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

it("pre-fills the form from the logged-in user's saved profile", async () => {
  renderPage();
  await waitFor(() => {
    expect(screen.getByLabelText("Full name")).toHaveValue("Jane Doe");
  });
  expect(screen.getByLabelText("Phone number")).toHaveValue("12345678");
  expect(screen.getByLabelText("Email")).toHaveValue("jane@x.com");
  expect(screen.getByLabelText("Address")).toHaveValue("1 Main St");
  expect(screen.getByLabelText("City")).toHaveValue("Beirut");
  expect(screen.getByLabelText("Area")).toHaveValue("Hamra");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd issa-beauty && pnpm test src/features/checkout/ui/CheckoutPage.test.tsx`
Expected: FAIL — the inputs render empty (no seeding yet).

- [ ] **Step 3: Import the shared list, auth, and hooks**

In `issa-beauty/src/features/checkout/ui/CheckoutPage.tsx`:

Change the React import on line 1 to add `useEffect` and `useRef`:

```ts
import { useEffect, useRef, useState } from "react";
```

Delete the local `COUNTRY_CODES` declaration (lines 21-22):

```ts
// Supported dialing codes. Lebanon only for now; add entries here to extend.
const COUNTRY_CODES = [{ code: "+961", label: "🇱🇧 +961" }];
```

Add these imports alongside the other feature imports near the top:

```ts
import { useAuth } from "@/features/auth/data/AuthContext";
import { COUNTRY_CODES, profileToForm } from "@/features/checkout/data/profileForm";
```

- [ ] **Step 4: Add the seeding effect**

Inside the `CheckoutPage` component, just after `const navigate = useNavigate();`, add:

```ts
  const { user } = useAuth();
```

Then, immediately after the `fieldErrors` state declaration (the `useState` block ending ~line 42), add the seeding effect:

```ts
  // Seed the form once from the logged-in user's saved profile. Only fill fields
  // the shopper hasn't already typed into, so a late-arriving profile (auth loads
  // async) never clobbers in-progress input.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !user) return;
    seededRef.current = true;
    const { form: seeded, countryCode: seededCode } = profileToForm(user.profile, user.email);
    setForm((f) => ({
      fullName: f.fullName || seeded.fullName,
      phone: f.phone || seeded.phone,
      email: f.email || seeded.email,
      address: f.address || seeded.address,
      city: f.city || seeded.city,
      area: f.area || seeded.area,
      notes: f.notes || seeded.notes,
    }));
    if (!form.phone) setCountryCode(seededCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);
```

(The `exhaustive-deps` disable is intentional: the effect must run on `user` changes only and reads `form.phone` as a one-time guard.)

- [ ] **Step 5: Run test + typecheck to verify they pass**

Run: `cd issa-beauty && pnpm test src/features/checkout/ui/CheckoutPage.test.tsx && pnpm exec tsc -b`
Expected: PASS; no type errors.

- [ ] **Step 6: Run the full storefront test + lint**

Run: `cd issa-beauty && pnpm test && pnpm lint`
Expected: all tests PASS; lint clean.

- [ ] **Step 7: Commit**

```bash
cd issa-beauty
git add src/features/checkout/ui/CheckoutPage.tsx src/features/checkout/ui/CheckoutPage.test.tsx
git commit -m "feat: pre-fill checkout from saved user profile"
```

---

### Task 6: Full verification across both repos

**Files:** none (verification only).

- [ ] **Step 1: Backend full suite + typecheck**

Run: `cd issa-beauty-backend && pnpm test && pnpm exec tsc -b`
Expected: all tests PASS; no type errors.

- [ ] **Step 2: Storefront full suite + typecheck + lint**

Run: `cd issa-beauty && pnpm test && pnpm exec tsc -b && pnpm lint`
Expected: all tests PASS; no type errors; lint clean.

- [ ] **Step 3: Manual end-to-end check (drive the real flow)**

With the backend and storefront running against a dev database:
1. Register/log in as a customer, place an order with full contact + delivery details.
2. Confirm the order succeeds.
3. Return to `/checkout` (add an item first) — the form is pre-filled with the details from that order, and every field is still editable.
4. Place a second order changing the address; revisit checkout and confirm the new address is now the default.
5. Log out; confirm checkout starts empty for a guest.
