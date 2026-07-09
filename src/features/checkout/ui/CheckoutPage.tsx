import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart, discountedPrice } from "@/features/cart/data/CartContext";
import {
  placeOrder,
  DELIVERY_FEE,
  type PlaceOrderInput,
} from "@/features/checkout/data/orders";
import { Button } from "@/common/ui/components/button";
import { Input } from "@/common/ui/components/input";
import { formatPrice } from "@/common/utils/currency";
import Seo from "@/common/seo/Seo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/common/ui/components/select";
import { useAuth } from "@/features/auth/data/AuthContext";
import { COUNTRY_CODES, profileToForm } from "@/features/checkout/data/profileForm";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    area: "",
    notes: "",
  });
  const [countryCode, setCountryCode] = useState<string>(COUNTRY_CODES[0].code);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof typeof form, string>>
  >({});

  // Seed the form once from the logged-in user's saved profile. Only fill fields
  // the shopper hasn't already typed into, so a late-arriving profile (auth loads
  // async) never clobbers in-progress input.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current || !user) return;
    seededRef.current = true;
    const { form: seeded, countryCode: seededCode } = profileToForm(user.profile, user.email);
    setForm((f) => ({
      fullName: f.fullName || seeded.fullName,
      phone: f.phone || seeded.phone,
      email: f.email || seeded.email,
      address: f.address || seeded.address,
      city: f.city || seeded.city,
      area: f.area || seeded.area,
      notes: f.notes || seeded.notes,
    }));
    // seededRef gates the body's mutations to a single run (the effect itself
    // may still be invoked on any `user` reference change). The setForm
    // functional updater reads the latest committed state, so typed text is
    // never clobbered. The `if (!form.phone)` guard instead reads the
    // render-closure snapshot rather than latest state — harmless today because
    // there's a single null->user transition and COUNTRY_CODES has one entry
    // (setting the only code is a no-op); revisit this guard if more dialing
    // codes are added.
    if (!form.phone) setCountryCode(seededCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const set =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }));
      // Clear this field's error as the user edits it.
      setFieldErrors((errs) =>
        errs[key] ? { ...errs, [key]: undefined } : errs,
      );
    };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const validate = () => {
    const errs: Partial<Record<keyof typeof form, string>> = {};
    if (!form.fullName.trim()) errs.fullName = "Please enter your full name.";
    const phoneDigits = form.phone.replace(/\s/g, "");
    if (!/^\d{6,8}$/.test(phoneDigits))
      errs.phone = "Enter a valid phone number (6–8 digits).";
    if (!EMAIL_RE.test(form.email.trim()))
      errs.email = "Enter a valid email address.";
    if (!form.address.trim()) errs.address = "Please enter your address.";
    if (!form.city.trim()) errs.city = "Please enter your city.";
    return errs;
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <Seo title="Checkout" noIndex />
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

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
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
      <Seo title="Checkout" noIndex />
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
                    {formatPrice(discountedPrice(i.price, i.discountPercentage) * i.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span className="tabular-nums">{formatPrice(DELIVERY_FEE)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold pt-1">
                <span>Total</span>
                <span className="tabular-nums">{formatPrice(total)}</span>
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
            autoComplete="name"
            aria-label="Full name"
            aria-invalid={!!fieldErrors.fullName}
          />
          {fieldErrors.fullName && (
            <p className="text-destructive text-xs">{fieldErrors.fullName}</p>
          )}
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
              autoComplete="tel-national"
              aria-label="Phone number"
              aria-invalid={!!fieldErrors.phone}
            />
          </div>
          {fieldErrors.phone && (
            <p className="text-destructive text-xs">{fieldErrors.phone}</p>
          )}
          <Input
            type="email"
            inputMode="email"
            placeholder="Email *"
            value={form.email}
            onChange={set("email")}
            required
            autoComplete="email"
            aria-label="Email"
            aria-invalid={!!fieldErrors.email}
          />
          {fieldErrors.email && (
            <p className="text-destructive text-xs">{fieldErrors.email}</p>
          )}

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
            autoComplete="street-address"
            aria-label="Address"
            aria-invalid={!!fieldErrors.address}
          />
          {fieldErrors.address && (
            <p className="text-destructive text-xs">{fieldErrors.address}</p>
          )}
          <Input
            placeholder="City *"
            value={form.city}
            onChange={set("city")}
            required
            autoComplete="address-level2"
            aria-label="City"
            aria-invalid={!!fieldErrors.city}
          />
          {fieldErrors.city && (
            <p className="text-destructive text-xs">{fieldErrors.city}</p>
          )}
          <Input
            placeholder="Area (optional)"
            value={form.area}
            onChange={set("area")}
            autoComplete="address-level3"
            aria-label="Area"
          />
          <Input
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={set("notes")}
            aria-label="Order notes"
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
