# Instant Crawler Previews + Brand Disambiguation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Social crawlers that fetch `https://issabeauty.org/products/:id` get correct live Open Graph / Twitter / Product-JSON-LD `<head>` markup (via a backend meta-service behind an nginx UA rule), and the storefront home carries static brand-disambiguation structured data.

**Architecture:** Two independent repos. The **backend** (`issa-beauty-backend`, Express) gains a `/render/products/:id` route that loads a product and returns `<head>`-only HTML, plus a dynamic `/sitemap.xml`. The **storefront** (`issa-beauty`, static Vite SPA) gains static `Organization`/`LocalBusiness` JSON-LD in `index.html`, a corrected footer email, removal of the stale static sitemap, and a committed nginx config doc. Real users keep hitting the static SPA unchanged.

**Tech Stack:** Express 4 + Mongoose 8 + TypeScript (ESM, `.js` import specifiers) on the backend, Vitest + supertest + mongodb-memory-server for tests; Vite + React + Vitest on the storefront.

## Global Constraints

- Backend is ESM: **all relative imports use `.js` specifiers** (e.g. `import { Product } from "../models.js"`).
- Backend base branch: **`feat/order-tracking`** (current backend tip; `main` is 8 commits behind). Create `claude/og-meta-service` off it.
- Storefront base branch: **`claude/seo-crawler-previews`** (already created off `main`; contains the design doc).
- Public origin is configured, never inferred from the request Host. Default `https://issabeauty.org`, override via env `PUBLIC_SITE_URL`.
- Currency is `USD` (matches `src/common/utils/currency.ts` in the storefront).
- Contact email everywhere is `Mohamadissa76374336@gmail.com`.
- Brand socials (sameAs): `https://www.instagram.com/issabeauty20`, `https://tiktok.com/@mohamad.issa2323`.
- Address: `Qobbeh, near Najem's Shoes`, Tripoli, LB. Phone `+96176374336`.
- All product-derived strings are HTML/XML-escaped before being emitted.
- Commit after every task. The two tracks (A = backend, B = storefront) are **independent and run in parallel**; each commits only within its own repo, so there are no cross-agent commit conflicts.

---

# TRACK A — Backend meta-service (`issa-beauty-backend`)

> Base branch `claude/og-meta-service` off `feat/order-tracking`. All paths in Track A are relative to `/home/salah/Projects/issa-beauty-backend`.

### Task A1: Site config module

**Files:**
- Create: `src/og/siteConfig.ts`

**Interfaces:**
- Produces: `PUBLIC_SITE_URL: string`, `BRAND_NAME: string`, `DEFAULT_SHARE_IMAGE: string`.

- [ ] **Step 1: Create the module**

```ts
// src/og/siteConfig.ts
// Public-facing origin for the storefront. The backend generates HTML/XML that
// references the *storefront* domain, not its own (api.*) host, so this is
// configured explicitly rather than read from the request Host header.
export const PUBLIC_SITE_URL = (
  process.env.PUBLIC_SITE_URL ?? "https://issabeauty.org"
).replace(/\/+$/, "");

export const BRAND_NAME = "Issa Beauty";

// Absolute default share image (used by the crawler fallback page).
export const DEFAULT_SHARE_IMAGE = `${PUBLIC_SITE_URL}/issa_beauty.png`;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm build`
Expected: PASS (no output errors).

- [ ] **Step 3: Commit**

```bash
git add src/og/siteConfig.ts
git commit -m "feat(og): site config for public origin + brand constants"
```

---

### Task A2: Pure product-meta builder

**Files:**
- Create: `src/og/meta.ts`
- Test: `src/og/meta.test.ts`

**Interfaces:**
- Consumes: `discountedUnitPrice` from `../orders.js`; `BRAND_NAME` from `./siteConfig.js`.
- Produces:
  - `type ProductMetaInput = { _id: unknown; name: string; description: string; imageUrl: string; price: number; discountPercentage?: number; in_stock?: boolean }`
  - `type ProductMeta = { title: string; description: string; image: string; canonical: string; jsonLd: Record<string, unknown> }`
  - `buildProductMeta(product: ProductMetaInput, origin: string): ProductMeta`

- [ ] **Step 1: Write the failing test**

```ts
// src/og/meta.test.ts
import { describe, it, expect } from "vitest";
import { buildProductMeta } from "./meta.js";

const base = {
  _id: "64b2f0000000000000000001",
  name: "Rosewater Toner",
  description: "  A gentle,   hydrating   toner.  ",
  imageUrl: "https://ik.imagekit.io/x/toner.jpg",
  price: 20,
  discountPercentage: 25,
  in_stock: true,
};

describe("buildProductMeta", () => {
  it("builds title, canonical, image and collapses description whitespace", () => {
    const m = buildProductMeta(base, "https://issabeauty.org");
    expect(m.title).toBe("Rosewater Toner | Issa Beauty");
    expect(m.canonical).toBe("https://issabeauty.org/products/64b2f0000000000000000001");
    expect(m.image).toBe("https://ik.imagekit.io/x/toner.jpg");
    expect(m.description).toBe("A gentle, hydrating toner.");
  });

  it("emits schema.org Product JSON-LD with discounted price and availability", () => {
    const m = buildProductMeta(base, "https://issabeauty.org");
    expect(m.jsonLd["@type"]).toBe("Product");
    const offers = m.jsonLd.offers as Record<string, unknown>;
    expect(offers.price).toBe("15.00"); // 20 - 25%
    expect(offers.priceCurrency).toBe("USD");
    expect(offers.availability).toBe("https://schema.org/InStock");
  });

  it("marks out-of-stock and prefixes a root-relative image with origin", () => {
    const m = buildProductMeta(
      { ...base, in_stock: false, imageUrl: "/img/x.jpg" },
      "https://issabeauty.org",
    );
    const offers = m.jsonLd.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
    expect(m.image).toBe("https://issabeauty.org/img/x.jpg");
  });

  it("truncates a very long description to <= 200 chars", () => {
    const m = buildProductMeta({ ...base, description: "x".repeat(500) }, "https://issabeauty.org");
    expect(m.description.length).toBeLessThanOrEqual(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/og/meta.test.ts`
Expected: FAIL — cannot find module `./meta.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/og/meta.ts
import { discountedUnitPrice } from "../orders.js";
import { BRAND_NAME } from "./siteConfig.js";

export type ProductMetaInput = {
  _id: unknown;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  discountPercentage?: number;
  in_stock?: boolean;
};

export type ProductMeta = {
  title: string;
  description: string;
  image: string;
  canonical: string;
  jsonLd: Record<string, unknown>;
};

const MAX_DESC = 200;

function normalizeDescription(raw: string): string {
  const collapsed = raw.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_DESC
    ? collapsed.slice(0, MAX_DESC - 1).trimEnd() + "…"
    : collapsed;
}

function absolute(url: string, origin: string): string {
  return /^https?:\/\//i.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

export function buildProductMeta(product: ProductMetaInput, origin: string): ProductMeta {
  const id = String(product._id);
  const canonical = `${origin}/products/${id}`;
  const image = absolute(product.imageUrl, origin);
  const description = normalizeDescription(product.description ?? "");
  const price = discountedUnitPrice(product.price, product.discountPercentage).toFixed(2);
  const inStock = product.in_stock !== false;

  return {
    title: `${product.name} | ${BRAND_NAME}`,
    description,
    image,
    canonical,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image,
      description,
      brand: { "@type": "Brand", name: BRAND_NAME },
      offers: {
        "@type": "Offer",
        price,
        priceCurrency: "USD",
        availability: `https://schema.org/${inStock ? "InStock" : "OutOfStock"}`,
        url: canonical,
      },
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/og/meta.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/og/meta.ts src/og/meta.test.ts
git commit -m "feat(og): pure product-meta builder with Product JSON-LD"
```

---

### Task A3: HTML renderer + escaping

**Files:**
- Create: `src/og/renderHtml.ts`
- Test: `src/og/renderHtml.test.ts`

**Interfaces:**
- Consumes: `ProductMeta` from `./meta.js`; `BRAND_NAME`, `PUBLIC_SITE_URL`, `DEFAULT_SHARE_IMAGE` from `./siteConfig.js`.
- Produces: `escapeHtml(s: string): string`, `renderMetaHtml(meta: ProductMeta): string`, `renderFallbackHtml(): string`.

- [ ] **Step 1: Write the failing test**

```ts
// src/og/renderHtml.test.ts
import { describe, it, expect } from "vitest";
import { escapeHtml, renderMetaHtml, renderFallbackHtml } from "./renderHtml.js";

describe("escapeHtml", () => {
  it("escapes the dangerous five", () => {
    expect(escapeHtml(`a<b>&"'`)).toBe("a&lt;b&gt;&amp;&quot;&#39;");
  });
});

describe("renderMetaHtml", () => {
  const meta = {
    title: 'Toner "X" & <b> | Issa Beauty',
    description: "desc",
    image: "https://img/x.jpg",
    canonical: "https://issabeauty.org/products/1",
    jsonLd: { "@type": "Product", name: "</script><script>alert(1)</script>" },
  };

  it("escapes attribute values and neutralizes </script> in JSON-LD", () => {
    const html = renderMetaHtml(meta);
    expect(html).toContain('property="og:title" content="Toner &quot;X&quot; &amp; &lt;b&gt; | Issa Beauty"');
    expect(html).not.toContain("</script><script>alert(1)</script>");
    expect(html).toContain("\\u003c/script"); // escaped form inside ld+json
    expect(html).toContain('<link rel="canonical" href="https://issabeauty.org/products/1"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
  });
});

describe("renderFallbackHtml", () => {
  it("is noindex and carries brand defaults", () => {
    const html = renderFallbackHtml();
    expect(html).toContain('name="robots" content="noindex');
    expect(html).toContain("Issa Beauty");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/og/renderHtml.test.ts`
Expected: FAIL — cannot find module `./renderHtml.js`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/og/renderHtml.ts
import type { ProductMeta } from "./meta.js";
import { BRAND_NAME, PUBLIC_SITE_URL, DEFAULT_SHARE_IMAGE } from "./siteConfig.js";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// JSON-LD is data, not executed script, but a literal "</script>" inside it
// would still close the tag — escape the "<" so the block stays intact.
function jsonLdScript(data: Record<string, unknown>): string {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">${json}</script>`;
}

function shell(head: string, canonical: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">${head}</head><body><p>Redirecting to <a href="${escapeHtml(
    canonical,
  )}">${escapeHtml(canonical)}</a></p><script>location.replace(${JSON.stringify(
    canonical,
  )})</script></body></html>`;
}

export function renderMetaHtml(meta: ProductMeta): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(meta.description);
  const img = escapeHtml(meta.image);
  const url = escapeHtml(meta.canonical);
  const head = [
    `<title>${t}</title>`,
    `<meta name="description" content="${d}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND_NAME)}">`,
    `<meta property="og:type" content="product">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
    `<meta name="twitter:image" content="${img}">`,
    jsonLdScript(meta.jsonLd),
  ].join("");
  return shell(head, meta.canonical);
}

export function renderFallbackHtml(): string {
  const head = [
    `<title>${escapeHtml(BRAND_NAME)}</title>`,
    `<meta name="robots" content="noindex,follow">`,
    `<meta name="description" content="${escapeHtml(BRAND_NAME)} — beauty & skincare in Tripoli, Lebanon.">`,
    `<meta property="og:site_name" content="${escapeHtml(BRAND_NAME)}">`,
    `<meta property="og:title" content="${escapeHtml(BRAND_NAME)}">`,
    `<meta property="og:image" content="${escapeHtml(DEFAULT_SHARE_IMAGE)}">`,
    `<meta property="og:url" content="${escapeHtml(PUBLIC_SITE_URL)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
  ].join("");
  return shell(head, PUBLIC_SITE_URL);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/og/renderHtml.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/og/renderHtml.ts src/og/renderHtml.test.ts
git commit -m "feat(og): head-only HTML renderer with escaping + fallback page"
```

---

### Task A4: `/render/products/:id` route

**Files:**
- Create: `src/routes/og.ts`
- Test: `src/routes/og.test.ts`

**Interfaces:**
- Consumes: `Product` from `../models.js`; `buildProductMeta` from `../og/meta.js`; `renderMetaHtml`, `renderFallbackHtml` from `../og/renderHtml.js`; `PUBLIC_SITE_URL` from `../og/siteConfig.js`.
- Produces: `ogRouter: express.Router` with `GET /products/:id`.

- [ ] **Step 1: Write the failing test**

```ts
// src/routes/og.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { Product } from "../models.js";

let mongo: MongoMemoryServer;
const app = createApp(loadConfig({ PUBLIC_SITE_URL: "https://issabeauty.org" }));

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("GET /render/products/:id", () => {
  it("returns head-only HTML with OG tags for a real product", async () => {
    const p = await Product.create({
      name: "Serum", category: "Skincare", price: 30, imageUrl: "https://img/s.jpg",
      description: "Nice serum", in_stock: true,
    });
    const res = await request(app).get(`/render/products/${p._id}`);
    expect(res.status).toBe(200);
    expect(res.type).toBe("text/html");
    expect(res.text).toContain('property="og:title" content="Serum | Issa Beauty"');
    expect(res.text).toContain(`href="https://issabeauty.org/products/${p._id}"`);
    expect(res.text).toContain('"@type":"Product"');
  });

  it("returns a 404 noindex fallback for a missing product", async () => {
    const res = await request(app).get("/render/products/64b2f0000000000000000099");
    expect(res.status).toBe(404);
    expect(res.text).toContain('content="noindex');
  });

  it("returns a 404 fallback for a malformed id (no crash)", async () => {
    const res = await request(app).get("/render/products/not-an-id");
    expect(res.status).toBe(404);
    expect(res.text).toContain('content="noindex');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/routes/og.test.ts`
Expected: FAIL — the route is absent, so the request 404s without the `noindex` fallback body and the assertions fail.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/routes/og.ts
import express from "express";
import { Product } from "../models.js";
import { buildProductMeta } from "../og/meta.js";
import { renderMetaHtml, renderFallbackHtml } from "../og/renderHtml.js";
import { PUBLIC_SITE_URL } from "../og/siteConfig.js";

export const ogRouter = express.Router();

ogRouter.get("/products/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      res.status(404).type("html").send(renderFallbackHtml());
      return;
    }
    const meta = buildProductMeta(product as never, PUBLIC_SITE_URL);
    res
      .status(200)
      .type("html")
      .set("Cache-Control", "public, max-age=300")
      .send(renderMetaHtml(meta));
  } catch {
    // Malformed ObjectId (CastError) or any lookup failure → clean fallback.
    res.status(404).type("html").send(renderFallbackHtml());
  }
});
```

- [ ] **Step 4: Mount the router in `src/app.ts`**

Add the import after the existing route imports (currently ending line 8):

```ts
import { ogRouter } from "./routes/og.js";
```

Then, immediately after `app.use(cookieParser());` (currently line 33) and before `app.use("/api", publicRouter);`, add:

```ts
  // Crawler-facing, unauthenticated. Mounted at the root (not /api) because nginx
  // proxies social-crawler hits for /products/:id straight here.
  app.use("/render", ogRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/routes/og.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/routes/og.ts src/routes/og.test.ts src/app.ts
git commit -m "feat(og): GET /render/products/:id meta route, mounted (+ tests)"
```

---

### Task A5: `/sitemap.xml` route

**Files:**
- Create: `src/routes/sitemap.ts`
- Test: `src/routes/sitemap.test.ts`

**Interfaces:**
- Consumes: `Product` from `../models.js`; `PUBLIC_SITE_URL` from `../og/siteConfig.js`.
- Produces: `sitemapRouter: express.Router` with `GET /sitemap.xml`.

- [ ] **Step 1: Write the failing test**

```ts
// src/routes/sitemap.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { Product } from "../models.js";

let mongo: MongoMemoryServer;
const app = createApp(loadConfig({ PUBLIC_SITE_URL: "https://issabeauty.org" }));

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("GET /sitemap.xml", () => {
  it("lists static entries and every product URL", async () => {
    const p = await Product.create({
      name: "Cream", category: "Skincare", price: 12, imageUrl: "u", description: "d",
    });
    const res = await request(app).get("/sitemap.xml");
    expect(res.status).toBe(200);
    expect(res.type).toContain("xml");
    expect(res.text).toContain("<loc>https://issabeauty.org/</loc>");
    expect(res.text).toContain("<loc>https://issabeauty.org/products</loc>");
    expect(res.text).toContain(`<loc>https://issabeauty.org/products/${p._id}</loc>`);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/routes/sitemap.test.ts`
Expected: FAIL — route absent (404, no `<loc>`). (The `og` router mounted in A4 does not match `/sitemap.xml`.)

- [ ] **Step 3: Write minimal implementation**

```ts
// src/routes/sitemap.ts
import express from "express";
import { Product } from "../models.js";
import { PUBLIC_SITE_URL } from "../og/siteConfig.js";

export const sitemapRouter = express.Router();

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function urlEntry(loc: string, changefreq: string, priority: string, lastmod?: Date): string {
  const mod = lastmod ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : "";
  return `<url><loc>${xmlEscape(loc)}</loc>${mod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

sitemapRouter.get("/sitemap.xml", async (_req, res) => {
  try {
    const products = await Product.find().select("_id updatedAt").lean();
    const entries = [
      urlEntry(`${PUBLIC_SITE_URL}/`, "daily", "1.0"),
      urlEntry(`${PUBLIC_SITE_URL}/products`, "daily", "0.9"),
      ...products.map((p) =>
        urlEntry(
          `${PUBLIC_SITE_URL}/products/${String(p._id)}`,
          "weekly",
          "0.8",
          (p as { updatedAt?: Date }).updatedAt,
        ),
      ),
    ].join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
    res.status(200).type("application/xml").set("Cache-Control", "public, max-age=600").send(xml);
  } catch (err) {
    res.status(500).type("text/plain").send((err as Error).message);
  }
});
```

- [ ] **Step 4: Mount the router in `src/app.ts`**

Add the import after the `ogRouter` import from Task A4:

```ts
import { sitemapRouter } from "./routes/sitemap.js";
```

Then, immediately after the `app.use("/render", ogRouter);` line added in A4, add:

```ts
  app.use(sitemapRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run src/routes/sitemap.test.ts`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/routes/sitemap.ts src/routes/sitemap.test.ts src/app.ts
git commit -m "feat(og): dynamic /sitemap.xml from live catalog, mounted (+ tests)"
```

---

### Task A6: Document env var + full-suite verification

> Both routers were mounted in A4/A5. This task adds the env doc and runs the whole suite + build to confirm nothing regressed.

**Files:**
- Modify: `.env.example` (document `PUBLIC_SITE_URL`)

- [ ] **Step 1: Document the env var in `.env.example`**

Append:

```
# Public storefront origin used in crawler meta HTML + sitemap (no trailing slash).
PUBLIC_SITE_URL=https://issabeauty.org
```

- [ ] **Step 2: Run the full backend suite**

Run: `pnpm vitest run`
Expected: PASS — including `src/routes/og.test.ts` (3) and `src/routes/sitemap.test.ts` (1). No prior tests broken.

- [ ] **Step 3: Typecheck/build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs(og): document PUBLIC_SITE_URL in .env.example"
```

---

# TRACK B — Storefront brand schema, footer, sitemap cleanup, nginx doc (`issa-beauty`)

> Branch `claude/seo-crawler-previews` (already checked out). All paths in Track B are relative to `/home/salah/Projects/issa-beauty`.

### Task B1: Organization / LocalBusiness JSON-LD in `index.html`

**Files:**
- Modify: `index.html` (add a JSON-LD `<script>` in `<head>`, after the existing default social meta block)
- Test: `src/common/seo/orgJsonLd.test.ts`

**Interfaces:**
- Produces: a single `application/ld+json` block in `index.html` of `@type` `HealthAndBeautyBusiness`.

- [ ] **Step 1: Write the failing test**

```ts
// src/common/seo/orgJsonLd.test.ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("index.html Organization JSON-LD", () => {
  const html = readFileSync(resolve(__dirname, "../../../index.html"), "utf8");
  const match = html.match(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
  );

  it("contains a parseable ld+json block", () => {
    expect(match).not.toBeNull();
    expect(() => JSON.parse(match![1])).not.toThrow();
  });

  it("declares the brand with sameAs socials and a Tripoli address", () => {
    const data = JSON.parse(match![1]);
    expect(data.name).toBe("Issa Beauty");
    expect(data.url).toBe("https://issabeauty.org");
    expect(data.sameAs).toContain("https://www.instagram.com/issabeauty20");
    expect(data.sameAs).toContain("https://tiktok.com/@mohamad.issa2323");
    expect(data.email).toBe("Mohamadissa76374336@gmail.com");
    expect(data.address.addressLocality).toBe("Tripoli");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/common/seo/orgJsonLd.test.ts`
Expected: FAIL — no ld+json block found (`match` is null).

- [ ] **Step 3: Add the JSON-LD to `index.html`**

Insert immediately before `</head>` (after the existing `twitter:card` meta):

```html
    <!-- Brand identity for search engines + link unfurlers. Static because it
         never changes per-page; disambiguates this shop (issabeauty.org, Tripoli,
         our official socials) from unrelated accounts using the same name. -->
    <script type="application/ld+json">
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
    </script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/common/seo/orgJsonLd.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add index.html src/common/seo/orgJsonLd.test.ts
git commit -m "feat(seo): static Organization/LocalBusiness JSON-LD for brand disambiguation"
```

---

### Task B2: Correct the footer contact email

**Files:**
- Modify: `src/layout/ui/Footer.tsx` (the `mailto:` href and the visible email text — both currently `issa.beauty.inc@gmail.com`)

- [ ] **Step 1: Update both occurrences**

Replace `href="mailto:issa.beauty.inc@gmail.com"` with `href="mailto:Mohamadissa76374336@gmail.com"`, and the visible text `issa.beauty.inc@gmail.com` with `Mohamadissa76374336@gmail.com`.

- [ ] **Step 2: Verify no stale references remain**

Run: `grep -rn "issa.beauty.inc@gmail.com" src/ index.html`
Expected: no output (all replaced).

- [ ] **Step 3: Build to confirm nothing broke**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/layout/ui/Footer.tsx
git commit -m "fix(footer): update contact email to Mohamadissa76374336@gmail.com"
```

---

### Task B3: Remove the stale static sitemap

**Files:**
- Delete: `public/sitemap.xml` (superseded by the backend-served dynamic sitemap that nginx will proxy; `public/robots.txt` already points at `https://issabeauty.org/sitemap.xml` and is unchanged)

- [ ] **Step 1: Delete the file**

```bash
git rm public/sitemap.xml
```

- [ ] **Step 2: Confirm robots.txt still references the sitemap URL**

Run: `grep -n "Sitemap" public/robots.txt`
Expected: `Sitemap: https://issabeauty.org/sitemap.xml`

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(seo): drop static sitemap.xml in favor of backend-served dynamic one"
```

---

### Task B4: nginx crawler-rendering config doc

**Files:**
- Create: `docs/deploy/nginx-crawler-rendering.md`

- [ ] **Step 1: Write the doc**

```markdown
# nginx: serve live crawler previews for product pages

The storefront is static (nginx serves `/var/www/issa-beauty/client/dist`). Social
crawlers do not run JS, so `/products/:id` shares need server-rendered `<head>`
tags. This config routes **crawler user-agents only** for product pages to the
backend meta-service, and proxies `/sitemap.xml` to the backend. Real users are
untouched.

Set `<BACKEND>` to the backend origin reachable from nginx (e.g.
`https://api.issabeauty.org` or `http://127.0.0.1:5002`).

## 1. Crawler UA map (http {} block, once)

```nginx
map $http_user_agent $is_crawler {
    default 0;
    "~*facebookexternalhit|WhatsApp|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Discordbot|Pinterest|redditbot|Applebot|bingbot|Googlebot|Embedly|vkShare|W3C_Validator|Google-InspectionTool" 1;
}
```

## 2. server {} block for issabeauty.org

```nginx
# Product pages: crawlers get live meta HTML from the backend; users get the SPA.
location ~ ^/products/[^/]+$ {
    if ($is_crawler) {
        proxy_pass <BACKEND>/render$request_uri;
    }
    try_files $uri /index.html;
}

# Always serve the dynamic sitemap from the backend.
location = /sitemap.xml {
    proxy_pass <BACKEND>/sitemap.xml;
}

# (existing) SPA fallback for everything else
location / {
    try_files $uri /index.html;
}
```

> `proxy_pass` inside `if` is one of the few directives allowed there. If the
> backend is unreachable, the `try_files` fallback still serves the SPA shell.

## 3. Apply & verify

```bash
sudo nginx -t && sudo systemctl reload nginx

# Should return server-rendered OG tags:
curl -A "facebookexternalhit/1.1" https://issabeauty.org/products/<REAL_ID> | grep og:title
# A normal user still gets the SPA shell (no product-specific og:title):
curl -A "Mozilla/5.0" https://issabeauty.org/products/<REAL_ID> | grep -c 'id="root"'
# Sitemap:
curl https://issabeauty.org/sitemap.xml | head
```

Then run the URL through the Facebook Sharing Debugger and a JSON-LD validator.

## Rollback

Remove the two `location` additions (and the `map`) and reload nginx. No app
redeploy needed.
```

- [ ] **Step 2: Commit**

```bash
git add docs/deploy/nginx-crawler-rendering.md
git commit -m "docs(deploy): nginx crawler-rendering + sitemap proxy config"
```

---

### Task B5: Verify the share image dimensions

**Files:**
- Inspect only: `public/issa_beauty.png`

- [ ] **Step 1: Check dimensions**

Run: `file public/issa_beauty.png`
Expected: prints image geometry. Ideal OG card is ~1200×630.

- [ ] **Step 2: Record the finding**

If it is already ~1200×630, note "share image OK" in the PR description and do nothing. If it is small/square (e.g. a 9×9 logo), note in the PR that a dedicated 1200×630 branded share card is a recommended follow-up (do **not** block this plan generating art). No commit if no file change.

---

## Final integration (orchestrator, after both tracks)

- [ ] Backend: `pnpm vitest run` green; push `claude/og-meta-service`; open PR against `feat/order-tracking` (or `main` per maintainer decision).
- [ ] Storefront: `pnpm build` + `pnpm vitest run` green; push `claude/seo-crawler-previews`; open PR against `main`.
- [ ] Deploy backend (PM2) and storefront (rsync), then apply the nginx doc and run the `curl -A` verifications.

## Self-review — spec coverage

- Backend meta-service (Product OG + JSON-LD): A1–A4, A6 ✓
- Dynamic sitemap: A5–A6 ✓
- `PUBLIC_SITE_URL` configured, not host-inferred: A1, A6 ✓
- HTML/XML escaping + injection safety: A3, A5 ✓
- 404 degradation / backend-down fallback: A4 (fallback page), B4 (`try_files`) ✓
- Brand disambiguation JSON-LD (sameAs + Tripoli address): B1 ✓
- Footer email correction: B2 ✓
- Static sitemap removal: B3 ✓
- nginx UA routing + sitemap proxy doc: B4 ✓
- Share image check: B5 ✓
- Parity contract (backend meta ≈ storefront ProductPage): enforced by A2 tests + documented in spec ✓
