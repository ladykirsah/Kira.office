import { describe, expect, it } from "vitest";
import {
  type CarBrand,
  type CarModel,
  brandLine,
  canDeleteCarBrand,
  canDeleteModel,
  coolantWords,
  findModels,
  foundWords,
  modelDraft,
  modelHead,
  modelLine,
  modelProblems,
  modelSave,
  oringRows,
  yearsWords,
} from "./carFitmentPage";

const model = (over: Partial<CarModel> & { id: string; nameEn: string }): CarModel => ({
  name: over.nameEn,
  nameTh: null,
  yearFrom: null,
  yearTo: null,
  chassis: null,
  refrigerant: null,
  coolant: null,
  orings: [],
  notes: null,
  productCount: 0,
  ...over,
});
const VIGO = model({
  id: "cm-vigo",
  nameEn: "Vigo",
  nameTh: "วีโก้",
  yearFrom: 2005,
  yearTo: 2014,
  chassis: "KUN15 · KUN26",
  refrigerant: "R134a",
  coolant: "8.5",
  orings: [
    { size: '3/8"', qty: 2 },
    { size: '1/2"', qty: 1 },
  ],
  notes: "คอม 10S11C",
  productCount: 34,
});
const VIOS = model({
  id: "cm-vios",
  nameEn: "Vios",
  nameTh: "วีออส",
  yearFrom: 2013,
  yearTo: 2022,
});
const brand = (over: Partial<CarBrand> & { id: string; nameEn: string }): CarBrand => ({
  name: over.nameEn,
  nameTh: null,
  imageKey: null,
  productCount: 0,
  models: [],
  ...over,
});
const TOYOTA = brand({
  id: "cb-toyota",
  nameEn: "Toyota",
  nameTh: "โตโยต้า",
  productCount: 120,
  models: [VIGO, VIOS],
});
const MAZDA = brand({ id: "cb-mazda", nameEn: "Mazda", nameTh: "มาสด้า" });

describe("lines", () => {
  it("given a brand > English name · how many models, as drawn", () => {
    expect(brandLine(TOYOTA).th).toBe("Toyota · 2 รุ่น");
    expect(brandLine(MAZDA).th).toBe("Mazda · ยังไม่มีรุ่น");
  });

  it("given a model > English name · years, and says when it has no service info", () => {
    expect(modelLine(VIGO).th).toBe("Vigo · 2005–2014");
    expect(modelLine(VIOS).th).toBe("Vios · 2013–2022 · ยังไม่มีข้อมูลบริการ");
  });

  it("given a model under its brand > Toyota Vigo · 2005–2014 (its page and the search list)", () => {
    expect(modelHead(TOYOTA, VIGO).th).toBe("Toyota Vigo · 2005–2014");
  });

  it("given years > from–to, from on, or nothing", () => {
    expect(yearsWords(2005, 2014).th).toBe("2005–2014");
    expect(yearsWords(2022, null).th).toBe("2022 ขึ้นไป");
    expect(yearsWords(null, null).th).toBe("");
  });

  it("given coolant > a bare number reads in litres; words stay as typed", () => {
    expect(coolantWords("8.5")).toBe("8.5 ลิตร");
    expect(coolantWords("8.5 ลิตร")).toBe("8.5 ลิตร");
    expect(coolantWords(null)).toBe("—");
  });

  it('given o-rings > one row per size: โอริง 3/8" · 2 ตัว', () => {
    expect(oringRows(VIGO)).toEqual([
      { label: 'โอริง 3/8"', value: "2 ตัว" },
      { label: 'โอริง 1/2"', value: "1 ตัว" },
    ]);
  });
});

describe("findModels", () => {
  const ISUZU = brand({
    id: "cb-isuzu",
    nameEn: "Isuzu",
    models: [model({ id: "cm-dmax", nameEn: "D-Max", yearFrom: 2012, yearTo: null })],
  });

  it("given Vigo > the model from any brand, with its brand", () => {
    const out = findModels([TOYOTA, ISUZU], "vigo");
    expect(out.map((r) => r.model.id)).toEqual(["cm-vigo"]);
    expect(out[0]!.brand.id).toBe("cb-toyota");
  });

  it("given the Thai name, or brand + model > found", () => {
    expect(findModels([TOYOTA], "วีโก้").map((r) => r.model.id)).toEqual(["cm-vigo"]);
    expect(findModels([TOYOTA], "toyota vios").map((r) => r.model.id)).toEqual(["cm-vios"]);
  });

  it("given a year > only models made that year", () => {
    expect(findModels([TOYOTA], "Vigo 2010").map((r) => r.model.id)).toEqual(["cm-vigo"]);
    expect(findModels([TOYOTA], "Vigo 2016")).toEqual([]);
    expect(findModels([ISUZU], "D-Max 2025").map((r) => r.model.id)).toEqual(["cm-dmax"]);
  });

  it("given nothing typed > nothing", () => {
    expect(findModels([TOYOTA], "  ")).toEqual([]);
  });

  it("says how many were found", () => {
    expect(foundWords(1).th).toBe("พบ 1 รุ่น");
  });
});

describe("deleting", () => {
  it("given products fit it > no delete; none > delete", () => {
    expect(canDeleteCarBrand(TOYOTA)).toBe(false);
    expect(canDeleteCarBrand(MAZDA)).toBe(true);
    expect(canDeleteModel(VIGO)).toBe(false);
    expect(canDeleteModel(VIOS)).toBe(true);
  });
});

describe("model form", () => {
  it("given a model > every box filled as saved; a new one is empty", () => {
    expect(modelDraft(VIGO)).toMatchObject({
      id: "cm-vigo",
      nameTh: "วีโก้",
      nameEn: "Vigo",
      yearFrom: "2005",
      yearTo: "2014",
      chassis: "KUN15 · KUN26",
      coolant: "8.5",
      orings: [
        { size: '3/8"', qty: "2" },
        { size: '1/2"', qty: "1" },
      ],
      notes: "คอม 10S11C",
    });
    expect(modelDraft()).toMatchObject({ id: null, nameEn: "", yearFrom: "", orings: [] });
  });

  it("given no English name or start year > says so under the box", () => {
    const d = { ...modelDraft(), nameTh: "ยาริส เอทีฟ" };
    expect(modelProblems(d, TOYOTA.models)).toEqual({
      nameEn: { th: "ยังไม่ได้ใส่ชื่ออังกฤษ", en: "Add the English name" },
      yearFrom: { th: "ยังไม่ได้ใส่ปีเริ่ม", en: "Add the start year" },
    });
  });

  it("given the same model and years as another > says it is there already", () => {
    const d = { ...modelDraft(), nameEn: "vigo", yearFrom: "2005", yearTo: "2014" };
    expect(modelProblems(d, TOYOTA.models).nameEn?.th).toBe("มีรุ่น Vigo 2005–2014 แล้ว");
    expect(modelProblems(modelDraft(VIGO), TOYOTA.models)).toEqual({});
  });

  it("given the form > what บันทึก sends: o-rings with no amount are not counted", () => {
    const d = {
      ...modelDraft(VIGO),
      orings: [
        { size: '3/8"', qty: "3" },
        { size: '1/2"', qty: "" },
        { size: ' 3/4" ', qty: "1" },
        { size: "", qty: "2" },
      ],
      notes: "  ",
    };
    expect(modelSave(d)).toEqual({
      names: { nameTh: "วีโก้", nameEn: "Vigo" },
      yearFrom: 2005,
      yearTo: 2014,
      info: {
        generationCode: "KUN15 · KUN26",
        yearFrom: 2005,
        yearTo: 2014,
        refrigerant: "R134a",
        coolantLiters: "8.5",
        oringUsage: [
          { size: '3/8"', qty: 3 },
          { size: '3/4"', qty: 1 },
        ],
        notes: null,
      },
    });
  });
});
