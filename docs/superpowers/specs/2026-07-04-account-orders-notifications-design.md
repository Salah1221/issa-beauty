# Account-Synced Orders + Revived Notifications — Design

_Date: 2026-07-04 · Repos: `issa-beauty` + `issa-beauty-backend` · Branch: `feat/account-orders` (off `feat/order-tracking`)_

## Overview

Now that customer accounts exist, make order tracking **account-backed** (orders
tied to the user, fetched from the server, cross-device) instead of the guest
`localStorage` model, and **bring back in-app status notifications**, gated to
logged-in users. On completion, merge into `feat/order-tracking`.

## Goals
- Orders placed while logged in are linked to the account.
- `/orders` (already login-gated) shows the account's orders from the server.
- Logged-in users get an in-app notification (bell + toast) when an order's status changes.

## Non-goals (YAGNI)
- Claiming guest orders placed before signup; password reset. (Follow-ups.)
- Keeping the guest order-number+phone tracking flow — it is removed.

## Backend (`issa-beauty-backend`)

- **`optionalUser` helper** (in `auth.ts`): reads `customer_token`; returns the userId if valid+customer role, else null. Does NOT 401.
- **`POST /api/orders`** (existing checkout route in `routes/public.ts`): call `optionalUser`; if a userId is returned, set it on the created order (`user` field already on the `Order` model). Guests still succeed with `user: null`.
- **New `GET /api/orders/mine`** (`routes/public.ts`, behind `requireUser`): returns the authenticated user's orders, newest first, full detail (they own them — no phone factor). Reuse `projectTrackedOrder` for a lean list projection, plus `items`/`shipping` for detail (return the full order docs is acceptable since the owner is authenticated).
- **Remove** `POST /api/orders/track` + `validateTrackInput` (obsolete). Keep `projectTrackedOrder` (reused by `/mine`). Update/remove the corresponding tests.

## Frontend (`issa-beauty` storefront)

**Remove (guest machinery):** `features/orders/data/trackedOrders.ts` + its test, `features/orders/data/orderTracking.ts`, `features/orders/ui/TrackOrderForm.tsx`, and the auto-add-on-checkout in `OrderConfirmation.tsx`.

**Orders client** (`features/orders/data/orders.ts`, new): `getMyOrders(): Promise<ApiResult<TrackedOrderView[]>>` → `GET /api/orders/mine`. (`TrackedOrderView` stays in `orderTypes.ts`.)

**Pages:**
- `MyOrdersPage` → `getMyOrders()` on mount (still under `RequireAuth`). Empty state when the account has no orders.
- `OrderDetail` → fetch via `getMyOrders()` and find by `orderNumber` (or a `getMyOrder(orderNumber)` helper); keep the `StatusStepper`. Drop the "stop tracking" action (orders are account-owned, not opt-in).

**Notifications (revived, logged-in only):** recover from commit `8e2f5d6`:
- `common/utils/useMediaQuery.ts` — as-is.
- `features/orders/data/notifications.ts` — keep `diffStatuses`, `OrderNotification`, and the notification-list store; **add** a per-user `lastSeen` map in localStorage (key `issa.orderLastSeen.<email>` → `{ [orderNumber]: status }`) so diffs are account-scoped and don't bleed across accounts/devices.
- `features/orders/data/useOrderNotifications.ts` — adapt to: no-op when logged out; when logged in, poll `getMyOrders()` (mount + ~60s while visible, in-flight guarded), diff against the user's `lastSeen`, update it, append notifications, toast on live change.
- `features/orders/ui/OrderNotificationsBell.tsx` — recover; unchanged Sheet(mobile)/Popover(desktop) list.

**Navbar:** render `<OrderNotificationsBell />` **only when `useAuth().user`** is set — logged out stays search + avatar; logged in shows search + bell + avatar.

## Error handling
- `/mine` requires auth → 401 if not; the client treats non-success as empty and the hook no-ops.
- Notification polling errors are swallowed (keep last-known), as before.
- Corrupt localStorage → treated as empty.

## Testing
- **Backend:** `/api/orders/mine` returns only the caller's orders + 401 without auth; `POST /api/orders` links `user` when authed and leaves `null` for guests.
- **Storefront:** `diffStatuses` + notification store incl. per-user `lastSeen` (pure); `getMyOrders` wiring exercised via MyOrdersPage.

## Decisions (made; adjustable)
- Notification `lastSeen` stored client-side, keyed by user email; no server read-state model.
- Bell only renders for logged-in users; polls `/api/orders/mine`.
- Guest order-number+phone tracking fully removed (endpoint + client).
