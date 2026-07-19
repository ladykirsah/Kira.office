import { describe, it, expect } from "vitest";
import { localBusinessJsonLd, SHOP } from "./business";
import { LINE_OA_URL } from "./links";

describe("localBusinessJsonLd > schema.org LocalBusiness from the SHOP NAP", () => {
  const ld = localBusinessJsonLd();

  it("is an AutoPartsStore with the shop name, url and E.164 phone", () => {
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("AutoPartsStore");
    expect(ld.name).toBe("AirPlus");
    expect(ld.telephone).toBe(SHOP.telephone);
    expect(String(ld.telephone).startsWith("+66")).toBe(true);
    expect(ld.url).toBe(SHOP.url);
  });

  it("carries a PostalAddress with region, postcode and country", () => {
    const addr = ld.address as Record<string, unknown>;
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr.addressRegion).toBe("Surin");
    expect(addr.postalCode).toBe("32140");
    expect(addr.addressCountry).toBe("TH");
  });

  it("carries opening hours (09:00–17:00) with days", () => {
    const spec = (ld.openingHoursSpecification as Record<string, unknown>[])[0];
    expect(spec.opens).toBe("09:00");
    expect(spec.closes).toBe("17:00");
    expect(spec.dayOfWeek).toContain("Monday");
  });

  it("lists the LINE OA in sameAs and never emits null/undefined", () => {
    expect(ld.sameAs).toContain(LINE_OA_URL);
    expect(JSON.stringify(ld)).not.toContain("null");
    expect(JSON.stringify(ld)).not.toContain("undefined");
  });
});
