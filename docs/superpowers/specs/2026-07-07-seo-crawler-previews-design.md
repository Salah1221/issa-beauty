# Design: Instant crawler previews + brand disambiguation

Date: 2026-07-07
Status: Approved (brainstorming)
Repos touched: `issa-beauty` (storefront), `issa-beauty-backend` (API)

## Problem

The storefront is a static Vite SPA served directly by nginx (deploy = rsync
`dist/`); the backend at `api.issabeauty.org` serves only the API. Social
crawlers (WhatsApp, Facebook, Instagram, Telegram, Discord, X, LinkedIn, etc.)
**do not run JavaScript**, so a shared `/products/:id` link renders no rich
preview — only the generic homepage defaults baked into `index.html`. This is a
direct conversion leak on the shop's main acquisition channel (link sharing).

Separately, another Instagram account ("safaissa") also uses the name "Issa
Beauty". We want search engines and link unfurlers to unambiguously attribute
*this* brand (domain `issabeauty.org`, physical shop in Tripoli, our official
socials) as the authoritative Issa Beauty.

The catalog changes often and previews must be **correct the instant a product
link is shared** — this rules out static prebuilding and requires per-request
server logic for product pages.

## Goals

- A social crawler that fetches `https://issabeauty.org/products/:id` receives
  HTML with a correct `<title>`, meta description, Open Graph + Twitter tags,
  canonical URL, and schema.org `Product` JSON-LD — reflecting **live** product
  data, with no rebuild.
- Real users and JS-capable crawlers (Googlebot) keep hitting the fast static
  SPA exactly as today. Zero change to their path.
- The home page carries static `Organization`/`LocalBusiness` JSON-LD that
  disambiguates this brand (domain, Tripoli address, official socials).
- `/sitemap.xml` lists all live product URLs.

## Non-goals (separate future plans)

Arabic/RTL i18n, cart-vs-server reconciliation, checkout/search test coverage,
the pre-existing `input.tsx` lint error, README. Full SSR or a headless-Chromium
prerender service (rejected as over-engineered — crawlers only need `<head>`).

## Architecture

Only **product pages** are dynamic enough to need the server. Home and
`/products` already receive the static `index.html` (which has correct default
OG tags), so brand structured data is added there as static markup at no runtime
cost.

```
                        ┌─ real users / Googlebot ───────────► static SPA (nginx, unchanged)
issabeauty.org ─ nginx ─┤
                        ├─ crawler UA + /products/:id ───────► proxy_pass ─► backend GET /render/products/:id
                        │                                                     (Product.findById → <head>-only HTML)
                        └─ any UA + /sitemap.xml ────────────► proxy_pass ─► backend GET /sitemap.xml
```

`proxy_pass` targets the backend origin (`api.issabeauty.org` / the backend's
local port on the same host). The **HTML the backend returns contains
`issabeauty.org` URLs** (canonical, og:url, og:image) — the backend only
generates markup; the public origin is configured, not inferred from the Host.

## Components

### A. Backend meta-service — `issa-beauty-backend` (Express/TS)

| File | Responsibility |
|---|---|
| `src/og/siteConfig.ts` | Single source of truth: `PUBLIC_SITE_URL` (env `PUBLIC_SITE_URL`, default `https://issabeauty.org`), brand name, default share image URL, official social URLs, Tripoli address. Consumed by meta, JSON-LD, and sitemap. |
| `src/og/meta.ts` | **Pure** `buildProductMeta(product, origin)` → `{ title, description, image, canonical, jsonLd }`. `title` = `"<name> \| Issa Beauty"`; `description` = product description (trimmed/collapsed, ~200 chars); `image` = `product.imageUrl` (absolute); `canonical` = `${origin}/products/${_id}`; `jsonLd` = schema.org `Product` (see Data). No I/O. |
| `src/og/renderHtml.ts` | `renderMetaHtml(meta)` → minimal HTML string: `<head>` with title, description, canonical, `og:*`, `twitter:*`, and the JSON-LD `<script>`. **HTML-escapes** every product-derived value. Body = `<noscript>` link + `<script>location.replace(canonical)</script>` so a human who lands here is bounced to the real page. |
| `src/routes/og.ts` | `ogRouter`: `GET /render/products/:id` → `Product.findById(id)`; 200 → `renderMetaHtml(...)` with `Content-Type: text/html` and `Cache-Control: public, max-age=300`; not found / bad id → 404 with a minimal noindex HTML stub (still valid so the unfurler shows brand defaults, not an error). |
| `src/routes/sitemap.ts` | `GET /sitemap.xml` → `Product.find().select("_id updatedAt").lean()`; emit `urlset` = static entries (`/`, `/products`) + one `<url>` per product (`<loc>` XML-escaped, `<lastmod>` from `updatedAt`). `Content-Type: application/xml`, short cache. |
| `src/app.ts` | Mount `ogRouter` (at `/render`) and the sitemap route. **Only shared-file edit in the backend repo** → single integration point. |
| Tests | `og/meta.test.ts` (title/desc/canonical/jsonLd shape), `og/renderHtml.test.ts` (escaping of `"`, `<`, `&` in name/description), `routes/og.test.ts` + `routes/sitemap.test.ts` via `supertest` + `mongodb-memory-server` (existing pattern). |

The `ogRouter` must **not** be behind the customer/admin auth or the strict rate
limiter; treat it like the other public read routes (loose limiter is fine).

### B. Storefront — `issa-beauty`

- `index.html`: add a static `<script type="application/ld+json">` with an
  `Organization` (typed as `HealthAndBeautyBusiness`/`LocalBusiness`) node — the
  **brand-disambiguation** payload (see Data). Static → every crawler sees it.
- `src/layout/ui/Footer.tsx`: correct the contact email to
  `Mohamadissa76374336@gmail.com` (both the visible text and the `mailto:` href).
- Remove `public/sitemap.xml` (superseded by the backend-served dynamic sitemap
  that nginx proxies). `public/robots.txt` already points at
  `https://issabeauty.org/sitemap.xml` — unchanged.
- Verify `public/issa_beauty.png` is a ~1200×630 branded share card. If it is
  not, flag it as a follow-up asset task (do not block on generating art).

### C. nginx — committed as docs, applied by the maintainer

- `docs/deploy/nginx-crawler-rendering.md`: a documented config fragment —
  - `map $http_user_agent $is_crawler { … }` matching `facebookexternalhit`,
    `WhatsApp`, `Twitterbot`, `LinkedInBot`, `Slackbot`, `TelegramBot`,
    `Discordbot`, `Pinterest`, `redditbot`, `Applebot`, `bingbot`, etc.
  - `location ~ ^/products/[^/]+$ { if ($is_crawler) { proxy_pass <backend>/render$request_uri; } try_files $uri /index.html; }`
  - `location = /sitemap.xml { proxy_pass <backend>/sitemap.xml; }`
  - Apply + rollback + test-with-curl notes (e.g.
    `curl -A facebookexternalhit https://issabeauty.org/products/<id>`).

## Data

### schema.org Product (backend, per product)

```jsonc
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "<product.name>",
  "image": "<absolute product.imageUrl>",
  "description": "<product.description>",
  "brand": { "@type": "Brand", "name": "Issa Beauty" },
  "offers": {
    "@type": "Offer",
    "price": "<discounted price>",           // price*(1-discountPercentage/100), 2dp
    "priceCurrency": "USD",                    // storefront prices are USD (see formatPrice)
    "availability": "https://schema.org/<InStock|OutOfStock>", // from in_stock
    "url": "<canonical>"
  }
}
```

### Organization / LocalBusiness (storefront `index.html`, static)

```jsonc
{
  "@context": "https://schema.org",
  "@type": "HealthAndBeautyBusiness",
  "name": "Issa Beauty",
  "url": "https://issabeauty.org",
  "logo": "https://issabeauty.org/issa_beauty.png",
  "image": "https://issabeauty.org/issa_beauty.png",
  "email": "Mohamadissa76374336@gmail.com",
  "telephone": "+96176374336",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Qobbeh, near Najem's Shoes",
    "addressLocality": "Tripoli",
    "addressCountry": "LB"
  },
  "sameAs": [
    "https://www.instagram.com/issabeauty20",
    "https://tiktok.com/@mohamad.issa2323"
  ]
}
```

`geo` (lat/long) omitted — not known precisely; add later if a Google Business
Profile is created. Currency is `USD` (confirmed: `CURRENCY` in
`src/common/utils/currency.ts`).

## The parity contract

`buildProductMeta` (backend) must produce the same title / description / image /
Product-JSON-LD that the storefront's `ProductPage` emits at runtime, so a social
preview matches what Googlebot sees when it renders the SPA. This is documented
here and pinned by `og/meta.test.ts`; we deliberately do **not** extract a shared
cross-repo package (overkill for two repos). If `ProductPage`'s meta logic
changes later, update `buildProductMeta` to match.

## Error handling & edge cases

- **Product not found / malformed id:** 404 + minimal valid noindex HTML (brand
  defaults), never a stack trace or JSON error — an unfurler should degrade to a
  generic-but-clean card.
- **Backend down:** nginx `proxy_pass` fails → configure `try_files … /index.html`
  fallback so crawlers still get the static shell rather than a 502.
- **HTML/XML injection:** product `name`/`description` are user-authored (admin) —
  escape in both `renderHtml` and the sitemap.
- **UA list drift:** documented and centralized in the nginx `map`; easy to extend.
- **Caching:** short `Cache-Control` on render + sitemap responses to blunt
  repeated crawler hits without serving stale data for long.

## Testing

- Backend: pure `meta`/`renderHtml` unit tests (incl. escaping and
  discount/availability math) + `supertest` route tests (200 shape, 404
  degradation, sitemap contains a seeded product). Follows existing
  `mongodb-memory-server` setup.
- Storefront: validate the `index.html` JSON-LD parses and carries `sameAs` +
  address (lightweight test or manual validator run); confirm the app still
  builds (`pnpm build`) and existing tests pass.
- Manual: `curl -A facebookexternalhit …/products/<id>` shows real tags; the
  Facebook Sharing Debugger / a JSON-LD validator confirms the cards.

## Repo boundaries & parallelization (for subagent-driven development)

The two repos are **separate git repositories**, so work splits cleanly along
that line — parallel agents never share a working tree or git index, satisfying
"no conflicting commits between parallel agents":

- **Agent 1 — backend** (`issa-beauty-backend`): all of Component A on its own
  branch. Sequential internally (single agent), commits within its own repo.
- **Agent 2 — storefront** (`issa-beauty`): all of Components B + C on this
  branch. Sequential internally, commits within its own repo.

The nginx doc (C) lives in the storefront repo `docs/` and is owned solely by
Agent 2, so there is no third writer to that repo. The two agents run in
parallel; the orchestrator reviews each and integrates.

## Rollout

1. Backend: implement, test, merge, deploy (PM2 restart via existing pipeline).
2. Storefront: implement, test, merge, deploy (rsync `dist/`).
3. Apply the nginx fragment on the server; verify with the `curl -A` checks and
   the Facebook Sharing Debugger.
4. (Ops, out of band) Create a Google Business Profile for the Tripoli shop —
   the strongest single "which Issa Beauty" signal for local search/Maps.
