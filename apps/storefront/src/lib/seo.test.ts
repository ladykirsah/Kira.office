import { describe, it, expect } from "vitest";
import {
  productSeoTitle,
  productMetaDescription,
  productJsonLd,
  breadcrumbJsonLd,
  serializeJsonLd,
  SITE_ORIGIN,
  type SeoProduct,
} from "./seo";

const vios: SeoProduct = {
  productId: "abc-123",
  name: "คอมเพรสเซอร์แอร์ Toyota Vios 2014",
  brandName: "DENSO",
  typeName: "Compressor",
  productRef: "CL-COMP-VIOS14",
  description: "คอมเพรสเซอร์แอร์แท้ สำหรับ Toyota Vios",
  imageKey: "products/vios.jpg",
  onHand: 5,
  warrantyDays: 180,
  fitments: [{ carBrand: "Toyota", carModel: "Vios", yearFrom: 2014, yearTo: 2019 }],
};

/** A product whose name already contains the brand — used to prove no duplicate keyword stuffing. */
const brandInName: SeoProduct = {
  ...vios,
  name: "ตู้แอร์ DENSO Coolgear",
  brandName: "DENSO",
};

/** Everything optional is null/empty — the builders must degrade gracefully, never emit "null". */
const bare: SeoProduct = {
  productId: "bare-1",
  name: "อะไหล่แอร์",
  brandName: null,
  typeName: null,
  productRef: "X-1",
  description: null,
  imageKey: null,
  onHand: 0,
  warrantyDays: null,
  fitments: [],
};

describe("productSeoTitle > given a full product > then packs the buying keywords", () => {
  it("includes the name, brand, แท้ and the AirPlus suffix", () => {
    const t = productSeoTitle(vios);
    expect(t).toContain("คอมเพรสเซอร์แอร์ Toyota Vios 2014");
    expect(t).toContain("DENSO");
    expect(t).toContain("แท้");
    expect(t.endsWith("| AirPlus")).toBe(true);
  });

  it("does not repeat a brand already present in the name", () => {
    const t = productSeoTitle(brandInName);
    expect((t.match(/DENSO/g) ?? []).length).toBe(1);
  });

  it("never leaks the string 'null' for a bare product", () => {
    const t = productSeoTitle(bare);
    expect(t).not.toContain("null");
    expect(t).toContain("อะไหล่แอร์");
    expect(t).toContain("AirPlus");
  });
});

describe("productMetaDescription > then reads as a keyword-rich sentence", () => {
  it("mentions brand, genuine and shipping for a full product", () => {
    const d = productMetaDescription(vios);
    expect(d).toContain("DENSO");
    expect(d).toMatch(/แท้/);
    expect(d.length).toBeGreaterThan(40);
    expect(d.length).toBeLessThanOrEqual(200);
  });

  it("degrades cleanly with no null/undefined for a bare product", () => {
    const d = productMetaDescription(bare);
    expect(d).not.toContain("null");
    expect(d).not.toContain("undefined");
    expect(d.length).toBeGreaterThan(0);
  });
});

describe("productJsonLd > then is valid schema.org Product + Offer", () => {
  it("maps core fields for an in-stock product", () => {
    const ld = productJsonLd(vios, { priceSatang: 289000 });
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Product");
    expect(ld.sku).toBe("CL-COMP-VIOS14");
    expect(ld.brand).toEqual({ "@type": "Brand", name: "DENSO" });
    const offers = ld.offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe("THB");
    expect(offers.price).toBe("2890.00");
    expect(offers.availability).toBe("https://schema.org/InStock");
    expect(offers.url).toBe(`${SITE_ORIGIN}/products/abc-123`);
    expect(ld.image).toEqual(["https://api.homeseeker.me/img/products/vios.jpg"]);
  });

  it("marks OutOfStock when onHand is 0", () => {
    const ld = productJsonLd({ ...vios, onHand: 0 }, { priceSatang: 289000 });
    expect((ld.offers as Record<string, unknown>).availability).toBe(
      "https://schema.org/OutOfStock",
    );
  });

  it("omits brand/image and never emits null for a bare product", () => {
    const ld = productJsonLd(bare, { priceSatang: 0 });
    expect(ld).not.toHaveProperty("brand");
    expect(ld).not.toHaveProperty("image");
    expect(JSON.stringify(ld)).not.toContain("null");
  });
});

describe("serializeJsonLd > prevents </script> breakout (XSS)", () => {
  it("escapes < so a hostile name can't close the script tag", () => {
    const s = serializeJsonLd({ name: "evil </script><img src=x onerror=alert(1)>" });
    expect(s).not.toContain("</script>");
    expect(s).not.toContain("<img");
    expect(s).toContain("\\u003c");
  });

  it("still round-trips to the original object", () => {
    const obj = { "@type": "Product", name: "ตู้แอร์ <Toyota> Vios" };
    expect(JSON.parse(serializeJsonLd(obj))).toEqual(obj);
  });
});

describe("breadcrumbJsonLd > then is a 3-level trail with absolute URLs", () => {
  it("goes home → สินค้า → product", () => {
    const bc = breadcrumbJsonLd(vios);
    expect(bc["@type"]).toBe("BreadcrumbList");
    const items = bc.itemListElement as { position: number; name: string; item: string }[];
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(items[2].name).toBe("คอมเพรสเซอร์แอร์ Toyota Vios 2014");
    expect(items[2].item).toBe(`${SITE_ORIGIN}/products/abc-123`);
    expect(items[0].item).toBe(`${SITE_ORIGIN}/`);
  });
});
