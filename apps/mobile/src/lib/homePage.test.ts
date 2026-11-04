import { describe, expect, it } from "vitest";
import {
  HOME_TILES,
  doneLine,
  homeCounts,
  ordersTabRoute,
  readTicked,
  shopeeChange,
  showsInsightButton,
  stillTicked,
  todayLine,
} from "./homePage";
import type { OrderListRow } from "./orderList";

const NOW = new Date(2026, 10, 4, 9, 30).getTime();

const order = (id: string, orderStatus: string, paymentStatus: string, at = NOW): OrderListRow => ({
  id,
  channel: "airplus",
  externalOrderId: id,
  orderStatus,
  paymentStatus,
  grandTotalSatang: 100_00,
  orderCreatedAt: at,
  importedAt: at,
});

describe("HOME_TILES", () => {
  it("given the drawing (canvas v331) > then four tiles in the Orders tabs' own words", () => {
    expect(HOME_TILES.map((t) => t.label.th)).toEqual([
      "รอดำเนินการ",
      "เตรียมส่ง",
      "กำลังส่ง",
      "คืนเงิน",
    ]);
    expect(HOME_TILES.map((t) => t.tab)).toEqual(["pending", "toship", "shipped", "refundclaim"]);
  });
});

describe("homeCounts", () => {
  it("given orders from any date > then each tile counts its whole Orders tab", () => {
    const longAgo = new Date(2025, 0, 2).getTime();
    const rows = [
      order("a", "placed", "paid"),
      order("b", "placed", "paid", longAgo),
      order("c", "shipped", "paid"),
      order("d", "placed", "unpaid"),
    ];

    const counts = homeCounts(rows, NOW);

    expect(counts.toship).toBe(2);
    expect(counts.shipped).toBe(1);
    expect(counts.pending).toBe(0);
    expect(counts.refundclaim).toBe(0);
  });
});

describe("shopeeChange", () => {
  it("given stock went down since the last Shopee update > then ลดใน Shopee and how many", () => {
    expect(shopeeChange(-2)).toEqual({ th: "ลดใน Shopee 2", en: "Lower on Shopee by 2" });
  });

  it("given stock went up > then เพิ่มใน Shopee and how many", () => {
    expect(shopeeChange(5)).toEqual({ th: "เพิ่มใน Shopee 5", en: "Raise on Shopee by 5" });
  });
});

describe("doneLine", () => {
  it("given 1 of 2 ticked > then ทำแล้ว 1 จาก 2", () => {
    expect(doneLine(1, 2)).toEqual({ th: "ทำแล้ว 1 จาก 2", en: "1 of 2 done" });
  });
});

describe("todayLine", () => {
  it("given Wednesday 4 Nov 2026 > then พุธ 4 พฤศจิกายน, no year", () => {
    expect(todayLine(NOW)).toEqual({ th: "พุธ 4 พฤศจิกายน", en: "Wednesday 4 November" });
  });

  it("given a Sunday in January > then the full day and month names", () => {
    expect(todayLine(new Date(2027, 0, 3).getTime())).toEqual({
      th: "อาทิตย์ 3 มกราคม",
      en: "Sunday 3 January",
    });
  });
});

describe("ordersTabRoute", () => {
  it("given a tile's tab > then the Orders page opened on that tab", () => {
    expect(ordersTabRoute("pending")).toBe("/orders?tab=pending");
  });
});

describe("stillTicked", () => {
  it("given a ticked product that left the list > then its tick goes too", () => {
    expect(stillTicked(["p1", "gone"], [{ productId: "p1" }, { productId: "p2" }])).toEqual(["p1"]);
  });
});

describe("readTicked", () => {
  it("given saved ticks > then the product ids", () => {
    expect(readTicked('["p1","p2"]')).toEqual(["p1", "p2"]);
  });

  it("given nothing saved or something broken > then no ticks", () => {
    expect(readTicked(null)).toEqual([]);
    expect(readTicked("{oops")).toEqual([]);
    expect(readTicked('[1,"p1"]')).toEqual(["p1"]);
  });
});

describe("showsInsightButton", () => {
  it("given the owner > then ดูภาพรวม AirPlus shows", () => {
    expect(showsInsightButton("super_admin")).toBe(true);
  });

  it("given an admin or a ช่าง (no ภาพรวม AirPlus in their menu) > then it doesn't", () => {
    expect(showsInsightButton("admin")).toBe(false);
    expect(showsInsightButton("mechanic")).toBe(false);
  });
});
