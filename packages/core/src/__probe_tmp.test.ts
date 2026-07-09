import { describe, it, expect } from "vitest";
import { looksLikeRichSheet } from "./customerImport";
const fieldRow = ["ตัวอักษรและตัวเลข","จังหวัด","แบรนด์","รุ่น","ปี","ชื่อ","เบอร์โทรศัพท์","หมายเหตุ","วันที่ (D/M/Y)","รายการ","แบรนด์สินค้า","รหัสสินค้า","หมายเหตุ"];
describe("probe", () => {
  it("real bare labels -> true", () => {
    const g = ["ทะเบียน","","รถยนต์","","","ลูกค้า","","","ประวัติ","","","",""];
    expect(looksLikeRichSheet([["Import Customers"],[""],g,fieldRow])).toBe(true);
  });
  it("fabricated variant labels -> false", () => {
    const g = ["ทะเบียนรถ","","รถยนต์","","","ลูกค้า","","","ประวัติการซ่อม","","","",""];
    expect(looksLikeRichSheet([["Import Customers"],[""],g,fieldRow])).toBe(false);
  });
});
