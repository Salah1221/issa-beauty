# Order Tracking & Status Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let guest shoppers track their orders and get in-site notifications when an order's status changes, with no accounts.

**Architecture:** A new public backend endpoint `POST /api/orders/track` returns lean status projections for `{orderNumber, phone}` pairs. The storefront remembers orders in `localStorage`, polls that endpoint, diffs statuses to raise notifications, and renders a mobile-first `/orders` page + a Navbar bell.

**Tech Stack:** Backend — Express + Mongoose + Vitest. Storefront — React 18 + React Router + shadcn/Radix + sonner + Vitest (added in this plan).

## Global Constraints

- **Two repos:** backend tasks are in `/home/salah/Projects/issa-beauty-backend`; storefront tasks are in `/home/salah/Projects/issa-beauty` (paths below are repo-relative).
- **No accounts / no auth.** Identity = browser `localStorage` + phone as the lookup second factor.
- **Backend:** skip rate limiters under test via the existing `process.env.NODE_ENV !== "test"` guard. Phone match compares **trimmed** strings. Batch capped at **25** pairs. Response is a lean projection only — never return `shipping`, `customer.fullName`, `customer.email`, or `notes`.
- **Order statuses (verbatim):** `"pending" | "confirmed" | "delivered" | "cancelled"`. Order number format: `IB-` + 6 chars.
- **Storefront:** mobile-first (stacked, ≥44px tap targets); all network calls return `ApiResult<T>` via `request` from `@/common/data/ApiClient`; feature code lives under `src/features/orders/`.
- **Commits:** the orchestrator commits after review. Worker subagents implement + run tests but DO NOT commit or push.

---

## Task B1: Backend track helpers (pure)

**Repo:** `issa-beauty-backend`

**Files:**
- Modify: `src/orders.ts` (append helpers + types)
- Test: `src/orders.test.ts` (append)

**Interfaces:**
- Consumes: nothing new.
- Produces:
  - `type TrackPair = { orderNumber: string; phone: string }`
  - `type TrackedOrderView = { orderNumber: string; status: string; total: number; itemCount: number; createdAt: string; updatedAt: string }`
  - `const MAX_TRACK_BATCH = 25`
  - `function validateTrackInput(body: unknown): { valid: boolean; errors: string[]; pairs: TrackPair[] }`
  - `function projectTrackedOrder(order: IOrder): TrackedOrderView`

- [ ] **Step 1: Write failing tests** in `src/orders.test.ts`:

```ts
import { validateTrackInput, projectTrackedOrder, MAX_TRACK_BATCH } from "./orders.js";

describe("validateTrackInput", () => {
  it("accepts a well-formed batch and trims fields", () => {
    const r = validateTrackInput({ orders: [{ orderNumber: " IB-ABC123 ", phone: " 03 111 " }] });
    expect(r.valid).toBe(true);
    expect(r.pairs).toEqual([{ orderNumber: "IB-ABC123", phone: "03 111" }]);
  });
  it("rejects a missing/empty orders array", () => {
    expect(validateTrackInput({}).valid).toBe(false);
    expect(validateTrackInput({ orders: [] }).valid).toBe(false);
  });
  it("rejects entries missing orderNumber or phone", () => {
    expect(validateTrackInput({ orders: [{ orderNumber: "IB-1" }] }).valid).toBe(false);
    expect(validateTrackInput({ orders: [{ phone: "03" }] }).valid).toBe(false);
  });
  it("rejects batches larger than the cap", () => {
    const orders = Array.from({ length: MAX_TRACK_BATCH + 1 }, (_, i) => ({ orderNumber: "IB-" + i, phone: "03" }));
    expect(validateTrackInput({ orders }).valid).toBe(false);
  });
});

describe("projectTrackedOrder", () => {
  it("returns only the lean, non-PII fields with a summed itemCount", () => {
    const view = projectTrackedOrder({
      orderNumber: "IB-ABC123",
      items: [{ quantity: 2 } as never, { quantity: 3 } as never],
      total: 42,
      status: "confirmed",
      customer: { fullName: "Jane", phone: "03", email: "j@x.com" },
      shipping: { address: "secret", city: "c" },
      createdAt: new Date("2026-07-03T18:00:00Z"),
      updatedAt: new Date("2026-07-03T19:00:00Z"),
    } as never);
    expect(view).toEqual({
      orderNumber: "IB-ABC123",
      status: "confirmed",
      total: 42,
      itemCount: 5,
      createdAt: "2026-07-03T18:00:00.000Z",
      updatedAt: "2026-07-03T19:00:00.000Z",
    });
    expect(view).not.toHaveProperty("customer");
    expect(view).not.toHaveProperty("shipping");
  });
});
```

- [ ] **Step 2: Run to confirm failure** — `pnpm test -- src/orders.test.ts` → FAIL (exports not defined).

- [ ] **Step 3: Implement** — append to `src/orders.ts` (import `IOrder` type at top if not present: `import type { IOrder } from "./models.js";`):

```ts
export const MAX_TRACK_BATCH = 25;

export type TrackPair = { orderNumber: string; phone: string };
export type TrackedOrderView = {
  orderNumber: string;
  status: string;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export function validateTrackInput(
  body: unknown,
): { valid: boolean; errors: string[]; pairs: TrackPair[] } {
  const errors: string[] = [];
  const orders = (body as { orders?: unknown })?.orders;
  if (!Array.isArray(orders) || orders.length === 0) {
    return { valid: false, errors: ["orders must be a non-empty array"], pairs: [] };
  }
  if (orders.length > MAX_TRACK_BATCH) {
    return { valid: false, errors: [`orders exceeds max batch of ${MAX_TRACK_BATCH}`], pairs: [] };
  }
  const pairs: TrackPair[] = [];
  for (const o of orders) {
    const orderNumber = typeof (o as TrackPair)?.orderNumber === "string" ? (o as TrackPair).orderNumber.trim() : "";
    const phone = typeof (o as TrackPair)?.phone === "string" ? (o as TrackPair).phone.trim() : "";
    if (!orderNumber || !phone) {
      errors.push("each entry needs orderNumber and phone");
      break;
    }
    pairs.push({ orderNumber, phone });
  }
  return { valid: errors.length === 0, errors, pairs };
}

export function projectTrackedOrder(order: IOrder): TrackedOrderView {
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    itemCount: order.items.reduce((n, it) => n + it.quantity, 0),
    createdAt: (order.createdAt as Date).toISOString(),
    updatedAt: (order.updatedAt as Date).toISOString(),
  };
}
```

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- src/orders.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add src/orders.ts src/orders.test.ts && git commit -m "feat(orders): track-lookup validation + lean projection helpers"`

---

## Task B2: `POST /api/orders/track` route

**Repo:** `issa-beauty-backend`

**Files:**
- Modify: `src/routes/public.ts` (add route; extend imports)
- Test: `src/routes/public.orders.test.ts` (append)

**Interfaces:**
- Consumes: `validateTrackInput`, `projectTrackedOrder`, `TrackedOrderView` from `../orders.js`.
- Produces: `POST /api/orders/track` → `{ success: true, data: TrackedOrderView[] }`. Unknown/phone-mismatch pairs are omitted. Uses `looseLimiter` (already applied router-wide) — no extra limiter.

- [ ] **Step 1: Write failing tests** — append to `src/routes/public.orders.test.ts` (follow the file's existing app/DB setup; create orders via the model or the POST route as the file already does):

```ts
describe("POST /api/orders/track", () => {
  it("returns lean status for a matching orderNumber + phone", async () => {
    const created = await Order.create({
      orderNumber: "IB-TRK001", items: [{ productId: "p", name: "n", unitPrice: 5, discountPercentage: 0, quantity: 2, lineTotal: 10, imageUrl: "" }],
      subtotal: 10, deliveryFee: 3, total: 13,
      customer: { fullName: "Jane", phone: "03123456" }, shipping: { address: "a", city: "c" }, status: "confirmed",
    });
    const res = await request(app).post("/api/orders/track").send({ orders: [{ orderNumber: "IB-TRK001", phone: "03123456" }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ orderNumber: "IB-TRK001", status: "confirmed", itemCount: 2, total: 13 });
    expect(res.body.data[0].customer).toBeUndefined();
    expect(res.body.data[0].shipping).toBeUndefined();
    expect(created.orderNumber).toBe("IB-TRK001");
  });
  it("omits pairs whose phone does not match", async () => {
    await Order.create({ orderNumber: "IB-TRK002", items: [{ productId: "p", name: "n", unitPrice: 5, discountPercentage: 0, quantity: 1, lineTotal: 5, imageUrl: "" }], subtotal: 5, deliveryFee: 3, total: 8, customer: { fullName: "J", phone: "03999999" }, shipping: { address: "a", city: "c" }, status: "pending" });
    const res = await request(app).post("/api/orders/track").send({ orders: [{ orderNumber: "IB-TRK002", phone: "wrong" }] });
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
  it("omits unknown order numbers", async () => {
    const res = await request(app).post("/api/orders/track").send({ orders: [{ orderNumber: "IB-NOPE00", phone: "03" }] });
    expect(res.body.data).toEqual([]);
  });
  it("400s on an empty batch", async () => {
    const res = await request(app).post("/api/orders/track").send({ orders: [] });
    expect(res.status).toBe(400);
  });
});
```

(Ensure `Order` is imported in the test file: `import { Order } from "../models.js";` — add only if absent.)

- [ ] **Step 2: Run to confirm failure** — `pnpm test -- src/routes/public.orders.test.ts` → FAIL (404 / route missing).

- [ ] **Step 3: Implement** — extend the import in `src/routes/public.ts`:

```ts
import { validateOrderInput, buildOrderDoc, generateOrderNumber, validateTrackInput, projectTrackedOrder } from "../orders.js";
```

Add the route (place it right after the `POST /orders` handler):

```ts
publicRouter.post("/orders/track", async (req, res) => {
  const { valid, errors, pairs } = validateTrackInput(req.body);
  if (!valid) {
    return res.status(400).json({ success: false, message: errors[0] });
  }
  try {
    const numbers = pairs.map((p) => p.orderNumber);
    const phoneByNumber = new Map(pairs.map((p) => [p.orderNumber, p.phone]));
    const orders = await Order.find({ orderNumber: { $in: numbers } });
    const data = orders
      .filter((o) => phoneByNumber.get(o.orderNumber)?.trim() === o.customer.phone.trim())
      .map(projectTrackedOrder);
    res.status(200).json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: (err as Error).message });
  }
});
```

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- src/routes/public.orders.test.ts` → PASS. Then run the full suite: `pnpm test` → all green.
- [ ] **Step 5: Commit** — `git add src/routes/public.ts src/routes/public.orders.test.ts && git commit -m "feat(orders): public POST /api/orders/track status lookup"`

---

## Task S0: Add Vitest to the storefront

**Repo:** `issa-beauty`

**Files:**
- Modify: `package.json` (add devDeps + `test` script)
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Test: `src/test/sanity.test.ts` (temporary smoke test, deleted in Step 5)

- [ ] **Step 1: Install deps** — `pnpm add -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event`
- [ ] **Step 2: Create `vitest.config.ts`:**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "jsdom", globals: true, setupFiles: ["./src/test/setup.ts"] },
});
```

- [ ] **Step 3: Create `src/test/setup.ts`:**

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
afterEach(() => localStorage.clear());
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Smoke test** — create `src/test/sanity.test.ts` with `it("runs", () => expect(1 + 1).toBe(2));`, run `pnpm test` → PASS, then delete the file.
- [ ] **Step 5: Commit** — `git add package.json pnpm-lock.yaml vitest.config.ts src/test/setup.ts && git commit -m "test: add vitest + jsdom + testing-library to storefront"`

---

## Task S1: Order types + tracked-orders store

**Repo:** `issa-beauty`

**Files:**
- Create: `src/features/orders/data/orderTypes.ts`
- Create: `src/features/orders/data/trackedOrders.ts`
- Test: `src/features/orders/data/trackedOrders.test.ts`

**Interfaces:**
- Produces:
  - `type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled"`
  - `type TrackedOrder = { orderNumber: string; phone: string; lastSeenStatus: OrderStatus; addedAt: string }`
  - `type TrackedOrderView = { orderNumber: string; status: OrderStatus; total: number; itemCount: number; createdAt: string; updatedAt: string }`
  - `getTrackedOrders(): TrackedOrder[]`
  - `addTrackedOrder(o: { orderNumber: string; phone: string; status: OrderStatus }): void` (idempotent by orderNumber)
  - `removeTrackedOrder(orderNumber: string): void`
  - `setLastSeenStatus(orderNumber: string, status: OrderStatus): void`

- [ ] **Step 1: Create `orderTypes.ts`:**

```ts
export type OrderStatus = "pending" | "confirmed" | "delivered" | "cancelled";
export const ORDER_STATUSES: OrderStatus[] = ["pending", "confirmed", "delivered", "cancelled"];

export type TrackedOrder = {
  orderNumber: string;
  phone: string;
  lastSeenStatus: OrderStatus;
  addedAt: string;
};

export type TrackedOrderView = {
  orderNumber: string;
  status: OrderStatus;
  total: number;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};
```

- [ ] **Step 2: Write failing tests** in `trackedOrders.test.ts`:

```ts
import { getTrackedOrders, addTrackedOrder, removeTrackedOrder, setLastSeenStatus } from "./trackedOrders";

it("adds and reads a tracked order", () => {
  addTrackedOrder({ orderNumber: "IB-1", phone: "03", status: "pending" });
  expect(getTrackedOrders()).toEqual([
    expect.objectContaining({ orderNumber: "IB-1", phone: "03", lastSeenStatus: "pending" }),
  ]);
});
it("is idempotent by orderNumber (updates phone/status, no dupes)", () => {
  addTrackedOrder({ orderNumber: "IB-1", phone: "03", status: "pending" });
  addTrackedOrder({ orderNumber: "IB-1", phone: "099", status: "confirmed" });
  const all = getTrackedOrders();
  expect(all).toHaveLength(1);
  expect(all[0]).toMatchObject({ phone: "099", lastSeenStatus: "confirmed" });
});
it("removes and updates last-seen status", () => {
  addTrackedOrder({ orderNumber: "IB-1", phone: "03", status: "pending" });
  setLastSeenStatus("IB-1", "delivered");
  expect(getTrackedOrders()[0].lastSeenStatus).toBe("delivered");
  removeTrackedOrder("IB-1");
  expect(getTrackedOrders()).toEqual([]);
});
it("treats corrupt storage as empty", () => {
  localStorage.setItem("issa.trackedOrders", "not json");
  expect(getTrackedOrders()).toEqual([]);
});
```

- [ ] **Step 3: Run to confirm failure** — `pnpm test -- trackedOrders` → FAIL.
- [ ] **Step 4: Implement `trackedOrders.ts`:**

```ts
import { OrderStatus, TrackedOrder } from "./orderTypes";

const KEY = "issa.trackedOrders";

export function getTrackedOrders(): TrackedOrder[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TrackedOrder[]) : [];
  } catch {
    return [];
  }
}

function save(orders: TrackedOrder[]): void {
  localStorage.setItem(KEY, JSON.stringify(orders));
}

export function addTrackedOrder(o: { orderNumber: string; phone: string; status: OrderStatus }): void {
  const orders = getTrackedOrders();
  const existing = orders.find((t) => t.orderNumber === o.orderNumber);
  if (existing) {
    existing.phone = o.phone;
    existing.lastSeenStatus = o.status;
  } else {
    orders.push({ orderNumber: o.orderNumber, phone: o.phone, lastSeenStatus: o.status, addedAt: new Date().toISOString() });
  }
  save(orders);
}

export function removeTrackedOrder(orderNumber: string): void {
  save(getTrackedOrders().filter((t) => t.orderNumber !== orderNumber));
}

export function setLastSeenStatus(orderNumber: string, status: OrderStatus): void {
  const orders = getTrackedOrders();
  const t = orders.find((x) => x.orderNumber === orderNumber);
  if (t) {
    t.lastSeenStatus = status;
    save(orders);
  }
}
```

- [ ] **Step 5: Run to confirm pass** — `pnpm test -- trackedOrders` → PASS.
- [ ] **Step 6: Commit** — `git add src/features/orders/data/orderTypes.ts src/features/orders/data/trackedOrders.ts src/features/orders/data/trackedOrders.test.ts && git commit -m "feat(orders): order types + localStorage tracked-orders store"`

---

## Task S2: Track API client

**Repo:** `issa-beauty`

**Files:**
- Create: `src/features/orders/data/orderTracking.ts`

**Interfaces:**
- Consumes: `request` from `@/common/data/ApiClient`, `ApiResult` from `@/common/data/ApiResult`, `TrackedOrderView` from `./orderTypes`.
- Produces: `trackOrders(pairs: { orderNumber: string; phone: string }[]): Promise<ApiResult<TrackedOrderView[]>>`

- [ ] **Step 1: Implement `orderTracking.ts`:**

```ts
import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";
import { TrackedOrderView } from "./orderTypes";

export const trackOrders = (
  pairs: { orderNumber: string; phone: string }[],
): Promise<ApiResult<TrackedOrderView[]>> =>
  request<TrackedOrderView[]>({ url: "/api/orders/track", method: "POST", data: { orders: pairs } });
```

- [ ] **Step 2: Typecheck** — `pnpm exec tsc -b` → no errors (this module has no test; it's a thin wrapper exercised via S4/S8).
- [ ] **Step 3: Commit** — `git add src/features/orders/data/orderTracking.ts && git commit -m "feat(orders): track-orders API client"`

---

## Task S3: Notification diff logic + notification store

**Repo:** `issa-beauty`

**Files:**
- Create: `src/features/orders/data/notifications.ts`
- Test: `src/features/orders/data/notifications.test.ts`

**Interfaces:**
- Consumes: `OrderStatus`, `TrackedOrder`, `TrackedOrderView` from `./orderTypes`.
- Produces:
  - `type OrderNotification = { id: string; orderNumber: string; status: OrderStatus; at: string; read: boolean }`
  - `diffStatuses(tracked: TrackedOrder[], views: TrackedOrderView[]): { orderNumber: string; status: OrderStatus }[]` (pure — one entry per order whose view.status differs from lastSeenStatus)
  - `getNotifications(): OrderNotification[]`
  - `addNotifications(changes: { orderNumber: string; status: OrderStatus }[]): OrderNotification[]` (prepends, returns the newly-added ones)
  - `markAllRead(): void`
  - `unreadCount(): number`

- [ ] **Step 1: Write failing tests** in `notifications.test.ts`:

```ts
import { diffStatuses, getNotifications, addNotifications, markAllRead, unreadCount } from "./notifications";
import { TrackedOrder, TrackedOrderView } from "./orderTypes";

const tracked = (n: string, s: TrackedOrder["lastSeenStatus"]): TrackedOrder => ({ orderNumber: n, phone: "03", lastSeenStatus: s, addedAt: "" });
const view = (n: string, s: TrackedOrderView["status"]): TrackedOrderView => ({ orderNumber: n, status: s, total: 1, itemCount: 1, createdAt: "", updatedAt: "" });

describe("diffStatuses", () => {
  it("flags only orders whose status changed", () => {
    const changes = diffStatuses([tracked("IB-1", "pending"), tracked("IB-2", "confirmed")], [view("IB-1", "confirmed"), view("IB-2", "confirmed")]);
    expect(changes).toEqual([{ orderNumber: "IB-1", status: "confirmed" }]);
  });
  it("returns nothing when all match", () => {
    expect(diffStatuses([tracked("IB-1", "pending")], [view("IB-1", "pending")])).toEqual([]);
  });
});

describe("notification store", () => {
  it("adds, counts unread, and marks read", () => {
    addNotifications([{ orderNumber: "IB-1", status: "confirmed" }]);
    expect(getNotifications()).toHaveLength(1);
    expect(unreadCount()).toBe(1);
    markAllRead();
    expect(unreadCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure** — `pnpm test -- notifications` → FAIL.
- [ ] **Step 3: Implement `notifications.ts`:**

```ts
import { OrderStatus, TrackedOrder, TrackedOrderView } from "./orderTypes";

const KEY = "issa.orderNotifications";
let seq = 0;

export type OrderNotification = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  at: string;
  read: boolean;
};

export function diffStatuses(
  tracked: TrackedOrder[],
  views: TrackedOrderView[],
): { orderNumber: string; status: OrderStatus }[] {
  const seen = new Map(tracked.map((t) => [t.orderNumber, t.lastSeenStatus]));
  const changes: { orderNumber: string; status: OrderStatus }[] = [];
  for (const v of views) {
    if (seen.has(v.orderNumber) && seen.get(v.orderNumber) !== v.status) {
      changes.push({ orderNumber: v.orderNumber, status: v.status });
    }
  }
  return changes;
}

export function getNotifications(): OrderNotification[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as OrderNotification[]) : [];
  } catch {
    return [];
  }
}

function save(n: OrderNotification[]): void {
  localStorage.setItem(KEY, JSON.stringify(n));
}

export function addNotifications(
  changes: { orderNumber: string; status: OrderStatus }[],
): OrderNotification[] {
  const now = new Date().toISOString();
  const added: OrderNotification[] = changes.map((c) => ({
    id: `${now}-${c.orderNumber}-${seq++}`,
    orderNumber: c.orderNumber,
    status: c.status,
    at: now,
    read: false,
  }));
  if (added.length) save([...added, ...getNotifications()]);
  return added;
}

export function markAllRead(): void {
  save(getNotifications().map((n) => ({ ...n, read: true })));
}

export function unreadCount(): number {
  return getNotifications().filter((n) => !n.read).length;
}
```

- [ ] **Step 4: Run to confirm pass** — `pnpm test -- notifications` → PASS.
- [ ] **Step 5: Commit** — `git add src/features/orders/data/notifications.ts src/features/orders/data/notifications.test.ts && git commit -m "feat(orders): status-diff + notification store"`

---

## Task S4: `useOrderNotifications` polling hook

**Repo:** `issa-beauty`

**Files:**
- Create: `src/features/orders/data/useOrderNotifications.ts`

**Interfaces:**
- Consumes: `getTrackedOrders`, `setLastSeenStatus` (S1); `trackOrders` (S2); `diffStatuses`, `addNotifications`, `getNotifications`, `markAllRead`, `unreadCount`, `OrderNotification` (S3); `toast` from `sonner`; status label from `./statusMeta` (S6 — import `STATUS_META`).
- Produces: `useOrderNotifications(): { notifications: OrderNotification[]; unreadCount: number; markAllRead: () => void; refresh: () => Promise<void> }`

- [ ] **Step 1: Implement `useOrderNotifications.ts`:**

```ts
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getTrackedOrders, setLastSeenStatus } from "./trackedOrders";
import { trackOrders } from "./orderTracking";
import { diffStatuses, addNotifications, getNotifications, markAllRead as markAllReadStore, unreadCount as unreadCountStore, OrderNotification } from "./notifications";
import { STATUS_META } from "./statusMeta";

const POLL_MS = 60_000;

export function useOrderNotifications() {
  const [notifications, setNotifications] = useState<OrderNotification[]>(getNotifications());
  const [unread, setUnread] = useState<number>(unreadCountStore());

  const sync = useCallback(() => {
    setNotifications(getNotifications());
    setUnread(unreadCountStore());
  }, []);

  const refresh = useCallback(async () => {
    const tracked = getTrackedOrders();
    if (tracked.length === 0) return;
    const res = await trackOrders(tracked.map((t) => ({ orderNumber: t.orderNumber, phone: t.phone })));
    if (res.type !== "success") return; // swallow poll errors, keep last-known state
    const changes = diffStatuses(tracked, res.data);
    if (changes.length === 0) return;
    const added = addNotifications(changes);
    changes.forEach((c) => setLastSeenStatus(c.orderNumber, c.status));
    added.forEach((n) =>
      toast(`Order ${n.orderNumber} is now ${STATUS_META[n.status].label}`),
    );
    sync();
  }, [sync]);

  const markAllRead = useCallback(() => {
    markAllReadStore();
    sync();
  }, [sync]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, POLL_MS);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { notifications, unreadCount: unread, markAllRead, refresh };
}
```

- [ ] **Step 2: Typecheck** — `pnpm exec tsc -b` (requires S6's `statusMeta.ts` to exist; sequence S6 before this task). Expected: no errors.
- [ ] **Step 3: Commit** — `git add src/features/orders/data/useOrderNotifications.ts && git commit -m "feat(orders): polling hook that diffs status and raises notifications"`

---

## Task S5: shadcn Popover component

**Repo:** `issa-beauty`

**Files:**
- Modify: `package.json` (adds `@radix-ui/react-popover`)
- Create: `src/common/ui/components/popover.tsx`

- [ ] **Step 1: Add the dependency** — `pnpm add @radix-ui/react-popover`
- [ ] **Step 2: Create `src/common/ui/components/popover.tsx`** (standard shadcn "new-york" Popover; if unsure of the exact current source, consult shadcn docs via context7 `resolve-library-id` → `query-docs` for "popover"):

```tsx
import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/common/utils/utils";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor };
```

> Note: `cn` lives at `@/common/utils/utils` in this repo (verify the import path against an existing component such as `select.tsx`).

- [ ] **Step 3: Typecheck** — `pnpm exec tsc -b` → no errors.
- [ ] **Step 4: Commit** — `git add package.json pnpm-lock.yaml src/common/ui/components/popover.tsx && git commit -m "feat(ui): add shadcn Popover"`

---

## Task S6: Status metadata + StatusStepper

**Repo:** `issa-beauty`

**Files:**
- Create: `src/features/orders/data/statusMeta.ts`
- Create: `src/features/orders/ui/StatusStepper.tsx`

**Interfaces:**
- Consumes: `OrderStatus` (S1).
- Produces:
  - `STATUS_META: Record<OrderStatus, { label: string; badgeClass: string }>`
  - `STEP_FLOW: OrderStatus[]` = `["pending", "confirmed", "delivered"]`
  - `<StatusStepper status={OrderStatus} />` component (default export not required; named export `StatusStepper`).

- [ ] **Step 1: Create `statusMeta.ts`:**

```ts
import { OrderStatus } from "./orderTypes";

export const STATUS_META: Record<OrderStatus, { label: string; badgeClass: string }> = {
  pending: { label: "Pending", badgeClass: "bg-amber-100 text-amber-800" },
  confirmed: { label: "Confirmed", badgeClass: "bg-blue-100 text-blue-800" },
  delivered: { label: "Delivered", badgeClass: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", badgeClass: "bg-red-100 text-red-800" },
};

// The happy-path flow shown as a stepper; "cancelled" is a terminal state, not a step.
export const STEP_FLOW: OrderStatus[] = ["pending", "confirmed", "delivered"];
```

- [ ] **Step 2: Create `StatusStepper.tsx`** (vertical, mobile-first):

```tsx
import { Check } from "lucide-react";
import { OrderStatus } from "../data/orderTypes";
import { STATUS_META, STEP_FLOW } from "../data/statusMeta";

export function StatusStepper({ status }: { status: OrderStatus }) {
  if (status === "cancelled") {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
        This order was cancelled.
      </div>
    );
  }
  const currentIndex = STEP_FLOW.indexOf(status);
  return (
    <ol className="space-y-4">
      {STEP_FLOW.map((step, i) => {
        const done = i <= currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-sm ${isCurrent ? "font-semibold" : done ? "text-foreground" : "text-muted-foreground"}`}>
              {STATUS_META[step].label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 3: Typecheck** — `pnpm exec tsc -b` → no errors.
- [ ] **Step 4: Commit** — `git add src/features/orders/data/statusMeta.ts src/features/orders/ui/StatusStepper.tsx && git commit -m "feat(orders): status metadata + vertical StatusStepper"`

---

## Task S7: OrderNotificationsBell

**Repo:** `issa-beauty`

**Files:**
- Create: `src/features/orders/ui/OrderNotificationsBell.tsx`

**Interfaces:**
- Consumes: `useOrderNotifications` (S4); `STATUS_META` (S6); `Popover*` (S5); `Button` (`@/common/ui/components/button`); `useNavigate` from `react-router-dom`; `Bell` from `lucide-react`.
- Produces: default export `OrderNotificationsBell` (renders nothing but the bell + badge + popover). Safe to render even with zero tracked orders (shows an empty state).

> **Deviation from spec (intentional):** the spec described a bottom Sheet on
> mobile + Popover on desktop. For v1 we use a single width-capped responsive
> Popover (`w-80 max-w-[calc(100vw-2rem)]`) — touch-friendly and simpler. A
> mobile Sheet can be added later if desired.

- [ ] **Step 1: Implement `OrderNotificationsBell.tsx`:**

```tsx
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/common/ui/components/popover";
import { useOrderNotifications } from "../data/useOrderNotifications";
import { STATUS_META } from "../data/statusMeta";

export default function OrderNotificationsBell() {
  const { notifications, unreadCount, markAllRead } = useOrderNotifications();
  const navigate = useNavigate();

  return (
    <Popover onOpenChange={(open) => { if (open && unreadCount > 0) markAllRead(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Order notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Order updates</div>
        {notifications.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No updates yet.</p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${n.orderNumber}`)}
                  className="block w-full px-4 py-3 text-left text-sm hover:bg-accent/50"
                >
                  <span className="font-medium">{n.orderNumber}</span> is now{" "}
                  <span className="font-medium">{STATUS_META[n.status].label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {new Date(n.at).toLocaleString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Typecheck** — `pnpm exec tsc -b` → no errors.
- [ ] **Step 3: Commit** — `git add src/features/orders/ui/OrderNotificationsBell.tsx && git commit -m "feat(orders): notifications bell with popover"`

---

## Task S8: MyOrdersPage, OrderDetail, TrackOrderForm

**Repo:** `issa-beauty`

**Files:**
- Create: `src/features/orders/ui/TrackOrderForm.tsx`
- Create: `src/features/orders/ui/MyOrdersPage.tsx`
- Create: `src/features/orders/ui/OrderDetail.tsx`

**Interfaces:**
- Consumes: `getTrackedOrders`, `addTrackedOrder`, `removeTrackedOrder` (S1); `trackOrders` (S2); `STATUS_META` (S6); `StatusStepper` (S6); `Button`, `Input`, `Card` (`@/common/ui/components/*`); `useParams`, `Link`, `useNavigate` (react-router).
- Produces: default exports `MyOrdersPage`, `OrderDetail`. `MyOrdersPage` fetches views for all tracked orders on mount via `trackOrders`.

- [ ] **Step 1: Implement `TrackOrderForm.tsx`** (manual add; verifies before saving):

```tsx
import { useState } from "react";
import { Button } from "@/common/ui/components/button";
import { Input } from "@/common/ui/components/input";
import { trackOrders } from "../data/orderTracking";
import { addTrackedOrder } from "../data/trackedOrders";

export default function TrackOrderForm({ onAdded }: { onAdded: () => void }) {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await trackOrders([{ orderNumber: orderNumber.trim(), phone: phone.trim() }]);
    setLoading(false);
    if (res.type === "success" && res.data.length === 1) {
      addTrackedOrder({ orderNumber: res.data[0].orderNumber, phone: phone.trim(), status: res.data[0].status });
      setOrderNumber(""); setPhone("");
      onAdded();
    } else {
      setError("We couldn't find an order with that number and phone.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">Track another order</h2>
      <Input placeholder="Order number (e.g. IB-7QX2M9)" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
      <Input placeholder="Phone used at checkout" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>{loading ? "Checking…" : "Track order"}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Implement `MyOrdersPage.tsx`** (mobile-first list; fetches all tracked views on mount):

```tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { getTrackedOrders } from "../data/trackedOrders";
import { trackOrders } from "../data/orderTracking";
import { TrackedOrderView } from "../data/orderTypes";
import { STATUS_META } from "../data/statusMeta";
import TrackOrderForm from "./TrackOrderForm";

export default function MyOrdersPage() {
  const [views, setViews] = useState<TrackedOrderView[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const tracked = getTrackedOrders();
    if (tracked.length === 0) { setViews([]); setLoading(false); return; }
    setLoading(true);
    const res = await trackOrders(tracked.map((t) => ({ orderNumber: t.orderNumber, phone: t.phone })));
    setViews(res.type === "success" ? res.data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">My Orders</h1>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : views.length === 0 ? (
        <div className="mb-6 rounded-xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">You have no tracked orders yet.</p>
          <Button asChild className="mt-4"><Link to="/products">Shop now</Link></Button>
        </div>
      ) : (
        <ul className="mb-6 space-y-3">
          {views.map((v) => (
            <li key={v.orderNumber}>
              <Link to={`/orders/${v.orderNumber}`} className="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{v.orderNumber}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[v.status].badgeClass}`}>{STATUS_META[v.status].label}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{new Date(v.createdAt).toLocaleDateString()}</span>
                  <span className="font-semibold text-foreground">${v.total.toFixed(2)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TrackOrderForm onAdded={load} />
    </div>
  );
}
```

- [ ] **Step 3: Implement `OrderDetail.tsx`** (deep-linkable `/orders/:orderNumber`):

```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/common/ui/components/button";
import { getTrackedOrders, removeTrackedOrder } from "../data/trackedOrders";
import { trackOrders } from "../data/orderTracking";
import { TrackedOrderView } from "../data/orderTypes";
import { STATUS_META } from "../data/statusMeta";
import { StatusStepper } from "./StatusStepper";

export default function OrderDetail() {
  const { orderNumber = "" } = useParams();
  const [view, setView] = useState<TrackedOrderView | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    const tracked = getTrackedOrders().find((t) => t.orderNumber === orderNumber);
    if (!tracked) { setState("missing"); return; }
    trackOrders([{ orderNumber: tracked.orderNumber, phone: tracked.phone }]).then((res) => {
      if (res.type === "success" && res.data.length === 1) { setView(res.data[0]); setState("ok"); }
      else setState("missing");
    });
  }, [orderNumber]);

  if (state === "loading") return <div className="mx-auto max-w-2xl px-4 py-8"><p className="text-muted-foreground">Loading…</p></div>;
  if (state === "missing" || !view)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">We couldn't load that order.</p>
        <Button asChild className="mt-4"><Link to="/orders">Back to my orders</Link></Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/orders" className="text-sm text-muted-foreground hover:underline">← My Orders</Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{view.orderNumber}</h1>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[view.status].badgeClass}`}>{STATUS_META[view.status].label}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {view.itemCount} {view.itemCount === 1 ? "item" : "items"} · ${view.total.toFixed(2)} · updated {new Date(view.updatedAt).toLocaleString()}
      </p>
      <div className="mt-6 rounded-xl border bg-card p-6"><StatusStepper status={view.status} /></div>
      <Button variant="ghost" className="mt-6 text-red-600" onClick={() => { removeTrackedOrder(view.orderNumber); history.back(); }}>
        Stop tracking this order
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck** — `pnpm exec tsc -b` → no errors.
- [ ] **Step 5: Commit** — `git add src/features/orders/ui/TrackOrderForm.tsx src/features/orders/ui/MyOrdersPage.tsx src/features/orders/ui/OrderDetail.tsx && git commit -m "feat(orders): my-orders list, detail, and manual track form"`

---

## Task S9: Wire routes, Navbar bell, and auto-add on checkout

**Repo:** `issa-beauty`

**Files:**
- Modify: `src/App.tsx` (add two routes)
- Modify: `src/layout/ui/Navbar.tsx` (add bell + "My Orders" link)
- Modify: `src/features/checkout/ui/OrderConfirmation.tsx` (auto-add tracked order + "Track your order" button)

**Interfaces:**
- Consumes: `MyOrdersPage`, `OrderDetail` (S8); `OrderNotificationsBell` (S7); `addTrackedOrder` (S1); `OrderStatus` (S1).

- [ ] **Step 1: Add routes** in `src/App.tsx` — import at top:

```tsx
import MyOrdersPage from "@/features/orders/ui/MyOrdersPage";
import OrderDetail from "@/features/orders/ui/OrderDetail";
```

Add to the `children` array (after the `checkout/success` route):

```tsx
{ path: "orders", element: <MyOrdersPage /> },
{ path: "orders/:orderNumber", element: <OrderDetail /> },
```

- [ ] **Step 2: Add the bell + link to `Navbar.tsx`** — import:

```tsx
import { Link } from "react-router-dom"; // already imported
import { Package } from "lucide-react";
import OrderNotificationsBell from "@/features/orders/ui/OrderNotificationsBell";
```

Inside the right-hand controls container (the `div` with `CartSheet`), immediately before `<CartSheet />` add:

```tsx
<Button asChild variant="ghost" size="icon" aria-label="My orders">
  <Link to="/orders"><Package className="h-5 w-5" /></Link>
</Button>
<OrderNotificationsBell />
```

- [ ] **Step 3: Auto-add on confirmation** in `OrderConfirmation.tsx` — import:

```tsx
import { addTrackedOrder } from "@/features/orders/data/trackedOrders";
import { OrderStatus } from "@/features/orders/data/orderTypes";
```

In the `useEffect` that parses `lastOrder`, after `setOrder(parsed)`, add:

```tsx
addTrackedOrder({ orderNumber: parsed.orderNumber, phone: parsed.customer.phone, status: (parsed.status as OrderStatus) ?? "pending" });
```

And add a "Track your order" button before "Continue shopping":

```tsx
<Button asChild variant="outline" className="mt-8 w-full">
  <Link to={`/orders/${order.orderNumber}`}>Track your order</Link>
</Button>
```

- [ ] **Step 4: Typecheck + build** — `pnpm exec tsc -b && pnpm build` → succeeds.
- [ ] **Step 5: Run full storefront test suite** — `pnpm test` → all green.
- [ ] **Step 6: Commit** — `git add src/App.tsx src/layout/ui/Navbar.tsx src/features/checkout/ui/OrderConfirmation.tsx && git commit -m "feat(orders): routes, navbar bell + link, auto-track on checkout"`

---

## Task S10: End-to-end verification (manual, with backend running)

**Repo:** both

- [ ] **Step 1:** Start backend (`cd issa-beauty-backend && PORT=5002 pnpm dev`) and storefront (`cd issa-beauty && PORT=5002 pnpm dev`, so the Vite proxy targets the backend).
- [ ] **Step 2:** Place an order via checkout → confirm it appears under `/orders` and a "Track your order" button deep-links to `/orders/:orderNumber` with the stepper.
- [ ] **Step 3:** In the dashboard (or via Mongo), change that order's status → within ~60s (or on tab refocus) the bell shows an unread badge, a toast fires, and the detail stepper advances.
- [ ] **Step 4:** Use "Track another order" with a valid number+phone → it's added; with a bad phone → inline error.
- [ ] **Step 5:** Verify mobile layout in device emulation (touch): cards stack, bell popover is reachable, tap targets are comfortable.

---

## Notes for the executor

- **Task ordering / parallelism:** B1→B2 (backend, independent repo). Storefront: S0 first; then S1, S5 can run in parallel; S2, S3, S6 depend on S1; S4 depends on S2+S3+S6; S7 depends on S4+S5+S6; S8 depends on S1+S2+S6; S9 depends on S7+S8. B1/B2 can run fully parallel to the storefront track.
- Worker subagents implement + run tests/typecheck but **do not commit**; the orchestrator reviews and commits each task.
