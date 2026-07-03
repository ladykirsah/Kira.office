import { describe, it, expect } from "vitest";
import { cartToDraftLines, draftToCartLines, type DraftApiLine } from "./posDraft";

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
