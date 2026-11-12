import { describe, expect, it } from "vitest";
import {
  customerSummary,
  fetchProducts,
  partLine,
  searchParts,
  serviceLine,
  type ProductRow,
} from "./posApi";

const product = (over: Partial<ProductRow> = {}): ProductRow => ({
  id: "p1",
  variantId: "v1",
  productRef: "DN-447220",
  name: "คอมเพรสเซอร์ DENSO 10S11C",
  status: "active",
  imageKey: "img/1.jpg",
  brandName: "DENSO",
  offlinePriceSatang: 345_000,
  b2bPriceSatang: 310_000,
  itemCostSatang: 250_000,
  onHand: 4,
  ...over,
});

describe("posApi product search", () => {
  it("searchParts > given a name or code > then every match is in one list", () => {
    const list = [
      product(),
      product({ id: "p2", variantId: "v2", productRef: "DN-116340", name: "โบลเวอร์ DENSO Altis" }),
      product({
        id: "p3",
        variantId: "v3",
        productRef: "TY-VIGO-08",
        name: "วาล์วแอร์ Toyota Vigo",
        brandName: null,
      }),
    ];
    expect(searchParts(list, "denso").map((p) => p.id)).toEqual(["p1", "p2"]);
    expect(searchParts(list, "vigo-08").map((p) => p.id)).toEqual(["p3"]);
    expect(searchParts(list, "densp")).toEqual([]);
  });

  it("searchParts > given a sold-out part > then it never shows (owner: 0 in stock = hidden)", () => {
    const list = [product(), product({ id: "p2", variantId: "v2", onHand: 0 })];
    expect(searchParts(list, "denso").map((p) => p.id)).toEqual(["p1"]);
    expect(searchParts(list, "").map((p) => p.id)).toEqual(["p1"]);
  });

  it("searchParts > given a product with sizes > then each size is its own pick, found by its size or its own code", () => {
    const sizes = [
      product({
        id: "or",
        variantId: "or-1",
        name: "โอริง R134a DENSO",
        optionValue: "3/8 เล็ก",
        code: "TG-001",
      }),
      product({
        id: "or",
        variantId: "or-2",
        name: "โอริง R134a DENSO",
        optionValue: "1/2 กลาง",
        code: "TG-002",
      }),
      product({
        id: "or",
        variantId: "or-3",
        name: "โอริง R134a DENSO",
        optionValue: "5/8 ใหญ่",
        code: "TG-003",
        onHand: 0,
      }),
    ];
    expect(searchParts(sizes, "โอริง").map((p) => p.variantId)).toEqual(["or-1", "or-2"]);
    expect(searchParts(sizes, "1/2").map((p) => p.variantId)).toEqual(["or-2"]);
    expect(searchParts(sizes, "tg-001").map((p) => p.variantId)).toEqual(["or-1"]);
  });

  it("partLine > given one size > then the line keeps that size, its own code and its own price", () => {
    const half = product({
      id: "or",
      variantId: "or-2",
      productRef: "TG-001",
      name: "โอริง R134a DENSO",
      optionValue: "1/2 กลาง",
      code: "TG-002",
      offlinePriceSatang: 4_500,
    });
    expect(partLine(half, "customer", "k1")).toMatchObject({
      variantId: "or-2",
      productRef: "TG-002",
      choiceValue: "1/2 กลาง",
      priceSatang: 4_500,
    });
  });

  it("fetchProducts > asks for one row per size, so every size can go on a bill", async () => {
    const urls: string[] = [];
    const out = await fetchProducts(
      async (url) => {
        urls.push(url);
        return Response.json({ products: [product()] });
      },
      "http://api",
      "tok",
    );
    expect(urls).toEqual(["http://api/products?by=variant"]);
    expect(out).toHaveLength(1);
  });

  it("searchParts > given a part with no variant > then it cannot be sold and is left out", () => {
    expect(searchParts([product({ variantId: null })], "")).toEqual([]);
  });

  it("partLine > given a product > then a line at the list price with its stock", () => {
    expect(partLine(product(), "customer", "k1")).toEqual({
      key: "k1",
      kind: "part",
      variantId: "v1",
      productId: "p1",
      productRef: "DN-447220",
      name: "คอมเพรสเซอร์ DENSO 10S11C",
      photoKey: "img/1.jpg",
      barcode: null,
      quantity: 1,
      walkInSatang: 345_000,
      mechanicSatang: 310_000,
      priceSatang: 345_000,
      useMechanic: false,
      costSatang: 250_000,
      onHand: 4,
      typeName: null,
      brandName: "DENSO",
      carModel: null,
    });
    expect(partLine(product(), "mechanic", "k1")).toMatchObject({
      priceSatang: 310_000,
      useMechanic: true,
    });
  });

  it("partLine > given a type and cars > then the line keeps the Thai type, the brand and the top car", () => {
    const coil = product({
      typeName: "Evaporator",
      typeNameTh: "ตู้แอร์",
      brandName: "Cool Gear",
      fitments: [{ carModel: "Revo" }, { carModel: "Fortuner Gen 2" }],
    });
    expect(partLine(coil, "customer", "k1")).toMatchObject({
      typeName: "ตู้แอร์",
      brandName: "Cool Gear",
      carModel: "Revo",
    });
    // No Thai name set for the type yet: the bill still says what it is, in English.
    expect(partLine(product({ typeName: "Evaporator" }), "customer", "k1").typeName).toBe(
      "Evaporator",
    );
  });

  it("serviceLine > given a saved or typed service > then a line with no stock", () => {
    expect(serviceLine({ name: "ล้างแอร์", priceSatang: 120_000 }, "s1")).toMatchObject({
      key: "s1",
      kind: "service",
      variantId: null,
      priceSatang: 120_000,
      walkInSatang: 120_000,
      onHand: null,
    });
  });
});

describe("posApi customer", () => {
  it("customerSummary > given a known plate > then name, visits, last visit and last mileage", () => {
    expect(
      customerSummary({
        customer: {
          licensePlate: "1กก 1234",
          plateProvince: "กรุงเทพมหานคร",
          customerName: "คุณสมชาย ใจดี",
          phone: "081-234-5678",
          carModel: "Toyota Vigo 2014",
        },
        history: [{ createdAt: 300 }, { createdAt: 200 }],
        lastMileage: { km: 148_200, at: 300 },
      }),
    ).toEqual({
      known: true,
      name: "คุณสมชาย ใจดี",
      phones: ["081-234-5678"],
      province: "กรุงเทพมหานคร",
      car: "Toyota Vigo 2014",
      visits: 2,
      lastVisitAt: 300,
      lastMileage: { km: 148_200, at: 300 },
    });
  });

  it("customerSummary > given a plate never seen > then a new customer", () => {
    expect(customerSummary({ customer: null, history: [] })).toMatchObject({
      known: false,
      visits: 0,
      lastMileage: null,
    });
  });
});
