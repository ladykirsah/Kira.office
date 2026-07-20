import { describe, it, expect } from "vitest";
import { TAXONOMY_IMAGE_TABLE, taxonomyImageKey } from "./taxonomyImages";

const UUID = "11111111-2222-3333-4444-555555555555";

describe("taxonomyImageKey > R2 key for a taxonomy cover image", () => {
  it("given a product type > namespaces the key under taxonomy/ with kind, id, uuid and ext", () => {
    expect(taxonomyImageKey("type", "pt-compressor", "jpg", UUID)).toBe(
      `taxonomy/type-pt-compressor-${UUID}.jpg`,
    );
  });

  it("given a car brand > uses the car-brand kind prefix", () => {
    expect(taxonomyImageKey("car-brand", "cb-toyota", "png", UUID)).toBe(
      `taxonomy/car-brand-cb-toyota-${UUID}.png`,
    );
  });

  it("always starts with the taxonomy/ namespace the /img/ route allow-lists", () => {
    expect(taxonomyImageKey("type", "x", "webp", UUID).startsWith("taxonomy/")).toBe(true);
  });

  it("given the same row twice > returns different keys so a replaced cover busts <img> caches", () => {
    const a = taxonomyImageKey("type", "pt-compressor", "jpg", UUID);
    const b = taxonomyImageKey(
      "type",
      "pt-compressor",
      "jpg",
      "99999999-8888-7777-6666-555555555555",
    );
    expect(a).not.toBe(b);
  });
});

describe("TAXONOMY_IMAGE_TABLE > maps each kind to its table", () => {
  it("points type at product_types and car-brand at car_brands", () => {
    expect(TAXONOMY_IMAGE_TABLE.type).toBe("product_types");
    expect(TAXONOMY_IMAGE_TABLE["car-brand"]).toBe("car_brands");
  });
});
