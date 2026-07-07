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
