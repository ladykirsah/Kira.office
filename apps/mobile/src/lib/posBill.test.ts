import { describe, expect, it } from "vitest";
import {
  billMissing,
  buildBillSale,
  buildBillDraft,
  customerUpsert,
  discountOf,
  draftRowText,
  forBuyer,
  lineTotal,
  nextDocNumber,
  parseMileage,
  shortLines,
  subtotal,
  withMechanicPrice,
  type BillState,
  type PosLine,
} from "./posBill";

const part = (over: Partial<PosLine> = {}): PosLine => ({
  key: "k1",
  kind: "part",
  variantId: "v1",
  productId: "p1",
  productRef: "DN-447220",
  name: "คอมเพรสเซอร์ DENSO 10S11C",
  photoKey: null,
  barcode: "8850001",
  quantity: 1,
  walkInSatang: 345_000,
  mechanicSatang: 310_000,
  priceSatang: 345_000,
  useMechanic: false,
  costSatang: 250_000,
  onHand: 4,
  ...over,
});

const service = (over: Partial<PosLine> = {}): PosLine => ({
  ...part(),
  key: "s1",
  kind: "service",
  variantId: null,
  productId: null,
  productRef: null,
  name: "เติมน้ำยาแอร์ R134a",
  barcode: null,
  walkInSatang: 39_000,
  mechanicSatang: 0,
  priceSatang: 39_000,
  costSatang: 0,
  onHand: null,
  ...over,
});

const bill = (over: Partial<BillState> = {}): BillState => ({
  doc: "bill",
  buyer: "customer",
  plate: "1กก 1234",
  province: "กรุงเทพมหานคร",
  customerName: "",
  phones: [],
  car: "Toyota Vigo 2014",
  mileage: "152,300",
  mechanicName: "",
  lines: [part(), service()],
  discount: { kind: "thb", value: "200" },
  note: "",
  ...over,
});

describe("posBill prices", () => {
  it("lineTotal > given a quantity and a price > then multiplies them", () => {
    expect(lineTotal(part({ quantity: 2, priceSatang: 48_000 }))).toBe(96_000);
  });

  it("withMechanicPrice > given the switch on > then the line takes the mechanic price", () => {
    expect(withMechanicPrice(part(), true).priceSatang).toBe(310_000);
    expect(withMechanicPrice(withMechanicPrice(part(), true), false).priceSatang).toBe(345_000);
  });

  it("withMechanicPrice > given no mechanic price set > then the walk-in price stays", () => {
    expect(withMechanicPrice(part({ mechanicSatang: 0 }), true).priceSatang).toBe(345_000);
  });

  it("forBuyer > given ช่าง > then every part is at the mechanic price and services stay", () => {
    const lines = forBuyer([part(), service()], "mechanic");
    expect(lines.map((l) => l.priceSatang)).toEqual([310_000, 39_000]);
    expect(forBuyer(lines, "customer").map((l) => l.priceSatang)).toEqual([345_000, 39_000]);
  });

  it("discountOf > given baht or percent > then clamps it to the subtotal", () => {
    expect(discountOf(426_000, { kind: "thb", value: "200" })).toBe(20_000);
    expect(discountOf(426_000, { kind: "pct", value: "10" })).toBe(42_600);
    expect(discountOf(10_000, { kind: "thb", value: "500" })).toBe(10_000);
    expect(discountOf(10_000, { kind: "thb", value: "" })).toBe(0);
  });

  it("subtotal > given lines > then adds their totals", () => {
    expect(subtotal([part(), service()])).toBe(384_000);
  });
});

describe("posBill what is still needed", () => {
  it("billMissing > given a customer bill with car and mileage > then nothing is missing", () => {
    expect(billMissing(bill())).toEqual([]);
  });

  it("billMissing > given a customer bill without plate, car or mileage > then names each one", () => {
    expect(billMissing(bill({ plate: " ", car: "", mileage: "" }))).toEqual([
      "plate",
      "car",
      "mileage",
    ]);
  });

  it("billMissing > given a ช่าง bill > then only items are needed", () => {
    expect(billMissing(bill({ buyer: "mechanic", plate: "", car: "", mileage: "" }))).toEqual([]);
    expect(billMissing(bill({ buyer: "mechanic", lines: [] }))).toEqual(["lines"]);
  });

  it("parseMileage > given a typed reading > then reads digits and refuses nonsense", () => {
    expect(parseMileage("152,300")).toBe(152_300);
    expect(parseMileage(" 98000 km")).toBe(98_000);
    expect(parseMileage("")).toBeNull();
    expect(parseMileage("abc")).toBeNull();
    expect(parseMileage("99999999")).toBeNull();
  });

  it("shortLines > given more of a part than the shop has > then that line is short", () => {
    const short = part({ key: "k2", quantity: 2, onHand: 1 });
    expect(shortLines([part(), short, service()]).map((l) => l.key)).toEqual(["k2"]);
  });
});

describe("posBill what is sent", () => {
  it("buildBillSale > given a customer bill > then sends the car, mileage and the split discount", () => {
    const sale = buildBillSale(bill(), {
      clientUuid: "u1",
      saleNumber: "DAS202610-30001",
      paymentMethod: "cash",
      receivedBy: "พี่เอ",
    });
    expect(sale).toMatchObject({
      clientUuid: "u1",
      saleNumber: "DAS202610-30001",
      paymentMethod: "cash",
      saleType: "repair",
      licensePlate: "1กก 1234",
      vehicle: "Toyota Vigo 2014",
      mileageKm: 152_300,
      buyerName: null,
    });
    expect(sale.notes).toBe("รับเงินโดย พี่เอ");
    expect(sale.lines.map((l) => l.discountSatang)).toEqual([17_969, 2_031]);
    expect(sale.lines[1]).toMatchObject({ lineType: "service", productVariantId: null });
  });

  it("buildBillSale > given a ช่าง bill of parts > then no car, the name, and a parts sale", () => {
    const sale = buildBillSale(
      bill({
        buyer: "mechanic",
        mechanicName: " ช่างโอ๊ต ",
        lines: [part()],
        discount: { kind: "thb", value: "" },
      }),
      {
        clientUuid: "u2",
        saleNumber: "DAS202610-30002",
        paymentMethod: "promptpay",
        receivedBy: "",
      },
    );
    expect(sale).toMatchObject({
      saleType: "parts",
      licensePlate: undefined,
      vehicle: undefined,
      mileageKm: null,
      buyerName: "ช่างโอ๊ต",
      notes: undefined,
    });
  });

  it("buildBillDraft > given a quotation > then keeps its number and the raw discount", () => {
    const draft = buildBillDraft(bill({ doc: "quote", note: "รับประกัน 6 เดือน" }), {
      draftId: "d1",
      saleNumber: "QT202610-30001",
    });
    expect(draft).toMatchObject({
      draftId: "d1",
      stage: "quotation",
      saleNumber: "QT202610-30001",
      discountSatang: 20_000,
      discountKind: "thb",
      discountValue: "200",
      notes: "รับประกัน 6 เดือน",
      mileageKm: 152_300,
    });
    expect(buildBillDraft(bill(), { draftId: "d2", saleNumber: null }).stage).toBe("draft");
  });

  it("customerUpsert > given a new plate > then sends only what was filled in", () => {
    expect(customerUpsert(bill({ customerName: "", phones: ["081", " "] }))).toEqual({
      licensePlate: "1กก 1234",
      plateProvince: "กรุงเทพมหานคร",
      phone: "081",
      carModel: "Toyota Vigo 2014",
    });
    expect(customerUpsert(bill({ buyer: "mechanic" }))).toBeNull();
  });
});

describe("posBill numbers and lists", () => {
  it("nextDocNumber > given today's numbers > then follows the highest for that prefix", () => {
    const now = new Date(2026, 9, 30, 10, 0).getTime();
    expect(nextDocNumber("QT", ["QT202610-30002", "DAS202610-30009", "QT202610-29007"], now)).toBe(
      "QT202610-30003",
    );
    expect(nextDocNumber("DAS", [], now)).toBe("DAS202610-30001");
  });

  it("draftRowText > given a quotation and a draft > then line 2 is plate · car, line 3 date · time", () => {
    const now = new Date(2026, 9, 30, 15, 0).getTime();
    expect(
      draftRowText(
        {
          stage: "quotation",
          saleNumber: "QT202610-27001",
          licensePlate: "3กก 9012",
          vehicle: "Isuzu D-Max 2018",
          buyerName: null,
          createdAt: new Date(2026, 9, 27, 16, 10).getTime(),
        },
        now,
      ),
    ).toEqual({
      top: { th: "ใบเสนอราคา · QT202610-27001", en: "Quotation · QT202610-27001" },
      main: "3กก 9012 · Isuzu D-Max 2018",
      when: { th: "27 ต.ค. · 16:10", en: "27 ต.ค. · 16:10" },
    });
    expect(
      draftRowText(
        {
          stage: "draft",
          saleNumber: null,
          licensePlate: null,
          vehicle: null,
          buyerName: null,
          createdAt: new Date(2026, 9, 30, 11, 42).getTime(),
        },
        now,
      ),
    ).toEqual({
      top: { th: "ฉบับร่าง", en: "Draft" },
      main: null,
      when: { th: "วันนี้ · 11:42", en: "Today · 11:42" },
    });
  });
});
