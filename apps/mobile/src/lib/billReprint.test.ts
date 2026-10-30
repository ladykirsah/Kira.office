import { describe, expect, it } from "vitest";
import { reprintBill } from "./billReprint";
import type { CarDetail, CarSale } from "./customersApi";

const sale: CarSale = {
  id: "s1",
  saleNumber: "DAS202608-12003",
  stage: "bill",
  createdAt: 1,
  subtotalSatang: 1590_00,
  discountTotalSatang: 90_00,
  taxTotalSatang: 0,
  grandTotalSatang: 1500_00,
  notes: "โทรก่อน",
  vehicle: "Toyota Vigo 2014",
  mileageKm: 128400,
  buyerName: null,
  paymentMethod: "promptpay",
  lines: [
    {
      description: "ล้างแอร์ทั้งระบบ",
      lineType: "service",
      quantity: 1,
      unitPriceSatang: 1200_00,
      discountSatang: 0,
      productRef: null,
      brandName: null,
    },
    {
      description: "น้ำยาแอร์ R134a",
      lineType: "part",
      quantity: 2,
      unitPriceSatang: 195_00,
      discountSatang: 0,
      productRef: "SU-134",
      brandName: "Suva",
    },
  ],
};
const customer: CarDetail["customer"] = {
  licensePlate: "1กก 1234",
  plateProvince: "กรุงเทพมหานคร",
  customerName: "คุณสมชาย",
  phone: "081, 089",
  carModel: null,
  notes: null,
};

describe("reprintBill", () => {
  it("given a saved bill > then the same paper ทำบิล printed: lines, discount, car and payment", () => {
    const doc = reprintBill(sale, customer, { shopName: "Den Air Service", lang: "th" });
    expect(doc).toMatchObject({
      kind: "bill",
      number: "DAS202608-12003",
      at: 1,
      shopName: "Den Air Service",
      paymentMethod: "promptpay",
      print: { style: "receipt", lang: "th", date: null },
    });
    expect(doc.bill).toMatchObject({
      buyer: "customer",
      plate: "1กก 1234",
      province: "กรุงเทพมหานคร",
      customerName: "คุณสมชาย",
      phones: ["081", "089"],
      car: "Toyota Vigo 2014",
      mileage: "128,400",
      discount: { kind: "thb", value: "90" },
      note: "โทรก่อน",
    });
    expect(
      doc.bill.lines.map((l) => [l.kind, l.name, l.quantity, l.priceSatang, l.productRef]),
    ).toEqual([
      ["service", "ล้างแอร์ทั้งระบบ", 1, 1200_00, null],
      ["part", "น้ำยาแอร์ R134a", 2, 195_00, "SU-134"],
    ]);
  });

  it("given a bill whose discount is spread over its lines > then the discount is taken off once", () => {
    const shared: CarSale = {
      ...sale,
      discountTotalSatang: 200_00,
      lines: [
        { ...sale.lines[0]!, unitPriceSatang: 3450_00, discountSatang: 150_00 },
        { ...sale.lines[1]!, quantity: 1, unitPriceSatang: 650_00, discountSatang: 50_00 },
      ],
    };
    const doc = reprintBill(shared, customer, { shopName: "", lang: "th" });
    expect(doc.bill.lines.map((l) => l.priceSatang)).toEqual([3450_00, 650_00]);
    expect(doc.bill.discount).toEqual({ kind: "thb", value: "200" });
  });

  it("given a mechanic's bill with an unknown way of paying > then the mechanic and no payment line", () => {
    const doc = reprintBill(
      { ...sale, buyerName: "ช่างเอ", paymentMethod: "transfer", mileageKm: null },
      null,
      { shopName: "", lang: "en" },
    );
    expect(doc.bill).toMatchObject({
      buyer: "mechanic",
      mechanicName: "ช่างเอ",
      mileage: "",
      plate: "",
    });
    expect(doc.paymentMethod).toBeNull();
  });
});
