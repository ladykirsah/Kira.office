import { describe, expect, it } from "vitest";
import type { OpenDraft, ProductRow } from "./posApi";
import { billFromDraft } from "./posDraft";

const products: ProductRow[] = [
  {
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
  },
];

const draft = (over: Partial<OpenDraft> = {}): OpenDraft => ({
  id: "d1",
  saleNumber: "QT202610-29002",
  saleType: "repair",
  licensePlate: "1กก 1234",
  vehicle: "Toyota Vigo 2014",
  notes: "รับประกัน 6 เดือน",
  stage: "quotation",
  grandTotalSatang: 0,
  discountKind: "thb",
  discountValue: "200",
  createdAt: 1,
  mileageKm: 152_300,
  buyerName: null,
  lines: [
    {
      productVariantId: "v1",
      lineType: "part",
      description: "คอมเพรสเซอร์ DENSO 10S11C",
      quantity: 2,
      unitPriceSatang: 330_000,
    },
    {
      productVariantId: null,
      lineType: "service",
      description: "เติมน้ำยาแอร์ R134a",
      quantity: 1,
      unitPriceSatang: 39_000,
    },
  ],
  ...over,
});

let n = 0;
const key = () => `k${++n}`;

describe("posDraft", () => {
  it("billFromDraft > given a quotation > then the same car, items, prices and discount come back", () => {
    n = 0;
    const { bill, quoteNumber } = billFromDraft(draft(), products, key);
    expect(quoteNumber).toBe("QT202610-29002");
    expect(bill).toMatchObject({
      doc: "quote",
      buyer: "customer",
      plate: "1กก 1234",
      car: "Toyota Vigo 2014",
      mileage: "152,300",
      note: "รับประกัน 6 เดือน",
      discount: { kind: "thb", value: "200" },
    });
    expect(bill.lines[0]).toMatchObject({
      key: "k1",
      kind: "part",
      variantId: "v1",
      quantity: 2,
      priceSatang: 330_000,
      walkInSatang: 345_000,
      onHand: 4,
      photoKey: "img/1.jpg",
    });
    expect(bill.lines[1]).toMatchObject({ kind: "service", priceSatang: 39_000, onHand: null });
  });

  it("billFromDraft > given a ช่าง draft > then it reopens as a ช่าง bill with the name", () => {
    const { bill, quoteNumber } = billFromDraft(
      draft({
        stage: "draft",
        saleNumber: null,
        licensePlate: null,
        vehicle: null,
        mileageKm: null,
        buyerName: "ช่างโอ๊ต",
      }),
      products,
      key,
    );
    expect(quoteNumber).toBeNull();
    expect(bill).toMatchObject({
      doc: "bill",
      buyer: "mechanic",
      mechanicName: "ช่างโอ๊ต",
      mileage: "",
    });
  });

  it("billFromDraft > given a part no longer listed > then it stays on the bill with no stock", () => {
    const { bill } = billFromDraft(draft(), [], key);
    expect(bill.lines[0]).toMatchObject({
      kind: "part",
      variantId: "v1",
      onHand: 0,
      priceSatang: 330_000,
    });
  });
});
