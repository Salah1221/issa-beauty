# Order Tracking & Status Notifications — Design

_Date: 2026-07-03 · Repos: `issa-beauty` (storefront) + `issa-beauty-backend`_

> **Addendum (2026-07-04):** After implementation, the **in-site notification**
> half of this design was removed. Guests already receive email on order
> placement and on every meaningful status change (backend `statusUpdateEmail`),
> so the notification bell + polling duplicated that and cluttered the navbar.
> What shipped: the backend `POST /api/orders/track` endpoint and the on-demand
> **My Orders** tracking page, with its entry point behind a "Guest" avatar
> menu. No in-site notifications, no accounts. Sections below about the bell,
> polling hook, and notification store are historical.

## Overview

Give guest shoppers a way to (1) track the status of their orders on a
dedicated **My Orders** page, and (2) receive **in-site notifications** when an
order's status changes. Mobile-first throughout. No customer accounts.

## Goals

- A returning visitor can see the current status of orders they placed.
- A visitor can add an order placed elsewhere (e.g. another device) by entering
  its order number + phone.
- The site surfaces a notification when a tracked order's status changes.

## Non-goals (YAGNI)

- No customer accounts / login / cross-device sync. The storefront is
  guest-checkout only and stays that way for this feature.
- No realtime push (WebSockets/SSE). Polling is sufficient.
- No per-status history model change for v1 (see "Status timeline" below).

## Identity & storage model

There are no accounts, so the **browser** is the source of truth for "my
orders". A `localStorage` store holds the orders this device tracks:

```ts
type TrackedOrder = {
  orderNumber: string;   // e.g. "IB-7QX2M9"
  phone: string;         // used to re-verify on lookup
  lastSeenStatus: OrderStatus;
  addedAt: string;       // ISO
};
```

- On successful checkout, the newly placed order is **auto-added** to this
  store (from the data already in `sessionStorage.lastOrder`).
- Users can **manually add** an order via a form (order number + phone),
  verified against the backend before it's saved.

> **Decision to confirm:** identity model = local-device + manual add. This is
> the only option that supports proactive notifications without building auth.

## Backend — one new public endpoint

`POST /api/orders/track` — behind the existing `looseLimiter` (poll-friendly)
or `strictLimiter` (see Security).

**Request:**
```json
{ "orders": [{ "orderNumber": "IB-7QX2M9", "phone": "+961..." }] }
```

**Response:** one entry per input pair; unknown/mismatched pairs are simply
omitted (do not reveal which field was wrong).
```json
{
  "success": true,
  "data": [
    {
      "orderNumber": "IB-7QX2M9",
      "status": "confirmed",
      "total": 42.0,
      "itemCount": 3,
      "createdAt": "2026-07-03T18:00:00Z",
      "updatedAt": "2026-07-03T19:30:00Z"
    }
  ]
}
```

**Rules:**
- Phone must match the order's stored (trimmed) phone. Compare trimmed values;
  reuse existing phone handling in `orders.ts`.
- Lean projection only — no address/name/notes/email in the response beyond what
  the caller already supplied. `itemCount` = sum of item quantities.
- The single endpoint serves both manual-add verification (one pair) and
  notification polling (many pairs).

**Security:**
- Rate-limit the endpoint (the app already wires `strictLimiter`/`looseLimiter`
  in `public.ts`). Cap the batch size (e.g. ≤ 25 pairs) to bound work.
- Order numbers are random `IB-` + 6 chars from a 32-symbol alphabet (~1e9
  space), and the phone second factor prevents enumeration/PII scraping.

## Client architecture (storefront)

Feature lives under `src/features/orders/` (new), mirroring the existing
`features/*` layout.

- **`data/trackedOrders.ts`** — read/write the `localStorage` store; add,
  remove, update `lastSeenStatus`. Pure, unit-testable.
- **`data/orderTracking.ts`** — API client for `POST /api/orders/track` (uses
  existing `ApiClient`/`ApiResult`).
- **`data/useOrderNotifications.ts`** — hook that:
  - polls `/api/orders/track` for all tracked orders on app mount and every
    ~60s while the tab is visible (pause when `document.hidden`);
  - diffs each returned `status` against `lastSeenStatus`;
  - on a change: updates the store, appends a persisted notification, and (if
    the change happened live this session) fires a `sonner` toast;
  - exposes `{ notifications, unreadCount, markAllRead }`.
  - Notifications persist in `localStorage` too.
- **UI:**
  - `ui/OrderNotificationsBell.tsx` — bell + unread badge in the Navbar. Opens a
    **Popover** on ≥sm and a bottom **Sheet** on mobile (Sheet already exists).
    Each item deep-links to the order on the tracking page.
  - `ui/MyOrdersPage.tsx` — the `/orders` route (see Routing). Stacked order
    **cards** (status badge, order number, date, total, item count). Tap → detail.
  - `ui/OrderDetail.tsx` — vertical **status stepper** + item list + delivery
    summary. Rendered at the deep-linkable sub-route `/orders/:orderNumber`
    (this is the target the notification bell links to).
  - `ui/TrackOrderForm.tsx` — "Track another order" (order number + phone),
    verifies via the API, then adds to the store.
  - Empty state with a CTA to `/products`.

## Routing

Add routes for the tracking page. **Default: `/orders`** (list) and
`/orders/:orderNumber` (detail).

> **Decision to confirm:** route name `/orders` vs `/track` vs `/my-orders`.

Entry points:
- Navbar: the notifications bell, plus a "My Orders" link/icon.
- `OrderConfirmation` screen: a "Track your order" button.

## Status timeline

Statuses: `pending → confirmed → delivered`, with `cancelled` as a distinct
terminal state.

- v1 derives stepper completion from the **current** status (Placed → Confirmed
  → Delivered), showing `updatedAt` as "last updated". `cancelled` renders as a
  distinct terminal badge, not a step.
- No `statusHistory` model change now. Adding a `statusHistory: [{status, at}]`
  array to the Order model (appended on admin status change) is an easy future
  enhancement for per-step timestamps.

## Mobile-first UX

- Cards stack vertically full-width; generous tap targets (min ~44px).
- Notifications use a bottom Sheet on mobile, Popover on desktop.
- Status stepper is vertical (reads well on narrow screens).
- Uses existing shadcn primitives (`card`, `badge`, `sheet`, `button`, `input`,
  `select`) + one new component (Popover / dropdown) pulled per shadcn docs.

## Error handling

- API failures during polling are swallowed silently (no toast spam); the UI
  keeps the last-known status. Manual-add failures show an inline form error
  ("We couldn't find an order with that number and phone").
- Corrupt `localStorage` (bad JSON) is treated as empty and reset.
- `--delete`/network offline: hook no-ops until the next successful poll.

## Testing

**Backend** (`src/routes/public.orders.test.ts` + new cases):
- match returns lean projection; phone mismatch omitted; unknown omitted;
  batch of several; batch-size cap; rate-limit behavior.

**Storefront:**
- `trackedOrders` store: add/dedupe/remove/update, corrupt-storage reset.
- notification diff logic: status change produces a notification + updates
  `lastSeenStatus`; no change produces nothing; multiple orders.

## Open questions (decisions made, please confirm)

1. **Identity model** — chose local-device + manual add. OK?
2. **Route name** — chose `/orders`. Prefer `/track` or `/my-orders`?
3. **Rate limiter** — `looseLimiter` for the poll endpoint (polling is frequent).
   OK, or prefer `strictLimiter`?
