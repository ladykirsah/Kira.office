import { describe, expect, it } from "vitest";
import {
  dayField,
  daySections,
  nextStep,
  parseDayField,
  rangeLabel,
  searchOrders,
  stamp,
  DEFAULT_VIEW,
  listSections,
  tabCounts,
  viewOrders,
  type OrderListRow,
  type OrderView,
} from "./orderList";

const NOW = new Date(2026, 9, 27, 15, 0).getTime(); // 27 Oct 2026, 15:00 local
const at = (day: number, hour = 10, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();

function order(over: Partial<OrderListRow> & { id: string }): OrderListRow {
  return {
    channel: "airplus",
    externalOrderId: `AP-${over.id}`,
    orderStatus: "new",
    paymentStatus: "pending",
    grandTotalSatang: 100_00,
    orderCreatedAt: at(27),
    importedAt: at(27),
    buyerUsername: "สมชาย",
    firstItemImageKey: null,
    ...over,
  };
}

const ALL: OrderView = { tab: "all", date: "all", custom: null, pay: "all", sort: "newest" };

describe("viewOrders", () => {
  it("given the default view of today > then only today's AirPlus orders show, newest first", () => {
    const rows = [
      order({ id: "old", orderCreatedAt: at(26, 18) }),
      order({ id: "early", orderCreatedAt: at(27, 9) }),
      order({ id: "late", orderCreatedAt: at(27, 14) }),
      order({ id: "shopee", channel: "shopee", orderCreatedAt: at(27, 12) }),
    ];

    const ids = viewOrders(rows, { ...ALL, date: "today" }, NOW).map((o) => o.id);

    expect(ids).toEqual(["late", "early"]);
  });

  it("given an order with no placed time > then its import time places it", () => {
    const rows = [order({ id: "x", orderCreatedAt: null, importedAt: at(23) })];

    expect(viewOrders(rows, { ...ALL, date: "7d" }, NOW)).toHaveLength(1);
    expect(viewOrders(rows, { ...ALL, date: "today" }, NOW)).toHaveLength(0);
  });

  it("given last month > then it covers the calendar month before this one", () => {
    const rows = [
      order({ id: "sep", orderCreatedAt: new Date(2026, 8, 15).getTime() }),
      order({ id: "oct", orderCreatedAt: at(2) }),
      order({ id: "aug", orderCreatedAt: new Date(2026, 7, 31).getTime() }),
    ];

    expect(viewOrders(rows, { ...ALL, date: "lastmonth" }, NOW).map((o) => o.id)).toEqual(["sep"]);
    expect(viewOrders(rows, { ...ALL, date: "month" }, NOW).map((o) => o.id)).toEqual(["oct"]);
  });

  it("given a status tab > then only orders whose status sits in that tab show", () => {
    const rows = [
      order({ id: "slip", paymentStatus: "verifying" }),
      order({ id: "cod", paymentStatus: "cod" }),
      order({ id: "paid", paymentStatus: "paid" }),
    ];

    expect(viewOrders(rows, { ...ALL, tab: "pending" }, NOW).map((o) => o.id)).toEqual([
      "slip",
      "cod",
    ]);
  });

  it("given a payment filter > then it matches the raw payment state", () => {
    const rows = [
      order({ id: "a", paymentStatus: "cod_confirmed" }),
      order({ id: "b", paymentStatus: "paid" }),
    ];

    expect(viewOrders(rows, { ...ALL, pay: "cod_confirmed" }, NOW).map((o) => o.id)).toEqual(["a"]);
  });

  it("given sort by payment > then orders follow the payment menu's order, not the alphabet", () => {
    const rows = [
      order({ id: "c", paymentStatus: "cod", orderCreatedAt: at(27, 14) }),
      order({ id: "p", paymentStatus: "pending", orderCreatedAt: at(27, 9) }),
    ];

    expect(viewOrders(rows, { ...ALL, sort: "payment" }, NOW).map((o) => o.id)).toEqual(["p", "c"]);
  });

  it("given the list opens > then it shows every date, so last week's open jobs are not hidden", () => {
    const rows = [order({ id: "old", orderCreatedAt: at(1) }), order({ id: "new" })];

    expect(viewOrders(rows, DEFAULT_VIEW, NOW).map((o) => o.id)).toEqual(["new", "old"]);
  });

  it("given sort oldest first > then the order placed longest ago comes first", () => {
    const rows = [
      order({ id: "new", orderCreatedAt: at(27, 14) }),
      order({ id: "old", orderCreatedAt: at(20) }),
    ];

    expect(viewOrders(rows, { ...ALL, sort: "oldest" }, NOW).map((o) => o.id)).toEqual([
      "old",
      "new",
    ]);
  });

  it("given sort by status > then orders follow the tabs' order, newest first inside each", () => {
    const rows = [
      order({
        id: "shipped",
        orderStatus: "shipped",
        paymentStatus: "paid",
        orderCreatedAt: at(27, 14),
      }),
      order({ id: "unpaid", paymentStatus: "pending", orderCreatedAt: at(20) }),
      order({ id: "slip-old", paymentStatus: "verifying", orderCreatedAt: at(21) }),
      order({ id: "slip-new", paymentStatus: "verifying", orderCreatedAt: at(26) }),
    ];

    expect(viewOrders(rows, { ...ALL, sort: "status" }, NOW).map((o) => o.id)).toEqual([
      "unpaid",
      "slip-new",
      "slip-old",
      "shipped",
    ]);
  });

  it("given a custom range > then only orders placed on those days show, both days included", () => {
    const rows = [
      order({ id: "before", orderCreatedAt: at(19, 23, 59) }),
      order({ id: "first", orderCreatedAt: at(20, 0, 0) }),
      order({ id: "last", orderCreatedAt: at(22, 23, 59) }),
      order({ id: "after", orderCreatedAt: at(23, 0, 0) }),
    ];
    const custom = { from: at(20, 12), to: at(22, 8) };

    expect(viewOrders(rows, { ...ALL, date: "custom", custom }, NOW).map((o) => o.id)).toEqual([
      "last",
      "first",
    ]);
  });

  it("given a custom range picked backwards > then it still covers the days between", () => {
    const rows = [order({ id: "mid", orderCreatedAt: at(21) })];
    const custom = { from: at(22), to: at(20) };

    expect(viewOrders(rows, { ...ALL, date: "custom", custom }, NOW)).toHaveLength(1);
  });
});

describe("tabCounts", () => {
  it("given a date range > then each status tab counts within it, and all counts everything in it", () => {
    const rows = [
      order({ id: "1", paymentStatus: "verifying" }),
      order({ id: "2", paymentStatus: "paid" }),
      order({ id: "3", paymentStatus: "paid", orderCreatedAt: at(1) }),
    ];

    const counts = tabCounts(rows, { ...ALL, date: "today" }, NOW);

    expect(counts.all).toBe(2);
    expect(counts.pending).toBe(1);
    expect(counts.toship).toBe(1);
    expect(counts.completed).toBe(0);
  });

  it("given a payment filter > then the tabs count only orders with that payment state", () => {
    const rows = [
      order({ id: "1", paymentStatus: "cod" }),
      order({ id: "2", paymentStatus: "verifying" }),
      order({ id: "3", paymentStatus: "paid" }),
    ];

    const counts = tabCounts(rows, { ...ALL, pay: "cod" }, NOW);

    expect(counts.all).toBe(1);
    expect(counts.pending).toBe(1);
    expect(counts.toship).toBe(0);
  });
});

describe("listSections", () => {
  const rows = [
    order({ id: "ship", paymentStatus: "paid", orderCreatedAt: at(27, 14) }),
    order({ id: "slip", paymentStatus: "verifying", orderCreatedAt: at(26, 9) }),
    order({ id: "cod", paymentStatus: "cod", orderCreatedAt: at(26, 8) }),
  ];

  it("given newest first > then rows group by day", () => {
    expect(listSections(rows, "newest", NOW).map((s) => s.title.th)).toEqual([
      "วันนี้",
      "เมื่อวาน",
    ]);
  });

  it("given sort by status > then rows group under their tab's name", () => {
    const sorted = viewOrders(rows, { ...ALL, sort: "status" }, NOW);
    const sections = listSections(sorted, "status", NOW);

    expect(sections.map((s) => s.title.th)).toEqual(["รอดำเนินการ", "เตรียมส่ง"]);
    expect(sections[0]?.rows.map((o) => o.id)).toEqual(["slip", "cod"]);
  });

  it("given sort by payment > then rows group under the payment state's name", () => {
    const sorted = viewOrders(rows, { ...ALL, sort: "payment" }, NOW);
    const sections = listSections(sorted, "payment", NOW);

    expect(sections.map((s) => s.title.th)).toEqual(["รอตรวจสลิป", "ชำระแล้ว", "เก็บเงินปลายทาง"]);
  });
});

describe("searchOrders", () => {
  it("given part of a name or order number > then it searches every date, newest first", () => {
    const rows = [
      order({ id: "1", buyerUsername: "สมชาย ใจดี", orderCreatedAt: at(1) }),
      order({ id: "2", buyerUsername: "มานี", externalOrderId: "AP-1045" }),
      order({ id: "3", buyerUsername: "สมชาย พรมมา", orderCreatedAt: at(20) }),
    ];

    expect(searchOrders(rows, "  สมชาย ").map((o) => o.id)).toEqual(["3", "1"]);
    expect(searchOrders(rows, "ap-1045").map((o) => o.id)).toEqual(["2"]);
  });

  it("given an empty query > then nothing is found", () => {
    expect(searchOrders([order({ id: "1" })], "  ")).toEqual([]);
  });

  it("given a name one letter off > then nothing is found (owner's rule: match = result)", () => {
    const rows = [order({ id: "1", buyerUsername: "สมชาย ใจดี" })];

    expect(searchOrders(rows, "สมชาญ")).toEqual([]);
  });
});

describe("nextStep", () => {
  it("given an order waiting on the shop > then the line names the job, marked as waiting", () => {
    expect(nextStep("new", "verifying")).toEqual({
      text: { th: "ตรวจการชำระเงิน", en: "Review payment" },
      waiting: true,
      icon: "slip",
      tone: "waiting",
    });
    expect(nextStep("new", "paid").text.th).toBe("บันทึกการส่งของ");
    expect(nextStep("delivery_failed", "paid").tone).toBe("danger");
  });

  it("given an order nobody needs to act on > then the line is its plain status", () => {
    expect(nextStep("shipped", "paid")).toEqual({
      text: { th: "กำลังจัดส่ง", en: "In transit" },
      waiting: false,
      icon: null,
      tone: "muted",
    });
  });

  it("given a status the app cannot read > then it says so instead of guessing", () => {
    expect(nextStep("ใหม่", null).text.th).toBe("สถานะไม่ทราบ");
  });
});

describe("daySections", () => {
  it("given orders over several days > then they group under today, yesterday, then a date", () => {
    const rows = [
      order({ id: "a", orderCreatedAt: at(27, 14) }),
      order({ id: "b", orderCreatedAt: at(26, 18) }),
      order({ id: "c", orderCreatedAt: at(24, 10) }),
      order({ id: "d", orderCreatedAt: at(24, 9) }),
    ];

    const sections = daySections(rows, NOW);

    expect(sections.map((s) => s.title.th)).toEqual(["วันนี้", "เมื่อวาน", "24 ต.ค."]);
    expect(sections[2]?.rows.map((o) => o.id)).toEqual(["c", "d"]);
  });
});

describe("stamp", () => {
  it("given a moment > then it reads as the web's day/month/year · time", () => {
    expect(stamp(new Date(2026, 9, 7, 9, 5).getTime())).toBe("07/10/26 · 09:05");
  });
});

describe("rangeLabel", () => {
  it("given two days in one month > then it reads as a short span", () => {
    expect(rangeLabel({ from: at(20), to: at(22) }).th).toBe("20–22 ต.ค.");
  });

  it("given days in two months, picked backwards > then both months show, earliest first", () => {
    const sep28 = new Date(2026, 8, 28).getTime();

    expect(rangeLabel({ from: at(3), to: sep28 }).th).toBe("28 ก.ย. – 3 ต.ค.");
  });

  it("given one day > then it reads as that day", () => {
    expect(rangeLabel({ from: at(20, 9), to: at(20, 18) }).en).toBe("20 Oct");
  });
});

describe("dayField / parseDayField", () => {
  it("given a day > then the date box reads it as year-month-day and back to that day", () => {
    expect(dayField(at(5, 15))).toBe("2026-10-05");
    expect(parseDayField("2026-10-05")).toBe(new Date(2026, 9, 5).getTime());
  });

  it("given text that is not a real day > then it is not read as one", () => {
    expect(parseDayField("")).toBeNull();
    expect(parseDayField("2026-02-30")).toBeNull();
    expect(parseDayField("5/10/2026")).toBeNull();
  });
});
