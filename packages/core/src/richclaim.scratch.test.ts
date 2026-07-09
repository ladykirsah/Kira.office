import { describe, it, expect } from "vitest";
import { parseRichSheet } from "./customerImport";

// Reviewer scenario (a): blank field col at index 8 BEFORE 'รายการ' at index 9 within ประวัติ group.
describe("reviewer scenario (a): blank field col before item anchor within group", () => {
  const rows: string[][] = [
    // group row: ประวัติ label carries the whole rest of the row (forward-fill)
    ["ทะเบียน", "", "รถยนต์", "", "", "ลูกค้า", "", "", "ประวัติ", "", "", "", ""],
    // field row: NOTE col 8 is BLANK (spacer), รายการ pushed to col 9, date moved to col 7? no—
    // keep วันที่ at 7? but 7 is in ลูกค้า group. Reproduce EXACTLY as claim: date somewhere, blank at 8.
    [
      "ตัวอักษรและตัวเลข", // 0 plate
      "จังหวัด", // 1 province
      "แบรนด์", // 2 car_brand
      "รุ่น", // 3 model
      "ปี", // 4 year
      "ชื่อ", // 5 name
      "เบอร์โทรศัพท์", // 6 phone
      "วันที่ (D/M/Y)", // 7 <-- date label but sits in ลูกค้า group span!
      "", // 8 BLANK spacer inside ประวัติ span
      "รายการ", // 9 item
      "แบรนด์สินค้า", // 10
      "รหัสสินค้า", // 11
      "หมายเหตุ", // 12
    ],
    ["1กก 1234", "กท", "Toyota", "Vigo", "2004", "สมชาย", "", "1/1/2025", "", "ตู้แอร์", "", "", ""],
  ];
  it("shows what actually happens", () => {
    const out = parseRichSheet(rows);
    console.log("customers", JSON.stringify(out.customers));
    console.log("history", JSON.stringify(out.history));
    console.log("errors", JSON.stringify(out.errors));
  });
});

// Cleaner repro that matches the claim's structure precisely: date is the FIRST ประวัติ col,
// then a blank spacer, then รายการ.
describe("reviewer scenario clean: date, blank, item all in ประวัติ group", () => {
  const rows: string[][] = [
    ["ทะเบียน", "รถยนต์", "ลูกค้า", "ประวัติ", "", "", ""],
    [
      "ตัวอักษรและตัวเลข", // 0 plate
      "แบรนด์", // 1 car_brand
      "ชื่อ", // 2 cust_name
      "วันที่", // 3 date (first ประวัติ col)
      "", // 4 BLANK spacer inside ประวัติ, before รายการ
      "รายการ", // 5 item anchor
      "หมายเหตุ", // 6 hist_note
    ],
    ["1กก 1234", "Toyota", "สมชาย", "1/1/2025", "", "ตู้แอร์", "note"],
  ];
  it("shows what actually happens", () => {
    const out = parseRichSheet(rows);
    console.log("CLEAN customers", JSON.stringify(out.customers));
    console.log("CLEAN history", JSON.stringify(out.history));
    console.log("CLEAN errors", JSON.stringify(out.errors));
  });
});

// Realistic BETWEEN-group spacer (visual separation), anchor is group's first field.
describe("realistic: spacer column BETWEEN groups (after each anchor)", () => {
  const rows: string[][] = [
    // spacer columns between each group (blank in group row too)
    ["ทะเบียน", "", "", "รถยนต์", "", "", "ลูกค้า", "", "", "ประวัติ", "", ""],
    [
      "ตัวอักษรและตัวเลข", // 0 plate
      "จังหวัด", // 1 province
      "", // 2 spacer (still ทะเบียน group)
      "แบรนด์", // 3 car_brand
      "รุ่น", // 4 model
      "", // 5 spacer (รถยนต์ group)
      "ชื่อ", // 6 cust_name
      "เบอร์โทรศัพท์", // 7 phone
      "", // 8 spacer (ลูกค้า group)
      "วันที่", // 9 date
      "รายการ", // 10 item
      "", // 11 spacer trailing (ประวัติ)
    ],
    ["1กก 1234", "กท", "", "Toyota", "Vigo", "", "สมชาย", "0812345678", "", "1/1/2025", "ตู้แอร์", ""],
  ];
  it("shows what actually happens with between-group spacers", () => {
    const out = parseRichSheet(rows);
    console.log("BTW customers", JSON.stringify(out.customers));
    console.log("BTW history", JSON.stringify(out.history));
    console.log("BTW errors", JSON.stringify(out.errors));
  });
});
