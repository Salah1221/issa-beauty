import { describe, it, expect } from "vitest";
import { splitPhone, profileToForm } from "./profileForm";

describe("splitPhone", () => {
  it("splits a known dialing code from the number", () => {
    expect(splitPhone("+961 12345678")).toEqual({ countryCode: "+961", phone: "12345678" });
  });
  it("defaults to +961 with an empty number when nothing is stored", () => {
    expect(splitPhone(undefined)).toEqual({ countryCode: "+961", phone: "" });
  });
  it("keeps the whole string as the number when no code matches", () => {
    expect(splitPhone("03123456")).toEqual({ countryCode: "+961", phone: "03123456" });
  });
});

describe("profileToForm", () => {
  it("builds form state from a profile plus the account email", () => {
    const { form, countryCode } = profileToForm(
      { fullName: "Jane", phone: "+961 12345678", address: "1 St", city: "Beirut", area: "Hamra", notes: "call" },
      "jane@x.com",
    );
    expect(countryCode).toBe("+961");
    expect(form).toEqual({
      fullName: "Jane",
      phone: "12345678",
      email: "jane@x.com",
      address: "1 St",
      city: "Beirut",
      area: "Hamra",
      notes: "call",
    });
  });

  it("returns empty fields (but keeps the email) when there is no profile", () => {
    const { form, countryCode } = profileToForm(undefined, "jane@x.com");
    expect(countryCode).toBe("+961");
    expect(form).toEqual({
      fullName: "",
      phone: "",
      email: "jane@x.com",
      address: "",
      city: "",
      area: "",
      notes: "",
    });
  });
});
