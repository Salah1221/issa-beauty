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
