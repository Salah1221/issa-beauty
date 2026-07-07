import { describe, it, expect } from "vitest";
import { discountedPrice } from "@/features/cart/data/CartContext";

describe("discountedPrice", () => {
  it("returns the price unchanged when discount is undefined", () => {
    expect(discountedPrice(100)).toBe(100);
  });

  it("returns the price unchanged when discount is 0", () => {
    expect(discountedPrice(100, 0)).toBe(100);
  });

  it("applies a normal percentage discount", () => {
    expect(discountedPrice(100, 20)).toBe(80);
  });

  it("returns 0 for a 100% discount", () => {
    expect(discountedPrice(100, 100)).toBe(0);
  });
});
