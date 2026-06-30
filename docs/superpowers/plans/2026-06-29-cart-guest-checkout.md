# Cart + Guest Checkout (COD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a client-side cart and a guest (no-account) cash-on-delivery checkout that records orders to the shared `issa_beauty` MongoDB database.

**Architecture:** Cart state lives client-side in a React Context persisted to `localStorage`. Checkout POSTs `{items:[{productId,quantity}], customer, shipping}` to a new `POST /api/orders`; the server re-fetches products, recomputes all prices/totals from the DB (client prices never trusted), validates stock, and saves an `Order`. The confirmation screen renders from the POST response cached in `sessionStorage`.

**Tech Stack:** Express + Mongoose (server), React 18 + React Router 6 + Tailwind + Radix/shadcn UI (client), Vitest + supertest + mongodb-memory-server (server tests).

## Global Constraints

- **No new client runtime dependency** for the cart — use React Context + `localStorage`.
- **Server is authoritative for money.** Never persist client-supplied prices; recompute from the DB.
- **Stock field is `in_stock`** (boolean) on the stored product documents — not `inStock`.
- **Delivery fee = `3`**, stored per-order as `deliveryFee`. A single source of truth: `DELIVERY_FEE` constant in `server/orders.js`. Dashboard-editable fee is out of scope.
- **Currency display:** `$` prefix, `.toFixed(2)`.
- **Guest checkout:** orders save with `user: null`; the field is reserved for future accounts.
- **Response envelope:** every endpoint returns `{ success, data?, message? }` (matches existing routes).
- **Path alias:** client imports use the `@/` alias (e.g. `@/features/cart/data/CartContext`).
- **ESM:** server is `"type": "module"`; use `import`/`export`.

---

## File Structure

**Server (root project):**
- Create `server/app.js` — the configured Express app (middleware + all routes + prod static), exported as default. No DB connect, no `listen`.
- Modify `server/index.js` — import `app`, call `connectDB()`, then `app.listen(...)`.
- Create `server/orders.js` — pure helpers: `DELIVERY_FEE`, `discountedUnitPrice`, `validateOrderInput`, `buildOrderDoc`, `generateOrderNumber`.
- Modify `server/models/models.js` — add `Order` model.
- Create `server/orders.test.js` — unit tests for the pure helpers.
- Create `server/order.routes.test.js` — supertest integration tests for `POST /api/orders`.
- Create `server/app.smoke.test.js` — smoke test that the extracted app serves `GET /api/products`.
- Modify root `package.json` — add `test` script + dev deps.
- Create root `vitest.config.js`.

**Client:**
- Create `client/src/features/cart/data/CartContext.tsx` — provider, `useCart`, `CartItem` type, `discountedPrice` helper.
- Create `client/src/features/cart/ui/CartSheet.tsx` — cart drawer + trigger icon/badge.
- Modify `client/src/features/products/ui/ProductCard.tsx` — "Add to cart" button.
- Modify `client/src/features/products/ui/ProductPage.tsx` — "Add to cart" button.
- Modify `client/src/layout/ui/Navbar.tsx` — render `<CartSheet/>`.
- Create `client/src/features/checkout/data/orders.ts` — `placeOrder`, types, client `DELIVERY_FEE`.
- Create `client/src/features/checkout/ui/CheckoutPage.tsx` — form + summary + submit.
- Create `client/src/features/checkout/ui/OrderConfirmation.tsx` — success summary.
- Modify `client/src/App.tsx` — wrap with `CartProvider`, add `/checkout` and `/checkout/success` routes.

---

## Task 1: Test tooling + extract `server/app.js`

**Files:**
- Modify: `package.json` (root)
- Create: `vitest.config.js` (root)
- Create: `server/app.js`
- Modify: `server/index.js`
- Create: `server/app.smoke.test.js`

**Interfaces:**
- Produces: `server/app.js` default export = configured Express `app` (no DB connect, no listen). `server/index.js` does `connectDB().then(() => app.listen(PORT))`.

- [ ] **Step 1: Add dev deps and test script**

Run (root is a standalone package — no `-w`):
```bash
pnpm add -D vitest supertest mongodb-memory-server
```
Then edit root `package.json` `scripts` to add:
```json
"test": "vitest run"
```
(Keep existing `dev`, `build`, `start`.)

- [ ] **Step 2: Create root `vitest.config.js`**

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["server/**/*.test.js"],
    // mongodb-memory-server downloads a binary on first run; give it room.
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});
```

- [ ] **Step 3: Create `server/app.js` by moving everything except bootstrap out of `index.js`**

Move all middleware, multer setup, `deleteImage`, `getAllCategories`, every route, and the production static-serving block into `app.js`. Export the app. It must NOT import `connectDB` or call `listen`.

```js
import { BannerImg, Category, Product } from "./models/models.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";

const getAllCategories = async () => {
  return await Category.find();
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const deleteImage = (imageUrl) => {
  const imagePath = path.join(__dirname, "uploads", path.basename(imageUrl));
  if (!fs.existsSync(imagePath)) {
    return;
  }
  fs.unlink(imagePath, (err) => {
    if (err) {
      console.error(err);
    }
  });
};

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage });

app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) {
    return res
      .status(400)
      .json({ success: false, message: "No file uploaded" });
  }
  res
    .status(201)
    .json({ success: true, imageUrl: `/uploads/${req.file.filename}` });
});

app.use(express.static(path.join(__dirname, "uploads")));
```

Then paste, unchanged, the existing route handlers from the current `index.js` in the same order: `GET /api/products`, `GET /api/products-price-range`, `GET /api/products-by-category`, `GET /api/products/:id`, `GET /api/categories`, `GET /api/banner-images`. After those, paste the production static block:

```js
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../client/dist")));

  app.get("*", (_, res) => {
    res.sendFile(path.resolve(__dirname, "../client/dist", "index.html"));
  });
}

export default app;
```

(`deleteImage` and `getAllCategories` are kept because existing handlers reference them.)

- [ ] **Step 4: Replace `server/index.js` with the bootstrap only**

```js
import app from "./app.js";
import { connectDB } from "./db.js";

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {});
});
```

- [ ] **Step 5: Write the smoke test**

Create `server/app.smoke.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;
let app;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  ({ default: app } = await import("./app.js"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("app", () => {
  it("serves GET /api/products with an empty catalog", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.total).toBe(0);
  });
});
```

- [ ] **Step 6: Run the smoke test (verify it passes)**

Run: `pnpm test -- server/app.smoke.test.js`
Expected: PASS (1 test). This confirms the app extraction works.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.js server/app.js server/index.js server/app.smoke.test.js
git commit -m "refactor(server): extract testable app + add vitest tooling"
```

---

## Task 2: `Order` model

**Files:**
- Modify: `server/models/models.js`
- Create: `server/order.model.test.js`

**Interfaces:**
- Produces: `Order` mongoose model (collection `orders`) with fields per the spec; exported from `models.js`.

- [ ] **Step 1: Write the failing model test**

Create `server/order.model.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;
let Order;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  ({ Order } = await import("./models/models.js"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

const validOrder = () => ({
  orderNumber: "IB-ABC123",
  items: [
    {
      productId: new mongoose.Types.ObjectId(),
      name: "Lipstick",
      unitPrice: 10,
      discountPercentage: 0,
      quantity: 2,
      lineTotal: 20,
      imageUrl: "https://example.com/x.jpg",
    },
  ],
  subtotal: 20,
  deliveryFee: 3,
  total: 23,
  customer: { fullName: "Jane", phone: "70123456" },
  shipping: { address: "1 St", city: "Beirut" },
});

describe("Order model", () => {
  it("applies defaults for status, paymentMethod and user", async () => {
    const order = await Order.create(validOrder());
    expect(order.status).toBe("pending");
    expect(order.paymentMethod).toBe("cod");
    expect(order.user).toBeNull();
  });

  it("requires orderNumber", async () => {
    const bad = validOrder();
    delete bad.orderNumber;
    await expect(Order.create(bad)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- server/order.model.test.js`
Expected: FAIL — `Order` is undefined / not exported.

- [ ] **Step 3: Add the `Order` model**

In `server/models/models.js`, before the model creation lines, add:
```js
const orderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    discountPercentage: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
    imageUrl: { type: String, required: true },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    items: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true, default: 3 },
    total: { type: Number, required: true },
    customer: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: false },
    },
    shipping: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      area: { type: String, required: false },
      notes: { type: String, required: false },
    },
    paymentMethod: { type: String, required: true, default: "cod" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "delivered", "cancelled"],
      default: "pending",
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
  },
  { timestamps: true }
);
```
Add the model after the existing `model(...)` lines:
```js
const Order = model("Order", orderSchema, "orders");
```
And add `Order` to the `export { ... }` statement.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- server/order.model.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add server/models/models.js server/order.model.test.js
git commit -m "feat(server): add Order model"
```

---

## Task 3: Order pure helpers (`server/orders.js`)

**Files:**
- Create: `server/orders.js`
- Create: `server/orders.test.js`

**Interfaces:**
- Produces:
  - `DELIVERY_FEE: number` (= 3)
  - `discountedUnitPrice(price: number, discountPercentage?: number): number`
  - `validateOrderInput(body): { valid: boolean, errors: string[] }`
  - `buildOrderDoc(input, productsById): orderDoc` — `input = { items:[{productId,quantity}], customer, shipping }`; `productsById` is an object keyed by product id string → product doc (`{_id,name,price,discountPercentage,imageUrl,in_stock}`). Returns the order document **without** `orderNumber` (set by the route). Throws `Error` with `.status = 400` for unknown or out-of-stock products.
  - `generateOrderNumber(): string` — format `IB-XXXXXX`.

- [ ] **Step 1: Write the failing unit tests**

Create `server/orders.test.js`:
```js
import { describe, it, expect } from "vitest";
import {
  DELIVERY_FEE,
  discountedUnitPrice,
  validateOrderInput,
  buildOrderDoc,
  generateOrderNumber,
} from "./orders.js";

const products = {
  a: { _id: "a", name: "Lipstick", price: 10, discountPercentage: 0, imageUrl: "u1", in_stock: true },
  b: { _id: "b", name: "Serum", price: 20, discountPercentage: 50, imageUrl: "u2", in_stock: true },
  oos: { _id: "oos", name: "Mask", price: 5, imageUrl: "u3", in_stock: false },
};

const validInput = () => ({
  items: [{ productId: "a", quantity: 2 }, { productId: "b", quantity: 1 }],
  customer: { fullName: "Jane", phone: "70123456", email: "j@x.com" },
  shipping: { address: "1 St", city: "Beirut", area: "Hamra", notes: "ring twice" },
});

describe("discountedUnitPrice", () => {
  it("returns full price with no discount", () => {
    expect(discountedUnitPrice(10, 0)).toBe(10);
    expect(discountedUnitPrice(10, undefined)).toBe(10);
  });
  it("applies a percentage discount", () => {
    expect(discountedUnitPrice(20, 50)).toBe(10);
  });
});

describe("validateOrderInput", () => {
  it("accepts a valid body", () => {
    expect(validateOrderInput(validInput()).valid).toBe(true);
  });
  it("rejects an empty cart", () => {
    const b = validInput(); b.items = [];
    expect(validateOrderInput(b).valid).toBe(false);
  });
  it("rejects a missing phone", () => {
    const b = validInput(); b.customer.phone = "";
    expect(validateOrderInput(b).valid).toBe(false);
  });
  it("rejects a bad email", () => {
    const b = validInput(); b.customer.email = "nope";
    expect(validateOrderInput(b).valid).toBe(false);
  });
  it("rejects a missing address", () => {
    const b = validInput(); b.shipping.address = "";
    expect(validateOrderInput(b).valid).toBe(false);
  });
  it("rejects a non-integer quantity", () => {
    const b = validInput(); b.items[0].quantity = 0;
    expect(validateOrderInput(b).valid).toBe(false);
  });
});

describe("buildOrderDoc", () => {
  it("computes line totals, subtotal, delivery fee and total", () => {
    const doc = buildOrderDoc(validInput(), products);
    // a: 10 * 2 = 20 ; b: 20*0.5 = 10 * 1 = 10 ; subtotal 30 ; +3 = 33
    expect(doc.items[0].lineTotal).toBe(20);
    expect(doc.items[1].lineTotal).toBe(10);
    expect(doc.subtotal).toBe(30);
    expect(doc.deliveryFee).toBe(DELIVERY_FEE);
    expect(doc.total).toBe(33);
    expect(doc.paymentMethod).toBe("cod");
    expect(doc.status).toBe("pending");
    expect(doc.user).toBeNull();
    expect(doc.orderNumber).toBeUndefined();
  });
  it("snapshots product fields onto items", () => {
    const doc = buildOrderDoc(validInput(), products);
    expect(doc.items[0]).toMatchObject({ name: "Lipstick", unitPrice: 10, quantity: 2, imageUrl: "u1" });
  });
  it("throws 400 for an unknown product", () => {
    const b = validInput(); b.items = [{ productId: "missing", quantity: 1 }];
    expect(() => buildOrderDoc(b, products)).toThrowError(/not found/i);
  });
  it("throws 400 for an out-of-stock product", () => {
    const b = validInput(); b.items = [{ productId: "oos", quantity: 1 }];
    try {
      buildOrderDoc(b, products);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e.status).toBe(400);
      expect(e.message).toMatch(/out of stock/i);
    }
  });
});

describe("generateOrderNumber", () => {
  it("matches the IB-XXXXXX format", () => {
    expect(generateOrderNumber()).toMatch(/^IB-[0-9A-Z]{6}$/);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- server/orders.test.js`
Expected: FAIL — cannot find module `./orders.js`.

- [ ] **Step 3: Implement `server/orders.js`**

```js
import crypto from "crypto";

export const DELIVERY_FEE = 3;

const round2 = (n) => Math.round(n * 100) / 100;

export function discountedUnitPrice(price, discountPercentage) {
  const d = discountPercentage && discountPercentage > 0 ? discountPercentage : 0;
  return price * (1 - d / 100);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOrderInput(body) {
  const errors = [];
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Invalid request body"] };
  }
  const { items, customer, shipping } = body;

  if (!Array.isArray(items) || items.length === 0) {
    errors.push("Cart is empty");
  } else {
    for (const it of items) {
      if (!it || typeof it.productId !== "string" || !it.productId) {
        errors.push("Invalid cart item");
        break;
      }
      if (!Number.isInteger(it.quantity) || it.quantity < 1) {
        errors.push("Invalid quantity");
        break;
      }
    }
  }

  if (!customer || typeof customer.fullName !== "string" || !customer.fullName.trim())
    errors.push("Full name is required");
  if (!customer || typeof customer.phone !== "string" || !customer.phone.trim())
    errors.push("Phone is required");
  if (customer && customer.email && !EMAIL_RE.test(customer.email))
    errors.push("Invalid email");

  if (!shipping || typeof shipping.address !== "string" || !shipping.address.trim())
    errors.push("Address is required");
  if (!shipping || typeof shipping.city !== "string" || !shipping.city.trim())
    errors.push("City is required");

  return { valid: errors.length === 0, errors };
}

export function buildOrderDoc(input, productsById) {
  const items = input.items.map((it) => {
    const p = productsById[it.productId];
    if (!p) {
      const e = new Error("A product in your cart was not found");
      e.status = 400;
      throw e;
    }
    if (p.in_stock === false) {
      const e = new Error(`${p.name} is out of stock`);
      e.status = 400;
      throw e;
    }
    const unit = discountedUnitPrice(p.price, p.discountPercentage);
    return {
      productId: p._id,
      name: p.name,
      unitPrice: p.price,
      discountPercentage: p.discountPercentage ?? 0,
      quantity: it.quantity,
      lineTotal: round2(unit * it.quantity),
      imageUrl: p.imageUrl,
    };
  });

  const subtotal = round2(items.reduce((s, i) => s + i.lineTotal, 0));
  const deliveryFee = DELIVERY_FEE;
  const total = round2(subtotal + deliveryFee);

  return {
    items,
    subtotal,
    deliveryFee,
    total,
    customer: {
      fullName: input.customer.fullName.trim(),
      phone: input.customer.phone.trim(),
      email: input.customer.email?.trim() || undefined,
    },
    shipping: {
      address: input.shipping.address.trim(),
      city: input.shipping.city.trim(),
      area: input.shipping.area?.trim() || undefined,
      notes: input.shipping.notes?.trim() || undefined,
    },
    paymentMethod: "cod",
    status: "pending",
    user: null,
  };
}

export function generateOrderNumber() {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const bytes = crypto.randomBytes(6);
  let s = "";
  for (let i = 0; i < 6; i++) s += alphabet[bytes[i] % alphabet.length];
  return `IB-${s}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- server/orders.test.js`
Expected: PASS (all describe blocks green).

- [ ] **Step 5: Commit**

```bash
git add server/orders.js server/orders.test.js
git commit -m "feat(server): add order pricing/validation helpers"
```

---

## Task 4: `POST /api/orders` route

**Files:**
- Modify: `server/app.js`
- Create: `server/order.routes.test.js`

**Interfaces:**
- Consumes: `validateOrderInput`, `buildOrderDoc`, `generateOrderNumber` from `./orders.js`; `Product`, `Order` from `./models/models.js`.
- Produces: `POST /api/orders` → `201 { success:true, data: <savedOrder> }` on success; `400 { success:false, message }` on validation/stock failure; `500` on unexpected error.

- [ ] **Step 1: Write the failing integration test**

Create `server/order.routes.test.js`:
```js
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo;
let app;
let Product;
let Order;

beforeAll(async () => {
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
});

const makeBody = (items) => ({
  items,
  customer: { fullName: "Jane", phone: "70123456", email: "j@x.com" },
  shipping: { address: "1 St", city: "Beirut" },
});

describe("POST /api/orders", () => {
  it("creates an order and computes totals incl. delivery fee", async () => {
    const p = await Product.create({
      name: "Serum", category: "skin", price: 20, discountPercentage: 50,
      imageUrl: "u", description: "d", in_stock: true,
    });
    const res = await request(app)
      .post("/api/orders")
      .send(makeBody([{ productId: String(p._id), quantity: 2 }]));
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subtotal).toBe(20); // 20*0.5*2
    expect(res.body.data.deliveryFee).toBe(3);
    expect(res.body.data.total).toBe(23);
    expect(res.body.data.orderNumber).toMatch(/^IB-/);
    expect(res.body.data.status).toBe("pending");
    expect(await Order.countDocuments()).toBe(1);
  });

  it("ignores client-supplied prices (recomputes from DB)", async () => {
    const p = await Product.create({
      name: "X", category: "c", price: 10, imageUrl: "u", description: "d", in_stock: true,
    });
    const res = await request(app)
      .post("/api/orders")
      .send(makeBody([{ productId: String(p._id), quantity: 1, price: 0.01 }]));
    expect(res.body.data.subtotal).toBe(10);
  });

  it("rejects an out-of-stock product with 400", async () => {
    const p = await Product.create({
      name: "Mask", category: "c", price: 5, imageUrl: "u", description: "d", in_stock: false,
    });
    const res = await request(app)
      .post("/api/orders")
      .send(makeBody([{ productId: String(p._id), quantity: 1 }]));
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/out of stock/i);
  });

  it("rejects an unknown product with 400", async () => {
    const res = await request(app)
      .post("/api/orders")
      .send(makeBody([{ productId: String(new mongoose.Types.ObjectId()), quantity: 1 }]));
    expect(res.status).toBe(400);
  });

  it("rejects missing required fields with 400", async () => {
    const p = await Product.create({
      name: "X", category: "c", price: 10, imageUrl: "u", description: "d", in_stock: true,
    });
    const body = makeBody([{ productId: String(p._id), quantity: 1 }]);
    body.customer.phone = "";
    const res = await request(app).post("/api/orders").send(body);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- server/order.routes.test.js`
Expected: FAIL — route returns 404 (not yet defined).

- [ ] **Step 3: Add the route to `server/app.js`**

Add `Order` to the models import at the top:
```js
import { BannerImg, Category, Order, Product } from "./models/models.js";
```
Add this import near the other imports:
```js
import { validateOrderInput, buildOrderDoc, generateOrderNumber } from "./orders.js";
```
Add the route after the `GET /api/banner-images` handler and before the production static block:
```js
app.post("/api/orders", async (req, res) => {
  const { valid, errors } = validateOrderInput(req.body);
  if (!valid) {
    return res.status(400).json({ success: false, message: errors[0] });
  }
  try {
    const ids = req.body.items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: ids } });
    const productsById = {};
    products.forEach((p) => {
      productsById[String(p._id)] = p;
    });

    let doc;
    try {
      doc = buildOrderDoc(req.body, productsById);
    } catch (e) {
      return res.status(e.status || 400).json({ success: false, message: e.message });
    }

    let saved;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        saved = await Order.create({ ...doc, orderNumber: generateOrderNumber() });
        break;
      } catch (e) {
        if (e.code === 11000 && attempt === 0) continue; // duplicate orderNumber, retry once
        throw e;
      }
    }

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- server/order.routes.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Run the full server suite**

Run: `pnpm test`
Expected: PASS — all server test files green.

- [ ] **Step 6: Commit**

```bash
git add server/app.js server/order.routes.test.js
git commit -m "feat(server): add POST /api/orders endpoint"
```

---

## Task 5: Cart context (client state)

**Files:**
- Create: `client/src/features/cart/data/CartContext.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Produces:
  - `type CartItem = { productId: string; name: string; price: number; discountPercentage?: number; imageUrl: string; quantity: number }`
  - `discountedPrice(price: number, discountPercentage?: number): number`
  - `CartProvider({ children })`
  - `useCart(): { items: CartItem[]; count: number; subtotal: number; addItem(item: Omit<CartItem,"quantity">, quantity?: number): void; removeItem(productId: string): void; setQuantity(productId: string, quantity: number): void; clear(): void }`
- Consumed by: Tasks 6, 8, 9.

- [ ] **Step 1: Create `CartContext.tsx`**

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  discountPercentage?: number;
  imageUrl: string;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "cart";

export const discountedPrice = (price: number, discountPercentage?: number) =>
  discountPercentage && discountPercentage > 0
    ? price * (1 - discountPercentage / 100)
    : price;

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem: CartContextValue["addItem"] = (item, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === item.productId);
      if (existing) {
        return prev.map((i) =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + quantity }
            : i,
        );
      }
      return [...prev, { ...item, quantity }];
    });
  };

  const removeItem = (productId: string) =>
    setItems((prev) => prev.filter((i) => i.productId !== productId));

  const setQuantity = (productId: string, quantity: number) =>
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.productId !== productId)
        : prev.map((i) => (i.productId === productId ? { ...i, quantity } : i)),
    );

  const clear = () => setItems([]);

  const count = useMemo(
    () => items.reduce((s, i) => s + i.quantity, 0),
    [items],
  );
  const subtotal = useMemo(
    () =>
      items.reduce(
        (s, i) => s + discountedPrice(i.price, i.discountPercentage) * i.quantity,
        0,
      ),
    [items],
  );

  const value = useMemo<CartContextValue>(
    () => ({ items, count, subtotal, addItem, removeItem, setQuantity, clear }),
    [items, count, subtotal],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
```

- [ ] **Step 2: Wrap the app with `CartProvider`**

In `client/src/App.tsx`, add the import:
```tsx
import { CartProvider } from "@/features/cart/data/CartContext";
```
Change the return of `App` from:
```tsx
  return <RouterProvider router={router} />;
```
to:
```tsx
  return (
    <CartProvider>
      <RouterProvider router={router} />
    </CartProvider>
  );
```

- [ ] **Step 3: Typecheck/build**

Run: `pnpm --prefix client build`
Expected: build succeeds (no TS errors).

- [ ] **Step 4: Commit**

```bash
git add client/src/features/cart/data/CartContext.tsx client/src/App.tsx
git commit -m "feat(client): add cart context with localStorage persistence"
```

---

## Task 6: Cart UI — add-to-cart buttons, cart drawer, navbar icon

> **Use the `superpowers:frontend-design` skill** for this task (visual components). Keep styling consistent with existing shadcn/Tailwind usage.

**Files:**
- Create: `client/src/features/cart/ui/CartSheet.tsx`
- Modify: `client/src/layout/ui/Navbar.tsx`
- Modify: `client/src/features/products/ui/ProductCard.tsx`
- Modify: `client/src/features/products/ui/ProductPage.tsx`

**Interfaces:**
- Consumes: `useCart`, `discountedPrice` from `@/features/cart/data/CartContext`; `ikUrl` from `@/common/utils/utils`; `Sheet*` from `@/common/ui/components/sheet`; `Button` from `@/common/ui/components/button`.
- Produces: `CartSheet` default export (renders its own trigger icon + badge).

- [ ] **Step 1: Create `CartSheet.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Plus, Minus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/common/ui/components/sheet";
import { Button } from "@/common/ui/components/button";
import { useCart, discountedPrice } from "@/features/cart/data/CartContext";
import { ikUrl } from "@/common/utils/utils";

export default function CartSheet() {
  const { items, count, subtotal, setQuantity, removeItem } = useCart();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const goCheckout = () => {
    setOpen(false);
    navigate("/checkout");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Open cart">
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your Cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <p className="mt-8 text-center text-muted-foreground">
            Your cart is empty.
          </p>
        ) : (
          <div className="-mx-6 flex-1 divide-y overflow-y-auto px-6">
            {items.map((item) => (
              <div key={item.productId} className="flex gap-3 py-4">
                <img
                  src={ikUrl(item.imageUrl, "w-160,q-80,f-auto")}
                  alt={item.name}
                  className="h-16 w-16 rounded object-cover"
                />
                <div className="flex flex-1 flex-col">
                  <span className="line-clamp-2 text-sm font-medium">
                    {item.name}
                  </span>
                  <span className="text-sm font-semibold">
                    ${discountedPrice(item.price, item.discountPercentage).toFixed(2)}
                  </span>
                  <div className="mt-auto flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuantity(item.productId, item.quantity - 1)}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setQuantity(item.productId, item.quantity + 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto h-7 w-7 text-destructive"
                      onClick={() => removeItem(item.productId)}
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <SheetFooter className="mt-auto flex-col gap-3 sm:flex-col sm:space-x-0">
            <div className="flex w-full justify-between text-sm">
              <span>Subtotal</span>
              <span className="font-semibold">${subtotal.toFixed(2)}</span>
            </div>
            <Button className="w-full" onClick={goCheckout}>
              Checkout
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Render `CartSheet` in the Navbar**

In `client/src/layout/ui/Navbar.tsx`, add the import:
```tsx
import CartSheet from "@/features/cart/ui/CartSheet";
```
Inside the actions container (the `div` with the theme toggle, around lines 98–136), add `<CartSheet />` immediately after the theme-toggle `Button` block so the cart icon sits to the right of the theme toggle.

- [ ] **Step 3: Add "Add to cart" to `ProductCard`**

In `client/src/features/products/ui/ProductCard.tsx`:
- Add imports:
```tsx
import { Button } from "@/common/ui/components/button";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/features/cart/data/CartContext";
```
- Inside the component, add: `const { addItem } = useCart();`
- In the price/footer row (the `div` at lines 74–92), replace the out-of-stock conditional area so the row shows the add-to-cart button when in stock and the "Out of stock" badge otherwise. Add this button (it must be `relative z-10` to sit above the card's `after:absolute after:inset-0` link overlay, and must stop the click from navigating):
```tsx
{in_stock === false ? (
  <Badge variant="destructive">Out of stock</Badge>
) : (
  <Button
    size="icon"
    className="relative z-10 h-8 w-8"
    aria-label={`Add ${name} to cart`}
    onClick={(e) => {
      e.preventDefault();
      e.stopPropagation();
      addItem({ productId: id, name, price, discountPercentage, imageUrl });
    }}
  >
    <ShoppingCart className="h-4 w-4" />
  </Button>
)}
```
(Replace the existing `{in_stock !== undefined && !in_stock && (<Badge .../>)}` block with the above.)

- [ ] **Step 4: Add "Add to cart" to `ProductPage`**

In `client/src/features/products/ui/ProductPage.tsx`:
- Add imports:
```tsx
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/features/cart/data/CartContext";
```
- Inside the component, add: `const { addItem } = useCart();`
- In the actions row (the `div` at lines 174–203, containing the WhatsApp + Copy URL buttons), add as the first button:
```tsx
<Button
  variant="default"
  disabled={product.in_stock === false}
  onClick={() =>
    addItem({
      productId: product._id,
      name: product.name,
      price: product.price,
      discountPercentage: product.discountPercentage,
      imageUrl: product.imageUrl,
    })
  }
>
  <ShoppingCart className="mr-2 h-4 w-4" />
  Add to cart
</Button>
```

- [ ] **Step 5: Typecheck/build**

Run: `pnpm --prefix client build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification**

Run `pnpm dev` (from repo root). In the browser:
- Cart icon appears in the navbar; badge hidden when empty.
- Click "Add to cart" on a product card → it does NOT navigate to the product page; badge increments.
- Out-of-stock product card shows the "Out of stock" badge instead of the add button.
- Open cart drawer → item listed; +/- adjust quantity (0 removes); trash removes; subtotal updates.
- Product page "Add to cart" works and is disabled for out-of-stock products.

- [ ] **Step 7: Commit**

```bash
git add client/src/features/cart/ui/CartSheet.tsx client/src/layout/ui/Navbar.tsx client/src/features/products/ui/ProductCard.tsx client/src/features/products/ui/ProductPage.tsx
git commit -m "feat(client): cart drawer, navbar cart icon, add-to-cart buttons"
```

---

## Task 7: Checkout API client

**Files:**
- Create: `client/src/features/checkout/data/orders.ts`

**Interfaces:**
- Consumes: `request` from `@/common/data/ApiClient`; `ApiResult` from `@/common/data/ApiResult`.
- Produces:
  - `DELIVERY_FEE = 3` (display only)
  - types `OrderItemInput`, `CustomerInput`, `ShippingInput`, `PlaceOrderInput`, `PlacedOrderItem`, `PlacedOrder`
  - `placeOrder(input: PlaceOrderInput): Promise<ApiResult<PlacedOrder>>`
- Consumed by: Tasks 8, 9.

- [ ] **Step 1: Create `orders.ts`**

```ts
import { request } from "@/common/data/ApiClient";
import { ApiResult } from "@/common/data/ApiResult";

// Display-only mirror of the server's authoritative delivery fee.
export const DELIVERY_FEE = 3;

export type OrderItemInput = { productId: string; quantity: number };
export type CustomerInput = { fullName: string; phone: string; email?: string };
export type ShippingInput = {
  address: string;
  city: string;
  area?: string;
  notes?: string;
};
export type PlaceOrderInput = {
  items: OrderItemInput[];
  customer: CustomerInput;
  shipping: ShippingInput;
};

export type PlacedOrderItem = {
  productId: string;
  name: string;
  unitPrice: number;
  discountPercentage: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
};

export type PlacedOrder = {
  orderNumber: string;
  items: PlacedOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customer: CustomerInput;
  shipping: ShippingInput;
  paymentMethod: string;
  status: string;
  createdAt: string;
};

export const placeOrder = (
  input: PlaceOrderInput,
): Promise<ApiResult<PlacedOrder>> =>
  request<PlacedOrder>({ url: "/api/orders", method: "POST", data: input });
```

- [ ] **Step 2: Typecheck/build**

Run: `pnpm --prefix client build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/checkout/data/orders.ts
git commit -m "feat(client): add placeOrder API client"
```

---

## Task 8: Checkout page

> **Use the `superpowers:frontend-design` skill** for this task.

**Files:**
- Create: `client/src/features/checkout/ui/CheckoutPage.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `useCart`, `discountedPrice` from `@/features/cart/data/CartContext`; `placeOrder`, `DELIVERY_FEE`, `PlaceOrderInput` from `@/features/checkout/data/orders`; `Button`, `Input` components; `useNavigate` from react-router.
- Behavior: empty cart → message + link to products. On submit success → store the returned `PlacedOrder` in `sessionStorage` under `"lastOrder"`, call `clear()`, navigate to `/checkout/success`. On error → show the message.

- [ ] **Step 1: Create `CheckoutPage.tsx`**

```tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, discountedPrice } from "@/features/cart/data/CartContext";
import {
  placeOrder,
  DELIVERY_FEE,
  type PlaceOrderInput,
} from "@/features/checkout/data/orders";
import { Button } from "@/common/ui/components/button";
import { Input } from "@/common/ui/components/input";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    area: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold">Your cart is empty</h1>
        <p className="mt-2 text-muted-foreground">
          Add some products before checking out.
        </p>
        <Button asChild className="mt-6">
          <Link to="/products">Browse products</Link>
        </Button>
      </div>
    );
  }

  const total = subtotal + DELIVERY_FEE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const input: PlaceOrderInput = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      customer: {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
      },
      shipping: {
        address: form.address,
        city: form.city,
        area: form.area || undefined,
        notes: form.notes || undefined,
      },
    };

    const result = await placeOrder(input);
    setSubmitting(false);

    if (result.type === "success") {
      sessionStorage.setItem("lastOrder", JSON.stringify(result.data));
      clear();
      navigate("/checkout/success");
    } else if (result.type === "error") {
      setError(result.message);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-3xl font-bold">Checkout</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2 className="text-lg font-semibold">Contact</h2>
          <Input placeholder="Full name *" value={form.fullName} onChange={set("fullName")} required />
          <Input placeholder="Phone *" value={form.phone} onChange={set("phone")} required />
          <Input type="email" placeholder="Email (optional)" value={form.email} onChange={set("email")} />

          <h2 className="pt-2 text-lg font-semibold">Delivery</h2>
          <Input placeholder="Address *" value={form.address} onChange={set("address")} required />
          <Input placeholder="City *" value={form.city} onChange={set("city")} required />
          <Input placeholder="Area (optional)" value={form.area} onChange={set("area")} />
          <Input placeholder="Notes (optional)" value={form.notes} onChange={set("notes")} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Placing order..." : "Place order (Cash on delivery)"}
          </Button>
        </form>

        <div className="h-fit rounded-lg border p-6">
          <h2 className="mb-4 text-lg font-semibold">Order summary</h2>
          <div className="divide-y">
            {items.map((i) => (
              <div key={i.productId} className="flex justify-between py-2 text-sm">
                <span className="pr-2">
                  {i.name} × {i.quantity}
                </span>
                <span className="font-medium">
                  ${(discountedPrice(i.price, i.discountPercentage) * i.quantity).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 border-t pt-4 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>${DELIVERY_FEE.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the `/checkout` route**

In `client/src/App.tsx`, add the import:
```tsx
import CheckoutPage from "@/features/checkout/ui/CheckoutPage";
```
Add to the `children` array of the layout route:
```tsx
{
  path: "checkout",
  element: <CheckoutPage />,
},
```

- [ ] **Step 3: Typecheck/build**

Run: `pnpm --prefix client build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

With `pnpm dev` running: add items, open cart, click Checkout → `/checkout` shows the form + summary with subtotal, `$3.00` delivery, total. Empty cart (remove all) → shows the empty-cart message. Submitting with blank required fields is blocked by the browser (`required`).

- [ ] **Step 5: Commit**

```bash
git add client/src/features/checkout/ui/CheckoutPage.tsx client/src/App.tsx
git commit -m "feat(client): checkout page with COD order submission"
```

---

## Task 9: Order confirmation page

> **Use the `superpowers:frontend-design` skill** for this task.

**Files:**
- Create: `client/src/features/checkout/ui/OrderConfirmation.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `PlacedOrder` from `@/features/checkout/data/orders`; reads `sessionStorage["lastOrder"]`.
- Behavior: if no stored order, redirect to `/`. Otherwise render order number, items, subtotal, delivery fee, total, and entered contact/shipping info.

- [ ] **Step 1: Create `OrderConfirmation.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { Button } from "@/common/ui/components/button";
import { type PlacedOrder } from "@/features/checkout/data/orders";

export default function OrderConfirmation() {
  const navigate = useNavigate();
  const [order, setOrder] = useState<PlacedOrder | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("lastOrder");
    if (!raw) {
      navigate("/", { replace: true });
      return;
    }
    try {
      setOrder(JSON.parse(raw) as PlacedOrder);
    } catch {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  if (!order) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <CircleCheck className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-4 text-2xl font-bold">Order placed!</h1>
        <p className="mt-1 text-muted-foreground">
          Your order number is{" "}
          <span className="font-semibold text-foreground">{order.orderNumber}</span>.
          We'll contact you to confirm delivery (cash on delivery).
        </p>
      </div>

      <div className="mt-8 rounded-lg border p-6">
        <h2 className="mb-4 text-lg font-semibold">Order summary</h2>
        <div className="divide-y">
          {order.items.map((i) => (
            <div key={i.productId} className="flex justify-between py-2 text-sm">
              <span className="pr-2">
                {i.name} × {i.quantity}
              </span>
              <span className="font-medium">${i.lineTotal.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-1 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery</span>
            <span>${order.deliveryFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border p-6 text-sm">
        <h2 className="mb-3 text-lg font-semibold">Delivery details</h2>
        <p>{order.customer.fullName}</p>
        <p>{order.customer.phone}</p>
        {order.customer.email && <p>{order.customer.email}</p>}
        <p className="mt-2">
          {order.shipping.address}
          {order.shipping.area ? `, ${order.shipping.area}` : ""}, {order.shipping.city}
        </p>
        {order.shipping.notes && (
          <p className="mt-1 text-muted-foreground">Notes: {order.shipping.notes}</p>
        )}
      </div>

      <Button asChild className="mt-8 w-full">
        <Link to="/products">Continue shopping</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Add the `/checkout/success` route**

In `client/src/App.tsx`, add the import:
```tsx
import OrderConfirmation from "@/features/checkout/ui/OrderConfirmation";
```
Add to the layout route `children`:
```tsx
{
  path: "checkout/success",
  element: <OrderConfirmation />,
},
```

- [ ] **Step 3: Typecheck/build**

Run: `pnpm --prefix client build`
Expected: build succeeds.

- [ ] **Step 4: Manual end-to-end verification**

With `pnpm dev` running and the server connected to the DB: add items → checkout → fill the form → Place order. Expect: redirect to `/checkout/success` showing the order number, items, subtotal, `$3.00` delivery, total, and your contact/shipping details. The cart badge resets to empty. Confirm a document exists in the `orders` collection (e.g. via the dashboard's DB or `mongosh`). Visiting `/checkout/success` directly with no recent order redirects home.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/checkout/ui/OrderConfirmation.tsx client/src/App.tsx
git commit -m "feat(client): order confirmation page"
```

---

## Final verification

- [ ] Run full server tests: `pnpm test` → all green.
- [ ] Run client build: `pnpm --prefix client build` → succeeds.
- [ ] Manual happy path: browse → add to cart → checkout → confirmation → order persisted with `user: null`, `status: "pending"`, correct totals incl. `$3` delivery.
