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
