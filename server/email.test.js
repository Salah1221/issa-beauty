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
