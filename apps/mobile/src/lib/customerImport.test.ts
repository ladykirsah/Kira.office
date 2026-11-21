import { describe, expect, it, vi } from "vitest";
import { readImport, runImport, type ImportCalls } from "./customerImport";

const customerSheet = [
  ["ทะเบียน", "จังหวัด", "ชื่อลูกค้า", "เบอร์โทร"],
  ["1กก 1234", "กรุงเทพมหานคร", "สมชาย", "081"],
  ["2ขข 5678", "", "", ""],
  ["1กก 1234", "", "", ""],
];
const historySheet = [
  ["ทะเบียน", "จังหวัด", "วันที่", "รายการ"],
  ["1กก 1234", "กรุงเทพมหานคร", "12/08/2569", "ล้างแอร์"],
  ["1กก 1234", "กรุงเทพมหานคร", "02/06/2569", "คอมเพรสเซอร์"],
  ["3กก 9012", "ขอนแก่น", "02/06/2569", "ไดเออร์"],
];
const richSheet = [
  ["ทะเบียน", "", "รถยนต์", "", "", "ลูกค้า", "", "", "ประวัติ", "", "", "", ""],
  [
    "ตัวอักษรและตัวเลข",
    "จังหวัด",
    "แบรนด์",
    "รุ่น",
    "ปี",
    "ชื่อ",
    "เบอร์โทรศัพท์",
    "หมายเหตุ",
    "วันที่ (D/M/Y)",
    "รายการ",
    "แบรนด์สินค้า",
    "รหัสสินค้า",
    "หมายเหตุ",
  ],
  [
    "1กก 1234",
    "เชียงใหม่",
    "Toyota",
    "Vigo",
    "",
    "สมชาย",
    "",
    "",
    "1/12/2025",
    "ตู้แอร์",
    "",
    "",
    "",
  ],
];

function calls(): ImportCalls {
  return {
    customers: vi.fn(async () => ({ created: 1, updated: 1, errors: [] })),
    history: vi.fn(async () => ({ imported: 3, errors: [] })),
    visits: vi.fn(async () => ({ imported: 0, errors: [] })),
  };
}

describe("readImport", () => {
  it("given a customer list > then how many different cars it holds", () => {
    expect(readImport(customerSheet)).toEqual({
      kind: "customers",
      cars: 2,
      visits: 0,
      problem: null,
    });
  });
  it("given a service-history file > then its cars and visits", () => {
    expect(readImport(historySheet)).toMatchObject({ kind: "history", cars: 2, visits: 3 });
  });
  it("given no plate column > then a plain problem, nothing to import", () => {
    const r = readImport([["ชื่อ"], ["สมชาย"]]);
    expect(r.problem?.th).toBe("ไม่พบคอลัมน์ทะเบียนในไฟล์นี้");
  });
  it("given a customer list with no province column > then a plain problem (plan 13.11: a car is plate + province)", () => {
    const r = readImport([
      ["ทะเบียน", "ชื่อลูกค้า"],
      ["1กก 1234", "สมชาย"],
    ]);
    expect(r.problem?.th).toBe("ไฟล์นี้ไม่มีคอลัมน์จังหวัด");
  });
  it("given a history file with no province column > then a plain problem", () => {
    const r = readImport([
      ["ทะเบียน", "วันที่", "รายการ"],
      ["1กก 1234", "12/08/2569", "ล้างแอร์"],
    ]);
    expect(r.problem?.th).toBe("ไฟล์ประวัติต้องมีคอลัมน์ ทะเบียน จังหวัด วันที่ และรายการ");
  });
  it("given only a header > then the file has no data", () => {
    expect(readImport([["ทะเบียน"]]).problem?.th).toBe("ไฟล์นี้ไม่มีข้อมูล");
  });
});

describe("runImport", () => {
  it("given a customer list > then it goes to the customer import with the guessed columns", async () => {
    const c = calls();
    const out = await runImport(c, customerSheet);
    expect(c.customers).toHaveBeenCalledTimes(1);
    const [, mapping] = vi.mocked(c.customers).mock.calls[0]!;
    expect(mapping).toMatchObject({ license_plate: "ทะเบียน" });
    expect(out).toEqual({ cars: 2, visits: 0, failedRows: 0 });
  });
  it("given a history file > then it goes to the history import", async () => {
    const c = calls();
    const out = await runImport(c, historySheet);
    expect(c.history).toHaveBeenCalledTimes(1);
    expect(c.customers).not.toHaveBeenCalled();
    expect(out).toEqual({ cars: 0, visits: 3, failedRows: 0 });
  });
  it("given the grouped form > then each visit carries its car's province (plan 13.11)", async () => {
    const c = calls();
    await runImport(c, richSheet);
    const [visits] = vi.mocked(c.visits).mock.calls[0]!;
    expect(visits.map((v) => [v.licensePlate, v.plateProvince])).toEqual([
      ["1กก 1234", "เชียงใหม่"],
    ]);
  });
});
