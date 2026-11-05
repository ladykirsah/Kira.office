import { describe, expect, it } from "vitest";
import type { Bill, Expense, MoneyOrder } from "./financePage";
import { billCountLine, quickLinks, seesMoney, todayCurve, todaySummary } from "./homeToday";

const NOW = new Date(2026, 10, 5, 14, 30).getTime(); // 5 Nov 2026, 14:30
const today = (h: number) => new Date(2026, 10, 5, h).getTime();
const yesterday = (h: number) => new Date(2026, 10, 4, h).getTime();

const bill = (over: Partial<Bill>): Bill => ({
  id: "b",
  saleNumber: "DAS1",
  grandTotalSatang: 1000_00,
  saleStatus: "completed",
  createdAt: today(10),
  saleType: "parts",
  licensePlate: null,
  vehicle: null,
  plateProvince: null,
  buyerName: null,
  grossProfitSatang: 300_00,
  partLineCount: 1,
  ...over,
});

const order = (over: Partial<MoneyOrder>): MoneyOrder => ({
  id: "o",
  channel: "airplus",
  externalOrderId: "AP-1",
  orderStatus: "delivered",
  paymentStatus: "paid",
  grandTotalSatang: 500_00,
  orderCreatedAt: today(11),
  importedAt: today(11),
  salesSatang: 500_00,
  profitSatang: 100_00,
  ...over,
});

const expense = (over: Partial<Expense>): Expense => ({
  id: "e",
  channel: "onsite",
  conversion: "ค่าน้ำ",
  amountSatang: 50_00,
  note: null,
  occurredAt: today(9),
  createdAt: today(9),
  hasSlip: false,
  ...over,
});

describe("quickLinks (หน้าหลัก on a computer: the shortcut row)", () => {
  it("given the owner > then ทำบิล, สแกน, เพิ่มสินค้า, ออกบาร์โค้ด, in the drawing's order", () => {
    expect(quickLinks("super_admin").map((l) => l.href)).toEqual([
      "/pos",
      "/scan",
      "/products/new",
      "/barcodes",
    ]);
  });

  it("given a link > then it carries the menu's own words", () => {
    expect(quickLinks("super_admin")[0]!.label.th).toBe("ทำบิล");
  });

  it("given a mechanic > then only the shortcuts their menu has (no เพิ่มสินค้า, no ออกบาร์โค้ด)", () => {
    expect(quickLinks("mechanic").map((l) => l.href)).toEqual(["/pos", "/scan"]);
  });
});

describe("todaySummary (หน้าหลัก on a computer: the owner's วันนี้ card)", () => {
  const input = {
    billsToday: [bill({ id: "b1" }), bill({ id: "b2", saleStatus: "refunded" })],
    billsYesterday: [bill({ id: "b0", createdAt: yesterday(10), grandTotalSatang: 2000_00 })],
    orders: [
      order({ id: "o1" }),
      order({ id: "o0", orderCreatedAt: yesterday(12), importedAt: yesterday(12) }),
    ],
    expenses: [expense({ id: "e1" })],
    now: NOW,
  };

  it("given today's done bills and AirPlus orders > then ยอดขาย adds both shops (a refunded bill is not income)", () => {
    expect(todaySummary(input).salesSatang).toBe(1000_00 + 500_00);
  });

  it("given today's expenses > then กำไร is the profit less them, as การเงิน adds it up", () => {
    expect(todaySummary(input).profitSatang).toBe(300_00 + 100_00 - 50_00);
  });

  it("given both shops > then บิล counts each shop's done bills and orders", () => {
    expect(todaySummary(input).count).toEqual({ den: 1, air: 1 });
  });

  it("given yesterday's sales > then the change says ▲/▼ against the whole of yesterday", () => {
    // Today 1,500 against yesterday 2,000 + 500 = 2,500 → ▼40%.
    expect(todaySummary(input).salesChange).toEqual({ arrow: "▼40%", tone: "bad" });
  });

  it("given nothing sold yesterday > then no change line at all", () => {
    expect(
      todaySummary({ ...input, billsYesterday: [], orders: [order({ id: "o1" })] }).salesChange,
    ).toBeNull();
  });
});

describe("billCountLine", () => {
  it("given each shop's bills > then เด่นแอร์ first, then AirPlus (owner: the counter is เด่นแอร์)", () => {
    expect(billCountLine({ den: 5, air: 8 })).toEqual({
      th: "เด่นแอร์ 5 · AirPlus 8",
      en: "Den Air 5 · AirPlus 8",
    });
  });
});

describe("todayCurve (the วันนี้ card's line: money in, added up hour by hour)", () => {
  it("given sales today > then the line runs from opening to now, adding up", () => {
    const curve = todayCurve(
      [
        { at: today(10), revenue: 100 },
        { at: today(13), revenue: 50 },
      ],
      [],
      NOW,
    );
    expect(curve.today).toHaveLength(15); // hours 0 … 14
    expect(curve.today[9]).toBe(0);
    expect(curve.today[10]).toBe(100);
    expect(curve.today[14]).toBe(150);
  });

  it("given yesterday's sales > then the dashed line covers the whole day", () => {
    const curve = todayCurve([], [{ at: yesterday(20), revenue: 70 }], NOW);
    expect(curve.yesterday).toHaveLength(24);
    expect(curve.yesterday[23]).toBe(70);
  });
});

describe("seesMoney (who gets the วันนี้ card)", () => {
  it("given the owner > then yes: การเงิน is in their menu", () => {
    expect(seesMoney("super_admin")).toBe(true);
  });

  it("given an admin or a mechanic > then no: the books are the owner's alone", () => {
    expect(seesMoney("admin")).toBe(false);
    expect(seesMoney("mechanic")).toBe(false);
  });
});
