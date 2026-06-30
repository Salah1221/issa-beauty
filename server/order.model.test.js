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
