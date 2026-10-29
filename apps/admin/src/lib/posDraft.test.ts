import { describe, it, expect } from "vitest";
import { cartToDraftLines, draftToCartLines, readLocalDraft, type DraftApiLine } from "./posDraft";

describe("cartToDraftLines", () => {
  it("maps a part line (keeps variant + cost, no per-line discount)", () => {
    expect(
      cartToDraftLines([
        {
          kind: "part",
          name: "Compressor",
          productVariantId: "v1",
          barcodeValue: "8850",
          quantity: 2,
          unitPriceSatang: 150000,
          unitCostSatang: 90000,
        },
      ]),
    ).toEqual([
      {
        productVariantId: "v1",
        lineType: "part",
        description: "Compressor",
        barcodeValue: "8850",
        quantity: 2,
        unitPriceSatang: 150000,
        unitCostSatang: 90000,
      },
    ]);
  });

  it("maps a service line to a null variant and zero cost", () => {
    expect(
      cartToDraftLines([{ kind: "service", name: "Regas", quantity: 1, unitPriceSatang: 80000 }]),
    ).toEqual([
      {
        productVariantId: null,
        lineType: "service",
        description: "Regas",
        barcodeValue: undefined,
        quantity: 1,
        unitPriceSatang: 80000,
        unitCostSatang: 0,
      },
    ]);
  });
});

describe("draftToCartLines", () => {
  it("restores lines into cart shape with fresh uids", () => {
    const lines: DraftApiLine[] = [
      {
        productVariantId: "v1",
        lineType: "part",
        description: "Compressor",
        barcodeValue: "8850",
        quantity: 2,
        unitPriceSatang: 150000,
        unitCostSatang: 90000,
      },
      {
        productVariantId: null,
        lineType: "service",
        description: "Regas",
        quantity: 1,
        unitPriceSatang: 80000,
        unitCostSatang: 0,
      },
    ];
    let n = 0;
    const restored = draftToCartLines(lines, () => `uid-${++n}`);
    expect(restored).toEqual([
      {
        uid: "uid-1",
        kind: "part",
        name: "Compressor",
        productVariantId: "v1",
        barcodeValue: "8850",
        quantity: 2,
        unitPriceSatang: 150000,
        unitCostSatang: 90000,
      },
      {
        uid: "uid-2",
        kind: "service",
        name: "Regas",
        productVariantId: null,
        barcodeValue: undefined,
        quantity: 1,
        unitPriceSatang: 80000,
        unitCostSatang: 0,
      },
    ]);
  });
});

describe("readLocalDraft", () => {
  const line = {
    uid: "a",
    kind: "part" as const,
    name: "Compressor",
    productVariantId: "v1",
    quantity: 1,
    unitPriceSatang: 259000,
  };

  it("given nothing saved > restores nothing", () => {
    expect(readLocalDraft(null)).toEqual({});
  });

  it("given a corrupt save > restores nothing instead of crashing the page", () => {
    expect(readLocalDraft("{not json")).toEqual({});
  });

  it("given a saved cart > restores the items, vehicle and document type", () => {
    const saved = {
      lines: [line],
      plate: "1กก 1234",
      province: "กรุงเทพมหานคร",
      mileage: "120000",
      note: "นัดรับพรุ่งนี้",
      billDate: "2026-10-29",
      carBrandId: "b1",
      carModelId: "m1",
      carYear: "2018",
      docType: "quotation",
    };
    expect(readLocalDraft(JSON.stringify(saved))).toEqual(saved);
  });

  it("given a bill discount > restores it exactly as typed (the sale is finished from this after /payment)", () => {
    // Coming back from /payment remounts POS, which completes the sale from the restored bill.
    // Losing the discount here recorded the sale at full price while the customer paid less.
    const restored = readLocalDraft(
      JSON.stringify({ lines: [line], discountKind: "pct", discountValue: "10" }),
    );
    expect(restored).toMatchObject({ discountKind: "pct", discountValue: "10" });
  });

  it("given a new customer's details and the bill's paper + language > restores them all", () => {
    // Same trip to /payment and back: the customer is filed and the bill printed from these.
    const restored = readLocalDraft(
      JSON.stringify({
        lines: [line],
        customerName: "สมชาย",
        phones: ["0810000001", "0820000002"],
        billLang: "en",
        billStyle: "thermal",
      }),
    );
    expect(restored).toMatchObject({
      customerName: "สมชาย",
      phones: ["0810000001", "0820000002"],
      billLang: "en",
      billStyle: "thermal",
    });
  });

  it("given phones that are not a list of text > leaves them out", () => {
    expect(readLocalDraft(JSON.stringify({ phones: [1, 2] })).phones).toBeUndefined();
    expect(readLocalDraft(JSON.stringify({ phones: [] })).phones).toBeUndefined();
  });

  it("given wrongly-typed fields > leaves them out so the page keeps its defaults", () => {
    const restored = readLocalDraft(
      JSON.stringify({ lines: [], plate: 5, docType: "invoice", note: "ok" }),
    );
    expect(restored).toEqual({ note: "ok" });
  });
});
