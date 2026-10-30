import { describe, expect, it } from "vitest";
import {
  accountName,
  itemsPreview,
  joinPhones,
  lineSub,
  longDate,
  monthBars,
  openQuote,
  payWord,
  phonesOf,
  plateLine,
  rowDate,
  shortOrderStatus,
  splitCar,
  visitCards,
} from "./customerPage";

const NOW = new Date(2026, 9, 30, 12, 0).getTime(); // 30 Oct 2026
const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 10, 0).getTime();

describe("plateLine", () => {
  it("given a province > then it rides after the plate", () => {
    expect(plateLine(" 1กก 1234 ", "กรุงเทพมหานคร")).toBe("1กก 1234 กรุงเทพมหานคร");
  });
  it("given no province > then the plate alone", () => {
    expect(plateLine("1กก 1234", null)).toBe("1กก 1234");
    expect(plateLine("1กก 1234", "  ")).toBe("1กก 1234");
  });
});

describe("splitCar", () => {
  const brands = ["Toyota", "Mitsubishi", "Isuzu", "MG"];
  it("given a known brand at the start > then brand and the rest", () => {
    expect(splitCar("Toyota Vigo 2014", brands)).toEqual({ brand: "Toyota", model: "Vigo 2014" });
  });
  it("given different letter case > then the list's spelling wins", () => {
    expect(splitCar("toyota vigo", brands)).toEqual({ brand: "Toyota", model: "vigo" });
  });
  it("given a brand that is only the start of a word > then no brand", () => {
    expect(splitCar("MGX 2020", brands)).toEqual({ brand: null, model: "MGX 2020" });
  });
  it("given no known brand or no text > then the text stays whole", () => {
    expect(splitCar("Ranger 2021", brands)).toEqual({ brand: null, model: "Ranger 2021" });
    expect(splitCar(null, brands)).toEqual({ brand: null, model: "" });
  });
});

describe("rowDate", () => {
  it("given this year > then day and month", () => {
    expect(rowDate(day(2026, 10, 30), NOW)).toEqual({ th: "30 ต.ค.", en: "30 Oct" });
  });
  it("given an earlier year > then the short Thai year too", () => {
    expect(rowDate(day(2025, 3, 31), NOW)).toEqual({ th: "31 มี.ค. 68", en: "31 Mar 2025" });
  });
  it("given no visit yet > then a dash", () => {
    expect(rowDate(null, NOW)).toEqual({ th: "—", en: "—" });
  });
});

describe("longDate", () => {
  it("given a day > then the full Thai year", () => {
    expect(longDate(day(2026, 8, 12))).toEqual({ th: "12 ส.ค. 2569", en: "12 Aug 2026" });
  });
});

describe("itemsPreview", () => {
  it("given up to 3 items > then all of them", () => {
    expect(itemsPreview(["a", "b", "c"])).toEqual({ shown: ["a", "b", "c"], more: 0 });
  });
  it("given 5 items > then 3 and how many more", () => {
    expect(itemsPreview(["a", "b", "c", "d", "e"])).toEqual({ shown: ["a", "b", "c"], more: 2 });
  });
});

describe("phonesOf / joinPhones", () => {
  it("given the shared phone field > then each number once", () => {
    expect(phonesOf("081-234-5678, 089-555-0142,  ")).toEqual(["081-234-5678", "089-555-0142"]);
    expect(phonesOf(null)).toEqual([]);
  });
  it("given typed phones > then blanks and repeats dropped, joined like ทำบิล", () => {
    expect(joinPhones([" 081 ", "", "089", "081"])).toBe("081, 089");
    expect(joinPhones(["", " "])).toBeNull();
  });
});

describe("lineSub", () => {
  it("given a service > then บริการ, price and quantity", () => {
    expect(
      lineSub({ lineType: "service", brandName: null, unitPriceSatang: 1200_00, quantity: 1 }),
    ).toEqual({ th: "บริการ · ฿1,200 × 1", en: "Service · ฿1,200 × 1" });
  });
  it("given a part with a brand > then the brand first", () => {
    expect(
      lineSub({ lineType: "part", brandName: "Suva", unitPriceSatang: 195_00, quantity: 2 }),
    ).toEqual({ th: "Suva · ฿195 × 2", en: "Suva · ฿195 × 2" });
  });
  it("given a part with no brand > then price and quantity only", () => {
    expect(
      lineSub({ lineType: "part", brandName: null, unitPriceSatang: 50_00, quantity: 3 }),
    ).toEqual({ th: "฿50 × 3", en: "฿50 × 3" });
  });
});

describe("payWord", () => {
  it("given the bill's way of paying > then plain words", () => {
    expect(payWord("promptpay")).toEqual({ th: "โอนพร้อมเพย์", en: "PromptPay transfer" });
    expect(payWord("cash")).toEqual({ th: "เงินสด", en: "Cash" });
    expect(payWord(null)).toBeNull();
  });
});

describe("visitCards", () => {
  it("given bills and old visits > then one card per visit, newest first", () => {
    const cards = visitCards(
      [
        {
          id: "b1",
          saleNumber: "DAS202608-12003",
          createdAt: day(2026, 8, 12),
          lines: [{ description: "ล้างแอร์ทั้งระบบ" }, { description: "น้ำยาแอร์ R134a" }],
        },
      ],
      [
        {
          id: "h1",
          happenedAt: day(2025, 3, 31),
          lines: [{ description: "ตู้แอร์ · DENSO" }, { description: "  " }],
        },
      ],
    );
    expect(cards).toEqual([
      {
        key: "b1",
        at: day(2026, 8, 12),
        number: "DAS202608-12003",
        billId: "b1",
        items: ["ล้างแอร์ทั้งระบบ", "น้ำยาแอร์ R134a"],
      },
      { key: "h1", at: day(2025, 3, 31), number: null, billId: null, items: ["ตู้แอร์ · DENSO"] },
    ]);
  });
});

describe("openQuote", () => {
  it("given quotations > then the newest, its first item and how many more", () => {
    const q = openQuote([
      {
        id: "q2",
        saleNumber: "QT202610-27001",
        createdAt: day(2026, 10, 27),
        grandTotalSatang: 6850_00,
        lines: [
          { description: "ล้างแอร์ทั้งระบบ" },
          { description: "a" },
          { description: "b" },
          { description: "c" },
        ],
      },
    ]);
    expect(q).toEqual({
      id: "q2",
      number: "QT202610-27001",
      at: day(2026, 10, 27),
      totalSatang: 6850_00,
      first: "ล้างแอร์ทั้งระบบ",
      more: 3,
    });
    expect(openQuote([])).toBeNull();
  });
});

describe("monthBars", () => {
  it("given six months > then Thai month names and each bar's share of the tallest", () => {
    const bars = monthBars([
      { month: "2026-09", count: 20 },
      { month: "2026-10", count: 40 },
    ]);
    expect(bars).toEqual([
      { key: "2026-09", label: { th: "ก.ย.", en: "Sep" }, count: 20, share: 0.5 },
      { key: "2026-10", label: { th: "ต.ค.", en: "Oct" }, count: 40, share: 1 },
    ]);
  });
  it("given no visits at all > then flat bars, not a division by zero", () => {
    expect(monthBars([{ month: "2026-10", count: 0 }])[0]!.share).toBe(0);
  });
});

describe("shortOrderStatus", () => {
  it.each([
    ["new", "กำลังสั่ง", "waiting"],
    ["confirmed", "กำลังสั่ง", "waiting"],
    ["packing", "กำลังสั่ง", "waiting"],
    ["shipped", "กำลังสั่ง", "waiting"],
    ["delivered", "สำเร็จ", "success"],
    ["claim_rejected", "สำเร็จ", "success"],
    ["claim_pending", "เคลม", "danger"],
    ["claimed", "เคลม", "danger"],
    ["cancelled", "ล้มเหลว", "muted"],
    ["expired", "ล้มเหลว", "muted"],
    ["delivery_failed", "ล้มเหลว", "muted"],
  ])("given %s > then %s", (status, th, tone) => {
    const s = shortOrderStatus(status);
    expect(s.word.th).toBe(th);
    expect(s.tone).toBe(tone);
  });
  it("given an unknown status > then กำลังสั่ง, never blank", () => {
    expect(shortOrderStatus(null).word.th).toBe("กำลังสั่ง");
  });
});

describe("accountName", () => {
  it("given a name > then the name", () => {
    expect(accountName({ name: " คุณวิภา ", anonymizedAt: null })).toEqual({
      th: "คุณวิภา",
      en: "คุณวิภา",
    });
  });
  it("given erased or nameless > then the plain reason", () => {
    expect(accountName({ name: "x", anonymizedAt: 1 }).th).toBe("ลบข้อมูลแล้ว");
    expect(accountName({ name: "", anonymizedAt: null }).th).toBe("(ยังไม่มีชื่อ)");
  });
});
