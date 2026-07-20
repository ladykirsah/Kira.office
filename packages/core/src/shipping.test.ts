import { describe, it, expect } from "vitest";
import {
  volumetricWeightKg,
  chargeableWeightKg,
  cartChargeableWeightKg,
  packedParcelDims,
  feeForChargeableKg,
  quoteShippingSatang,
  type ShippingRateCard,
} from "./shipping";

// A small FIXTURE rate card — deliberately NOT the real Flash numbers, so these
// tests exercise the calculation logic, not the placeholder rate table.
const CARD: ShippingRateCard = {
  tiers: [
    { uptoKg: 1, feeSatang: 2500 },
    { uptoKg: 2, feeSatang: 3500 },
    { uptoKg: 5, feeSatang: 6000 },
  ],
  overflowPerKgSatang: 1000, // ฿10 per whole kg above the heaviest tier
  volumetricDivisor: 5000,
  remoteSurchargeSatang: 5000, // ฿50
};

describe("volumetricWeightKg", () => {
  it("given a full box in mm > converts to volumetric kg via /5000 on cm", () => {
    // 25 x 40 x 15.5 cm = 15500 cm^3 / 5000 = 3.1 kg
    expect(volumetricWeightKg({ widthMm: 250, lengthMm: 400, heightMm: 155 }, 5000)).toBeCloseTo(
      3.1,
      6,
    );
  });

  it("given any missing dimension > returns 0 (cannot compute volume)", () => {
    expect(volumetricWeightKg({ widthMm: 250, lengthMm: 400, heightMm: null }, 5000)).toBe(0);
    expect(volumetricWeightKg(null, 5000)).toBe(0);
  });

  it("given a zero or negative dimension > returns 0", () => {
    expect(volumetricWeightKg({ widthMm: 0, lengthMm: 400, heightMm: 155 }, 5000)).toBe(0);
    expect(volumetricWeightKg({ widthMm: -1, lengthMm: 400, heightMm: 155 }, 5000)).toBe(0);
  });
});

describe("chargeableWeightKg", () => {
  it("given a heavy compact parcel > actual weight dominates", () => {
    // compressor: 5.8 kg actual, 20x15x15 cm -> 0.9 kg volumetric
    expect(
      chargeableWeightKg(5800, { widthMm: 200, lengthMm: 150, heightMm: 150 }, 5000),
    ).toBeCloseTo(5.8, 6);
  });

  it("given a light bulky parcel > volumetric weight dominates", () => {
    // condenser: 1.0 kg actual, 25x40x15.5 cm -> 3.1 kg volumetric
    expect(
      chargeableWeightKg(1000, { widthMm: 250, lengthMm: 400, heightMm: 155 }, 5000),
    ).toBeCloseTo(3.1, 6);
  });

  it("given no dimensions > falls back to actual weight only", () => {
    expect(chargeableWeightKg(800, null, 5000)).toBeCloseTo(0.8, 6);
  });
});

describe("cartChargeableWeightKg", () => {
  it("given a multi-item cart > uses the greater of TOTAL actual vs TOTAL volumetric", () => {
    // Two light-bulky items: actual 1+1=2 kg, volumetric 3.1+3.1=6.2 kg -> 6.2
    const items = [
      {
        weightGrams: 1000,
        dims: { widthMm: 250, lengthMm: 400, heightMm: 155 },
        qty: 1,
      },
      {
        weightGrams: 1000,
        dims: { widthMm: 250, lengthMm: 400, heightMm: 155 },
        qty: 1,
      },
    ];
    expect(cartChargeableWeightKg(items, 5000)).toBeCloseTo(6.2, 6);
  });

  it("given heavy compact items > total actual dominates", () => {
    // Two compressors: actual 5.8+5.8=11.6 kg, volumetric 0.9+0.9=1.8 kg -> 11.6
    const items = [
      {
        weightGrams: 5800,
        dims: { widthMm: 200, lengthMm: 150, heightMm: 150 },
        qty: 1,
      },
      {
        weightGrams: 5800,
        dims: { widthMm: 200, lengthMm: 150, heightMm: 150 },
        qty: 1,
      },
    ];
    expect(cartChargeableWeightKg(items, 5000)).toBeCloseTo(11.6, 6);
  });

  it("given qty > 1 > multiplies both actual and volumetric by qty", () => {
    // One line, qty 3, light bulky: actual 3 kg, volumetric 9.3 kg -> 9.3
    const items = [
      {
        weightGrams: 1000,
        dims: { widthMm: 250, lengthMm: 400, heightMm: 155 },
        qty: 3,
      },
    ];
    expect(cartChargeableWeightKg(items, 5000)).toBeCloseTo(9.3, 6);
  });
});

describe("feeForChargeableKg", () => {
  it("given weight inside a tier > returns that tier's fee", () => {
    expect(feeForChargeableKg(0.5, CARD)).toBe(2500);
    expect(feeForChargeableKg(1.0, CARD)).toBe(2500); // boundary is inclusive
    expect(feeForChargeableKg(1.5, CARD)).toBe(3500);
    expect(feeForChargeableKg(2.0, CARD)).toBe(3500);
    expect(feeForChargeableKg(4.9, CARD)).toBe(6000);
    expect(feeForChargeableKg(5.0, CARD)).toBe(6000);
  });

  it("given weight above the heaviest tier > adds per-kg overflow, rounded up per whole kg", () => {
    expect(feeForChargeableKg(5.5, CARD)).toBe(7000); // +ceil(0.5)=1 kg
    expect(feeForChargeableKg(7.0, CARD)).toBe(8000); // +2 kg
  });

  it("given zero or empty weight > still charges the minimum (base) tier", () => {
    expect(feeForChargeableKg(0, CARD)).toBe(2500);
  });
});

describe("quoteShippingSatang", () => {
  it("given a light-bulky cart > prices on volumetric weight", () => {
    const items = [
      {
        weightGrams: 1000,
        dims: { widthMm: 250, lengthMm: 400, heightMm: 155 },
        qty: 1,
      },
    ];
    expect(quoteShippingSatang(items, false, CARD)).toBe(6000); // 3.1 kg -> <=5 tier
  });

  it("given a remote destination > adds the flat remote surcharge", () => {
    const items = [
      {
        weightGrams: 1000,
        dims: { widthMm: 250, lengthMm: 400, heightMm: 155 },
        qty: 1,
      },
    ];
    expect(quoteShippingSatang(items, true, CARD)).toBe(11000); // 6000 + 5000
  });

  it("given a heavy compact parcel to a remote postcode > overflow + surcharge", () => {
    const items = [
      {
        weightGrams: 5800,
        dims: { widthMm: 200, lengthMm: 150, heightMm: 150 },
        qty: 1,
      },
    ];
    // 5.8 kg -> 6000 + ceil(0.8)=1 kg overflow (1000) = 7000, + remote 5000 = 12000
    expect(quoteShippingSatang(items, true, CARD)).toBe(12000);
  });
});

/**
 * The owner's packing rule (confirmed 2026-07-20): items are stacked so one face of each
 * touches, and they are laid on their LARGEST face. So each item contributes its smallest
 * dimension to the stack height, and the footprint is the largest footprint in the cart.
 *
 * Fixtures are the owner's own three worked examples, in mm.
 */
const PROD_A = { widthMm: 500, lengthMm: 1000, heightMm: 200 }; // 50 x 100 x 20 cm
const PROD_B = { widthMm: 200, lengthMm: 600, heightMm: 100 }; //  20 x 60  x 10 cm
const PROD_C = { widthMm: 300, lengthMm: 300, heightMm: 300 }; //  30 x 30  x 30 cm

describe("packedParcelDims (owner's stack-on-largest-face rule)", () => {
  it("owner case 1 > 2 units of A stack on the 50x100 face > 100 x 50 x 40 cm", () => {
    expect(packedParcelDims([{ dims: PROD_A, qty: 2 }])).toEqual({
      widthMm: 1000,
      lengthMm: 500,
      heightMm: 400,
    });
  });

  it("owner case 2 > A + B, 50x100 touching 20x60 > 100 x 50 x 30 cm", () => {
    expect(
      packedParcelDims([
        { dims: PROD_A, qty: 1 },
        { dims: PROD_B, qty: 1 },
      ]),
    ).toEqual({ widthMm: 1000, lengthMm: 500, heightMm: 300 });
  });

  it("owner case 3 > 2 cubes > 30 x 30 x 60 cm (orientation is moot when sides are equal)", () => {
    expect(packedParcelDims([{ dims: PROD_C, qty: 2 }])).toEqual({
      widthMm: 300,
      lengthMm: 300,
      heightMm: 600,
    });
  });

  it("given a single item > returns it laid on its largest face, not its stored order", () => {
    expect(packedParcelDims([{ dims: PROD_A, qty: 1 }])).toEqual({
      widthMm: 1000,
      lengthMm: 500,
      heightMm: 200,
    });
  });

  it("given an item with unknown dims > ignores it rather than treating it as zero-sized", () => {
    expect(
      packedParcelDims([
        { dims: PROD_C, qty: 1 },
        { dims: null, qty: 3 },
      ]),
    ).toEqual({ widthMm: 300, lengthMm: 300, heightMm: 300 });
  });

  it("given nothing measurable > returns null so the caller prices on actual weight alone", () => {
    expect(packedParcelDims([{ dims: null, qty: 2 }])).toBeNull();
  });
});

describe("cart volumetric weight uses the packed box, not summed item volumes", () => {
  it("owner case 2 > packed box counts the void space that summing volumes ignores", () => {
    // Summing each item's own volume gives 20 + 2.4 = 22.4 kg and UNDER-charges: the real
    // carton is 100x50x30 cm because B sits on top of A's larger footprint.
    const items = [
      { weightGrams: 0, dims: PROD_A, qty: 1 },
      { weightGrams: 0, dims: PROD_B, qty: 1 },
    ];
    expect(cartChargeableWeightKg(items, 5000)).toBeCloseTo(30, 6);
  });

  it("owner case 1 > two identical items are exactly twice the volume", () => {
    const items = [{ weightGrams: 0, dims: PROD_A, qty: 2 }];
    expect(cartChargeableWeightKg(items, 5000)).toBeCloseTo(40, 6);
  });
});
