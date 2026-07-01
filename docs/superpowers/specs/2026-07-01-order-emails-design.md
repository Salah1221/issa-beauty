# Order Emails (Resend) — Design

**Date:** 2026-07-01
**Status:** Approved
**Repos:** issa-beauty (storefront) + issa-beauty-dashboard — one feature, two branches/PRs (`feat/order-emails` in each)

## Goal

Send the transactional emails a small e-commerce store needs, using Resend and
the verified sending domain `send.issabeauty.org`:

- **Order confirmation** to the customer when they place an order (storefront).
- **New-order alert** to the store owner when an order is placed (storefront).
- **Status-update** emails to the customer when the admin advances the order to
  `confirmed`, `delivered`, or `cancelled` (dashboard).

## Key decisions

- **Email is optional at checkout.** Customer emails are sent only when the
  order has a `customer.email`; guest orders without one skip silently.
- **Fire-and-forget + guarded.** Sends are triggered after the DB write and are
  NOT awaited by the HTTP response; any failure is caught and logged so a mail
  problem never fails checkout or a status update.
- **Dev-safe.** If `RESEND` (API key) is unset, the email module no-ops with a
  warning — local/test runs never hit the network.
- **Pure builders vs. sender.** Template builders return `{ subject, html }`
  (no network, unit-testable); a single `sendEmail()` performs the Resend call.
- **Per-repo module.** Each backend gets its own near-identical
  `server/email.js` (the two backends will converge later; keep them alike).

## Config (env)

- `RESEND` — Resend API key. Both backends read `process.env.RESEND`.
- `STORE_ORDER_EMAIL` — owner recipient for new-order alerts (storefront only).
  If unset, the owner alert is skipped.
- Sender (constant): `ISSA Beauty <orders@send.issabeauty.org>`.
- Add both keys to each repo's `.env.example`.

## Module — `server/email.js` (each repo)

```
import { Resend } from "resend";
const FROM = "ISSA Beauty <orders@send.issabeauty.org>";
const resend = process.env.RESEND ? new Resend(process.env.RESEND) : null;

// Perform the send; no-op (warn) when no API key is configured.
export async function sendEmail({ to, subject, html }): Promise<void>

// Pure builders → { subject, html }
export function orderConfirmationEmail(order)        // storefront + shared
export function newOrderNotificationEmail(order)     // storefront
export function statusUpdateEmail(order)             // dashboard → {subject,html} | null
```

- A single shared helper builds the branded HTML shell (inline CSS — email
  clients ignore `<style>`/classes): logo/wordmark header, body, muted footer.
- `orderConfirmationEmail` / `newOrderNotificationEmail` render an items table
  (name × qty, line total), subtotal, delivery fee, total, delivery address,
  and a "Cash on delivery" note. The owner alert leads with customer name +
  phone so it's actionable for fulfilment.
- `statusUpdateEmail(order)` returns `null` for any status other than
  `confirmed | delivered | cancelled`; otherwise a short status-specific
  message plus the order number and total.

`sendEmail` signature is identical in both repos. Builders live where they're
used; the confirmation/owner builders are storefront, the status builder is
dashboard (duplicating the shared HTML shell in each repo is acceptable given
the two are separate codebases today).

## Triggers

### Storefront — `POST /api/orders` (after `Order.create`, before/independent of the response)
```
if (saved.customer?.email) {
  const { subject, html } = orderConfirmationEmail(saved);
  sendEmail({ to: saved.customer.email, subject, html })
    .catch((e) => console.error("order confirmation email failed", e));
}
if (process.env.STORE_ORDER_EMAIL) {
  const { subject, html } = newOrderNotificationEmail(saved);
  sendEmail({ to: process.env.STORE_ORDER_EMAIL, subject, html })
    .catch((e) => console.error("new-order alert failed", e));
}
```
Not awaited — the 201 response is returned immediately.

### Dashboard — `PATCH /api/orders/:id/status` (after the status update)
```
const built = statusUpdateEmail(order);   // order = the updated doc
if (built && order.customer?.email) {
  sendEmail({ to: order.customer.email, ...built })
    .catch((e) => console.error("status email failed", e));
}
```
Not awaited — the 200 response is returned immediately.

## Failure handling

- No API key → `sendEmail` logs a warning and returns without throwing.
- Resend/network error → caught by the caller's `.catch`, logged; the order /
  status change is unaffected.
- Missing `customer.email` → no customer email attempted (owner alert still
  fires if configured).

## Testing (per repo — vitest + supertest + mongodb-memory-server already set up)

- **Builder unit tests (pure, no network):** each builder returns a non-empty
  `subject` and `html` containing the key facts (order number, total; owner
  alert includes customer phone). `statusUpdateEmail` returns `null` for
  `pending` and an object for `confirmed`/`delivered`/`cancelled`.
- **Route tests with Resend mocked** (`vi.mock("resend")`): 
  - Storefront: `POST /api/orders` still returns 201 and persists the order
    when the mocked send resolves AND when it rejects (guard proven); no send
    is attempted when the body has no `customer.email` (owner alert still
    attempted when `STORE_ORDER_EMAIL` is set).
  - Dashboard: `PATCH .../status` still returns 200 when the mocked send
    rejects; a send is attempted for `confirmed` and not for a no-email order.
- No test performs a real network send.

## Out of scope (later)

- Retries / queue / scheduled sends.
- Delivery/open webhooks, tracking pixels.
- Marketing or abandoned-cart emails.
- Customer-facing "resend my confirmation".
- Real login mailboxes (this is send-only transactional).
- Localizing / theming beyond the single branded shell.
