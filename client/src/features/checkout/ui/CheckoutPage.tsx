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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/ui/components/select";

// Supported dialing codes. Lebanon only for now; add entries here to extend.
const COUNTRY_CODES = [{ code: "+961", label: "🇱🇧 +961" }];

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
  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[0].code);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
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
        phone: `${countryCode} ${form.phone.trim()}`,
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
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Checkout</h1>

      {/* Mobile: summary first; md+: grid places form left, summary right */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8 lg:gap-12">
        {/* Order summary — comes first in DOM so it appears above form on mobile */}
        <div className="md:order-last">
          <div className="rounded-xl border bg-card shadow-sm p-6 md:sticky md:top-24">
            <h2 className="text-base font-semibold mb-4">Order summary</h2>
            <div className="divide-y">
              {items.map((i) => (
                <div key={i.productId} className="flex justify-between py-2 text-sm">
                  <span className="pr-2 text-foreground">
                    {i.name} × {i.quantity}
                  </span>
                  <span className="font-medium tabular-nums">
                    ${(discountedPrice(i.price, i.discountPercentage) * i.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span className="tabular-nums">${DELIVERY_FEE.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-1">
                <span>Total</span>
                <span className="tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact group */}
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Contact
          </p>
          <Input
            placeholder="Full name *"
            value={form.fullName}
            onChange={set("fullName")}
            required
          />
          <div className="flex gap-2">
            <Select value={countryCode} onValueChange={setCountryCode}>
              <SelectTrigger className="w-[110px] shrink-0" aria-label="Country code">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRY_CODES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="tel"
              inputMode="tel"
              className="flex-1"
              placeholder="Phone *"
              value={form.phone}
              onChange={set("phone")}
              required
            />
          </div>
          <Input
            type="email"
            placeholder="Email (optional)"
            value={form.email}
            onChange={set("email")}
          />

          {/* Divider with notch */}
          <div className="relative flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
              Delivery
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Delivery group */}
          <Input
            placeholder="Address *"
            value={form.address}
            onChange={set("address")}
            required
          />
          <Input
            placeholder="City *"
            value={form.city}
            onChange={set("city")}
            required
          />
          <Input
            placeholder="Area (optional)"
            value={form.area}
            onChange={set("area")}
          />
          <Input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={set("notes")}
          />

          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full h-12 text-sm font-semibold tracking-wide"
            disabled={submitting}
          >
            {submitting ? "Placing order…" : "Place order — cash on delivery"}
          </Button>
        </form>
      </div>
    </div>
  );
}
