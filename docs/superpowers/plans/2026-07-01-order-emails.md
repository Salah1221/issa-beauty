# Order Emails (Resend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send transactional order emails via Resend — order confirmation + owner alert from the storefront, and status-update emails from the dashboard.

**Architecture:** Each backend gets a `server/email.js` with pure `{subject,html}` builders plus one `sendEmail()` that calls Resend. Sends are fire-and-forget and guarded so they never break checkout or status changes; the module no-ops when the `RESEND` key is unset.

**Tech Stack:** Node/Express (ESM), Mongoose, `resend` SDK, Vitest + supertest + mongodb-memory-server (already configured in both repos).

## Global Constraints

- Two repos: **storefront** = `/home/salah/Projects/issa-beauty`, **dashboard** = `/home/salah/Projects/issa-beauty-dashboard`. Both are on branch `feat/order-emails`. Tasks 1–2 are storefront; Tasks 3–4 are dashboard.
- API key env var is exactly `RESEND`. Owner recipient env var is exactly `STORE_ORDER_EMAIL` (storefront only).
- Sender constant (both repos): `ISSA Beauty <orders@send.issabeauty.org>`.
- ESM (`import`/`export`).
- Customer emails send only when `order.customer.email` is present.
- Sends are **not awaited** by the HTTP response and are wrapped in `.catch(...)`; `sendEmail` no-ops with a warning when `process.env.RESEND` is unset.
- Money formatting: `$` + `.toFixed(2)`.
- Response envelope stays `{ success, data?, message? }`; email work must not change status codes.

---

## Task 1: Storefront — `email.js` module + builder tests

**Repo:** storefront (`/home/salah/Projects/issa-beauty`)

**Files:**
- Modify: `package.json` (add `resend`), `.env` docs via `.env.example` if present (else skip .env.example)
- Create: `server/email.js`
- Create: `server/email.test.js`

**Interfaces:**
- Produces: `sendEmail({to,subject,html}): Promise<void>`, `orderConfirmationEmail(order): {subject,html}`, `newOrderNotificationEmail(order): {subject,html}` — all from `server/email.js`.

- [ ] **Step 1: Install the Resend SDK**

Run (root is a standalone package): `pnpm add resend`
Expected: `resend` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing builder tests**

Create `server/email.test.js`:
```js
import { describe, it, expect } from "vitest";
import { orderConfirmationEmail, newOrderNotificationEmail } from "./email.js";

const order = {
  orderNumber: "IB-ABC123",
  items: [
    { name: "Lipstick", quantity: 2, lineTotal: 20 },
    { name: "Serum", quantity: 1, lineTotal: 10 },
  ],
  subtotal: 30,
  deliveryFee: 3,
  total: 33,
  customer: { fullName: "Jane Doe", phone: "+961 70123456", email: "jane@example.com" },
  shipping: { address: "1 Hamra St", city: "Beirut", area: "Hamra", notes: "ring twice" },
  paymentMethod: "cod",
};

describe("orderConfirmationEmail", () => {
  it("subject references the order number", () => {
    expect(orderConfirmationEmail(order).subject).toContain("IB-ABC123");
  });
  it("html shows the total, an item and the delivery city", () => {
    const { html } = orderConfirmationEmail(order);
    expect(html).toContain("$33.00");
    expect(html).toContain("Lipstick");
    expect(html).toContain("Beirut");
  });
});

describe("newOrderNotificationEmail", () => {
  it("subject includes the total for a quick glance", () => {
    expect(newOrderNotificationEmail(order).subject).toContain("$33.00");
  });
  it("html leads with customer phone for fulfilment", () => {
    expect(newOrderNotificationEmail(order).html).toContain("+961 70123456");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test -- server/email.test.js`
Expected: FAIL — cannot find module `./email.js`.

- [ ] **Step 4: Implement `server/email.js`**

```js
import { Resend } from "resend";

const FROM = "ISSA Beauty <orders@send.issabeauty.org>";
const resend = process.env.RESEND ? new Resend(process.env.RESEND) : null;

const money = (n) => `$${Number(n).toFixed(2)}`;

function shell(heading, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#faf7f5;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="font-size:22px;font-weight:700;color:#e11d63;letter-spacing:0.5px;">ISSA Beauty</div>
      <h1 style="font-size:18px;margin:16px 0;">${heading}</h1>
      ${bodyHtml}
      <p style="margin-top:24px;font-size:12px;color:#8a8a8a;">ISSA Beauty · Automated message, please don't reply.</p>
    </div>
  </body></html>`;
}

function itemsTable(order) {
  const rows = order.items
    .map(
      (it) =>
        `<tr><td style="padding:6px 0;">${it.name} × ${it.quantity}</td><td style="padding:6px 0;text-align:right;">${money(it.lineTotal)}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
    ${rows}
    <tr><td colspan="2" style="border-top:1px solid #eee;padding-top:8px;"></td></tr>
    <tr><td style="padding:2px 0;color:#666;">Subtotal</td><td style="text-align:right;">${money(order.subtotal)}</td></tr>
    <tr><td style="padding:2px 0;color:#666;">Delivery</td><td style="text-align:right;">${money(order.deliveryFee)}</td></tr>
    <tr><td style="padding:6px 0;font-weight:700;">Total</td><td style="text-align:right;font-weight:700;">${money(order.total)}</td></tr>
  </table>`;
}

function addressBlock(order) {
  const s = order.shipping || {};
  const area = s.area ? `, ${s.area}` : "";
  const notes = s.notes ? `<br/><span style="color:#666;">Notes: ${s.notes}</span>` : "";
  return `<p style="font-size:14px;line-height:1.5;">${order.customer.fullName}<br/>${order.customer.phone}<br/>${s.address}${area}, ${s.city}${notes}</p>`;
}

export function orderConfirmationEmail(order) {
  const firstName = order.customer.fullName.split(" ")[0];
  const html = shell(
    `Thanks for your order, ${firstName}!`,
    `<p style="font-size:14px;">Your order <strong>${order.orderNumber}</strong> is confirmed. Payment is <strong>cash on delivery</strong>.</p>
     <h2 style="font-size:14px;margin:20px 0 8px;">Order</h2>${itemsTable(order)}
     <h2 style="font-size:14px;margin:20px 0 8px;">Delivery to</h2>${addressBlock(order)}`,
  );
  return { subject: `Order ${order.orderNumber} confirmed — ISSA Beauty`, html };
}

export function newOrderNotificationEmail(order) {
  const email = order.customer.email ? ` · ${order.customer.email}` : "";
  const html = shell(
    `New order ${order.orderNumber}`,
    `<p style="font-size:14px;"><strong>${order.customer.fullName}</strong> · ${order.customer.phone}${email}</p>
     ${itemsTable(order)}
     <h2 style="font-size:14px;margin:20px 0 8px;">Deliver to</h2>${addressBlock(order)}
     <p style="font-size:13px;color:#666;">Cash on delivery.</p>`,
  );
  return { subject: `New order ${order.orderNumber} — ${money(order.total)}`, html };
}

export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn("RESEND not set; skipping email:", subject);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- server/email.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Document env vars**

If `.env.example` exists at repo root, append:
```
RESEND=
STORE_ORDER_EMAIL=
```
If it does not exist, create it with those two lines.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml server/email.js server/email.test.js .env.example
git commit -m "feat(server): add Resend email module (order confirmation + owner alert)"
```

---

## Task 2: Storefront — wire emails into `POST /api/orders`

**Repo:** storefront (`/home/salah/Projects/issa-beauty`)

**Files:**
- Modify: `server/app.js`
- Create: `server/order.email.routes.test.js`

**Interfaces:**
- Consumes: `sendEmail`, `orderConfirmationEmail`, `newOrderNotificationEmail` from `./email.js`.
- Behavior: after the order is saved and before returning, fire (un-awaited, guarded) the customer confirmation (if `saved.customer.email`) and the owner alert (if `process.env.STORE_ORDER_EMAIL`).

- [ ] **Step 1: Write the failing route test**

Create `server/order.email.routes.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const { mail } = vi.hoisted(() => ({ mail: { sent: [], mode: "resolve" } }));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload) => {
        mail.sent.push(payload);
        if (mail.mode === "reject") throw new Error("resend boom");
        return { id: "test" };
      },
    };
  },
}));

let mongo, app, Product, Order;

beforeAll(async () => {
  process.env.RESEND = "test-key";
  process.env.STORE_ORDER_EMAIL = "owner@example.com";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  ({ default: app } = await import("./app.js"));
  ({ Product, Order } = await import("./models/models.js"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Product.deleteMany({});
  await Order.deleteMany({});
  mail.sent = [];
  mail.mode = "resolve";
});

const body = (productId, over = {}) => ({
  items: [{ productId, quantity: 1 }],
  customer: { fullName: "Jane Doe", phone: "70123456", email: "jane@example.com", ...over },
  shipping: { address: "1 St", city: "Beirut" },
});

const makeProduct = () =>
  Product.create({ name: "X", category: "c", price: 10, imageUrl: "u", description: "d", in_stock: true });

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("order emails on POST /api/orders", () => {
  it("sends a customer confirmation and an owner alert", async () => {
    const p = await makeProduct();
    const res = await request(app).post("/api/orders").send(body(String(p._id)));
    expect(res.status).toBe(201);
    await flush();
    const recipients = mail.sent.map((m) => m.to);
    expect(recipients).toContain("jane@example.com");
    expect(recipients).toContain("owner@example.com");
  });

  it("skips the customer email when no email is given (owner alert still sent)", async () => {
    const p = await makeProduct();
    const b = body(String(p._id));
    delete b.customer.email;
    const res = await request(app).post("/api/orders").send(b);
    expect(res.status).toBe(201);
    await flush();
    const recipients = mail.sent.map((m) => m.to);
    expect(recipients).not.toContain("jane@example.com");
    expect(recipients).toContain("owner@example.com");
  });

  it("still returns 201 and persists the order when sending rejects", async () => {
    mail.mode = "reject";
    const p = await makeProduct();
    const res = await request(app).post("/api/orders").send(body(String(p._id)));
    expect(res.status).toBe(201);
    await flush();
    expect(await Order.countDocuments()).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- server/order.email.routes.test.js`
Expected: FAIL — no emails captured (`mail.sent` empty) because the route doesn't send yet.

- [ ] **Step 3: Wire the sends into `server/app.js`**

Add to the imports near the top (with the other `./` imports):
```js
import { sendEmail, orderConfirmationEmail, newOrderNotificationEmail } from "./email.js";
```
In the `POST /api/orders` handler, immediately after the order is saved (after the retry loop sets `saved`, and before `res.status(201).json(...)`), add:
```js
    if (saved.customer?.email) {
      const { subject, html } = orderConfirmationEmail(saved);
      sendEmail({ to: saved.customer.email, subject, html }).catch((e) =>
        console.error("order confirmation email failed", e),
      );
    }
    if (process.env.STORE_ORDER_EMAIL) {
      const { subject, html } = newOrderNotificationEmail(saved);
      sendEmail({ to: process.env.STORE_ORDER_EMAIL, subject, html }).catch((e) =>
        console.error("new-order alert failed", e),
      );
    }
```
(Do not `await` these; the `res.status(201).json({ success: true, data: saved })` line stays as-is right after.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- server/order.email.routes.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full storefront server suite**

Run: `pnpm test`
Expected: PASS (existing order/app tests + the two new email test files).

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/order.email.routes.test.js
git commit -m "feat(server): email order confirmation + owner alert on new order"
```

---

## Task 3: Dashboard — `email.js` module + builder tests

**Repo:** dashboard (`/home/salah/Projects/issa-beauty-dashboard`)

**Files:**
- Modify: `package.json` (add `resend`), `.env.example`
- Create: `server/email.js`
- Create: `server/email.test.js`

**Interfaces:**
- Produces: `sendEmail({to,subject,html}): Promise<void>`, `statusUpdateEmail(order): {subject,html} | null` — from `server/email.js`. Returns `null` unless `order.status` is `confirmed | delivered | cancelled`.

- [ ] **Step 1: Install the Resend SDK**

Run: `pnpm add resend`
Expected: `resend` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing builder tests**

Create `server/email.test.js`:
```js
import { describe, it, expect } from "vitest";
import { statusUpdateEmail } from "./email.js";

const base = {
  orderNumber: "IB-XYZ789",
  total: 23,
  customer: { fullName: "Jane Doe", phone: "+961 70123456", email: "jane@example.com" },
};

describe("statusUpdateEmail", () => {
  it("returns null for pending (no email for that status)", () => {
    expect(statusUpdateEmail({ ...base, status: "pending" })).toBeNull();
  });
  it("builds a confirmed email referencing the order number", () => {
    const built = statusUpdateEmail({ ...base, status: "confirmed" });
    expect(built).not.toBeNull();
    expect(built.subject.toLowerCase()).toContain("confirmed");
    expect(built.html).toContain("IB-XYZ789");
  });
  it("builds delivered and cancelled emails", () => {
    expect(statusUpdateEmail({ ...base, status: "delivered" }).subject.toLowerCase()).toContain("delivered");
    expect(statusUpdateEmail({ ...base, status: "cancelled" }).subject.toLowerCase()).toContain("cancelled");
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm test -- server/email.test.js`
Expected: FAIL — cannot find module `./email.js`.

- [ ] **Step 4: Implement `server/email.js`**

```js
import { Resend } from "resend";

const FROM = "ISSA Beauty <orders@send.issabeauty.org>";
const resend = process.env.RESEND ? new Resend(process.env.RESEND) : null;

const money = (n) => `$${Number(n).toFixed(2)}`;

function shell(heading, bodyHtml) {
  return `<!DOCTYPE html><html><body style="margin:0;background:#faf7f5;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="font-size:22px;font-weight:700;color:#e11d63;letter-spacing:0.5px;">ISSA Beauty</div>
      <h1 style="font-size:18px;margin:16px 0;">${heading}</h1>
      ${bodyHtml}
      <p style="margin-top:24px;font-size:12px;color:#8a8a8a;">ISSA Beauty · Automated message, please don't reply.</p>
    </div>
  </body></html>`;
}

const STATUS_COPY = {
  confirmed: {
    subject: "confirmed",
    heading: "Your order is confirmed",
    line: "We're preparing your order for delivery.",
  },
  delivered: {
    subject: "delivered",
    heading: "Your order has been delivered",
    line: "Thank you for shopping with ISSA Beauty!",
  },
  cancelled: {
    subject: "cancelled",
    heading: "Your order was cancelled",
    line: "Your order has been cancelled. If this is unexpected, please contact us.",
  },
};

export function statusUpdateEmail(order) {
  const copy = STATUS_COPY[order.status];
  if (!copy) return null;
  const html = shell(
    copy.heading,
    `<p style="font-size:14px;">${copy.line}</p>
     <p style="font-size:14px;">Order <strong>${order.orderNumber}</strong> · Total ${money(order.total)}</p>`,
  );
  return { subject: `Order ${order.orderNumber} ${copy.subject} — ISSA Beauty`, html };
}

export async function sendEmail({ to, subject, html }) {
  if (!resend) {
    console.warn("RESEND not set; skipping email:", subject);
    return;
  }
  await resend.emails.send({ from: FROM, to, subject, html });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- server/email.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Document env vars**

Append to `.env.example` (create if missing):
```
RESEND=
```

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml server/email.js server/email.test.js .env.example
git commit -m "feat(server): add Resend email module (order status updates)"
```

---

## Task 4: Dashboard — wire email into `PATCH /api/orders/:id/status`

**Repo:** dashboard (`/home/salah/Projects/issa-beauty-dashboard`)

**Files:**
- Modify: `server/app.js`
- Create: `server/order.email.routes.test.js`

**Interfaces:**
- Consumes: `sendEmail`, `statusUpdateEmail` from `./email.js`.
- Behavior: after the status update succeeds, if `statusUpdateEmail(order)` is non-null and `order.customer.email` exists, fire (un-awaited, guarded) the send. Response is unchanged.

- [ ] **Step 1: Write the failing route test**

Create `server/order.email.routes.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const { mail } = vi.hoisted(() => ({ mail: { sent: [], mode: "resolve" } }));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload) => {
        mail.sent.push(payload);
        if (mail.mode === "reject") throw new Error("resend boom");
        return { id: "test" };
      },
    };
  },
}));

let mongo, app, Order, AdminAuth, hashPassword;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.IMAGEKIT_PUBLIC_KEY = "x";
  process.env.IMAGEKIT_PRIVATE_KEY = "x";
  process.env.IMAGEKIT_URL_ENDPOINT = "https://example.com";
  process.env.RESEND = "test-key";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  ({ default: app } = await import("./app.js"));
  ({ Order, AdminAuth } = await import("./models.js"));
  ({ hashPassword } = await import("./auth.js"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const makeOrder = (over = {}) =>
  Order.create({
    orderNumber: "IB-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    items: [{ productId: new mongoose.Types.ObjectId(), name: "X", unitPrice: 10, discountPercentage: 0, quantity: 1, lineTotal: 10, imageUrl: "u" }],
    subtotal: 10, deliveryFee: 3, total: 13,
    customer: { fullName: "Jane", phone: "70123456", email: "jane@example.com" },
    shipping: { address: "1 St", city: "Beirut" },
    ...over,
  });

async function agent() {
  const a = request.agent(app);
  await a.post("/api/auth/login").send({ password: "letmein" });
  return a;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  await Order.deleteMany({});
  await AdminAuth.deleteMany({});
  await AdminAuth.create({ passwordHash: await hashPassword("letmein") });
  mail.sent = [];
  mail.mode = "resolve";
});

describe("status-update emails on PATCH /api/orders/:id/status", () => {
  it("emails the customer when moved to confirmed", async () => {
    const o = await makeOrder({ status: "pending" });
    const a = await agent();
    const res = await a.patch(`/api/orders/${o._id}/status`).send({ status: "confirmed" });
    expect(res.status).toBe(200);
    await flush();
    expect(mail.sent.map((m) => m.to)).toContain("jane@example.com");
  });

  it("does not email when the order has no customer email", async () => {
    const o = await makeOrder({ status: "pending", customer: { fullName: "No Email", phone: "70000000" } });
    const a = await agent();
    const res = await a.patch(`/api/orders/${o._id}/status`).send({ status: "delivered" });
    expect(res.status).toBe(200);
    await flush();
    expect(mail.sent).toHaveLength(0);
  });

  it("still returns 200 when the email send rejects", async () => {
    mail.mode = "reject";
    const o = await makeOrder({ status: "pending" });
    const a = await agent();
    const res = await a.patch(`/api/orders/${o._id}/status`).send({ status: "cancelled" });
    expect(res.status).toBe(200);
    await flush();
    expect(res.body.data.status).toBe("cancelled");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- server/order.email.routes.test.js`
Expected: FAIL — `mail.sent` empty (route doesn't send yet).

- [ ] **Step 3: Wire the send into `server/app.js`**

Add to the imports near the top:
```js
import { sendEmail, statusUpdateEmail } from "./email.js";
```
In the `PATCH /api/orders/:id/status` handler, after the `order` is updated (`findByIdAndUpdate(..., { new: true })`) and the not-found check, and before `res.status(200).json(...)`, add:
```js
    const built = statusUpdateEmail(order);
    if (built && order.customer?.email) {
      sendEmail({ to: order.customer.email, ...built }).catch((e) =>
        console.error("status email failed", e),
      );
    }
```
(Do not `await`; the existing 200 response stays right after.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- server/order.email.routes.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full dashboard server suite**

Run: `pnpm test`
Expected: PASS (existing auth/app/order tests + the two new email test files).

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/order.email.routes.test.js
git commit -m "feat(server): email the customer on order status change"
```

---

## Final verification

- [ ] Storefront: `pnpm test` green; dashboard: `pnpm test` green.
- [ ] Manual (optional, needs a real `RESEND` key + verified domain): set `RESEND` and `STORE_ORDER_EMAIL`, place a test order with a real email → confirmation + owner alert arrive; change its status in the dashboard → status email arrives.
