import { describe, expect, it, vi } from "vitest";
import { readImport, runImport, type ImportCalls } from "./customerImport";

const customerSheet = [
  ["ทะเบียน", "จังหวัด", "ชื่อลูกค้า", "เบอร์โทร"],
  ["1กก 1234", "กรุงเทพมหานคร", "สมชาย", "081"],
  ["2ขข 5678", "", "", ""],
  ["1กก 1234", "", "", ""],
];
const historySheet = [
  ["ทะเบียน", "วันที่", "รายการ"],
  ["1กก 1234", "12/08/2569", "ล้างแอร์"],
  ["1กก 1234", "02/06/2569", "คอมเพรสเซอร์"],
  ["3กก 9012", "02/06/2569", "ไดเออร์"],
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
});
