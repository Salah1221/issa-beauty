// Single source of truth for how money is rendered across the storefront.
// Centralised so switching currency/locale (or adding LBP alongside USD) is a
// one-line change instead of a hunt through every component that prints a price.
export const CURRENCY = "USD";
export const CURRENCY_LOCALE = "en-US";

const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Format a numeric amount as a localized currency string, e.g. 3 -> "$3.00".
export function formatPrice(amount: number): string {
  return formatter.format(amount);
}
