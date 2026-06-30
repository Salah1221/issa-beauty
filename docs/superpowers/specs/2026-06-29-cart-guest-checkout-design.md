# Cart + Guest Checkout (COD) — Design

**Date:** 2026-06-29
**Status:** Approved
**Milestone:** 1 of the gallery → e-commerce transformation

## Goal

Turn the read-only product gallery into a working store: customers can add
products to a cart and place an order without an account. Orders are recorded
to the shared `issa_beauty` MongoDB database for the dashboard app to act on
later. Payment is cash on delivery (COD) / order-request only — no online
payment in this milestone.

## Key decisions

- **Guest checkout, account-ready.** No login required. Each order carries the
  customer's contact/shipping info directly. An optional, nullable `user`
  reference is reserved so accounts can be layered on later (and past guest
  orders linked by email) with no migration.
- **Server is the source of truth for money.** The client sends only
  `{ productId, quantity }` per line plus customer info. The server re-fetches
  each product, recomputes unit prices / discounts / totals from the DB, and
  validates availability. Client-supplied prices are never trusted; this also
  avoids stale-price bugs.
- **Dashboard integration is the shared `orders` collection only** — no
  cross-app API. The storefront writes; the dashboard reads (later milestone).

## Architecture

- **Cart** is entirely client-side: a `CartProvider` (React Context) persisted
  to `localStorage` (survives refresh, needs no login). It stores
  `{ productId, quantity }` plus a display snapshot (name, price,
  discountPercentage, imageUrl) used purely for rendering the cart.
- **Checkout** posts the cart + customer form to the server, which builds and
  saves the authoritative order, then returns it.
- **Confirmation** renders from the POST response, cached in `sessionStorage`
  so a page refresh still shows the summary.

## Data model — new `Order` model (storefront `server/models/models.js`)

```
orderNumber    String    // short human ref e.g. "IB-7K3F9Q", unique, server-generated
items          [{
                  productId,            // ref "Product"
                  name,                 // snapshot at order time
                  unitPrice,            // pre-discount price snapshot
                  discountPercentage,   // snapshot (0/absent allowed)
                  quantity,
                  lineTotal,            // discounted unit price * quantity, server-computed
                  imageUrl              // snapshot
               }]
subtotal       Number    // sum of lineTotals, server-computed
deliveryFee    Number    // stored per-order; defaults to 3 in v1 (see below)
total          Number    // subtotal + deliveryFee, server-computed
customer       { fullName, phone, email? }   // email optional
shipping       { address, city, area?, notes? }
paymentMethod  String    // "cod"
status         String    // enum: pending|confirmed|delivered|cancelled, default "pending"
user           ObjectId  // ref future "User", optional / null → account-ready
timestamps               // createdAt / updatedAt
```

Snapshots (`name`, `unitPrice`, `discountPercentage`, `imageUrl`, `lineTotal`)
are written so the order remains an accurate historical record even if the
product is later edited or deleted.

### Delivery fee

For v1 the server applies a fixed `DELIVERY_FEE = 3` constant and stores it on
each order as `deliveryFee`. Storing it per-order means historical orders keep
the fee that applied when they were placed. Making the fee editable from the
dashboard is a later milestone and is **out of scope** here.

## API — storefront `server/index.js`

### `POST /api/orders`

Request body:
```
{
  items: [{ productId: string, quantity: number }],
  customer: { fullName, phone, email? },
  shipping: { address, city, area?, notes? }
}
```

Behavior:
1. Validate shape and required fields (`items` non-empty; `fullName`, `phone`,
   `shipping.address`, `shipping.city` present; `email` format-checked if
   given; each `quantity` an integer ≥ 1).
2. Fetch all referenced products by id. Reject (`400`) if any id is unknown or
   the product is **out of stock** (read the real stored field `in_stock`),
   with a message naming the offending product.
3. Recompute each `lineTotal` from current DB price + discount, then
   `subtotal`, apply `deliveryFee = 3`, compute `total`.
4. Generate a unique `orderNumber`, save the order with `status: "pending"`,
   `paymentMethod: "cod"`, `user: null`.
5. Respond `201` with the saved order.

No other new endpoints. The confirmation screen uses the POST response; no
authenticated order-lookup endpoint is needed for guests in v1.

## Client (follows the existing `features/` convention)

- `features/cart/`
  - `CartContext.tsx` — provider + `useCart` hook; `localStorage` persistence;
    actions: add, remove, setQuantity, clear; derived count and subtotal.
  - `CartSheet.tsx` — drawer using the existing `sheet.tsx`; lists items,
    quantity steppers, remove, subtotal, "Checkout" button.
- `features/checkout/`
  - `CheckoutPage.tsx` — the customer form (full name, phone, email optional,
    address, city/area, notes), order summary with subtotal + `$3` delivery +
    total, submit. Empty cart → checkout disabled.
  - `OrderConfirmation.tsx` — full summary: items, delivery fee, total, order
    number, and the entered contact/shipping info.
- `Navbar.tsx` — add a cart icon with an item-count badge (count from
  `useCart`).
- `ProductCard.tsx` / `ProductPage.tsx` — "Add to cart" button, disabled when
  `in_stock` is false.
- Routing (`App.tsx`) — add routes `/checkout` and `/checkout/success`; wrap
  `RouterProvider` with `CartProvider`.

## On successful order

1. **Clear the cart** (empty the `CartProvider` state + `localStorage`).
2. Navigate to `/checkout/success`.
3. **Show the order summary** (items, delivery fee, total, order number,
   contact/shipping), rendered from the POST response cached in
   `sessionStorage`.

## Edge cases / validation

- Out-of-stock products can't be added to the cart; if an item sells out before
  checkout, the server rejects that line with a clear message and the client
  surfaces it.
- Empty cart disables the checkout button.
- Quantity is always ≥ 1; reaching 0 removes the line.
- Required fields validated on both client and server. Email is optional but
  format-checked when present.
- Price/discount changes between "add to cart" and checkout are resolved by the
  server recompute; the checkout summary reflects authoritative server values.

## Testing

- Add `vitest + supertest + mongodb-memory-server` (mirroring the dashboard) and
  a test for `POST /api/orders` covering: happy path + correct totals incl.
  delivery fee, out-of-stock rejection, unknown product rejection, and missing
  required-field validation. This is the one critical write path.
- Cart and checkout UI are verified manually in this milestone.

## Out of scope (later milestones)

- Accounts / login (the `user` field is reserved now).
- Online payment.
- Dashboard-editable delivery fee, and tax.
- Order history for customers.
- Email / WhatsApp order notifications.
- Inventory quantity counts and stock decrement on order.
- The dashboard order-management view.
