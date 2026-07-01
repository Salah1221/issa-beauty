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
