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
