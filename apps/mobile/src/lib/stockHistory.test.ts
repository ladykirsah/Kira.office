import { describe, expect, it } from "vitest";
import {
  changeText,
  leftText,
  movementSections,
  movementSubtitle,
  noMatchDetail,
  periodLabel,
  periodOf,
  whenText,
  movementLabel,
  shownMovements,
  type Movement,
} from "./stockHistory";

const row = (over: Partial<Movement>): Movement => ({
  id: "m",
  variantId: "v",
  sku: null,
  productName: "คอมเพรสเซอร์ DENSO 10S11C",
  productRef: "DN-447220",
  imageKey: null,
  movementType: "onsite_sale",
  quantityDelta: -1,
  quantityAfter: 4,
  salePriceSatang: null,
  createdAt: 0,
  ...over,
});

describe("movementLabel", () => {
  it.each([
    ["onsite_sale", "ขายเด่นแอร์"],
    ["online_sale", "ขายออนไลน์"],
    ["hold", "ไปงานนอก"],
    ["unhold", "กลับจากงานนอก"],
    ["receive", "เติมสต็อก"],
    ["purchase_receipt", "เติมสต็อก"],
    ["manual_adjustment", "ปรับสต็อก"],
    ["correction", "ปรับสต็อก"],
    ["write_off", "ปรับสต็อก"],
    ["damaged_lost", "ปรับสต็อก"],
    ["reconciliation", "ปรับสต็อก"],
    ["transfer", "ปรับสต็อก"],
    ["refund_return", "คืนของ"],
    ["opening_balance", "ยอดยกมา"],
  ])("given %s > then the row says %s (no นับใหม่ or ของเสีย, owner 1 Nov)", (type, th) => {
    expect(movementLabel(type).th).toBe(th);
  });
});

describe("shownMovements", () => {
  const rows = [
    row({ id: "sale", movementType: "onsite_sale" }),
    row({ id: "online", movementType: "online_sale", productName: "วาล์วแอร์ DENSO Vigo" }),
    row({ id: "refill", movementType: "receive", productName: "แผงร้อน Honda City 2014" }),
    row({ id: "fix", movementType: "write_off" }),
    row({ id: "back", movementType: "refund_return", productRef: "DN-447500", sku: "SKU-9" }),
    row({ id: "job", movementType: "hold" }),
    row({ id: "jobBack", movementType: "unhold" }),
    row({ id: "start", movementType: "opening_balance" }),
  ];
  const ids = (kind: Parameters<typeof shownMovements>[1]["kind"], q = "") =>
    shownMovements(rows, { kind, q }).map((m) => m.id);

  it("given a type button > then only its changes, in the order they came", () => {
    expect(ids("all")).toEqual(rows.map((r) => r.id));
    expect(ids("refill")).toEqual(["refill"]);
    expect(ids("sale")).toEqual(["sale", "online"]);
    expect(ids("adjust")).toEqual(["fix"]);
    expect(ids("return")).toEqual(["back"]);
    expect(ids("job")).toEqual(["job", "jobBack"]);
    expect(ids("opening")).toEqual(["start"]);
  });

  it("given words > then every change whose name or code holds them, any case", () => {
    expect(ids("all", " vigo ")).toEqual(["online"]);
    expect(ids("all", "dn-447500")).toEqual(["back"]);
    expect(ids("all", "sku-9")).toEqual(["back"]);
    expect(ids("sale", "honda")).toEqual([]);
  });
});

describe("changeText", () => {
  it("given a change > then the badge's sign and number", () => {
    expect([changeText(-1), changeText(6), changeText(0)]).toEqual(["−1", "+6", "0"]);
  });
});

describe("leftText", () => {
  it("given what is left after a change > then เหลือ and the number", () => {
    expect(leftText(12)).toEqual({ th: "เหลือ 12", en: "12 left" });
    expect(leftText(0)).toEqual({ th: "เหลือ 0", en: "0 left" });
  });
});

describe("movementSubtitle", () => {
  it("given the whole list at its limit > then it says these are the latest", () => {
    expect(movementSubtitle({ shown: 100, total: 100, limit: 100 }).th).toBe("100 รายการล่าสุด");
  });

  it("given fewer than the limit, or a narrowed list > then just how many", () => {
    expect(movementSubtitle({ shown: 37, total: 37, limit: 100 }).th).toBe("37 รายการ");
    expect(movementSubtitle({ shown: 3, total: 100, limit: 100 }).th).toBe("3 รายการ");
    expect(movementSubtitle({ shown: 0, total: 100, limit: 100 }).th).toBe("0 รายการ");
  });
});

// 1 Nov 2026, 15:00 local time.
const NOW = new Date(2026, 10, 1, 15, 0).getTime();
const at = (month: number, day: number, hour = 10) => new Date(2026, month, day, hour).getTime();

describe("movementSections", () => {
  it("given changes over three days > then one group per day, titled as Orders titles days", () => {
    const rows = [
      row({ id: "a", createdAt: at(10, 1, 14) }),
      row({ id: "b", createdAt: at(10, 1, 9) }),
      row({ id: "c", createdAt: at(9, 31) }),
      row({ id: "d", createdAt: at(9, 27) }),
    ];
    expect(movementSections(rows, NOW).map((s) => [s.title.th, s.rows.map((r) => r.id)])).toEqual([
      ["วันนี้", ["a", "b"]],
      ["เมื่อวาน", ["c"]],
      ["27 ต.ค.", ["d"]],
    ]);
  });
});

describe("whenText", () => {
  it("given a day > then the date only, no clock time (owner, 1 Nov)", () => {
    expect(whenText(at(10, 1), NOW).th).toBe("วันนี้");
    expect(whenText(at(9, 31), NOW).th).toBe("เมื่อวาน");
    expect(whenText(at(9, 27), NOW).th).toBe("27 ต.ค.");
  });

  it("given a day in another year > then its Thai year too", () => {
    expect(whenText(new Date(2025, 9, 27).getTime(), NOW).th).toBe("27 ต.ค. 2568");
  });
});

describe("noMatchDetail", () => {
  it("given a type and words that match nothing > then both, and that only the latest were looked at", () => {
    expect(noMatchDetail({ th: "คืนของ", en: "Returns" }, " honda ", 100).th).toBe(
      "ไม่มีรายการ “คืนของ” ของ “honda”\nใน 100 รายการล่าสุด",
    );
  });

  it("given only words, over a whole list > then just the words", () => {
    expect(noMatchDetail(null, "honda", null).th).toBe("ไม่มีรายการของ “honda”");
  });
});

describe("periodOf", () => {
  it("given ทุกวัน > then no dates (the server sends the latest)", () => {
    expect(periodOf("all", null, NOW)).toBeNull();
  });

  it("given วันนี้ > then from midnight to now", () => {
    expect(periodOf("today", null, NOW)).toEqual({ start: at(10, 1, 0), end: NOW });
  });

  it("given two picked days > then from the first one's start to the last one's end", () => {
    const period = periodOf("custom", { from: at(9, 31), to: at(9, 27) }, NOW);
    expect(period).toEqual({ start: at(9, 27, 0), end: at(10, 1, 0) - 1 });
  });

  it("given กำหนดเอง… with no days picked yet > then no dates", () => {
    expect(periodOf("custom", null, NOW)).toBeNull();
  });
});

describe("periodLabel", () => {
  it("given a preset or two picked days > then the date button's words", () => {
    expect(periodLabel("all", null).th).toBe("ทุกวัน");
    expect(periodLabel("today", null).th).toBe("วันนี้");
    expect(periodLabel("custom", { from: at(9, 27), to: at(9, 31) }).th).toBe("27–31 ต.ค.");
  });
});
