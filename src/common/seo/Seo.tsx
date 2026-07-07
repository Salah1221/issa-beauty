import { Helmet } from "react-helmet-async";

const SITE_NAME = "Issa Beauty";
const DEFAULT_DESCRIPTION =
  "Carefully curated beauty and skincare from Issa Beauty, Tripoli, Lebanon. Browse the collection and order with cash on delivery.";
// Absolute default share image lives in /public. Product pages pass their own.
const DEFAULT_IMAGE = "/issa_beauty.png";

type SeoProps = {
  /** Page title; rendered as "<title> | Issa Beauty" unless it is the brand itself. */
  title?: string;
  description?: string;
  /** Absolute or root-relative image URL for social share cards. */
  image?: string;
  /** Canonical URL for this page. Defaults to the current location. */
  url?: string;
  type?: "website" | "product" | "article";
  /** When true, ask crawlers not to index this page (e.g. checkout). */
  noIndex?: boolean;
  /** Optional JSON-LD structured data object (e.g. schema.org Product). */
  jsonLd?: Record<string, unknown>;
};

// Per-route <head> manager. Sets the document title, meta description, and
// Open Graph / Twitter card tags so shared links render a rich preview and
// search engines get real metadata instead of an empty SPA shell.
export default function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = "website",
  noIndex = false,
  jsonLd,
}: SeoProps) {
  const fullTitle =
    !title || title === SITE_NAME ? SITE_NAME : `${title} | ${SITE_NAME}`;
  const canonical =
    url ?? (typeof window !== "undefined" ? window.location.href : undefined);
  const absoluteImage =
    image.startsWith("http") || typeof window === "undefined"
      ? image
      : `${window.location.origin}${image}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {canonical && <link rel="canonical" href={canonical} />}
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph (WhatsApp, Facebook, Instagram link previews) */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={absoluteImage} />
      {canonical && <meta property="og:url" content={canonical} />}

      {/* Twitter / X card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteImage} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
