import { describe, expect, it } from "vitest";
import {
  type Brand,
  type Category,
  type CarSystem,
  brandLine,
  brandsTab,
  canDeleteBrand,
  canDeleteCategory,
  canDeleteSystem,
  categoryChanges,
  categoryDraft,
  categoryLine,
  deleteTitle,
  aboutExample,
  aboutLine,
  DESCRIPTION_NOTE,
  FIELDS_HINT,
  forAllNote,
  TERMS_NOTE,
  termsProblem,
  textPreview,
  findBrands,
  findCategories,
  keepPartsWhole,
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
  terms: null,
  sample: null,
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

  it("given a category with products > no delete; none > delete", () => {
    expect(canDeleteCategory(COMPRESSOR)).toBe(false);
    expect(canDeleteCategory(DRIER)).toBe(true);
  });
});

describe("เกี่ยวกับสินค้าประเภทนี้", () => {
  const TEXT =
    "👨🏻‍🔧 คำแนะนำจากช่าง\nหากรถยนต์ของคุณเลขไมล์ถึง 150,000 กม. แล้ว\n\nกรณีได้ถอดตู้แอร์\n\n🔥 มีช่าง";
  const RULES =
    "สินค้า: {{product_name}}\nยี่ห้อ: {{brand}}\nรับประกัน {{warranty}} นับจากวันที่ซื้อ";

  it("given a long text > its first two lines with words, then …", () => {
    expect(textPreview(TEXT, 2)).toBe(
      "👨🏻‍🔧 คำแนะนำจากช่าง\nหากรถยนต์ของคุณเลขไมล์ถึง 150,000 กม. แล้ว…",
    );
  });

  it("given as many lines as shown or fewer > as typed, no …", () => {
    expect(textPreview("a\n\nb", 2)).toBe("a\nb");
  });

  it("given both texts > the form row reads the first line of each, joined by ·", () => {
    expect(aboutLine({ description: TEXT, terms: RULES })).toBe(
      "👨🏻‍🔧 คำแนะนำจากช่าง · สินค้า: {{product_name}}",
    );
    expect(aboutLine({ description: "", terms: " \n" + RULES })).toBe("สินค้า: {{product_name}}");
    expect(aboutLine({ description: " ", terms: "" })).toBe("");
  });

  it("says where each shows on AirPlus, and which products it covers", () => {
    expect(DESCRIPTION_NOTE.th).toBe("บน AirPlus: ต่อท้ายคำอธิบายของสินค้า เว้น 1 บรรทัด");
    expect(TERMS_NOTE.th).toBe(
      "บน AirPlus: กล่อง เงื่อนไข ของมันเอง · ชื่อ ยี่ห้อ รับประกัน เปลี่ยนตามแต่ละชิ้น",
    );
    expect(forAllNote(EVAP).th).toBe("ใช้กับตู้แอร์ทุกชิ้น (40)");
    expect(forAllNote(DRIER).th).toBe("ยังไม่มีสินค้าในหมวดนี้");
  });

  it("lists the fill-ins a product has, with what each becomes", () => {
    expect(FIELDS_HINT.th).toBe(
      "ใส่ได้: {{product_name}} ชื่อสินค้า · {{brand}} ยี่ห้อ · {{warranty}} รับประกันของหมวดนี้",
    );
  });

  it("given a fill-in a product doesn't have > says it under the box; none > nothing", () => {
    expect(termsProblem(RULES)).toBeNull();
    expect(termsProblem("รับประกัน {{รับประกันศูนย์}}")?.th).toBe(
      "{{รับประกันศูนย์}} ไม่มีในสินค้า · ใช้ได้แค่ 3 ช่องข้างล่าง",
    );
    expect(termsProblem("{{a}} {{ b }}")?.th).toBe(
      "{{a}} {{b}} ไม่มีในสินค้า · ใช้ได้แค่ 3 ช่องข้างล่าง",
    );
  });

  describe("aboutExample", () => {
    const WITH = {
      ...EVAP,
      sample: { name: "ตู้แอร์ Toyota Vigo", brand: "DENSO", description: "👉🏻 Made in Thailand" },
    };
    const draft = { ...categoryDraft(WITH), warrantyDays: 365, description: TEXT, terms: RULES };

    it("given a product in the category > it, as AirPlus shows it, from what is typed now", () => {
      expect(aboutExample(WITH, draft)).toEqual({
        from: {
          th: "ตัวอย่างจาก ตู้แอร์ Toyota Vigo · DENSO · 1 ใน 40 สินค้า",
          en: "Example: ตู้แอร์ Toyota Vigo · DENSO · 1 of 40 products",
        },
        description: `👉🏻 Made in Thailand\n\n${TEXT}`,
        terms: "สินค้า: ตู้แอร์ Toyota Vigo\nยี่ห้อ: DENSO\nรับประกัน 1 ปี นับจากวันที่ซื้อ",
      });
    });

    it("given no brand, no texts > no brand in the line; nothing to show for either", () => {
      const bare = { ...WITH, sample: { name: "Evap", brand: null, description: null } };
      expect(aboutExample(bare, { ...draft, description: " ", terms: "" })).toEqual({
        from: {
          th: "ตัวอย่างจาก Evap · 1 ใน 40 สินค้า",
          en: "Example: Evap · 1 of 40 products",
        },
        description: null,
        terms: null,
      });
    });

    it("given no product in the category > nothing to show", () => {
      expect(aboutExample(DRIER, categoryDraft(DRIER))).toBeNull();
    });
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
      terms: "",
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
      terms: false,
    });
    expect(
      categoryChanges(null, { ...d, warrantyDays: 30, description: " x ", terms: "y" }),
    ).toMatchObject({ warranty: true, description: true, terms: true });
  });

  it("given an edit > only what changed is sent", () => {
    const d = categoryDraft(COMPRESSOR);
    expect(categoryChanges(COMPRESSOR, d)).toEqual({
      rename: false,
      system: false,
      warranty: false,
      description: false,
      terms: false,
    });
    expect(
      categoryChanges(COMPRESSOR, {
        ...d,
        nameTh: "คอม",
        systemId: null,
        warrantyDays: 0,
        description: "a",
        terms: "b",
      }),
    ).toEqual({ rename: true, system: true, warranty: true, description: true, terms: true });
  });

  it("given a brand or system > its names, or empty for a new one", () => {
    expect(nameDraft(DENSO)).toEqual({ id: "br-denso", nameTh: "เดนโซ่", nameEn: "DENSO" });
    expect(nameDraft()).toEqual({ id: null, nameTh: "", nameEn: "" });
  });
});

describe("keepPartsWhole", () => {
  const line = "Compressor · รับประกัน 1 ปี · ยังไม่มีสินค้า";
  const out = keepPartsWhole(line);

  it("given a list row's second line > reads the same", () => {
    expect(out.replace(/\u2060/g, "").replace(/\u00A0/g, " ")).toBe(line);
  });

  it("given a part > no place to break inside it: no plain space, letters joined (no ยังไม่มี / สินค้า)", () => {
    const parts = out.split(" · ");
    expect(parts).toHaveLength(3);
    expect(parts.every((p) => !p.includes(" "))).toBe(true);
    expect(out).toContain("มี\u2060สิ\u2060น");
  });

  it("given Thai marks > they stay on their letter, never split from it", () => {
    expect(out).not.toMatch(/\u2060[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/);
  });
});
