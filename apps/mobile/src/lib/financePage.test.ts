import { describe, expect, it } from "vitest";
import {
  billRows,
  billState,
  billSub,
  billTitle,
  billTotals,
  changeLine,
  dayHeading,
  expenseBody,
  expenseProblems,
  expenseSub,
  expensesIn,
  financeOrders,
  ledgerLine,
  minus,
  money,
  orderRows,
  orderState,
  orderSub,
  orderTotals,
  periodRange,
  previousRange,
  searchBills,
  type Bill,
  type Expense,
  type MoneyOrder,
} from "./financePage";

const at = (y: number, m: number, d: number, h = 12, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 10, 29, 15, 0);

const bill = (over: Partial<Bill>): Bill => ({
  id: "b",
  saleNumber: "DAS202610-29004",
  grandTotalSatang: 406000,
  saleStatus: "completed",
  createdAt: at(2026, 10, 29, 14, 32),
  saleType: "parts",
  licensePlate: "1กก 1234",
  vehicle: "Toyota Vigo",
  plateProvince: "กรุงเทพมหานคร",
  buyerName: null,
  grossProfitSatang: 132000,
  partLineCount: 2,
  ...over,
});

const order = (over: Partial<MoneyOrder>): MoneyOrder => ({
  id: "o",
  channel: "airplus",
  externalOrderId: "AP-2006",
  orderStatus: "delivered",
  paymentStatus: "paid",
  grandTotalSatang: 353000,
  orderCreatedAt: at(2026, 10, 29, 13, 40),
  importedAt: 0,
  buyerUsername: "คุณมานพ",
  salesSatang: 353000,
  profitSatang: 102000,
  ...over,
});

const expense = (over: Partial<Expense>): Expense => ({
  id: "e",
  channel: "airplus",
  conversion: "แพ็กเกจ LINE OA รายเดือน",
  amountSatang: 120000,
  note: null,
  occurredAt: at(2026, 10, 1, 0),
  createdAt: 0,
  hasSlip: false,
  ...over,
});

describe("money words", () => {
  it("money > given satang > then baht with commas and no .00", () => {
    expect(money(31260000)).toBe("฿312,600");
    expect(money(150)).toBe("฿1.5");
  });
  it("money > given a loss > then a real minus sign before the baht", () => {
    expect(money(-214000)).toBe("−฿2,140");
  });
  it("minus > given an expense > then a real minus sign before the baht", () => {
    expect(minus(385000)).toBe("−฿3,850");
  });
});

describe("periods", () => {
  it("periodRange > given เดือนนี้ > then the 1st of the month to just after now", () => {
    expect(periodRange("month", null, NOW)).toEqual({ from: at(2026, 10, 1, 0), to: NOW + 1 });
  });
  it("periodRange > given ทุกวัน > then from the very start", () => {
    expect(periodRange("all", null, NOW)).toEqual({ from: 0, to: NOW + 1 });
  });
  it("previousRange > given a range > then the same length right before it", () => {
    expect(previousRange({ from: 100, to: 160 }, "7d")).toEqual({ from: 40, to: 100 });
  });
  it("previousRange > given เดือนนี้ > then last month up to the same day and time", () => {
    expect(previousRange(periodRange("month", null, NOW), "month")).toEqual({
      from: at(2026, 9, 1, 0),
      to: at(2026, 9, 29, 15, 0) + 1,
    });
  });
  it("previousRange > given เดือนก่อน > then the whole month before it", () => {
    expect(previousRange(periodRange("lastmonth", null, NOW), "lastmonth")).toEqual({
      from: at(2026, 8, 1, 0),
      to: at(2026, 9, 1, 0),
    });
  });
  it("previousRange > given ทุกวัน > then nothing to compare with", () => {
    expect(previousRange({ from: 0, to: NOW + 1 }, "all")).toBeNull();
  });
});

describe("changeLine", () => {
  it("given more than before > then a green ▲ with the whole percent", () => {
    expect(changeLine(312600, 286800)).toEqual({ arrow: "▲9%", tone: "good" });
  });
  it("given less than before > then a red ▼", () => {
    expect(changeLine(90, 100)).toEqual({ arrow: "▼10%", tone: "bad" });
  });
  it("given nothing before, or no period before > then no line", () => {
    expect(changeLine(100, 0)).toBeNull();
    expect(changeLine(100, null)).toBeNull();
  });
});

describe("Den Air Service bills", () => {
  it("billTotals > given completed and refunded bills > then only completed ones count", () => {
    const t = billTotals([
      bill({ id: "a" }),
      bill({
        id: "b",
        grandTotalSatang: 690000,
        grossProfitSatang: 94000,
      }),
      bill({ id: "c", saleStatus: "refunded", grandTotalSatang: 89000 }),
    ]);
    expect(t).toEqual({
      count: 2,
      revenueSatang: 1096000,
      profitSatang: 226000,
    });
  });
  it("billTitle > given a plate > then the plate with its province, never the car", () => {
    expect(billTitle(bill({}))).toEqual({
      th: "1กก 1234 กรุงเทพมหานคร",
      en: "1กก 1234 กรุงเทพมหานคร",
    });
    expect(billTitle(bill({ plateProvince: null })).th).toBe("1กก 1234");
  });
  it("billTitle > given no plate > then the buyer, or a counter sale", () => {
    expect(billTitle(bill({ licensePlate: null, vehicle: null, buyerName: "ราคาช่าง" })).th).toBe(
      "ราคาช่าง",
    );
    expect(billTitle(bill({ licensePlate: null, vehicle: null })).th).toBe("ขายหน้าร้าน");
  });
  it("billSub > then the bill number only, no time", () => {
    expect(billSub(bill({}))).toBe("DAS202610-29004");
  });
  it("billState > given a refunded bill > then คืนเงินแล้ว, otherwise nothing", () => {
    expect(billState(bill({ saleStatus: "refunded" }))).toEqual({
      th: "คืนเงินแล้ว",
      en: "Refunded",
    });
    expect(billState(bill({}))).toBeNull();
  });
  it("searchBills > given a plate, a bill number or an amount > then the bills that match", () => {
    const rows = [
      bill({ id: "a" }),
      bill({
        id: "b",
        licensePlate: "2ขข 5678",
        saleNumber: "DAS202610-29001",
        grandTotalSatang: 89000,
      }),
    ];
    expect(searchBills(rows, "1กก").map((b) => b.id)).toEqual(["a"]);
    expect(searchBills(rows, "29001").map((b) => b.id)).toEqual(["b"]);
    expect(searchBills(rows, "890").map((b) => b.id)).toEqual(["b"]);
    expect(searchBills(rows, "กรุงเทพ").map((b) => b.id)).toEqual(["a", "b"]);
    expect(searchBills(rows, "Vigo")).toEqual([]);
  });
});

describe("AirPlus orders", () => {
  it("financeOrders > then only orders where money moved, inside the period", () => {
    const rows = financeOrders(
      [
        order({ id: "done" }),
        order({ id: "refunded", orderStatus: "claimed", paymentStatus: "refunded" }),
        order({ id: "shipping", orderStatus: "shipped" }),
        order({ id: "unpaid", orderStatus: "new", paymentStatus: "pending" }),
        order({ id: "shopee", channel: "shopee" }),
        order({ id: "old", orderCreatedAt: at(2026, 9, 1) }),
      ],
      { from: at(2026, 10, 1, 0), to: NOW + 1 },
    );
    expect(rows.map((o) => o.id)).toEqual(["done", "refunded"]);
  });
  it("orderTotals > then the order's own sales and profit", () => {
    expect(orderTotals([order({}), order({ salesSatang: 197000, profitSatang: 56000 })])).toEqual({
      count: 2,
      revenueSatang: 550000,
      profitSatang: 158000,
    });
  });
  it("orderState > given a refund or a claim > then its words once; a done order says nothing", () => {
    expect(orderState(order({ orderStatus: "claimed", paymentStatus: "refunded" }))).toEqual({
      th: "คืนเงินแล้ว",
      en: "Refunded",
    });
    expect(orderState(order({ orderStatus: "claimed", paymentStatus: "paid" }))?.th).toBe("เคลม");
    expect(orderState(order({}))).toBeNull();
  });
  it("orderSub > then the order number only, no time", () => {
    expect(orderSub(order({}))).toBe("AP-2006");
  });
});

describe("expenses", () => {
  it("expensesIn > given a shop and a period > then that shop's, newest first", () => {
    const rows = expensesIn(
      [
        expense({ id: "line", occurredAt: at(2026, 10, 1) }),
        expense({ id: "power", channel: "onsite", occurredAt: at(2026, 10, 5) }),
        expense({ id: "ads", occurredAt: at(2026, 10, 12) }),
        expense({ id: "old", occurredAt: at(2026, 9, 12) }),
      ],
      "airplus",
      { from: at(2026, 10, 1, 0), to: NOW + 1 },
    );
    expect(rows.map((e) => e.id)).toEqual(["ads", "line"]);
  });
  it("expenseSub > then the shop and the day", () => {
    expect(expenseSub(expense({}), NOW)).toEqual({ th: "AirPlus · 1 ต.ค.", en: "AirPlus · 1 Oct" });
    expect(expenseSub(expense({ channel: "onsite", occurredAt: at(2025, 12, 30) }), NOW).th).toBe(
      "Den Air Service · 30 ธ.ค. 2568",
    );
  });
  it("expenseProblems > given empty boxes > then only those boxes are named", () => {
    expect(
      expenseProblems({ name: " ", amount: "", channel: "onsite", day: NOW, note: "" }),
    ).toEqual({
      name: { th: "ยังไม่ได้ใส่รายการ", en: "Add what it was for" },
      amount: { th: "ยังไม่ได้ใส่จำนวนเงิน", en: "Add the amount" },
    });
    expect(
      expenseProblems({
        name: "ค่าไฟร้าน",
        amount: "3,850",
        channel: "onsite",
        day: NOW,
        note: "",
      }),
    ).toEqual({});
  });
  it("expenseBody > then what the server takes, in satang, note left out when empty", () => {
    expect(
      expenseBody({
        name: " ค่าไฟร้าน ",
        amount: "3,850.50",
        channel: "onsite",
        day: NOW,
        note: "",
      }),
    ).toEqual({
      channel: "onsite",
      conversion: "ค่าไฟร้าน",
      amountSatang: 385050,
      occurredAt: NOW,
    });
  });
});

describe("dayHeading", () => {
  it("given today, yesterday, another day > then the drawn words", () => {
    expect(dayHeading(at(2026, 10, 29, 0), NOW).th).toBe("วันนี้ · 29 ต.ค.");
    expect(dayHeading(at(2026, 10, 28, 0), NOW).th).toBe("เมื่อวาน · 28 ต.ค.");
    expect(dayHeading(at(2026, 10, 20, 0), NOW).th).toBe("20 ต.ค.");
  });
});

describe("a shop's list: money in and money out together", () => {
  const power = expense({
    id: "power",
    channel: "onsite",
    conversion: "ค่าไฟร้าน",
    amountSatang: 385000,
    occurredAt: at(2026, 10, 28, 0),
  });
  it("billRows > given bills and the shop's expenses > then newest first, an expense after its day's bills", () => {
    const rows = billRows(
      [bill({ id: "today" }), bill({ id: "yesterday", createdAt: at(2026, 10, 28, 9) })],
      [power],
      "",
    );
    expect(
      rows.map((r) => (r.kind === "expense" ? r.expense.id : r.kind === "bill" ? r.bill.id : "")),
    ).toEqual(["today", "yesterday", "power"]);
  });
  it("billRows > given a search > then the expenses that match too", () => {
    const rows = billRows([bill({ id: "a" })], [power], "ค่าไฟ");
    expect(rows.map((r) => r.kind)).toEqual(["expense"]);
    expect(billRows([bill({ id: "a" })], [power], "3850").map((r) => r.kind)).toEqual(["expense"]);
  });
  it("orderRows > given orders and the shop's expenses > then both, newest first", () => {
    const ads = expense({
      id: "ads",
      conversion: "ค่าโฆษณา Facebook",
      occurredAt: at(2026, 10, 28, 0),
    });
    const rows = orderRows([order({ id: "o1" })], [ads], "");
    expect(rows.map((r) => r.kind)).toEqual(["order", "expense"]);
    expect(orderRows([order({ id: "o1" })], [ads], "facebook").map((r) => r.kind)).toEqual([
      "expense",
    ]);
  });
});

describe("ledgerLine: a shop's list row on the computer (DeskFinance, 5 Nov 2026)", () => {
  it("ledgerLine > given a bill > then plate, bill number, total and profit", () => {
    expect(ledgerLine({ kind: "bill", at: 0, bill: bill({}) })).toEqual({
      title: { th: "1กก 1234 กรุงเทพมหานคร", en: "1กก 1234 กรุงเทพมหานคร" },
      sub: { th: "DAS202610-29004", en: "DAS202610-29004" },
      amount: "฿4,060",
      profit: "฿1,320",
      state: null,
    });
  });
  it("ledgerLine > given a refunded bill > then its state instead of the profit", () => {
    const line = ledgerLine({ kind: "bill", at: 0, bill: bill({ saleStatus: "refunded" }) });
    expect(line.profit).toBeNull();
    expect(line.state).toEqual({ th: "คืนเงินแล้ว", en: "Refunded" });
  });
  it("ledgerLine > given an order > then buyer, order number, sales and profit", () => {
    expect(ledgerLine({ kind: "order", at: 0, order: order({}) })).toEqual({
      title: { th: "คุณมานพ", en: "คุณมานพ" },
      sub: { th: "AP-2006", en: "AP-2006" },
      amount: "฿3,530",
      profit: "฿1,020",
      state: null,
    });
  });
  it("ledgerLine > given an order with no buyer or sales > then its number and its total", () => {
    const line = ledgerLine({
      kind: "order",
      at: 0,
      order: order({ buyerUsername: null, salesSatang: null, profitSatang: null }),
    });
    expect(line.title.th).toBe("AP-2006");
    expect(line.amount).toBe("฿3,530");
    expect(line.profit).toBe("฿0");
  });
  it("ledgerLine > given an expense > then its name, ค่าใช้จ่าย, the amount out and no profit", () => {
    expect(ledgerLine({ kind: "expense", at: 0, expense: expense({}) })).toEqual({
      title: { th: "แพ็กเกจ LINE OA รายเดือน", en: "แพ็กเกจ LINE OA รายเดือน" },
      sub: { th: "ค่าใช้จ่าย", en: "Expense" },
      amount: "−฿1,200",
      profit: null,
      state: null,
    });
  });
});
