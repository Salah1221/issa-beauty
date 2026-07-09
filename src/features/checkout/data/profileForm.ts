import type { UserProfile } from "@/features/auth/data/auth";

// Supported dialing codes. Lebanon only for now; add entries here to extend.
// Lives here (not in CheckoutPage) so both the form and splitPhone share one list.
export const COUNTRY_CODES = [{ code: "+961", label: "🇱🇧 +961" }] as const;

export type CheckoutFormState = {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  area: string;
  notes: string;
};

// Split a stored full phone ("+961 12345678") into a known dialing code and the
// national remainder. Falls back to the default code when nothing matches so the
// select always has a valid value.
export function splitPhone(
  stored: string | undefined,
  codes: readonly { code: string }[] = COUNTRY_CODES,
): { countryCode: string; phone: string } {
  const fallback = codes[0].code;
  const trimmed = (stored ?? "").trim();
  if (!trimmed) return { countryCode: fallback, phone: "" };
  const match = codes.find((c) => trimmed.startsWith(c.code));
  if (!match) return { countryCode: fallback, phone: trimmed };
  return { countryCode: match.code, phone: trimmed.slice(match.code.length).trim() };
}

// Build the checkout form's initial state from a saved profile plus the account
// email (email is not part of the profile — it is the account identity).
export function profileToForm(
  profile: UserProfile | undefined,
  email: string,
): { form: CheckoutFormState; countryCode: string } {
  const { countryCode, phone } = splitPhone(profile?.phone);
  return {
    countryCode,
    form: {
      fullName: profile?.fullName ?? "",
      phone,
      email: email ?? "",
      address: profile?.address ?? "",
      city: profile?.city ?? "",
      area: profile?.area ?? "",
      notes: profile?.notes ?? "",
    },
  };
}
