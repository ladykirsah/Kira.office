import { describe, expect, it } from "vitest";
import {
  AIRPLUS_PAGES,
  bannerState,
  choiceLabel,
  choiceOf,
  createBody,
  defaultWindow,
  emptyForm,
  externalProblem,
  formOf,
  joinDayTime,
  linkLine,
  linkOf,
  moved,
  orderPatches,
  parseTimeField,
  patchBody,
  photoFailedToast,
  photoProblem,
  productChoices,
  rowName,
  segmentLabel,
  slotFull,
  slotRows,
  statusLine,
  timeField,
  whenRows,
  windowFromRows,
  windowLabel,
  windowProblem,
  type Banner,
  type LinkNames,
} from "./bannerPage";
import type { ProductRow } from "./productList";

const day = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).getTime();
const NOW = day(2026, 10, 20, 9);

const banner = (over: Partial<Banner> = {}): Banner => ({
  id: "b1",
  slot: "hero",
  imageKey: "banners/b1.jpg",
  linkUrl: null,
  sortOrder: 0,
  startsAt: null,
  endsAt: null,
  status: "active",
  createdAt: 1,
  ...over,
});

const names: LinkNames = {
  brands: [{ id: "br-denso", name: "DENSO", nameTh: null, nameEn: null }],
  types: [{ id: "ty-comp", name: "Compressor", nameTh: "คอมเพรสเซอร์", nameEn: "Compressor" }],
  products: [{ id: "p1", name: "คอมเพรสเซอร์ DENSO 10S11C" }],
};

describe("slotRows", () => {
  it("given both slots mixed > then only that slot, by its order, newer first on a tie (as the website)", () => {
    const rows = slotRows(
      [
        banner({ id: "p", slot: "promo" }),
        banner({ id: "h2", sortOrder: 1 }),
        banner({ id: "h1b", sortOrder: 0, createdAt: 5 }),
        banner({ id: "h1a", sortOrder: 0, createdAt: 2 }),
      ],
      "hero",
    );
    expect(rows.map((b) => b.id)).toEqual(["h1b", "h1a", "h2"]);
  });
});

describe("slotFull", () => {
  it("given 3 slides > then the main slides are full", () => {
    expect(slotFull("hero", 3)).toBe(true);
    expect(slotFull("hero", 2)).toBe(false);
  });

  it("given more than 3 (two phones at once) > then it stays full", () => {
    expect(slotFull("hero", 4)).toBe(true);
  });

  it("given any number of strips > then strips are never full", () => {
    expect(slotFull("promo", 40)).toBe(false);
  });
});

describe("segmentLabel", () => {
  it("given the two slots > then slides say n / 3 and strips just the count", () => {
    expect(segmentLabel("hero", 2).th).toBe("สไลด์หลัก · 2 / 3");
    expect(segmentLabel("promo", 4).th).toBe("แถบโปรโมชัน · 4");
  });
});

describe("rowName", () => {
  it("given a place in the list > then สไลด์ n or แถบ n, counting from 1", () => {
    expect(rowName("hero", 0).th).toBe("สไลด์ 1");
    expect(rowName("promo", 2).th).toBe("แถบ 3");
  });
});

describe("bannerState", () => {
  it("given on, with a photo and no dates > then it shows", () => {
    expect(bannerState(banner(), NOW)).toBe("showing");
  });

  it("given a start still ahead > then รอเริ่ม", () => {
    expect(bannerState(banner({ startsAt: day(2026, 11, 11) }), NOW)).toBe("waiting");
  });

  it("given an end already passed > then หมดเวลาแล้ว", () => {
    expect(bannerState(banner({ endsAt: day(2026, 10, 15, 23, 59) }), NOW)).toBe("ended");
  });

  it("given switched off > then ปิดอยู่, whatever its dates", () => {
    expect(bannerState(banner({ status: "disabled", endsAt: day(2026, 10, 1) }), NOW)).toBe("off");
  });

  it("given no photo > then ไม่แสดง (the website skips it)", () => {
    expect(bannerState(banner({ imageKey: null }), NOW)).toBe("hidden");
  });
});

describe("windowLabel", () => {
  it("given no dates > then ตลอดเวลา", () => {
    expect(windowLabel(null, null).th).toBe("ตลอดเวลา");
  });

  it("given a range in one month > then 1–31 ต.ค.", () => {
    expect(windowLabel(day(2026, 10, 1), day(2026, 10, 31, 23, 59)).th).toBe("1–31 ต.ค.");
  });

  it("given only a start or only an end > then ตั้งแต่ / ถึง", () => {
    expect(windowLabel(day(2026, 11, 11), null).th).toBe("ตั้งแต่ 11 พ.ย.");
    expect(windowLabel(null, day(2026, 10, 31)).th).toBe("ถึง 31 ต.ค.");
  });
});

describe("statusLine", () => {
  it("given a waiting strip > then the state and its dates, joined by a dot", () => {
    const b = banner({ startsAt: day(2026, 11, 11), endsAt: day(2026, 11, 12, 23, 59) });
    expect(statusLine(b, NOW).th).toBe("รอเริ่ม · 11–12 พ.ย.");
  });
});

describe("linkLine", () => {
  it("given a link > then ลิงก์ and the link as saved; none > an em dash", () => {
    expect(linkLine(banner({ linkUrl: "/tools" })).th).toBe("ลิงก์ /tools");
    expect(linkLine(banner()).th).toBe("ลิงก์ —");
  });
});

describe("moved", () => {
  const rows = [banner({ id: "a" }), banner({ id: "b" }), banner({ id: "c" })];

  it("given ▼ on the first > then it swaps with the second, the old list untouched", () => {
    expect(moved(rows, 0, 1).map((b) => b.id)).toEqual(["b", "a", "c"]);
    expect(rows.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });

  it("given ▲ on the first or ▼ on the last > then nothing moves", () => {
    expect(moved(rows, 0, -1).map((b) => b.id)).toEqual(["a", "b", "c"]);
    expect(moved(rows, 2, 1).map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});

describe("orderPatches", () => {
  it("given a new order > then each row's place, sending only the ones that changed", () => {
    const rows = [
      banner({ id: "b", sortOrder: 1 }),
      banner({ id: "a", sortOrder: 0 }),
      banner({ id: "c", sortOrder: 2 }),
    ];
    expect(orderPatches(rows)).toEqual([
      { id: "b", sortOrder: 0 },
      { id: "a", sortOrder: 1 },
    ]);
  });
});

describe("links", () => {
  it("given each kind of ไปที่ > then the link the website opens", () => {
    expect(linkOf({ kind: "none" })).toBeNull();
    expect(linkOf({ kind: "page", path: "/coupons" })).toBe("/coupons");
    expect(linkOf({ kind: "brand", id: "br-denso" })).toBe("/products?brand=br-denso");
    expect(linkOf({ kind: "category", id: "ty-comp" })).toBe("/products?type=ty-comp&ctx=cat");
    expect(linkOf({ kind: "car", name: "Land Rover" })).toBe(
      "/products?carBrand=Land+Rover&ctx=brand",
    );
    expect(linkOf({ kind: "product", id: "p1" })).toBe("/products/p1");
    expect(linkOf({ kind: "external", url: "  https://lin.ee/tltIFtI " })).toBe(
      "https://lin.ee/tltIFtI",
    );
  });

  it("given a saved link > then the same ไปที่ comes back", () => {
    const all = [
      { kind: "none" },
      { kind: "page", path: "/" },
      { kind: "brand", id: "br-denso" },
      { kind: "category", id: "ty-comp" },
      { kind: "car", name: "Land Rover" },
      { kind: "product", id: "p1" },
      { kind: "external", url: "https://lin.ee/tltIFtI" },
    ] as const;
    for (const c of all) expect(choiceOf(linkOf(c))).toEqual(c);
  });

  it("given an older link the lists don't know > then it stays a page with its path", () => {
    expect(choiceOf("/warranty")).toEqual({ kind: "page", path: "/warranty" });
    expect(choiceOf("/products?q=denso")).toEqual({ kind: "page", path: "/products?q=denso" });
  });

  it("given a saved product link with a broken % > then it stays a page, so the banner still opens", () => {
    expect(choiceOf("/products/50%")).toEqual({ kind: "page", path: "/products/50%" });
  });

  it("given every AirPlus page > then each is a real website path, coupons included", () => {
    expect(AIRPLUS_PAGES.map((p) => p.path)).toEqual([
      "/",
      "/products",
      "/categories",
      "/brands",
      "/coupons",
      "/tools",
      "/how-to-order",
      "/info",
      "/returns",
      "/faq",
    ]);
    expect(AIRPLUS_PAGES.find((p) => p.path === "/coupons")?.label.th).toBe("คูปองส่วนลด");
  });
});

describe("choiceLabel", () => {
  it("given each kind > then the words the ไปที่ row shows", () => {
    expect(choiceLabel({ kind: "none" }, names).th).toBe("คลิกไม่ได้");
    expect(choiceLabel({ kind: "page", path: "/coupons" }, names).th).toBe("คูปองส่วนลด");
    expect(choiceLabel({ kind: "brand", id: "br-denso" }, names).th).toBe("สินค้ายี่ห้อ DENSO");
    expect(choiceLabel({ kind: "category", id: "ty-comp" }, names).th).toBe(
      "สินค้าในหมวด คอมเพรสเซอร์",
    );
    expect(choiceLabel({ kind: "car", name: "Toyota" }, names).th).toBe("สินค้าสำหรับรถ Toyota");
    expect(choiceLabel({ kind: "product", id: "p1" }, names).th).toBe("คอมเพรสเซอร์ DENSO 10S11C");
    expect(choiceLabel({ kind: "external", url: "https://lin.ee/tltIFtI" }, names).th).toBe(
      "lin.ee/tltIFtI",
    );
  });

  it("given a brand or product the lists no longer have > then the saved name, never blank", () => {
    expect(choiceLabel({ kind: "brand", id: "denso" }, names).th).toBe("สินค้ายี่ห้อ denso");
    expect(choiceLabel({ kind: "product", id: "gone" }, names).th).toBe("ไม่พบสินค้านี้");
    expect(choiceLabel({ kind: "page", path: "/warranty" }, names).th).toBe("/warranty");
  });
});

describe("externalProblem", () => {
  it("given a link without https:// > then say so under the field", () => {
    expect(externalProblem("lin.ee/tltIFtI")?.th).toBe("ลิงก์ต้องขึ้นต้นด้วย https://");
    expect(externalProblem("http://lin.ee/x")?.th).toBe("ลิงก์ต้องขึ้นต้นด้วย https://");
    expect(externalProblem("")?.th).toBe("ลิงก์ต้องขึ้นต้นด้วย https://");
  });

  it("given an https link > then no problem", () => {
    expect(externalProblem(" https://lin.ee/tltIFtI ")).toBeNull();
  });
});

describe("productChoices", () => {
  const row = (over: Partial<ProductRow>): ProductRow =>
    ({
      id: "p",
      name: "x",
      productRef: "DN-1",
      status: "active",
      imageKey: null,
      onlinePriceSatang: 345000,
      ...over,
    }) as ProductRow;

  it("given the catalogue > then only products on AirPlus that match, in Thai order", () => {
    const out = productChoices(
      [
        row({ id: "v", name: "วาล์วแอร์ DENSO Vigo" }),
        row({ id: "k", name: "คอมเพรสเซอร์ DENSO 10S11C" }),
        row({ id: "off", name: "คอมเพรสเซอร์ DENSO 10S17C", status: "draft" }),
        row({ id: "s", name: "คอมเพรสเซอร์ Sanden" }),
      ],
      "denso",
    );
    expect(out.map((r) => r.id)).toEqual(["k", "v"]);
  });

  it("given a code typed > then the product with that code", () => {
    const out = productChoices([row({ id: "k", productRef: "DN-447220" })], "447220");
    expect(out.map((r) => r.id)).toEqual(["k"]);
  });
});

describe("forms", () => {
  it("given a new slide > then no photo, คลิกไม่ได้, ตลอดเวลา, on", () => {
    expect(emptyForm("hero")).toEqual({
      slot: "hero",
      link: { kind: "none" },
      startsAt: null,
      endsAt: null,
      on: true,
    });
  });

  it("given a saved banner > then its form", () => {
    const b = banner({ linkUrl: "/products/p1", startsAt: 5, endsAt: 9, status: "disabled" });
    expect(formOf(b)).toEqual({
      slot: "hero",
      link: { kind: "product", id: "p1" },
      startsAt: 5,
      endsAt: 9,
      on: false,
    });
  });

  it("given a new banner > then it goes at the end of its slot", () => {
    const rows = [banner({ sortOrder: 0 }), banner({ id: "b2", sortOrder: 4 })];
    const form = { ...emptyForm("hero"), link: { kind: "page", path: "/tools" } as const };
    expect(createBody(form, rows)).toEqual({
      slot: "hero",
      linkUrl: "/tools",
      sortOrder: 5,
      startsAt: null,
      endsAt: null,
    });
  });

  it("given an edit > then the link, dates and on / off", () => {
    const form = { ...formOf(banner()), on: false, startsAt: 1, endsAt: 2 };
    expect(patchBody(form)).toEqual({
      linkUrl: null,
      startsAt: 1,
      endsAt: 2,
      status: "disabled",
    });
  });

  it("given a new banner with no photo > then เลือกรูปก่อน; an edit or a photo > no problem", () => {
    expect(photoProblem(true, false)?.th).toBe("เลือกรูปก่อน");
    expect(photoProblem(true, true)).toBeNull();
    expect(photoProblem(false, false)).toBeNull();
  });

  it("given an end before the start > then say so; in order or no dates > fine", () => {
    expect(windowProblem(day(2026, 10, 31), day(2026, 10, 1))?.th).toBe(
      "วันสิ้นสุดต้องอยู่หลังวันเริ่ม",
    );
    expect(windowProblem(day(2026, 10, 1), day(2026, 10, 31))).toBeNull();
    expect(windowProblem(null, null)).toBeNull();
  });

  it("given the photo failed after saving > then the toast names the slide to tap", () => {
    expect(photoFailedToast("hero", 2)).toEqual({
      title: { th: "รูปขึ้นไม่สำเร็จ", en: "The picture did not upload" },
      detail: { th: "แตะสไลด์ 3 เพื่อเลือกรูปใหม่", en: "Tap Slide 3 to pick it again" },
    });
  });
});

describe("times", () => {
  it("given minutes after midnight > then the clock time as the time box holds it; none > empty", () => {
    expect(timeField(23 * 60 + 59)).toBe("23:59");
    expect(timeField(7 * 60 + 5)).toBe("07:05");
    expect(timeField(null)).toBe("");
  });

  it("given a typed time > then minutes after midnight; not a real time > null", () => {
    expect(parseTimeField("23:59")).toBe(23 * 60 + 59);
    expect(parseTimeField("00:00")).toBe(0);
    expect(parseTimeField("24:00")).toBeNull();
    expect(parseTimeField("7:5")).toBeNull();
  });

  it("given a day and a time > then that moment", () => {
    expect(joinDayTime(day(2026, 10, 31), 23 * 60 + 59)).toBe(day(2026, 10, 31, 23, 59));
  });

  it("given กำหนดช่วงเวลา turned on > then from today 00:00 to the month's last day 23:59", () => {
    expect(defaultWindow(day(2026, 10, 20, 9, 30))).toEqual({
      startsAt: day(2026, 10, 20),
      endsAt: day(2026, 10, 31, 23, 59),
    });
  });
});

describe("whenRows", () => {
  const now = day(2026, 10, 20, 9, 30);

  it("given no window saved > then both rows start from today to the month's last day", () => {
    expect(whenRows(null, null, now)).toEqual({
      start: { day: day(2026, 10, 20), minutes: 0 },
      end: { day: day(2026, 10, 31), minutes: 23 * 60 + 59 },
    });
  });

  it("given only a start saved (old back office) > then the end row opens empty, not filled in", () => {
    expect(whenRows(day(2026, 10, 5, 8, 0), null, now)).toEqual({
      start: { day: day(2026, 10, 5), minutes: 8 * 60 },
      end: { day: null, minutes: null },
    });
  });

  it("given only an end saved > then the start row opens empty", () => {
    expect(whenRows(null, day(2026, 10, 9, 18, 0), now).start).toEqual({
      day: null,
      minutes: null,
    });
  });
});

describe("windowFromRows", () => {
  const full = (d: number, minutes: number) => ({ day: d, minutes });
  const empty = { day: null, minutes: null };

  it("given both rows > then that start and end", () => {
    expect(windowFromRows(full(day(2026, 10, 1), 0), full(day(2026, 10, 30), 600))).toEqual({
      startsAt: day(2026, 10, 1),
      endsAt: day(2026, 10, 30, 10, 0),
    });
  });

  it("given an empty end row > then the banner keeps no end", () => {
    expect(windowFromRows(full(day(2026, 10, 5), 480), empty)).toEqual({
      startsAt: day(2026, 10, 5, 8, 0),
      endsAt: null,
    });
  });

  it("given a day without its time, or both rows empty > then ใส่วันและเวลาให้ครบ", () => {
    const half = { day: day(2026, 10, 5), minutes: null };
    expect(windowFromRows(half, empty)).toEqual({
      problem: { th: "ใส่วันและเวลาให้ครบ", en: "Fill in both days and times" },
    });
    expect(windowFromRows(empty, empty)).toEqual({
      problem: { th: "ใส่วันและเวลาให้ครบ", en: "Fill in both days and times" },
    });
  });

  it("given a window that must have both ends (แฟลชเซล) > one row empty > then ใส่วันและเวลาให้ครบ", () => {
    expect(windowFromRows(full(day(2026, 10, 5), 480), empty, true)).toEqual({
      problem: { th: "ใส่วันและเวลาให้ครบ", en: "Fill in both days and times" },
    });
  });

  it("given an end before the start > then the end-after-start problem", () => {
    expect(windowFromRows(full(day(2026, 10, 30), 0), full(day(2026, 10, 1), 0))).toEqual({
      problem: { th: "วันสิ้นสุดต้องอยู่หลังวันเริ่ม", en: "The end must be after the start" },
    });
  });
});
