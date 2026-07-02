# Issa Beauty Unified Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `issa-beauty-backend` — a single TypeScript Express/MongoDB backend that serves both the storefront (public) and dashboard (admin) APIs, replacing the duplicated JS backends in the `issa-beauty` and `issa-beauty-dashboard` repos.

**Architecture:** One Express app. Public routes live at `/api/*` (paths identical to today's storefront so its client needs zero changes); admin routes move under `/api/admin/*` (the dashboard client is repointed later). Shared logic (models, db, orders, email, auth, imagekit) lives in focused `src/*.ts` modules. Behavior is ported 1:1 from the existing servers; the port is TDD-locked by porting each existing test suite to TypeScript first.

**Tech Stack:** TypeScript (strict, NodeNext, ES2022), Express 4, Mongoose 8, jsonwebtoken, bcryptjs, cookie-parser, cors, helmet, express-rate-limit, multer, imagekit, resend, dotenv. Tests: vitest + supertest + mongodb-memory-server.

## Global Constraints

- **Location:** New repo lives at `/home/salah/Projects/issa-beauty-backend`. It is a **local git repo only** — do NOT `git push`, do NOT create a GitHub remote, do NOT create the repo on GitHub. (User will create it under `Salah1221` and push after testing.)
- **Do not touch** the existing `issa-beauty` or `issa-beauty-dashboard` repos or their running servers. This plan only creates the new repo. Read from them for porting; never modify them.
- **Package manager:** pnpm 10. **Node:** 22.
- **Module system:** ES modules (`"type": "module"`), TypeScript `module: NodeNext` — relative imports use `.js` extensions in TS source.
- **Backend port:** `5002` (default in code; overridable via `PORT` env). Old servers use 5000/5001.
- **Response envelope (never deviate):** success = `{ success: true, data, ...extras }`; error = `{ success: false, message }`. Pagination adds `total`, `page`, `pages`. Dashboard orders list adds `pendingCount`.
- **Route split:** public = `/api/*` (no auth, storefront shapes unchanged). admin = `/api/admin/*` (all `requireAuth` except login).
- **Cookie:** name `token`; `{ httpOnly: true, sameSite: "lax", secure: NODE_ENV === "production", maxAge: 30d }`. Do NOT use `SameSite=None`.
- **Never trust client prices** — order totals are always recomputed from the DB (`buildOrderDoc`).
- **No public order reads** — the public router must expose no route that returns order documents.
- **Emails are fire-and-forget** — order creation / status update must succeed (persist + respond) even if email sending throws.
- Each task ends GREEN: `pnpm build` (tsc) compiles and `pnpm test` passes before committing.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/package.json`
- Create: `/home/salah/Projects/issa-beauty-backend/tsconfig.json`
- Create: `/home/salah/Projects/issa-beauty-backend/vitest.config.ts`
- Create: `/home/salah/Projects/issa-beauty-backend/.gitignore`
- Create: `/home/salah/Projects/issa-beauty-backend/.env.example`
- Create: `/home/salah/Projects/issa-beauty-backend/src/smoke.test.ts`

**Interfaces:**
- Produces: a working TS + vitest harness. `pnpm build` runs `tsc`, `pnpm test` runs vitest.

- [ ] **Step 1: Create the repo dir and init git**

```bash
mkdir -p /home/salah/Projects/issa-beauty-backend/src
cd /home/salah/Projects/issa-beauty-backend
git init
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "issa-beauty-backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^16.6.1",
    "express": "^4.22.1",
    "express-rate-limit": "^7.4.1",
    "helmet": "^8.0.0",
    "imagekit": "^5.2.0",
    "jsonwebtoken": "^9.0.3",
    "mongodb": "^6.21.0",
    "mongoose": "^8.23.0",
    "multer": "1.4.5-lts.1",
    "resend": "^6.16.0"
  },
  "devDependencies": {
    "@types/cookie-parser": "^1.4.7",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/multer": "^1.4.12",
    "@types/node": "^22.9.0",
    "@types/supertest": "^6.0.2",
    "mongodb-memory-server": "^11.2.0",
    "supertest": "^7.2.2",
    "tsx": "^4.19.2",
    "typescript": "^5.6.3",
    "vitest": "^4.1.9"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

- [ ] **Step 4: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

- [ ] **Step 5: Write `.gitignore`**

```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 6: Write `.env.example`**

```
PORT=5002
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/issa_beauty
JWT_SECRET=change-me
INITIAL_DASHBOARD_PASSWORD=admin
IMAGEKIT_PUBLIC_KEY=
IMAGEKIT_PRIVATE_KEY=
IMAGEKIT_URL_ENDPOINT=
RESEND=
STORE_ORDER_EMAIL=
STOREFRONT_ORIGIN=https://issabeauty.org,https://www.issabeauty.org
DASHBOARD_ORIGIN=https://dashboard.issabeauty.org,https://www.dashboard.issabeauty.org
```

- [ ] **Step 7: Write the smoke test `src/smoke.test.ts`**

```typescript
import { describe, it, expect } from "vitest";

describe("harness", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 8: Install and verify**

Run: `cd /home/salah/Projects/issa-beauty-backend && pnpm install && pnpm test && pnpm build`
Expected: install succeeds; vitest reports 1 passing test; `tsc` exits 0 (creates `dist/`).

- [ ] **Step 9: Commit**

```bash
cd /home/salah/Projects/issa-beauty-backend
git add -A
git commit -m "chore: scaffold TypeScript backend project"
```

---

### Task 2: Config module

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/config.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/config.test.ts`

**Interfaces:**
- Produces: `loadConfig(env: NodeJS.ProcessEnv = process.env): Config` returning
  `{ port: number, nodeEnv: string, mongoUri: string, jwtSecret: string, initialDashboardPassword: string, imagekit: { publicKey, privateKey, urlEndpoint }, resendKey: string, storeOrderEmail: string, allowedOrigins: string[] }`.
  `allowedOrigins` = `STOREFRONT_ORIGIN` + `DASHBOARD_ORIGIN`, each split on `,`, trimmed, empties dropped.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test `src/config.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

const base = {
  PORT: "5002",
  NODE_ENV: "test",
  MONGODB_URI: "mongodb://localhost/x",
  JWT_SECRET: "s",
  STOREFRONT_ORIGIN: "https://issabeauty.org, https://www.issabeauty.org",
  DASHBOARD_ORIGIN: "https://dashboard.issabeauty.org",
};

describe("loadConfig", () => {
  it("parses port as a number and defaults to 5002", () => {
    expect(loadConfig(base).port).toBe(5002);
    expect(loadConfig({ ...base, PORT: undefined }).port).toBe(5002);
  });

  it("splits, trims, and merges allowed origins", () => {
    expect(loadConfig(base).allowedOrigins).toEqual([
      "https://issabeauty.org",
      "https://www.issabeauty.org",
      "https://dashboard.issabeauty.org",
    ]);
  });

  it("drops empty origin entries", () => {
    expect(
      loadConfig({ ...base, STOREFRONT_ORIGIN: "", DASHBOARD_ORIGIN: "https://d.org," })
        .allowedOrigins,
    ).toEqual(["https://d.org"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/config.test.ts`
Expected: FAIL — cannot find module `./config.js`.

- [ ] **Step 3: Write `src/config.ts`**

```typescript
export interface Config {
  port: number;
  nodeEnv: string;
  mongoUri: string;
  jwtSecret: string;
  initialDashboardPassword: string;
  imagekit: { publicKey: string; privateKey: string; urlEndpoint: string };
  resendKey: string;
  storeOrderEmail: string;
  allowedOrigins: string[];
}

function origins(...vals: (string | undefined)[]): string[] {
  return vals
    .flatMap((v) => (v ?? "").split(","))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT) || 5002,
    nodeEnv: env.NODE_ENV ?? "development",
    mongoUri: env.MONGODB_URI ?? "",
    jwtSecret: env.JWT_SECRET ?? "",
    initialDashboardPassword: env.INITIAL_DASHBOARD_PASSWORD ?? "admin",
    imagekit: {
      publicKey: env.IMAGEKIT_PUBLIC_KEY ?? "",
      privateKey: env.IMAGEKIT_PRIVATE_KEY ?? "",
      urlEndpoint: env.IMAGEKIT_URL_ENDPOINT ?? "",
    },
    resendKey: env.RESEND ?? "",
    storeOrderEmail: env.STORE_ORDER_EMAIL ?? "",
    allowedOrigins: origins(env.STOREFRONT_ORIGIN, env.DASHBOARD_ORIGIN),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add typed config loader"
```

---

### Task 3: Database connection

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/db.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/db.test.ts`

**Interfaces:**
- Produces: `connectDB(uri: string): Promise<void>` — `mongoose.connect(uri)`, logs host on success; on failure logs and rethrows (does NOT call `process.exit` — the caller decides). Also `disconnectDB(): Promise<void>`.
- Consumes: nothing.

> Note: the existing `db.js` reads `process.env.MONGODB_URI` and calls `process.exit(1)` on error. For testability we take `uri` as a parameter and rethrow instead of exiting; `index.ts` (Task 18) supplies the uri and handles fatal exit.

- [ ] **Step 1: Write the failing test `src/db.test.ts`**

```typescript
import { describe, it, expect, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { connectDB, disconnectDB } from "./db.js";

let mongo: MongoMemoryServer;

afterAll(async () => {
  await disconnectDB();
  if (mongo) await mongo.stop();
});

describe("connectDB", () => {
  it("connects to a reachable mongo instance", async () => {
    mongo = await MongoMemoryServer.create();
    await connectDB(mongo.getUri());
    expect(mongoose.connection.readyState).toBe(1);
  });

  it("rejects (does not exit) on an unreachable uri", async () => {
    await disconnectDB();
    await expect(
      connectDB("mongodb://127.0.0.1:1/x?serverSelectionTimeoutMS=200"),
    ).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/db.test.ts`
Expected: FAIL — cannot find module `./db.js`.

- [ ] **Step 3: Write `src/db.ts`**

```typescript
import mongoose from "mongoose";

export async function connectDB(uri: string): Promise<void> {
  try {
    const conn = await mongoose.connect(uri);
    console.log("Connected to MongoDB " + conn.connection.host);
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/db.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add mongoose connection helper"
```

---

### Task 4: Models

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/models.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/models.test.ts`

**Reference:** superset of both repos' models. Read `issa-beauty-dashboard/server/models.js` (the superset) for exact field defs.

**Interfaces:**
- Produces: named exports `Product, Category, BannerImg, AdminAuth, Order` (Mongoose models) and `ORDER_STATUSES: readonly ["pending","confirmed","delivered","cancelled"]`. Collection overrides: `BannerImg`→`bannerImages`, `AdminAuth`→`adminAuth`, `Order`→`orders`. TS interfaces exported: `IProduct, ICategory, IBannerImg, IAdminAuth, IOrder, IOrderItem`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test `src/models.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Product, BannerImg, AdminAuth, Order, ORDER_STATUSES } from "./models.js";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("models", () => {
  it("exposes ORDER_STATUSES", () => {
    expect(ORDER_STATUSES).toEqual(["pending", "confirmed", "delivered", "cancelled"]);
  });

  it("Order defaults status=pending, paymentMethod=cod, deliveryFee=3, user=null", async () => {
    const o = await Order.create({
      orderNumber: "IB-TEST01",
      items: [{ productId: new mongoose.Types.ObjectId(), name: "x", unitPrice: 5, quantity: 1, lineTotal: 5, imageUrl: "u" }],
      subtotal: 5,
      total: 8,
      customer: { fullName: "A", phone: "1" },
      shipping: { address: "a", city: "c" },
    });
    expect(o.status).toBe("pending");
    expect(o.paymentMethod).toBe("cod");
    expect(o.deliveryFee).toBe(3);
    expect(o.user).toBeNull();
  });

  it("Order rejects an invalid status enum", async () => {
    await expect(
      Order.create({
        orderNumber: "IB-TEST02",
        items: [{ productId: new mongoose.Types.ObjectId(), name: "x", unitPrice: 5, quantity: 1, lineTotal: 5, imageUrl: "u" }],
        subtotal: 5, total: 8,
        customer: { fullName: "A", phone: "1" },
        shipping: { address: "a", city: "c" },
        status: "bogus",
      }),
    ).rejects.toBeTruthy();
  });

  it("Order requires orderNumber", async () => {
    await expect(
      Order.create({
        items: [{ productId: new mongoose.Types.ObjectId(), name: "x", unitPrice: 5, quantity: 1, lineTotal: 5, imageUrl: "u" }],
        subtotal: 5, total: 8,
        customer: { fullName: "A", phone: "1" },
        shipping: { address: "a", city: "c" },
      }),
    ).rejects.toBeTruthy();
  });

  it("Product accepts imageFileId; BannerImg uses bannerImages collection; AdminAuth uses adminAuth", async () => {
    const p = await Product.create({ name: "n", category: "c", price: 1, imageUrl: "u", description: "d", imageFileId: "fid" });
    expect(p.imageFileId).toBe("fid");
    expect(BannerImg.collection.collectionName).toBe("bannerImages");
    expect(AdminAuth.collection.collectionName).toBe("adminAuth");
    expect(Order.collection.collectionName).toBe("orders");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/models.test.ts`
Expected: FAIL — cannot find module `./models.js`.

- [ ] **Step 3: Write `src/models.ts`**

Port `issa-beauty-dashboard/server/models.js` to TS. Declare a TS interface per document (fields below) and pass a typed `Schema<IX>`. Exact schema (from reference §4):
- `Product`: `name*`, `category*`, `price*` (Number), `discountPercentage?` (Number), `imageUrl*`, `description*`, `in_stock` (Boolean, default true), `imageFileId?`, timestamps.
- `Category`: `name*`, timestamps.
- `BannerImg`: `imageUrl*`, `imageFileId?`, timestamps → `model("BannerImg", schema, "bannerImages")`.
- `AdminAuth`: `passwordHash*`, timestamps → `model("AdminAuth", schema, "adminAuth")`.
- `OrderItem` (subdoc, `_id: false`): `productId*` (ObjectId ref Product), `name*`, `unitPrice*` (Number), `discountPercentage` (Number default 0), `quantity*` (Number min 1), `lineTotal*` (Number), `imageUrl*`.
- `Order`: `orderNumber*` (unique), `items` `[OrderItem]`, `subtotal*`, `deliveryFee` (default 3), `total*`, `customer` `{ fullName*, phone*, email? }`, `shipping` `{ address*, city*, area?, notes? }`, `paymentMethod` (default "cod"), `status` (enum `ORDER_STATUSES`, default "pending"), `user` (ObjectId ref User, default null), timestamps → `model("Order", schema, "orders")`.

Export `ORDER_STATUSES = ["pending", "confirmed", "delivered", "cancelled"] as const;` and use it in the enum.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/models.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add mongoose models (superset, typed)"
```

---

### Task 5: Order domain logic

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/orders.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/orders.test.ts`

**Reference:** port `issa-beauty/server/orders.js` (full source already known). Port `issa-beauty/server/orders.test.js` to TS.

**Interfaces:**
- Produces: `DELIVERY_FEE = 3`; `discountedUnitPrice(price: number, discountPercentage?: number): number`; `validateOrderInput(body: unknown): { valid: boolean; errors: string[] }`; `buildOrderDoc(input: OrderInput, productsById: Record<string, ProductSnapshot>): OrderDoc` (throws `Error & { status: 400 }` on missing/out-of-stock product); `generateOrderNumber(): string` (`IB-` + 6 chars from `0123456789ABCDEFGHJKMNPQRSTVWXYZ`). Define `OrderInput`, `ProductSnapshot` (`{ _id, name, price, discountPercentage?, imageUrl, in_stock }`), `OrderDoc` types.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test `src/orders.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { discountedUnitPrice, validateOrderInput, buildOrderDoc, generateOrderNumber, DELIVERY_FEE } from "./orders.js";

describe("discountedUnitPrice", () => {
  it("returns full price with no/zero discount", () => {
    expect(discountedUnitPrice(100)).toBe(100);
    expect(discountedUnitPrice(100, 0)).toBe(100);
  });
  it("applies a percentage discount", () => {
    expect(discountedUnitPrice(100, 25)).toBe(75);
  });
});

describe("validateOrderInput", () => {
  const ok = {
    items: [{ productId: "p1", quantity: 2 }],
    customer: { fullName: "A", phone: "111" },
    shipping: { address: "addr", city: "city" },
  };
  it("accepts a valid body", () => {
    expect(validateOrderInput(ok)).toEqual({ valid: true, errors: [] });
  });
  it("rejects empty cart", () => {
    expect(validateOrderInput({ ...ok, items: [] }).valid).toBe(false);
  });
  it("rejects non-integer quantity", () => {
    expect(validateOrderInput({ ...ok, items: [{ productId: "p1", quantity: 0 }] }).valid).toBe(false);
  });
  it("requires fullName, phone, address, city", () => {
    expect(validateOrderInput({ ...ok, customer: { phone: "1" } }).valid).toBe(false);
    expect(validateOrderInput({ ...ok, customer: { fullName: "A" } }).valid).toBe(false);
    expect(validateOrderInput({ ...ok, shipping: { city: "c" } }).valid).toBe(false);
    expect(validateOrderInput({ ...ok, shipping: { address: "a" } }).valid).toBe(false);
  });
  it("rejects a malformed email but allows omitting it", () => {
    expect(validateOrderInput({ ...ok, customer: { fullName: "A", phone: "1", email: "bad" } }).valid).toBe(false);
    expect(validateOrderInput({ ...ok, customer: { fullName: "A", phone: "1", email: "a@b.co" } }).valid).toBe(true);
  });
});

describe("buildOrderDoc", () => {
  const products = {
    p1: { _id: "p1", name: "Lipstick", price: 10, discountPercentage: 50, imageUrl: "u", in_stock: true },
    p2: { _id: "p2", name: "Serum", price: 20, imageUrl: "u2", in_stock: true },
  } as any;

  it("recomputes totals from the DB, ignoring any client prices", () => {
    const doc = buildOrderDoc(
      { items: [{ productId: "p1", quantity: 2 }, { productId: "p2", quantity: 1 }], customer: { fullName: "A", phone: "1" }, shipping: { address: "a", city: "c" } },
      products,
    );
    // p1: 10*0.5*2 = 10 ; p2: 20*1 = 20 ; subtotal 30 ; +3 delivery = 33
    expect(doc.subtotal).toBe(30);
    expect(doc.deliveryFee).toBe(DELIVERY_FEE);
    expect(doc.total).toBe(33);
    expect(doc.items[0].lineTotal).toBe(10);
    expect(doc.paymentMethod).toBe("cod");
    expect(doc.status).toBe("pending");
  });

  it("throws 400 for a missing product", () => {
    try {
      buildOrderDoc({ items: [{ productId: "nope", quantity: 1 }], customer: { fullName: "A", phone: "1" }, shipping: { address: "a", city: "c" } }, products);
      throw new Error("should have thrown");
    } catch (e: any) {
      expect(e.status).toBe(400);
    }
  });

  it("throws 400 for an out-of-stock product", () => {
    const oos = { p1: { ...products.p1, in_stock: false } } as any;
    try {
      buildOrderDoc({ items: [{ productId: "p1", quantity: 1 }], customer: { fullName: "A", phone: "1" }, shipping: { address: "a", city: "c" } }, oos);
      throw new Error("should have thrown");
    } catch (e: any) {
      expect(e.status).toBe(400);
    }
  });
});

describe("generateOrderNumber", () => {
  it("matches IB-XXXXXX with the safe alphabet", () => {
    expect(generateOrderNumber()).toMatch(/^IB-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/orders.test.ts`
Expected: FAIL — cannot find module `./orders.js`.

- [ ] **Step 3: Write `src/orders.ts`**

Port `issa-beauty/server/orders.js` verbatim into TS, adding the types from the Interfaces block. Keep `round2`, the email regex, and the exact discount/rounding math. `buildOrderDoc` throws `Object.assign(new Error(msg), { status: 400 })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: port order domain logic to TS"
```

---

### Task 6: Email module (merged)

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/email.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/email.test.ts`

**Reference:** merge `issa-beauty/server/email.js` (`orderConfirmationEmail`, `newOrderNotificationEmail`, `sendEmail`, plus `esc`, `money`, `shell`, `itemsTable`, `addressBlock`, `FROM`) with `issa-beauty-dashboard/server/email.js` (`statusUpdateEmail`). Keep shared helpers single-copy. Read both source files.

**Interfaces:**
- Produces: `orderConfirmationEmail(order): { subject: string; html: string }`; `newOrderNotificationEmail(order): { subject; html }`; `statusUpdateEmail(order): { subject; html } | null` (null when `order.status === "pending"`); `sendEmail(args: { to: string; subject: string; html: string }): Promise<void>` (reads `process.env.RESEND` at call time; if unset, logs and returns). `FROM = "ISSA Beauty <orders@send.issabeauty.org>"`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test `src/email.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { orderConfirmationEmail, newOrderNotificationEmail, statusUpdateEmail } from "./email.js";

const order: any = {
  orderNumber: "IB-ABC123",
  items: [{ name: "Lipstick", quantity: 2, lineTotal: 10, unitPrice: 5, discountPercentage: 0, imageUrl: "u" }],
  subtotal: 10, deliveryFee: 3, total: 13,
  customer: { fullName: "Jane Doe", phone: "111", email: "jane@example.com" },
  shipping: { address: "1 St", city: "Beirut" },
  status: "confirmed",
};

describe("order emails", () => {
  it("confirmation includes order number and total", () => {
    const { subject, html } = orderConfirmationEmail(order);
    expect(subject).toContain("IB-ABC123");
    expect(html).toContain("13");
    expect(html).toContain("Lipstick");
  });
  it("owner notification includes total in subject and customer phone", () => {
    const { subject, html } = newOrderNotificationEmail(order);
    expect(subject).toContain("IB-ABC123");
    expect(html).toContain("111");
  });
});

describe("statusUpdateEmail", () => {
  it("returns null for pending", () => {
    expect(statusUpdateEmail({ ...order, status: "pending" })).toBeNull();
  });
  it("builds an email for confirmed/delivered/cancelled", () => {
    for (const status of ["confirmed", "delivered", "cancelled"]) {
      const res = statusUpdateEmail({ ...order, status });
      expect(res).not.toBeNull();
      expect(res!.subject).toContain("IB-ABC123");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/email.test.ts`
Expected: FAIL — cannot find module `./email.js`.

- [ ] **Step 3: Write `src/email.ts`**

Merge both source files into TS. One copy of `esc`, `money`, `shell`, `itemsTable`, `addressBlock`, `FROM`, `sendEmail`. Add `IOrder`-shaped param types (import `IOrder` from `./models.js` or define a local `EmailOrder` structural type). Preserve the HTML/subject text exactly as in the sources. `statusUpdateEmail` returns `null` for `"pending"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/email.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: merge storefront + dashboard email templates (TS)"
```

---

### Task 7: Auth module

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/auth.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/auth.test.ts`

**Reference:** port `issa-beauty-dashboard/server/auth.js` and `auth.test.js`.

**Interfaces:**
- Produces: `COOKIE_NAME = "token"`; `TOKEN_MAX_AGE_MS = 30*24*60*60*1000`; `hashPassword(plain: string): Promise<string>`; `verifyPassword(plain, hash): Promise<boolean>`; `signToken(): string` (payload `{ role: "admin" }`, `expiresIn: "30d"`, secret `process.env.JWT_SECRET`); `verifyToken(token: string): JwtPayload | string | null`; `requireAuth(req, res, next)` Express middleware reading `req.cookies[COOKIE_NAME]`, 401 `{ success: false, message: "Unauthorized" }` when missing/invalid.
- Consumes: nothing.

- [ ] **Step 1: Write the failing test `src/auth.test.ts`**

```typescript
import { describe, it, expect, beforeAll, vi } from "vitest";
import { hashPassword, verifyPassword, signToken, verifyToken, requireAuth, COOKIE_NAME } from "./auth.js";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret";
});

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const h = await hashPassword("s3cret");
    expect(await verifyPassword("s3cret", h)).toBe(true);
    expect(await verifyPassword("nope", h)).toBe(false);
  });
});

describe("jwt", () => {
  it("signs a token that verifies back to admin", () => {
    const decoded = verifyToken(signToken());
    expect((decoded as any).role).toBe("admin");
  });
  it("returns null for a garbage token", () => {
    expect(verifyToken("garbage")).toBeNull();
  });
});

describe("requireAuth", () => {
  function res() {
    return { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as any;
  }
  it("calls next with a valid token cookie", () => {
    const next = vi.fn();
    requireAuth({ cookies: { [COOKIE_NAME]: signToken() } } as any, res(), next);
    expect(next).toHaveBeenCalled();
  });
  it("responds 401 without a token", () => {
    const r = res();
    const next = vi.fn();
    requireAuth({ cookies: {} } as any, r, next);
    expect(r.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/auth.test.ts`
Expected: FAIL — cannot find module `./auth.js`.

- [ ] **Step 3: Write `src/auth.ts`**

Port `auth.js` to TS. Type `requireAuth` as `(req: Request, res: Response, next: NextFunction) => void` (import from express). `SALT_ROUNDS = 10`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: port auth (jwt/bcrypt/requireAuth) to TS"
```

---

### Task 8: Bootstrap admin auth

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/bootstrapAuth.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/bootstrapAuth.test.ts`

**Reference:** port `issa-beauty-dashboard/server/bootstrapAuth.js` and `bootstrapAuth.test.js`.

**Interfaces:**
- Produces: `ensureAdminAuth(): Promise<IAdminAuth>` — if no `AdminAuth` doc, hash `process.env.INITIAL_DASHBOARD_PASSWORD` (fallback `"admin"` with a warning) and create one; else return existing without change.
- Consumes: `AdminAuth` (Task 4), `hashPassword` (Task 7).

- [ ] **Step 1: Write the failing test `src/bootstrapAuth.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { AdminAuth } from "./models.js";
import { verifyPassword } from "./auth.js";
import { ensureAdminAuth } from "./bootstrapAuth.js";

let mongo: MongoMemoryServer;
beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.INITIAL_DASHBOARD_PASSWORD = "seed-pass";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await AdminAuth.deleteMany({});
});

describe("ensureAdminAuth", () => {
  it("seeds a hashed password from env when none exists", async () => {
    await ensureAdminAuth();
    const doc = await AdminAuth.findOne();
    expect(doc).not.toBeNull();
    expect(await verifyPassword("seed-pass", doc!.passwordHash)).toBe(true);
  });
  it("does not overwrite an existing password", async () => {
    await ensureAdminAuth();
    const first = await AdminAuth.findOne();
    await ensureAdminAuth();
    const count = await AdminAuth.countDocuments();
    const second = await AdminAuth.findOne();
    expect(count).toBe(1);
    expect(second!.passwordHash).toBe(first!.passwordHash);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/bootstrapAuth.test.ts`
Expected: FAIL — cannot find module `./bootstrapAuth.js`.

- [ ] **Step 3: Write `src/bootstrapAuth.ts`** (port from source).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/bootstrapAuth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: port admin auth bootstrap to TS"
```

---

### Task 9: ImageKit helper

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/imagekit.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/imagekit.test.ts`

**Reference:** the ImageKit setup + `uploadImage`/`deleteImage` + transform constants from `issa-beauty-dashboard/server/app.js` (reference §7/§10).

**Interfaces:**
- Produces: `PRODUCT_IMAGE_TR = "w-1600,h-1600,c-at_max,q-80"`; `BANNER_IMAGE_TR = "w-2000,h-2000,c-at_max,q-80"`; `uploadImage(buffer: Buffer, fileName: string, pre: string): Promise<{ url: string; fileId: string }>`; `deleteImage(fileId: string): Promise<void>`. The ImageKit client is created lazily from env inside the module.
- Consumes: nothing.

> The ImageKit SDK reads keys from env at construction. Build the client lazily (on first use) so tests can set dummy env and mock the SDK.

- [ ] **Step 1: Write the failing test `src/imagekit.test.ts`**

```typescript
import { describe, it, expect, vi, beforeAll } from "vitest";

const uploadMock = vi.fn(async () => ({ url: "https://ik/x.jpg", fileId: "fid-1" }));
const deleteMock = vi.fn(async () => undefined);

vi.mock("imagekit", () => ({
  default: class {
    upload = uploadMock;
    deleteFile = deleteMock;
  },
}));

beforeAll(() => {
  process.env.IMAGEKIT_PUBLIC_KEY = "x";
  process.env.IMAGEKIT_PRIVATE_KEY = "x";
  process.env.IMAGEKIT_URL_ENDPOINT = "https://example.com";
});

describe("imagekit helper", () => {
  it("uploads with the given transformation and returns url+fileId", async () => {
    const { uploadImage, PRODUCT_IMAGE_TR } = await import("./imagekit.js");
    const res = await uploadImage(Buffer.from("x"), "name-1", PRODUCT_IMAGE_TR);
    expect(res).toEqual({ url: "https://ik/x.jpg", fileId: "fid-1" });
    expect(uploadMock).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "name-1", transformation: { pre: PRODUCT_IMAGE_TR } }),
    );
  });
  it("deletes by fileId", async () => {
    const { deleteImage } = await import("./imagekit.js");
    await deleteImage("fid-1");
    expect(deleteMock).toHaveBeenCalledWith("fid-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/imagekit.test.ts`
Expected: FAIL — cannot find module `./imagekit.js`.

- [ ] **Step 3: Write `src/imagekit.ts`**

```typescript
import ImageKit from "imagekit";

export const PRODUCT_IMAGE_TR = "w-1600,h-1600,c-at_max,q-80";
export const BANNER_IMAGE_TR = "w-2000,h-2000,c-at_max,q-80";

let client: ImageKit | null = null;
function ik(): ImageKit {
  if (!client) {
    client = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY ?? "",
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY ?? "",
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT ?? "",
    });
  }
  return client;
}

export async function uploadImage(buffer: Buffer, fileName: string, pre: string): Promise<{ url: string; fileId: string }> {
  const res = await ik().upload({ file: buffer, fileName, transformation: { pre } });
  return { url: res.url, fileId: res.fileId };
}

export async function deleteImage(fileId: string): Promise<void> {
  await ik().deleteFile(fileId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/imagekit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add imagekit upload/delete helper"
```

---

### Task 10: App skeleton + base middleware + public catalog routes

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/app.ts`
- Create: `/home/salah/Projects/issa-beauty-backend/src/routes/public.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/routes/public.catalog.test.ts`

**Reference:** storefront `app.js` GET handlers: `/api/products` (the `$facet` aggregation + price filtering + sort), `/api/products-price-range`, `/api/products-by-category`, `/api/products/:id`, `/api/categories`, `/api/banner-images`. Response shapes MUST match the storefront exactly (its client is unchanged). **Fix while porting:** `GET /api/products/:id` returns **200**, not 201.

**Interfaces:**
- Produces: `createApp(config: Config): express.Express` (default export style: `export function createApp`). Mounts `helmet()`, `cors` (allowlist = `config.allowedOrigins`, `credentials: true`), `express.json({ limit: "10kb" })`, `cookieParser()`, and the public router at `/api`. Exports `publicRouter`.
- Consumes: `Config` (Task 2), models (Task 4), `discountedUnitPrice` (Task 5).

- [ ] **Step 1: Write the failing test `src/routes/public.catalog.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Express } from "express";

let app: Express, mongo: MongoMemoryServer, Product: any, Category: any, BannerImg: any;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { createApp } = await import("../app.js");
  const { loadConfig } = await import("../config.js");
  ({ Product, Category, BannerImg } = await import("../models.js"));
  app = createApp(loadConfig({ STOREFRONT_ORIGIN: "https://issabeauty.org", DASHBOARD_ORIGIN: "https://dashboard.issabeauty.org" }));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Product.deleteMany({});
  await Category.deleteMany({});
  await BannerImg.deleteMany({});
});

describe("public catalog", () => {
  it("GET /api/products returns the envelope with pagination on empty DB", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: [], total: 0 });
    expect(res.body).toHaveProperty("pages");
    expect(res.body).toHaveProperty("page");
  });

  it("GET /api/products filters by search and category", async () => {
    await Product.create({ name: "Red Lipstick", category: "Lips", price: 10, imageUrl: "u", description: "d" });
    await Product.create({ name: "Blue Serum", category: "Skin", price: 20, imageUrl: "u", description: "d" });
    const res = await request(app).get("/api/products?search=lipstick");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Red Lipstick");
  });

  it("GET /api/products-price-range returns min/max", async () => {
    await Product.create({ name: "A", category: "c", price: 10, imageUrl: "u", description: "d" });
    await Product.create({ name: "B", category: "c", price: 30, imageUrl: "u", description: "d" });
    const res = await request(app).get("/api/products-price-range");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.min).toBe(10);
    expect(res.body.max).toBe(30);
  });

  it("GET /api/products-by-category groups products", async () => {
    await Product.create({ name: "A", category: "Lips", price: 10, imageUrl: "u", description: "d" });
    const res = await request(app).get("/api/products-by-category");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("Lips");
  });

  it("GET /api/products/:id returns 200 (not 201) for a found product", async () => {
    const p = await Product.create({ name: "A", category: "c", price: 10, imageUrl: "u", description: "d" });
    const res = await request(app).get(`/api/products/${p._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("A");
  });

  it("GET /api/products/:id returns 400 for an invalid id", async () => {
    const res = await request(app).get("/api/products/not-an-id");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("GET /api/categories and /api/banner-images return arrays", async () => {
    await Category.create({ name: "Lips" });
    await BannerImg.create({ imageUrl: "u" });
    expect((await request(app).get("/api/categories")).body.data).toHaveLength(1);
    expect((await request(app).get("/api/banner-images")).body.data).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/public.catalog.test.ts`
Expected: FAIL — cannot find module `../app.js`.

- [ ] **Step 3: Implement `src/routes/public.ts` and `src/app.ts`**

- `public.ts`: `export const publicRouter = express.Router();` with the six GET handlers ported from storefront `app.js` (keep the aggregation pipeline and price-range logic identical; fix `/:id` to 200). Use models from `./models.js` and `discountedUnitPrice` where the source used it.
- `app.ts`:

```typescript
import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import type { Config } from "./config.js";
import { publicRouter } from "./routes/public.js";

export function createApp(config: Config): Express {
  const app = express();
  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin || config.allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());
  app.use("/api", publicRouter);
  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/routes/public.catalog.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: app skeleton + public catalog routes"
```

---

### Task 11: Public order creation route

**Files:**
- Modify: `/home/salah/Projects/issa-beauty-backend/src/routes/public.ts` (add `POST /api/orders`)
- Test: `/home/salah/Projects/issa-beauty-backend/src/routes/public.orders.test.ts`

**Reference:** storefront `app.js` `POST /api/orders` (validate → fetch products → `buildOrderDoc` → `generateOrderNumber` with one retry on duplicate → save → fire-and-forget emails). Response 201 `{ success: true, data: order }`.

**Interfaces:**
- Consumes: `validateOrderInput`, `buildOrderDoc`, `generateOrderNumber` (Task 5); `orderConfirmationEmail`, `newOrderNotificationEmail`, `sendEmail` (Task 6); `Product`, `Order` (Task 4).

- [ ] **Step 1: Write the failing test `src/routes/public.orders.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Express } from "express";

const { mail } = vi.hoisted(() => ({ mail: { sent: [] as any[], mode: "resolve" as "resolve" | "reject" } }));
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (payload: any) => {
        mail.sent.push(payload);
        if (mail.mode === "reject") throw new Error("resend boom");
        return { id: "test" };
      },
    };
  },
}));

const flush = () => new Promise((r) => setTimeout(r, 50));

let app: Express, mongo: MongoMemoryServer, Product: any, Order: any;

beforeAll(async () => {
  process.env.RESEND = "test-key";
  process.env.STORE_ORDER_EMAIL = "owner@shop.com";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { createApp } = await import("../app.js");
  const { loadConfig } = await import("../config.js");
  ({ Product, Order } = await import("../models.js"));
  app = createApp(loadConfig({ STORE_ORDER_EMAIL: "owner@shop.com" }));
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

async function seed() {
  return Product.create({ name: "Lipstick", category: "Lips", price: 10, discountPercentage: 50, imageUrl: "u", description: "d", in_stock: true });
}

describe("POST /api/orders", () => {
  it("creates an order recomputing totals from the DB", async () => {
    const p = await seed();
    const res = await request(app).post("/api/orders").send({
      items: [{ productId: String(p._id), quantity: 2, unitPrice: 999 }],
      customer: { fullName: "Jane", phone: "111", email: "jane@example.com" },
      shipping: { address: "1 St", city: "Beirut" },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.subtotal).toBe(10); // 10 * 0.5 * 2, client's 999 ignored
    expect(res.body.data.total).toBe(13);
    expect(res.body.data.orderNumber).toMatch(/^IB-/);
  });

  it("rejects an out-of-stock product with 400", async () => {
    const p = await Product.create({ name: "X", category: "c", price: 5, imageUrl: "u", description: "d", in_stock: false });
    const res = await request(app).post("/api/orders").send({
      items: [{ productId: String(p._id), quantity: 1 }],
      customer: { fullName: "Jane", phone: "111" },
      shipping: { address: "1 St", city: "Beirut" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects a missing required field with 400", async () => {
    const p = await seed();
    const res = await request(app).post("/api/orders").send({
      items: [{ productId: String(p._id), quantity: 1 }],
      customer: { phone: "111" },
      shipping: { address: "1 St", city: "Beirut" },
    });
    expect(res.status).toBe(400);
  });

  it("emails customer + owner when email present; still 201 if email throws", async () => {
    const p = await seed();
    await request(app).post("/api/orders").send({
      items: [{ productId: String(p._id), quantity: 1 }],
      customer: { fullName: "Jane", phone: "111", email: "jane@example.com" },
      shipping: { address: "1 St", city: "Beirut" },
    });
    await flush();
    const recipients = mail.sent.map((m) => m.to);
    expect(recipients).toContain("jane@example.com");
    expect(recipients).toContain("owner@shop.com");

    mail.mode = "reject";
    const res = await request(app).post("/api/orders").send({
      items: [{ productId: String(p._id), quantity: 1 }],
      customer: { fullName: "Jane", phone: "111", email: "jane@example.com" },
      shipping: { address: "1 St", city: "Beirut" },
    });
    expect(res.status).toBe(201);
  });

  it("skips the customer email when none is given but still alerts the owner", async () => {
    const p = await seed();
    await request(app).post("/api/orders").send({
      items: [{ productId: String(p._id), quantity: 1 }],
      customer: { fullName: "Jane", phone: "111" },
      shipping: { address: "1 St", city: "Beirut" },
    });
    await flush();
    const recipients = mail.sent.map((m) => m.to);
    expect(recipients).toContain("owner@shop.com");
    expect(recipients).not.toContain(undefined);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/public.orders.test.ts`
Expected: FAIL — no `POST /api/orders` route (404s).

- [ ] **Step 3: Add the `POST /api/orders` handler to `public.ts`** (port from storefront, fire-and-forget emails wrapped so failures never reject the response; the store-owner email only sent when `config.storeOrderEmail`/`process.env.STORE_ORDER_EMAIL` is set; customer email only when `customer.email` present).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/routes/public.orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: public order creation route with emails"
```

---

### Task 12: Admin auth routes + requireAuth mounting

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.ts`
- Modify: `/home/salah/Projects/issa-beauty-backend/src/app.ts` (mount admin router at `/api/admin`)
- Test: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.auth.test.ts`

**Reference:** dashboard `app.js` auth routes, remounted. Route map:
- `POST /api/admin/auth/login` (no auth) — body `{ password }`; 200 `{ success: true }` + Set-Cookie; 401 on wrong/invalid.
- `app.use("/api/admin", requireAuth)` **after** the login route so everything else is gated.
- `GET /api/admin/auth/check` → 200 `{ success: true, authenticated: true }`.
- `POST /api/admin/auth/logout` → clears cookie, 200.
- `PUT /api/admin/auth/password` → body `{ currentPassword, newPassword }`; 400 if `newPassword.length < 4`; 401 if current wrong; 200 on success.

**Interfaces:**
- Produces: `export const adminRouter = express.Router();`
- Consumes: `requireAuth`, `signToken`, `verifyPassword`, `hashPassword`, `COOKIE_NAME`, `TOKEN_MAX_AGE_MS` (Task 7); `AdminAuth` (Task 4).

- [ ] **Step 1: Write the failing test `src/routes/admin.auth.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Express } from "express";

let app: Express, mongo: MongoMemoryServer, AdminAuth: any;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.IMAGEKIT_PUBLIC_KEY = "x";
  process.env.IMAGEKIT_PRIVATE_KEY = "x";
  process.env.IMAGEKIT_URL_ENDPOINT = "https://example.com";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { createApp } = await import("../app.js");
  const { loadConfig } = await import("../config.js");
  const { hashPassword } = await import("../auth.js");
  ({ AdminAuth } = await import("../models.js"));
  await AdminAuth.create({ passwordHash: await hashPassword("letmein") });
  app = createApp(loadConfig({}));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("admin auth", () => {
  it("rejects a wrong password", async () => {
    const res = await request(app).post("/api/admin/auth/login").send({ password: "nope" });
    expect(res.status).toBe(401);
  });

  it("logs in and sets a cookie", async () => {
    const res = await request(app).post("/api/admin/auth/login").send({ password: "letmein" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]?.[0]).toContain("token=");
  });

  it("blocks protected routes without a cookie", async () => {
    const res = await request(app).get("/api/admin/auth/check");
    expect(res.status).toBe(401);
  });

  it("allows /check with a valid cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/auth/login").send({ password: "letmein" });
    const res = await agent.get("/api/admin/auth/check");
    expect(res.status).toBe(200);
    expect(res.body.authenticated).toBe(true);
  });

  it("changes the password", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/auth/login").send({ password: "letmein" });
    const changed = await agent.put("/api/admin/auth/password").send({ currentPassword: "letmein", newPassword: "newpass" });
    expect(changed.status).toBe(200);
    expect((await request(app).post("/api/admin/auth/login").send({ password: "newpass" })).status).toBe(200);
    // restore for isolation
    await agent.put("/api/admin/auth/password").send({ currentPassword: "newpass", newPassword: "letmein" });
  });

  it("rejects a too-short new password", async () => {
    const agent = request.agent(app);
    await agent.post("/api/admin/auth/login").send({ password: "letmein" });
    const res = await agent.put("/api/admin/auth/password").send({ currentPassword: "letmein", newPassword: "ab" });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/admin.auth.test.ts`
Expected: FAIL — cannot find module `../app.js` export path / admin router.

- [ ] **Step 3: Create `admin.ts` with the auth routes** and wire `app.use("/api/admin", adminRouter)` in `app.ts`. Inside `adminRouter`, register `POST /auth/login` first, then `adminRouter.use(requireAuth)`, then the rest. Cookie options from Global Constraints.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/routes/admin.auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin auth routes under /api/admin"
```

---

### Task 13: Admin product routes (CRUD + ImageKit)

**Files:**
- Modify: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.products.test.ts`

**Reference:** dashboard `app.js` product routes (`GET /api/products`, `GET /api/products/:id`, `POST`, `PUT`, `DELETE`), remounted under `/api/admin/products`. **Fixes while porting:** remove the dead `changeOrigin:` label (dashboard app.js ~169); `GET /:id` returns **200**. Use `multer()` memory storage + `uploadImage`/`deleteImage` (Task 9). `GET /api/admin/products` returns `{ success, data, total, page, pages }` via `.find().skip().limit()`.

**Interfaces:**
- Consumes: `Product` (Task 4); `uploadImage`, `deleteImage`, `PRODUCT_IMAGE_TR` (Task 9); `requireAuth` (already mounted).

- [ ] **Step 1: Write the failing test `src/routes/admin.products.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Express } from "express";

const uploadMock = vi.fn(async () => ({ url: "https://ik/p.jpg", fileId: "fid-p" }));
const deleteMock = vi.fn(async () => undefined);
vi.mock("imagekit", () => ({ default: class { upload = uploadMock; deleteFile = deleteMock; } }));

let app: Express, mongo: MongoMemoryServer, Product: any, AdminAuth: any;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.IMAGEKIT_PUBLIC_KEY = "x";
  process.env.IMAGEKIT_PRIVATE_KEY = "x";
  process.env.IMAGEKIT_URL_ENDPOINT = "https://example.com";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { createApp } = await import("../app.js");
  const { loadConfig } = await import("../config.js");
  const { hashPassword } = await import("../auth.js");
  ({ Product, AdminAuth } = await import("../models.js"));
  await AdminAuth.create({ passwordHash: await hashPassword("letmein") });
  app = createApp(loadConfig({}));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Product.deleteMany({});
});

async function authed() {
  const agent = request.agent(app);
  await agent.post("/api/admin/auth/login").send({ password: "letmein" });
  return agent;
}

describe("admin products", () => {
  it("requires auth", async () => {
    expect((await request(app).get("/api/admin/products")).status).toBe(401);
  });

  it("lists products with pagination envelope", async () => {
    await Product.create({ name: "A", category: "c", price: 1, imageUrl: "u", description: "d" });
    const agent = await authed();
    const res = await agent.get("/api/admin/products");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, total: 1 });
    expect(res.body.data).toHaveLength(1);
  });

  it("creates a product with an uploaded image", async () => {
    const agent = await authed();
    const res = await agent
      .post("/api/admin/products")
      .field("name", "Lipstick")
      .field("category", "Lips")
      .field("price", "10")
      .field("description", "nice")
      .attach("image", Buffer.from("img"), "l.jpg");
    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toBe("https://ik/p.jpg");
    expect(res.body.data.imageFileId).toBe("fid-p");
    expect(uploadMock).toHaveBeenCalled();
  });

  it("updates a product, replacing its image", async () => {
    const p = await Product.create({ name: "A", category: "c", price: 1, imageUrl: "old", description: "d", imageFileId: "old-fid" });
    const agent = await authed();
    const res = await agent
      .put(`/api/admin/products/${p._id}`)
      .field("name", "A2")
      .field("category", "c")
      .field("price", "2")
      .field("description", "d")
      .attach("image", Buffer.from("img"), "n.jpg");
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("A2");
    expect(deleteMock).toHaveBeenCalledWith("old-fid");
  });

  it("deletes a product (and its image) and returns the refetched list", async () => {
    const p = await Product.create({ name: "A", category: "c", price: 1, imageUrl: "u", description: "d", imageFileId: "fid-x" });
    const agent = await authed();
    const res = await agent.delete(`/api/admin/products/${p._id}`);
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("fid-x");
    expect(res.body.data).toHaveLength(0);
  });

  it("404s deleting an unknown product", async () => {
    const agent = await authed();
    const res = await agent.delete(`/api/admin/products/${new mongoose.Types.ObjectId()}`);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/admin.products.test.ts`
Expected: FAIL — no product routes.

- [ ] **Step 3: Add product routes to `admin.ts`** (port from dashboard, apply the two fixes noted). Use `multer().single("image")` per route.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/routes/admin.products.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin product routes (CRUD + imagekit), fix dead label"
```

---

### Task 14: Admin category routes

**Files:**
- Modify: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.categories.test.ts`

**Reference:** dashboard category routes under `/api/admin/categories`. **Fixes while porting:** in the DELETE handler, `await Promise.all(...)` the product updates (dashboard smell ~254-256); on rename, standardize category-update to return the updated doc and cascade the rename to all products with the old name (use `Product.updateMany({ category: oldName }, { category: newName })` for correctness/efficiency).

**Interfaces:**
- Consumes: `Category`, `Product` (Task 4).

- [ ] **Step 1: Write the failing test `src/routes/admin.categories.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Express } from "express";

let app: Express, mongo: MongoMemoryServer, Category: any, Product: any, AdminAuth: any;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.IMAGEKIT_PUBLIC_KEY = "x";
  process.env.IMAGEKIT_PRIVATE_KEY = "x";
  process.env.IMAGEKIT_URL_ENDPOINT = "https://example.com";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { createApp } = await import("../app.js");
  const { loadConfig } = await import("../config.js");
  const { hashPassword } = await import("../auth.js");
  ({ Category, Product, AdminAuth } = await import("../models.js"));
  await AdminAuth.create({ passwordHash: await hashPassword("letmein") });
  app = createApp(loadConfig({}));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Category.deleteMany({});
  await Product.deleteMany({});
});

async function authed() {
  const agent = request.agent(app);
  await agent.post("/api/admin/auth/login").send({ password: "letmein" });
  return agent;
}

describe("admin categories", () => {
  it("requires auth", async () => {
    expect((await request(app).get("/api/admin/categories")).status).toBe(401);
  });

  it("creates and lists categories", async () => {
    const agent = await authed();
    expect((await agent.post("/api/admin/categories").send({ name: "Lips" })).status).toBe(201);
    expect((await agent.get("/api/admin/categories")).body.data).toHaveLength(1);
  });

  it("renaming cascades to products", async () => {
    const c = await Category.create({ name: "Old" });
    await Product.create({ name: "P", category: "Old", price: 1, imageUrl: "u", description: "d" });
    const agent = await authed();
    const res = await agent.put(`/api/admin/categories/${c._id}`).send({ name: "New" });
    expect(res.status).toBe(200);
    expect((await Product.findOne({ name: "P" }))!.category).toBe("New");
  });

  it("deleting reassigns products to Uncategorized", async () => {
    const c = await Category.create({ name: "Gone" });
    await Product.create({ name: "P", category: "Gone", price: 1, imageUrl: "u", description: "d" });
    const agent = await authed();
    const res = await agent.delete(`/api/admin/categories/${c._id}`);
    expect(res.status).toBe(200);
    expect((await Product.findOne({ name: "P" }))!.category).toBe("Uncategorized");
  });

  it("404s an unknown category", async () => {
    const agent = await authed();
    expect((await agent.put(`/api/admin/categories/${new mongoose.Types.ObjectId()}`).send({ name: "X" })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/admin.categories.test.ts`
Expected: FAIL — no category routes.

- [ ] **Step 3: Add category routes to `admin.ts`** with the fixes noted.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/routes/admin.categories.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin category routes with cascade fixes"
```

---

### Task 15: Admin banner routes

**Files:**
- Modify: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.banners.test.ts`

**Reference:** dashboard banner routes under `/api/admin/banner-images` (`GET`, `POST` upload with `BANNER_IMAGE_TR`, `DELETE` with ImageKit cleanup).

**Interfaces:**
- Consumes: `BannerImg` (Task 4); `uploadImage`, `deleteImage`, `BANNER_IMAGE_TR` (Task 9).

- [ ] **Step 1: Write the failing test `src/routes/admin.banners.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Express } from "express";

const uploadMock = vi.fn(async () => ({ url: "https://ik/b.jpg", fileId: "fid-b" }));
const deleteMock = vi.fn(async () => undefined);
vi.mock("imagekit", () => ({ default: class { upload = uploadMock; deleteFile = deleteMock; } }));

let app: Express, mongo: MongoMemoryServer, BannerImg: any, AdminAuth: any;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.IMAGEKIT_PUBLIC_KEY = "x";
  process.env.IMAGEKIT_PRIVATE_KEY = "x";
  process.env.IMAGEKIT_URL_ENDPOINT = "https://example.com";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { createApp } = await import("../app.js");
  const { loadConfig } = await import("../config.js");
  const { hashPassword } = await import("../auth.js");
  ({ BannerImg, AdminAuth } = await import("../models.js"));
  await AdminAuth.create({ passwordHash: await hashPassword("letmein") });
  app = createApp(loadConfig({}));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await BannerImg.deleteMany({});
});

async function authed() {
  const agent = request.agent(app);
  await agent.post("/api/admin/auth/login").send({ password: "letmein" });
  return agent;
}

describe("admin banners", () => {
  it("requires auth", async () => {
    expect((await request(app).get("/api/admin/banner-images")).status).toBe(401);
  });
  it("uploads a banner", async () => {
    const agent = await authed();
    const res = await agent.post("/api/admin/banner-images").attach("image", Buffer.from("img"), "b.jpg");
    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toBe("https://ik/b.jpg");
    expect(res.body.data.imageFileId).toBe("fid-b");
  });
  it("deletes a banner and its image", async () => {
    const b = await BannerImg.create({ imageUrl: "u", imageFileId: "fid-del" });
    const agent = await authed();
    const res = await agent.delete(`/api/admin/banner-images/${b._id}`);
    expect(res.status).toBe(200);
    expect(deleteMock).toHaveBeenCalledWith("fid-del");
  });
  it("404s an unknown banner", async () => {
    const agent = await authed();
    expect((await agent.delete(`/api/admin/banner-images/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/admin.banners.test.ts`
Expected: FAIL — no banner routes.

- [ ] **Step 3: Add banner routes to `admin.ts`** (port from dashboard).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/routes/admin.banners.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin banner routes (imagekit)"
```

---

### Task 16: Admin order routes (list, pending-count, status + email)

**Files:**
- Modify: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/routes/admin.orders.test.ts`

**Reference:** dashboard order routes under `/api/admin/orders` — `GET` (list newest-first, paginated, `status` filter, global `pendingCount`), `GET /pending-count`, `PATCH /:id/status` (validate status ∈ ORDER_STATUSES, update, fire-and-forget `statusUpdateEmail` when non-null and customer email present).

**Interfaces:**
- Consumes: `Order`, `ORDER_STATUSES` (Task 4); `statusUpdateEmail`, `sendEmail` (Task 6).

- [ ] **Step 1: Write the failing test `src/routes/admin.orders.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Express } from "express";

const { mail } = vi.hoisted(() => ({ mail: { sent: [] as any[], mode: "resolve" as "resolve" | "reject" } }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: async (p: any) => { mail.sent.push(p); if (mail.mode === "reject") throw new Error("boom"); return { id: "t" }; } };
  },
}));
const flush = () => new Promise((r) => setTimeout(r, 50));

let app: Express, mongo: MongoMemoryServer, Order: any, AdminAuth: any;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-secret";
  process.env.RESEND = "k";
  process.env.IMAGEKIT_PUBLIC_KEY = "x";
  process.env.IMAGEKIT_PRIVATE_KEY = "x";
  process.env.IMAGEKIT_URL_ENDPOINT = "https://example.com";
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  const { createApp } = await import("../app.js");
  const { loadConfig } = await import("../config.js");
  const { hashPassword } = await import("../auth.js");
  ({ Order, AdminAuth } = await import("../models.js"));
  await AdminAuth.create({ passwordHash: await hashPassword("letmein") });
  app = createApp(loadConfig({}));
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
beforeEach(async () => {
  await Order.deleteMany({});
  mail.sent = [];
  mail.mode = "resolve";
});

async function authed() {
  const agent = request.agent(app);
  await agent.post("/api/admin/auth/login").send({ password: "letmein" });
  return agent;
}
async function makeOrder(overrides: any = {}) {
  return Order.create({
    orderNumber: "IB-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
    items: [{ productId: new mongoose.Types.ObjectId(), name: "x", unitPrice: 5, quantity: 1, lineTotal: 5, imageUrl: "u" }],
    subtotal: 5, total: 8,
    customer: { fullName: "A", phone: "1", email: "buyer@example.com" },
    shipping: { address: "a", city: "c" },
    ...overrides,
  });
}

describe("admin orders", () => {
  it("requires auth", async () => {
    expect((await request(app).get("/api/admin/orders")).status).toBe(401);
  });

  it("lists newest-first with a global pendingCount", async () => {
    await makeOrder({ status: "pending" });
    await makeOrder({ status: "confirmed" });
    const agent = await authed();
    const res = await agent.get("/api/admin/orders");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.pendingCount).toBe(1);
  });

  it("filters by status but keeps pendingCount global", async () => {
    await makeOrder({ status: "pending" });
    await makeOrder({ status: "confirmed" });
    const agent = await authed();
    const res = await agent.get("/api/admin/orders?status=confirmed");
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pendingCount).toBe(1);
  });

  it("returns the pending-count endpoint", async () => {
    await makeOrder({ status: "pending" });
    const agent = await authed();
    const res = await agent.get("/api/admin/orders/pending-count");
    expect(res.body.count).toBe(1);
  });

  it("updates status and emails the customer on confirmed; still 200 if email throws", async () => {
    const o = await makeOrder({ status: "pending" });
    const agent = await authed();
    const res = await agent.patch(`/api/admin/orders/${o._id}/status`).send({ status: "confirmed" });
    expect(res.status).toBe(200);
    await flush();
    expect(mail.sent.map((m) => m.to)).toContain("buyer@example.com");

    mail.mode = "reject";
    const res2 = await agent.patch(`/api/admin/orders/${o._id}/status`).send({ status: "delivered" });
    expect(res2.status).toBe(200);
  });

  it("does not email when moved to pending", async () => {
    const o = await makeOrder({ status: "confirmed" });
    const agent = await authed();
    await agent.patch(`/api/admin/orders/${o._id}/status`).send({ status: "pending" });
    await flush();
    expect(mail.sent).toHaveLength(0);
  });

  it("rejects an invalid status (400) and 404s an unknown order", async () => {
    const agent = await authed();
    const o = await makeOrder();
    expect((await agent.patch(`/api/admin/orders/${o._id}/status`).send({ status: "bogus" })).status).toBe(400);
    expect((await agent.patch(`/api/admin/orders/${new mongoose.Types.ObjectId()}/status`).send({ status: "confirmed" })).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/admin.orders.test.ts`
Expected: FAIL — no order routes.

- [ ] **Step 3: Add order routes to `admin.ts`** (port from dashboard; email fire-and-forget).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/routes/admin.orders.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: admin order routes (list/pending/status + email)"
```

---

### Task 17: Security hardening (rate-limits + no-public-order-read guarantee)

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/rateLimit.ts`
- Modify: `/home/salah/Projects/issa-beauty-backend/src/app.ts`, `src/routes/public.ts`, `src/routes/admin.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/routes/security.test.ts`

**Reference:** spec §6. Tiered `express-rate-limit`:
- `strictLimiter` (low max, e.g. `max: 5, windowMs: 60_000`) on `POST /api/orders` and `POST /api/admin/auth/login`.
- `looseLimiter` (e.g. `max: 100, windowMs: 60_000`) on public GET routes.
- Make limits overridable via a factory so the test can construct tiny limits without waiting.

**Interfaces:**
- Produces: `makeLimiter(opts: { windowMs: number; max: number }): RequestHandler`; exported `strictLimiter`, `looseLimiter` with production defaults.
- CORS/helmet/body-cap already in `app.ts` (Task 10) — this task adds only rate limits and the explicit no-public-order-read test.

- [ ] **Step 1: Write the failing test `src/routes/security.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import express from "express";
import { makeLimiter } from "../rateLimit.js";

describe("makeLimiter", () => {
  it("429s past the max within the window", async () => {
    const app = express();
    app.use(makeLimiter({ windowMs: 60_000, max: 2 }));
    app.get("/x", (_req, res) => res.json({ ok: true }));
    await request(app).get("/x").expect(200);
    await request(app).get("/x").expect(200);
    await request(app).get("/x").expect(429);
  });
});

describe("no public order reads", () => {
  let app: express.Express, mongo: MongoMemoryServer;
  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    const { createApp } = await import("../app.js");
    const { loadConfig } = await import("../config.js");
    app = createApp(loadConfig({}));
  });
  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("has no public GET that returns orders", async () => {
    // The public router must not expose order listings or order-by-id.
    expect((await request(app).get("/api/orders")).status).toBe(404);
    expect((await request(app).get("/api/orders/000000000000000000000000")).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/routes/security.test.ts`
Expected: FAIL — cannot find module `../rateLimit.js`.

- [ ] **Step 3: Implement `src/rateLimit.ts` and apply limiters**

```typescript
import rateLimit, { type RateLimitRequestHandler } from "express-rate-limit";

export function makeLimiter(opts: { windowMs: number; max: number }): RateLimitRequestHandler {
  return rateLimit({
    windowMs: opts.windowMs,
    max: opts.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later." },
  });
}

export const strictLimiter = makeLimiter({ windowMs: 60_000, max: 5 });
export const looseLimiter = makeLimiter({ windowMs: 60_000, max: 100 });
```

Apply: in `public.ts`, `looseLimiter` on the router (GETs) and `strictLimiter` specifically on `POST /orders`. In `admin.ts`, `strictLimiter` on `POST /auth/login`. (Order matters — attach `strictLimiter` to the login/orders handlers directly so it isn't shadowed by a looser router-level limiter.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/routes/security.test.ts && pnpm test`
Expected: PASS (security suite), and the FULL suite still green.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: tiered rate limiting + assert no public order reads"
```

---

### Task 18: Server bootstrap (index.ts)

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/src/index.ts`
- Test: `/home/salah/Projects/issa-beauty-backend/src/index.test.ts`

**Reference:** merge both `index.js` bootstraps. Sequence: load env (`dotenv.config()`), `loadConfig`, fatal-exit if `!jwtSecret`, `createApp`, `connectDB`, `ensureAdminAuth`, `app.listen(port)`.

**Interfaces:**
- Produces: `start(): Promise<Server>` (exported for testing) and a bottom-of-file `if (import.meta.url === ...)` guard that calls `start()` when run directly. Fatal errors (`connectDB` reject, missing `JWT_SECRET`) log and `process.exit(1)`.
- Consumes: everything above.

- [ ] **Step 1: Write the failing test `src/index.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import type { Server } from "http";

let mongo: MongoMemoryServer, server: Server;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = "test-secret";
  process.env.INITIAL_DASHBOARD_PASSWORD = "letmein";
  process.env.PORT = "0"; // ephemeral port
  process.env.IMAGEKIT_PUBLIC_KEY = "x";
  process.env.IMAGEKIT_PRIVATE_KEY = "x";
  process.env.IMAGEKIT_URL_ENDPOINT = "https://example.com";
});
afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  const mongoose = (await import("mongoose")).default;
  await mongoose.disconnect();
  await mongo.stop();
});

describe("start()", () => {
  it("boots, connects, seeds admin, and serves the API", async () => {
    const { start } = await import("./index.js");
    server = await start();
    const res = await request(server).get("/api/products");
    expect(res.status).toBe(200);
    // admin was seeded → login works
    const login = await request(server).post("/api/admin/auth/login").send({ password: "letmein" });
    expect(login.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/index.test.ts`
Expected: FAIL — cannot find module `./index.js`.

- [ ] **Step 3: Write `src/index.ts`**

```typescript
import "dotenv/config";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { connectDB } from "./db.js";
import { ensureAdminAuth } from "./bootstrapAuth.js";
import type { Server } from "http";

export async function start(): Promise<Server> {
  const config = loadConfig();
  if (!config.jwtSecret) {
    console.error("FATAL: JWT_SECRET is not set");
    process.exit(1);
  }
  await connectDB(config.mongoUri);
  await ensureAdminAuth();
  const app = createApp(config);
  return new Promise((resolve) => {
    const server = app.listen(config.port, () => {
      console.log(`Server listening on port ${config.port}`);
      resolve(server);
    });
  });
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  start().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes, then the whole suite + build**

Run: `pnpm test && pnpm build`
Expected: ALL tests PASS; `tsc` exits 0.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: server bootstrap (connect, seed, listen)"
```

---

### Task 19: Deploy workflow, PM2 config, README (no execution)

**Files:**
- Create: `/home/salah/Projects/issa-beauty-backend/.github/workflows/deploy.yml`
- Create: `/home/salah/Projects/issa-beauty-backend/ecosystem.config.cjs`
- Create: `/home/salah/Projects/issa-beauty-backend/README.md`

**Reference:** storefront `deploy.yml` pattern, adapted for a TS build + api subdomain. **These files are created but NOT run** — no deploy happens in this plan.

**Interfaces:**
- Produces: CI that builds `dist/`, writes `.env` from secrets, rsyncs to `/var/www/issa-beauty-backend/`, `pnpm install --prod`, PM2 reload. Delivery is manual/user-triggered later.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy Backend to Production

on:
  workflow_dispatch:

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - uses: pnpm/action-setup@v3
        with:
          version: 10
      - name: Install & build
        run: |
          pnpm install
          pnpm run build
      - name: Create .env
        run: |
          cat <<EOF > .env
          PORT=${{ secrets.PORT }}
          NODE_ENV=production
          MONGODB_URI=${{ secrets.MONGODB_URI }}
          JWT_SECRET=${{ secrets.JWT_SECRET }}
          INITIAL_DASHBOARD_PASSWORD=${{ secrets.INITIAL_DASHBOARD_PASSWORD }}
          IMAGEKIT_PUBLIC_KEY=${{ secrets.IMAGEKIT_PUBLIC_KEY }}
          IMAGEKIT_PRIVATE_KEY=${{ secrets.IMAGEKIT_PRIVATE_KEY }}
          IMAGEKIT_URL_ENDPOINT=${{ secrets.IMAGEKIT_URL_ENDPOINT }}
          RESEND=${{ secrets.RESEND }}
          STORE_ORDER_EMAIL=${{ secrets.STORE_ORDER_EMAIL }}
          STOREFRONT_ORIGIN=${{ secrets.STOREFRONT_ORIGIN }}
          DASHBOARD_ORIGIN=${{ secrets.DASHBOARD_ORIGIN }}
          EOF
      - name: Deploy with rsync
        uses: burnett01/rsync-deployments@5.2
        with:
          switches: -avz --delete --exclude='.git/' --exclude='node_modules/' --exclude='src/'
          path: ./
          remote_path: /var/www/issa-beauty-backend/
          remote_host: ${{ secrets.HOST }}
          remote_user: ${{ secrets.USERNAME }}
          remote_key: ${{ secrets.SSH_PRIVATE_KEY }}
      - name: Install prod deps & reload PM2
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/issa-beauty-backend
            pnpm install --prod
            pm2 restart issa-beauty-backend --update-env || pm2 start ecosystem.config.cjs
```

> Note: trigger is `workflow_dispatch` only (manual) — not `push` — so nothing deploys until the user runs it.

- [ ] **Step 2: Write `ecosystem.config.cjs`**

```javascript
module.exports = {
  apps: [
    {
      name: "issa-beauty-backend",
      script: "dist/index.js",
      env: { NODE_ENV: "production" },
    },
  ],
};
```

- [ ] **Step 3: Write `README.md`**

A short README: what this is, `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm build`, the env vars (point to `.env.example`), the route map (public `/api/*`, admin `/api/admin/*`), and the deploy note (manual `workflow_dispatch`, api.issabeauty.org, port 5002, PM2). Include the rollout reminder: repoint dashboard client to `/api/admin/*` + set `VITE_API_BASE_URL`; storefront just sets `VITE_API_BASE_URL`.

- [ ] **Step 4: Verify build still green**

Run: `pnpm build && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: add manual deploy workflow, pm2 config, README"
```

---

## Post-plan (NOT part of automated execution — user-driven, after local testing)

These are captured for completeness and happen only after the user tests and approves. Do NOT perform them during plan execution:

1. **Create GitHub repo** under `Salah1221` and push (user action).
2. **Set GitHub secrets** (spec §11) and run the manual deploy workflow.
3. **Frontend cutover** (spec §12 phases 2–3): repoint dashboard client to `VITE_API_BASE_URL` + `/api/admin/*` (+ fix its `lib/auth.ts` interceptor `/api/auth/` → `/api/admin/auth/`); repoint storefront client `ApiClient.ts` to `VITE_API_BASE_URL`. Then retire the old servers.

---

## Self-Review

**Spec coverage check:**
- §3 repo structure → Tasks 1–19 create every file. ✔
- §4 API surface (public `/api/*`, admin `/api/admin/*`, dropped `/api/upload`) → Tasks 10–16; upload never ported. ✔
- §5 CORS + Lax cookie → Task 10 (cors allowlist + credentials), Task 12 (cookie opts). ✔
- §6 security (rate-limit tiers, helmet, 10kb cap, no public order reads, price-integrity, two smell fixes) → Task 10 (helmet/cap/cors), Task 17 (limits + no-order-read), Task 5 (price integrity via buildOrderDoc), Task 13 (dead label), Task 14 (unawaited map). ✔
- §7 model reconciliation (superset, imageFileId, AdminAuth, ORDER_STATUSES) → Task 4. ✔
- §8 consolidation map → Tasks 4–16 follow it. ✔
- §9 testing (port both suites, red-green on admin path move) → every route task ports the matching suite under new paths. ✔
- §10 deploy seamless → Task 19 (manual trigger, .env from secrets). ✔
- §11 env vars → `.env.example` (Task 1) + deploy.yml (Task 19). ✔

**Placeholder scan:** Ported-handler steps reference exact source files + explicit transformations and are backed by full test code; no vague "add error handling". Modules with subtle logic (config, db, imagekit, rateLimit, app, index) include complete code. ✔

**Type consistency:** `createApp(config: Config)` used consistently (Tasks 10, 12, and all route tests). `loadConfig` signature stable. `uploadImage`/`deleteImage` names consistent across Tasks 9/13/15. `ORDER_STATUSES`, `COOKIE_NAME`, `TOKEN_MAX_AGE_MS` referenced with the names defined in Tasks 4/7. ✔
