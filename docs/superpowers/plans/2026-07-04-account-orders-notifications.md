# Account-Synced Orders + Revived Notifications — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Make `/orders` account-backed (server-fetched, linked at checkout) and revive logged-in-only in-app status notifications.

**Architecture:** Backend adds `GET /api/orders/mine` (auth) + links `user` at checkout + drops the guest track endpoint. Storefront drops the guest localStorage tracking and fetches the account's orders; the notification bell (recovered from git) polls `/api/orders/mine` and is shown only when logged in.

## Global Constraints
- **Repos:** backend `/home/salah/Projects/issa-beauty-backend`; storefront `/home/salah/Projects/issa-beauty`. Both on branch `feat/account-orders`.
- **Recover removed files from commit `8e2f5d6`** (storefront) where noted, e.g. `git show 8e2f5d6:<path> > <path>`.
- Order statuses: `"pending"|"confirmed"|"delivered"|"cancelled"`. Response envelope `{success,message?,data?}`; client uses `request`/`ApiResult`.
- Skip rate limiters under `NODE_ENV==="test"`. Do NOT modify admin auth.
- **Commits:** worker subagents implement + test but DO NOT commit; the orchestrator reviews and commits each task.

---

## Task OA1: Backend — link orders to user, `GET /api/orders/mine`, remove track

**Repo:** backend. **Files:** Modify `src/auth.ts`, `src/routes/public.ts`, `src/orders.ts` (remove `validateTrackInput` if now unused — keep `projectTrackedOrder`); Modify/trim `src/routes/public.orders.test.ts`.

**Produces:** `optionalUser(req): string | null` in auth.ts; `GET /api/orders/mine` (requireUser); `POST /api/orders` sets `user`.

- [ ] **Step 1 — auth.ts:** append:
```ts
export function optionalUser(req: Request): string | null {
  const token = req.cookies?.[CUSTOMER_COOKIE];
  const payload = token ? verifyToken(token) : null;
  if (!payload || typeof payload === "string" || (payload as { role?: string }).role !== "customer") return null;
  return ((payload as { sub?: string }).sub) ?? null;
}
```

- [ ] **Step 2 — failing tests** appended to `src/routes/public.orders.test.ts` (import `signUserToken` from `../auth.js` and `User` if needed; reuse the existing app/supertest/mongo harness). Also DELETE the existing `POST /api/orders/track` describe block in this file.
```ts
import { signUserToken } from "../auth.js";
describe("GET /api/orders/mine", () => {
  it("401s without a customer cookie", async () => {
    const res = await request(app).get("/api/orders/mine");
    expect(res.status).toBe(401);
  });
  it("returns only the authenticated user's orders, newest first", async () => {
    const uid = "507f1f77bcf86cd799439099";
    await Order.create({ orderNumber: "IB-MINE01", user: uid, items: [{ productId: "507f1f77bcf86cd799439011", name: "n", unitPrice: 5, discountPercentage: 0, quantity: 1, lineTotal: 5, imageUrl: "img" }], subtotal: 5, deliveryFee: 3, total: 8, customer: { fullName: "J", phone: "03" }, shipping: { address: "a", city: "c" }, status: "pending" });
    await Order.create({ orderNumber: "IB-OTHER1", user: "507f1f77bcf86cd799439098", items: [{ productId: "507f1f77bcf86cd799439011", name: "n", unitPrice: 5, discountPercentage: 0, quantity: 1, lineTotal: 5, imageUrl: "img" }], subtotal: 5, deliveryFee: 3, total: 8, customer: { fullName: "K", phone: "04" }, shipping: { address: "b", city: "d" }, status: "pending" });
    const res = await request(app).get("/api/orders/mine").set("Cookie", `customer_token=${signUserToken(uid)}`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((o: { orderNumber: string }) => o.orderNumber)).toEqual(["IB-MINE01"]);
  });
});
describe("POST /api/orders user linking", () => {
  it("links the order to the logged-in user", async () => {
    const uid = "507f1f77bcf86cd799439097";
    // Build a valid order body the same way the existing 'places an order' test does;
    // reuse that test's product-seeding + payload helper. Send with the customer cookie:
    const res = await request(app).post("/api/orders").set("Cookie", `customer_token=${signUserToken(uid)}`).send(VALID_ORDER_BODY);
    expect(res.status).toBe(201);
    const saved = await Order.findOne({ orderNumber: res.body.data.orderNumber });
    expect(String(saved!.user)).toBe(uid);
  });
});
```
(Use the existing file's product-seeding + valid-order payload for `VALID_ORDER_BODY`; mirror the existing "places an order" test exactly for setup.)

- [ ] **Step 3 — run, expect FAIL:** `pnpm test -- src/routes/public.orders.test.ts`.

- [ ] **Step 4 — implement** in `src/routes/public.ts`:
  - Import: add `requireUser, optionalUser` to the `../auth.js` import; ensure `projectTrackedOrder` still imported; remove `validateTrackInput` from imports.
  - **Delete** the `publicRouter.post("/orders/track", ...)` handler.
  - In the `POST /orders` handler, where the order is created, capture the user and set it:
    ```ts
    const userId = optionalUser(req);
    saved = await Order.create({ ...doc, orderNumber: generateOrderNumber(), user: userId ?? null });
    ```
    (apply to the create call inside the existing retry loop).
  - Add the mine route:
    ```ts
    publicRouter.get("/orders/mine", requireUser, async (req, res) => {
      try {
        const userId = (req as express.Request & { userId?: string }).userId;
        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: orders.map(projectTrackedOrder) });
      } catch (err) {
        res.status(500).json({ success: false, message: (err as Error).message });
      }
    });
    ```
  - In `src/orders.ts`, remove `validateTrackInput` and `TrackPair`/`MAX_TRACK_BATCH` **only if** nothing else references them (grep first). Keep `projectTrackedOrder` + `TrackedOrderView`. Remove the now-dead `validateTrackInput` unit tests from `src/orders.test.ts`.

- [ ] **Step 5 — run, expect PASS**, then full `pnpm test` (the pre-existing `index.test.ts` port failure is unrelated). **Step 6 — commit:** `feat(orders): link orders to account + GET /api/orders/mine; drop guest track`.

---

## Task OA2: Storefront — orders client + revived notification store/hook

**Repo:** storefront. **Files:** Create `src/features/orders/data/orders.ts`; Recover `src/common/utils/useMediaQuery.ts` (from 8e2f5d6, as-is); Create `src/features/orders/data/notifications.ts` + `notifications.test.ts`; Create `src/features/orders/data/useOrderNotifications.ts`.

- [ ] **Step 1 — orders client** `src/features/orders/data/orders.ts`:
```ts
import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";
import { TrackedOrderView } from "./orderTypes";

export const getMyOrders = (): Promise<ApiResult<TrackedOrderView[]>> =>
  request<TrackedOrderView[]>({ url: "/api/orders/mine", method: "GET" });
```

- [ ] **Step 2 — recover** `src/common/utils/useMediaQuery.ts`: `git show 8e2f5d6:src/common/utils/useMediaQuery.ts > src/common/utils/useMediaQuery.ts`.

- [ ] **Step 3 — failing tests** `src/features/orders/data/notifications.test.ts`:
```ts
import { diffStatuses, getLastSeen, setLastSeen, addNotifications, getNotifications, markAllRead, unreadCount } from "./notifications";
import { TrackedOrderView } from "./orderTypes";
const view = (n: string, s: TrackedOrderView["status"]): TrackedOrderView => ({ orderNumber: n, status: s, total: 1, itemCount: 1, createdAt: "", updatedAt: "" });

describe("diffStatuses", () => {
  it("flags only orders seen before at a different status", () => {
    const changes = diffStatuses({ "IB-1": "pending", "IB-2": "confirmed" }, [view("IB-1", "confirmed"), view("IB-2", "confirmed"), view("IB-NEW", "pending")]);
    expect(changes).toEqual([{ orderNumber: "IB-1", status: "confirmed" }]);
  });
});
describe("per-user store", () => {
  it("keeps lastSeen and notifications separate per user key", () => {
    setLastSeen("a@x.com", { "IB-1": "pending" });
    expect(getLastSeen("a@x.com")).toEqual({ "IB-1": "pending" });
    expect(getLastSeen("b@x.com")).toEqual({});
    addNotifications("a@x.com", [{ orderNumber: "IB-1", status: "confirmed" }]);
    expect(getNotifications("a@x.com")).toHaveLength(1);
    expect(getNotifications("b@x.com")).toHaveLength(0);
    expect(unreadCount("a@x.com")).toBe(1);
    markAllRead("a@x.com");
    expect(unreadCount("a@x.com")).toBe(0);
  });
});
```

- [ ] **Step 4 — run, expect FAIL.** **Step 5 — implement** `src/features/orders/data/notifications.ts`:
```ts
import { OrderStatus, TrackedOrderView } from "./orderTypes";

const NOTES_PREFIX = "issa.orderNotifications.";
const SEEN_PREFIX = "issa.orderLastSeen.";
let seq = 0;

export type OrderNotification = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  at: string;
  read: boolean;
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getLastSeen(userKey: string): Record<string, OrderStatus> {
  const v = readJson<Record<string, OrderStatus>>(SEEN_PREFIX + userKey, {});
  return v && typeof v === "object" ? v : {};
}
export function setLastSeen(userKey: string, map: Record<string, OrderStatus>): void {
  localStorage.setItem(SEEN_PREFIX + userKey, JSON.stringify(map));
}

export function diffStatuses(
  lastSeen: Record<string, OrderStatus>,
  views: TrackedOrderView[],
): { orderNumber: string; status: OrderStatus }[] {
  const changes: { orderNumber: string; status: OrderStatus }[] = [];
  for (const v of views) {
    if (v.orderNumber in lastSeen && lastSeen[v.orderNumber] !== v.status) {
      changes.push({ orderNumber: v.orderNumber, status: v.status });
    }
  }
  return changes;
}

export function getNotifications(userKey: string): OrderNotification[] {
  const v = readJson<OrderNotification[]>(NOTES_PREFIX + userKey, []);
  return Array.isArray(v) ? v : [];
}
function saveNotifications(userKey: string, n: OrderNotification[]): void {
  localStorage.setItem(NOTES_PREFIX + userKey, JSON.stringify(n));
}
export function addNotifications(
  userKey: string,
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
  if (added.length) saveNotifications(userKey, [...added, ...getNotifications(userKey)].slice(0, 50));
  return added;
}
export function markAllRead(userKey: string): void {
  saveNotifications(userKey, getNotifications(userKey).map((n) => ({ ...n, read: true })));
}
export function unreadCount(userKey: string): number {
  return getNotifications(userKey).filter((n) => !n.read).length;
}
```

- [ ] **Step 6 — run, expect PASS.**

- [ ] **Step 7 — implement** `src/features/orders/data/useOrderNotifications.ts`:
```tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getMyOrders } from "./orders";
import { useAuth } from "@/features/auth/data/AuthContext";
import {
  diffStatuses, addNotifications, getNotifications, getLastSeen, setLastSeen,
  markAllRead as markAllReadStore, unreadCount as unreadCountStore, OrderNotification,
} from "./notifications";
import { STATUS_META } from "./statusMeta";

const POLL_MS = 60_000;

export function useOrderNotifications() {
  const { user } = useAuth();
  const userKey = user?.email ?? "";
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const inFlight = useRef(false);

  const sync = useCallback(() => {
    setNotifications(userKey ? getNotifications(userKey) : []);
    setUnread(userKey ? unreadCountStore(userKey) : 0);
  }, [userKey]);

  const refresh = useCallback(async () => {
    if (!userKey || inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await getMyOrders();
      if (res.type !== "success") return;
      const views = res.data;
      const lastSeen = getLastSeen(userKey);
      const changes = diffStatuses(lastSeen, views);
      const next = { ...lastSeen };
      for (const v of views) next[v.orderNumber] = v.status;
      setLastSeen(userKey, next);
      if (changes.length) {
        const added = addNotifications(userKey, changes);
        added.forEach((n) => toast(`Order ${n.orderNumber} is now ${STATUS_META[n.status].label}`));
      }
      sync();
    } finally {
      inFlight.current = false;
    }
  }, [userKey, sync]);

  const markAllRead = useCallback(() => {
    if (userKey) { markAllReadStore(userKey); sync(); }
  }, [userKey, sync]);

  useEffect(() => {
    sync();
    if (!userKey) return;
    refresh();
    const id = window.setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
    const onVis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, [userKey, refresh, sync]);

  return { notifications, unreadCount: unread, markAllRead, refresh };
}
```

- [ ] **Step 8 — `pnpm exec tsc -b`** (will fail until OA3 removes the old importers; acceptable if the only errors are unresolved references in files OA3 rewrites — otherwise fix). Run `pnpm test -- notifications` → PASS. **Step 9 — commit:** `feat(orders): account orders client + per-user notification store/hook`.

---

## Task OA3: Storefront — recover bell, rewrite pages, remove guest tracking, gate bell in navbar

**Repo:** storefront. **Files:** Recover `src/features/orders/ui/OrderNotificationsBell.tsx` (from 8e2f5d6); Rewrite `src/features/orders/ui/MyOrdersPage.tsx`, `src/features/orders/ui/OrderDetail.tsx`; Delete `src/features/orders/data/trackedOrders.ts` (+ test), `src/features/orders/data/orderTracking.ts`, `src/features/orders/ui/TrackOrderForm.tsx`; Modify `src/features/checkout/ui/OrderConfirmation.tsx` (remove auto-track), `src/layout/ui/Navbar.tsx` (gated bell).

- [ ] **Step 1 — recover the bell:** `git show 8e2f5d6:src/features/orders/ui/OrderNotificationsBell.tsx > src/features/orders/ui/OrderNotificationsBell.tsx`. It already consumes `useOrderNotifications()` (new signature is compatible) and navigates to `/orders/:orderNumber`. No changes needed.

- [ ] **Step 2 — delete guest machinery:**
```bash
git rm src/features/orders/data/trackedOrders.ts src/features/orders/data/trackedOrders.test.ts src/features/orders/data/orderTracking.ts src/features/orders/ui/TrackOrderForm.tsx
```

- [ ] **Step 3 — rewrite `MyOrdersPage.tsx`** to fetch the account's orders (no localStorage, no TrackOrderForm):
```tsx
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/common/ui/components/badge";
import { Button } from "@/common/ui/components/button";
import { getMyOrders } from "../data/orders";
import { TrackedOrderView } from "../data/orderTypes";
import { STATUS_META } from "../data/statusMeta";

type LoadState = "loading" | "ok" | "error";

export default function MyOrdersPage() {
  const [views, setViews] = useState<TrackedOrderView[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const load = useCallback(async () => {
    setState("loading");
    const res = await getMyOrders();
    if (res.type === "success") { setViews(res.data); setState("ok"); }
    else setState("error");
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold">My Orders</h1>
      {state === "loading" ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : state === "error" ? (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">We couldn't load your orders.</p>
          <Button className="mt-4" onClick={() => load()}>Retry</Button>
        </div>
      ) : views.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-center">
          <p className="text-muted-foreground">You have no orders yet.</p>
          <Button asChild className="mt-4"><Link to="/products">Shop now</Link></Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {views.map((v) => (
            <li key={v.orderNumber}>
              <Link to={`/orders/${v.orderNumber}`} className="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{v.orderNumber}</span>
                  <Badge variant="outline" className={`rounded-full border-transparent ${STATUS_META[v.status].badgeClass}`}>{STATUS_META[v.status].label}</Badge>
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
    </div>
  );
}
```

- [ ] **Step 4 — rewrite `OrderDetail.tsx`** to fetch from the account (drop "stop tracking"):
```tsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Badge } from "@/common/ui/components/badge";
import { Button } from "@/common/ui/components/button";
import { getMyOrders } from "../data/orders";
import { TrackedOrderView } from "../data/orderTypes";
import { STATUS_META } from "../data/statusMeta";
import { StatusStepper } from "./StatusStepper";

export default function OrderDetail() {
  const { orderNumber = "" } = useParams();
  const [view, setView] = useState<TrackedOrderView | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    getMyOrders().then((res) => {
      if (res.type === "success") {
        const found = res.data.find((o) => o.orderNumber === orderNumber) ?? null;
        setView(found); setState(found ? "ok" : "missing");
      } else setState("missing");
    });
  }, [orderNumber]);

  if (state === "loading") return <div className="mx-auto max-w-2xl px-4 py-8"><p className="text-muted-foreground">Loading…</p></div>;
  if (state === "missing" || !view)
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-center">
        <p className="text-muted-foreground">We couldn't find that order.</p>
        <Button asChild className="mt-4"><Link to="/orders">Back to my orders</Link></Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <Link to="/orders" className="text-sm text-muted-foreground hover:underline">← My Orders</Link>
      <div className="mt-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{view.orderNumber}</h1>
        <Badge variant="outline" className={`rounded-full border-transparent ${STATUS_META[view.status].badgeClass}`}>{STATUS_META[view.status].label}</Badge>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {view.itemCount} {view.itemCount === 1 ? "item" : "items"} · ${view.total.toFixed(2)} · updated {new Date(view.updatedAt).toLocaleString()}
      </p>
      <div className="mt-6 rounded-xl border bg-card p-6"><StatusStepper status={view.status} /></div>
    </div>
  );
}
```

- [ ] **Step 5 — `OrderConfirmation.tsx`**: remove the `addTrackedOrder({...})` call and the `import { addTrackedOrder }` / `import { OrderStatus }` lines added earlier (orders now link server-side). Keep the "Track your order" button linking to `/orders/${order.orderNumber}` (it will require login via the gate — acceptable).

- [ ] **Step 6 — Navbar**: import `OrderNotificationsBell` and `useAuth`; render the bell only when logged in, before `<AccountMenu />`:
```tsx
{user && <OrderNotificationsBell />}
```
(get `const { user } = useAuth();` in the Navbar component).

- [ ] **Step 7 — verify:** `pnpm exec tsc -b && pnpm build && pnpm test` → all green (no lingering imports of the deleted modules; grep to confirm none remain: `grep -rn "trackedOrders\|orderTracking\|TrackOrderForm" src` returns nothing).
- [ ] **Step 8 — commit:** `feat(orders): account-backed My Orders + logged-in notifications bell; remove guest tracking`.

---

## Task OA4: Manual E2E
- [ ] Log in; place an order while logged in → it appears under `/orders` (from the server). Change its status in the dashboard → within ~60s / on tab focus the bell badges + toasts, and the detail stepper advances. Log out → bell disappears, `/orders` redirects to `/login`.

## Notes for executor
- Order: OA1 (backend, independent repo) can run parallel to OA2→OA3 (storefront; OA3 depends on OA2). Worker subagents do NOT commit; orchestrator commits per task.
- After all tasks + final review, the branch merges into `feat/order-tracking`.
