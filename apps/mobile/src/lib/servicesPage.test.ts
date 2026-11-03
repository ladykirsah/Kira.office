import { describe, expect, it } from "vitest";
import type { ServiceRow } from "./posApi";
import {
  addFromSearch,
  deleteTitle,
  draftOf,
  findServices,
  listHeading,
  newDraft,
  notFound,
  serviceBody,
  serviceProblems,
} from "./servicesPage";

const LIST: ServiceRow[] = [
  { id: "sv1", name: "ล้างแอร์", nameEn: "Air-con cleaning", basePriceSatang: 69000 },
  { id: "sv2", name: "เติมน้ำยาแอร์ R134a", nameEn: "", basePriceSatang: 39000 },
  { id: "sv3", name: "เติมน้ำยาแอร์ R1234yf", nameEn: "", basePriceSatang: 129000 },
  { id: "sv4", name: "ตรวจเช็กระบบแอร์", nameEn: "A/C check", basePriceSatang: 0 },
];

describe("the list (canvas ตั้งค่าบริการ, บริการ 1)", () => {
  it("listHeading > given no search > then บริการที่มี · count", () => {
    expect(listHeading(LIST, LIST, "").th).toBe("บริการที่มี · 4");
  });
  it("listHeading > given a search > then พบ N บริการ", () => {
    expect(listHeading(LIST, LIST.slice(1, 3), "เติมน้ำยา").th).toBe("พบ 2 บริการ");
  });
  it("findServices > then the Thai or English name holds the words, any case, in list order", () => {
    expect(findServices(LIST, " เติมน้ำยา ").map((s) => s.id)).toEqual(["sv2", "sv3"]);
    expect(findServices(LIST, "a/c CHECK").map((s) => s.id)).toEqual(["sv4"]);
    expect(findServices(LIST, "")).toEqual(LIST);
  });
  it("notFound and addFromSearch > then ไม่พบ “…” and + เพิ่ม “…”", () => {
    expect(notFound(" ซ่อมพัดลม ").th).toBe("ไม่พบ “ซ่อมพัดลม”");
    expect(addFromSearch(" ซ่อมพัดลม ").th).toBe("+ เพิ่ม “ซ่อมพัดลม”");
  });
});

describe("เพิ่มบริการ and แก้ (บริการ 2)", () => {
  it("newDraft > given a search > then the name is filled in (มาจากคำค้น → ชื่อใส่ให้แล้ว)", () => {
    expect(newDraft(" ซ่อมพัดลม ")).toEqual({ id: null, name: "ซ่อมพัดลม", nameEn: "", price: "" });
  });
  it("draftOf > then the saved values, the price without ฿ or commas, ฿0 as 0", () => {
    expect(draftOf(LIST[2]!)).toEqual({
      id: "sv3",
      name: "เติมน้ำยาแอร์ R1234yf",
      nameEn: "",
      price: "1290",
    });
    expect(draftOf(LIST[3]!).price).toBe("0");
  });
  it("serviceProblems > given no name > then ยังไม่ได้ใส่ชื่อบริการ, and a ฿0 or empty price is fine", () => {
    expect(serviceProblems({ id: null, name: " ", nameEn: "", price: "0" }, LIST)).toEqual({
      name: { th: "ยังไม่ได้ใส่ชื่อบริการ", en: "Add the service name" },
    });
    expect(serviceProblems({ id: null, name: "ซ่อมพัดลม", nameEn: "", price: "" }, LIST)).toEqual(
      {},
    );
  });
  it("serviceProblems > given another service's name, any case > then มีบริการนี้แล้ว", () => {
    const said = serviceProblems({ id: null, name: " ล้างแอร์ ", nameEn: "", price: "750" }, LIST);
    expect(said.name?.th).toBe("มีบริการนี้แล้ว · แตะบริการเดิมเพื่อแก้ราคา");
    expect(serviceProblems({ ...draftOf(LIST[0]!), price: "750" }, LIST)).toEqual({});
  });
  it("serviceProblems > given a price that is not an amount > then it says so under the price", () => {
    expect(
      serviceProblems({ id: null, name: "ซ่อมพัดลม", nameEn: "", price: "1.2.3" }, LIST).price?.th,
    ).toBe("ใส่ราคาเป็นตัวเลข");
  });
  it("serviceBody > then trimmed names and satang, an empty price as ฿0", () => {
    expect(
      serviceBody({ id: null, name: " ซ่อมพัดลม ", nameEn: " Fan repair ", price: "1,250" }),
    ).toEqual({ name: "ซ่อมพัดลม", nameEn: "Fan repair", basePriceSatang: 125000 });
    expect(
      serviceBody({ id: null, name: "ซ่อมพัดลม", nameEn: "", price: "" }).basePriceSatang,
    ).toBe(0);
  });
  it("deleteTitle > then ลบบริการ name?", () => {
    expect(deleteTitle("ล้างแอร์").th).toBe("ลบบริการ ล้างแอร์?");
  });
});
