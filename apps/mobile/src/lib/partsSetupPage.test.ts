import { describe, expect, it } from "vitest";
import {
  type Brand,
  type Category,
  type CarSystem,
  blockedDelete,
  brandLine,
  brandsTab,
  canDeleteBrand,
  canDeleteSystem,
  categoryChanges,
  categoryDraft,
  categoryLine,
  deleteTitle,
  descriptionLine,
  descriptionNote,
  descriptionPreview,
  findBrands,
  findCategories,
  nameDraft,
  nameProblems,
  sortBrands,
  systemLine,
  systemsWithCounts,
  titleOf,
  unassigned,
  WARRANTY_CHOICES,
  warrantyWords,
} from "./partsSetupPage";

const brand = (over: Partial<Brand> & Pick<Brand, "id" | "nameEn">): Brand => ({
  nameTh: null,
  imageKey: null,
  productCount: 0,
  ...over,
});
const sys = (over: Partial<CarSystem> & Pick<CarSystem, "id" | "nameEn">): CarSystem => ({
  nameTh: null,
  ...over,
});
const cat = (over: Partial<Category> & Pick<Category, "id" | "nameEn">): Category => ({
  nameTh: null,
  systemId: "uc-ac",
  warrantyDays: null,
  imageKey: null,
  description: null,
  productCount: 0,
  ...over,
});

const DENSO = brand({ id: "br-denso", nameEn: "DENSO", nameTh: "เดนโซ่", productCount: 86 });
const GENERIC = brand({ id: "br-generic", nameEn: "Generic", nameTh: "ไม่มียี่ห้อ" });
const AC = sys({ id: "uc-ac", nameEn: "A/C", nameTh: "แอร์" });
const SUSPENSION = sys({ id: "uc-susp", nameEn: "Suspension", nameTh: "ช่วงล่าง" });
const COMPRESSOR = cat({
  id: "pt-comp",
  nameEn: "Compressor",
  nameTh: "คอมเพรสเซอร์",
  warrantyDays: 365,
  productCount: 42,
});
const DRIER = cat({ id: "pt-drier", nameEn: "Receiver drier", nameTh: "ไดเออร์" });
const EVAP = cat({ id: "pt-evap", nameEn: "Evaporator", nameTh: "ตู้แอร์", productCount: 40 });

describe("titleOf / lines", () => {
  it("given a Thai name > the title is Thai and the line starts with the English name", () => {
    expect(titleOf(DENSO)).toBe("เดนโซ่");
    expect(brandLine(DENSO)).toEqual({
      th: "DENSO · ใช้ใน 86 สินค้า",
      en: "DENSO · used in 86 products",
    });
  });

  it("given no Thai name > the English name is the title and is not said twice", () => {
    const mahle = brand({ id: "br-mahle", nameEn: "Mahle", productCount: 3 });
    expect(titleOf(mahle)).toBe("Mahle");
    expect(brandLine(mahle).th).toBe("ใช้ใน 3 สินค้า");
  });

  it("given a brand with no products > ยังไม่มีสินค้า", () => {
    expect(brandLine(GENERIC).th).toBe("Generic · ยังไม่มีสินค้า");
  });

  it("given a category > English · warranty · products, as drawn", () => {
    expect(categoryLine(COMPRESSOR).th).toBe("Compressor · รับประกัน 1 ปี · 42 สินค้า");
    expect(categoryLine(DRIER).th).toBe("Receiver drier · ไม่มีรับประกัน · ยังไม่มีสินค้า");
  });

  it("given systems and categories > each system counts its categories and their products", () => {
    const rows = systemsWithCounts([AC, SUSPENSION], [COMPRESSOR, DRIER, EVAP]);
    expect(systemLine(rows[0]).th).toBe("A/C · 3 หมวดหมู่ · 82 สินค้า");
    expect(systemLine(rows[1]).th).toBe("Suspension · ยังไม่มีหมวดหมู่");
  });
});

describe("unassigned", () => {
  it("given categories with no system (or a system that is gone) > one ยังไม่ได้จัดระบบ row", () => {
    const loose = [
      cat({ id: "a", nameEn: "Horn", systemId: null, productCount: 3 }),
      cat({ id: "b", nameEn: "Wiper", systemId: "uc-gone", productCount: 2 }),
    ];
    const u = unassigned([AC], [COMPRESSOR, ...loose]);
    expect(u?.categories.map((c) => c.id)).toEqual(["a", "b"]);
    expect(u?.line.th).toBe("2 หมวดหมู่ · 5 สินค้า");
  });

  it("given every category in a system > no row", () => {
    expect(unassigned([AC], [COMPRESSOR])).toBeNull();
  });
});

describe("brandsTab / sortBrands", () => {
  it("given 5 brands > ยี่ห้ออะไหล่ · 5", () => {
    expect(brandsTab(5).th).toBe("ยี่ห้ออะไหล่ · 5");
  });

  it("given brands > most used first, then Thai order", () => {
    const sanden = brand({ id: "s", nameEn: "SANDEN", nameTh: "ซันเดน", productCount: 24 });
    const calsonic = brand({ id: "c", nameEn: "Calsonic", nameTh: "คาโซนิค", productCount: 24 });
    expect(sortBrands([GENERIC, sanden, DENSO, calsonic]).map((b) => b.id)).toEqual([
      "br-denso",
      "c",
      "s",
      "br-generic",
    ]);
  });
});

describe("warrantyWords", () => {
  it.each([
    [null, "ไม่มีรับประกัน"],
    [0, "ไม่มีรับประกัน"],
    [30, "30 วัน"],
    [90, "3 เดือน"],
    [180, "6 เดือน"],
    [365, "1 ปี"],
    [730, "2 ปี"],
    [45, "45 วัน"],
  ])("given %s days > %s", (days, words) => {
    expect(warrantyWords(days).th).toBe(words);
  });

  it("offers the drawn choices in order", () => {
    expect(WARRANTY_CHOICES).toEqual([0, 30, 90, 180, 365, 730]);
  });
});

describe("find", () => {
  it("given words > brands whose Thai or English name holds them, any case", () => {
    expect(findBrands([DENSO, GENERIC], "den").map((b) => b.id)).toEqual(["br-denso"]);
    expect(findBrands([DENSO, GENERIC], "ไม่มี").map((b) => b.id)).toEqual(["br-generic"]);
    expect(findBrands([DENSO, GENERIC], " ")).toHaveLength(2);
  });

  it("given words > categories by either name", () => {
    expect(findCategories([COMPRESSOR, EVAP], "ตู้").map((c) => c.id)).toEqual(["pt-evap"]);
  });
});

describe("nameProblems", () => {
  it("given no English name > ยังไม่ได้ใส่ชื่ออังกฤษ", () => {
    expect(nameProblems("brand", { id: null, nameEn: " " }, [DENSO]).nameEn?.th).toBe(
      "ยังไม่ได้ใส่ชื่ออังกฤษ",
    );
  });

  it("given another one's English name, any case > มียี่ห้อ DENSO แล้ว", () => {
    expect(nameProblems("brand", { id: null, nameEn: "denso" }, [DENSO]).nameEn?.th).toBe(
      "มียี่ห้อ DENSO แล้ว",
    );
    expect(nameProblems("system", { id: null, nameEn: "a/c" }, [AC]).nameEn?.th).toBe(
      "มีระบบ A/C แล้ว",
    );
  });

  it("given another one's identity name (shown under a different English name) > refused too", () => {
    // The server's add finds-or-creates on `name`, so a match there would quietly merge into it.
    const old = brand({ id: "br-x", name: "Denso Thailand", nameEn: "DENSO TH" });
    expect(nameProblems("brand", { id: null, nameEn: "denso thailand" }, [old]).nameEn?.th).toBe(
      "มียี่ห้อ DENSO TH แล้ว",
    );
  });

  it("given its own name while editing > no problem", () => {
    expect(nameProblems("brand", { id: "br-denso", nameEn: "DENSO" }, [DENSO])).toEqual({});
  });

  it("given a category without a system > ยังไม่ได้เลือกระบบ", () => {
    const p = nameProblems("category", { id: null, nameEn: "Pressure switch", systemId: null }, []);
    expect(p.system?.th).toBe("ยังไม่ได้เลือกระบบ");
  });
});

describe("deleting", () => {
  it("given a brand still used > no delete; unused > delete", () => {
    expect(canDeleteBrand(DENSO)).toBe(false);
    expect(canDeleteBrand(GENERIC)).toBe(true);
  });

  it("given a system with categories > no delete; empty > delete", () => {
    expect(canDeleteSystem(AC, [COMPRESSOR])).toBe(false);
    expect(canDeleteSystem(SUSPENSION, [COMPRESSOR])).toBe(true);
  });

  it("asks with the thing's name", () => {
    expect(deleteTitle("brand", GENERIC).th).toBe("ลบยี่ห้อ ไม่มียี่ห้อ?");
    expect(deleteTitle("system", SUSPENSION).th).toBe("ลบระบบ ช่วงล่าง?");
    expect(deleteTitle("category", DRIER).th).toBe("ลบหมวดหมู่ ไดเออร์?");
  });

  it("given a category still used > says why it can't go", () => {
    expect(blockedDelete(COMPRESSOR)).toEqual({
      title: { th: "ลบ คอมเพรสเซอร์ ไม่ได้", en: "Can't delete Compressor" },
      body: {
        th: "ยังใช้อยู่ใน 42 สินค้า · ย้ายสินค้าไปหมวดอื่นก่อน",
        en: "Still used by 42 products · move them to another category first",
      },
    });
    expect(blockedDelete(DRIER)).toBeNull();
  });
});

describe("description", () => {
  const TEXT =
    "👨🏻‍🔧 คำแนะนำจากช่าง\nหากรถยนต์ของคุณเลขไมล์ถึง 150,000 กม. แล้ว\n\nกรณีได้ถอดตู้แอร์\n\n🔥 มีช่าง";

  it("given a long text > its first three lines with words, then …", () => {
    expect(descriptionPreview(TEXT)).toBe(
      "👨🏻‍🔧 คำแนะนำจากช่าง\nหากรถยนต์ของคุณเลขไมล์ถึง 150,000 กม. แล้ว\nกรณีได้ถอดตู้แอร์…",
    );
  });

  it("given three lines or fewer > as typed, no …", () => {
    expect(descriptionPreview("a\n\nb")).toBe("a\nb");
  });

  it("given a text > one line joined by · for the form row", () => {
    expect(descriptionLine("a\n\nb\nc")).toBe("a · b · c");
  });

  it("says where it shows, with the category's product count", () => {
    expect(descriptionNote(EVAP).th).toBe(
      "บน AirPlus: ต่อท้ายคำอธิบายของสินค้า เว้น 1 บรรทัด · ตู้แอร์ทุกชิ้น (40)",
    );
  });
});

describe("drafts and what บันทึก sends", () => {
  it("given a new category from a system page > that system is already picked, no warranty, no text", () => {
    expect(categoryDraft(undefined, "uc-ac")).toEqual({
      id: null,
      nameTh: "",
      nameEn: "",
      systemId: "uc-ac",
      warrantyDays: 0,
      description: "",
    });
  });

  it("given a saved category > its values, warranty none as 0", () => {
    expect(categoryDraft(DRIER)).toMatchObject({
      id: "pt-drier",
      nameTh: "ไดเออร์",
      warrantyDays: 0,
    });
  });

  it("given a new category > the add carries names and system; warranty and text only when set", () => {
    const d = { ...categoryDraft(undefined, "uc-ac"), nameEn: "Switch" };
    expect(categoryChanges(null, d)).toEqual({
      rename: false,
      system: false,
      warranty: false,
      description: false,
    });
    expect(categoryChanges(null, { ...d, warrantyDays: 30, description: " x " })).toMatchObject({
      warranty: true,
      description: true,
    });
  });

  it("given an edit > only what changed is sent", () => {
    const d = categoryDraft(COMPRESSOR);
    expect(categoryChanges(COMPRESSOR, d)).toEqual({
      rename: false,
      system: false,
      warranty: false,
      description: false,
    });
    expect(
      categoryChanges(COMPRESSOR, {
        ...d,
        nameTh: "คอม",
        systemId: null,
        warrantyDays: 0,
        description: "a",
      }),
    ).toEqual({ rename: true, system: true, warranty: true, description: true });
  });

  it("given a brand or system > its names, or empty for a new one", () => {
    expect(nameDraft(DENSO)).toEqual({ id: "br-denso", nameTh: "เดนโซ่", nameEn: "DENSO" });
    expect(nameDraft()).toEqual({ id: null, nameTh: "", nameEn: "" });
  });
});
