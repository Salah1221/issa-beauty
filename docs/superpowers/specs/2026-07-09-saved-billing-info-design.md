# Saved Billing Info for Logged-In Customers — Design

_Date: 2026-07-09 · Repos: `issa-beauty` + `issa-beauty-backend`_

## Overview

Logged-in customers re-type the same contact and delivery details on every
checkout. Persist those details on the user account so returning customers see
the checkout form pre-filled. Saving is **automatic and invisible**: whenever a
logged-in user places an order, the details from that order become their saved
defaults. Guests are unaffected.

## Goals
- A logged-in user's checkout details are stored server-side on their account.
- Every order a logged-in user places refreshes those saved details.
- The checkout form pre-fills from the saved details, all fields still editable.
- Cross-device (server-side, not `localStorage`).

## Non-goals (YAGNI)
- A dedicated "My details" / profile-editing page or a "save my info" checkbox.
- Clearing/managing saved info from the UI.
- Backfilling profiles from orders placed before this ships.
- Touching the guest checkout flow.

## Data model (`issa-beauty-backend`)

Add an optional `profile` subdocument to the `User` schema in `models.ts`:

```ts
profile?: {
  fullName?: string;
  phone?: string;    // full string incl. dialing code, e.g. "+961 12345678"
  address?: string;
  city?: string;
  area?: string;
  notes?: string;
};
```

All fields optional; `profile` is absent until the user's first order. Email is
**not** stored here — it is already the account identity.

`phone` is stored as the same full string that lands on the order today
(`"+961 12345678"`), so no re-derivation is needed on save.

## Auto-save on order placement (`issa-beauty-backend`)

In `POST /api/orders` (`routes/public.ts`), the route already resolves
`optionalUser(req)`. When that returns a userId (logged-in order), after the
order is successfully created, upsert the order's `customer` + `shipping` fields
into `user.profile`:

- `fullName` ← `customer.fullName`
- `phone` ← `customer.phone`
- `address` ← `shipping.address`
- `city` ← `shipping.city`
- `area` ← `shipping.area`
- `notes` ← `shipping.notes`

This is a **best-effort** update: it runs after the order is saved and its
failure is caught and logged, never failing the order response. Guests
(`userId == null`) skip it entirely.

Implemented as a small `saveUserProfile(userId, order)` helper (colocated with
the order route or in a thin module) so it is unit-testable and keeps the route
readable.

## Expose the profile (`issa-beauty-backend`)

Extend `GET /api/auth/me` (`routes/customerAuth.ts`) so the payload becomes
`{ email, profile }` (profile `undefined`/omitted when unset). This is the
endpoint `AuthContext` already calls on load, so the profile arrives with the
existing user fetch — no new endpoint or extra round-trip.

## Frontend (`issa-beauty` storefront)

**`features/auth/data/auth.ts`** — extend the `AuthUser` type:

```ts
export type UserProfile = {
  fullName?: string; phone?: string; address?: string;
  city?: string; area?: string; notes?: string;
};
export type AuthUser = { email: string; profile?: UserProfile };
```

`AuthContext` and `getMe` need no logic changes — the richer object flows through
unchanged.

**`features/checkout/ui/CheckoutPage.tsx`** — seed form state from
`useAuth().user?.profile` when present:
- `fullName`, `email` (email from `user.email`), `address`, `city`, `area`,
  `notes` populate directly.
- `phone` is split back into `countryCode` + national number: if the stored
  string starts with a known code in `COUNTRY_CODES`, use it and put the
  remainder in the phone input; otherwise default `countryCode` to `+961` and
  drop the code portion. All fields stay editable.
- Because `user` loads asynchronously (AuthContext starts with `loading: true`),
  initialize the form from `user` via lazy initial state **and** reconcile when
  `user` resolves — but only overwrite fields the user has not already typed, so
  a late-arriving profile never clobbers in-progress input.

No new routes, pages, or form controls.

## Error handling
- Profile save failure on order placement is caught + logged; the order still
  succeeds and returns normally.
- `/me` for a logged-out or invalid session returns `data: null` as today; the
  form simply starts empty.
- Unparseable stored `phone` → country code falls back to `+961`, number field
  left as best-effort remainder or blank.

## Testing
- **Backend (`public.orders.test.ts`)**: placing an order as a logged-in user
  writes/refreshes `user.profile`; a second order overwrites it; a guest order
  creates no profile; a profile-save error does not fail the order.
- **Backend (`customerAuth.test.ts`)**: `GET /api/auth/me` returns `profile`
  when set and omits/undefines it when unset.
- **Frontend**: `CheckoutPage` renders pre-filled fields when `user.profile` is
  present (including phone split into code + number), and starts empty for a
  logged-out user.
