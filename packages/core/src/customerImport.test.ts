import { describe, it, expect } from "vitest";
import {
  CUSTOMER_HISTORY_FIELDS,
  CUSTOMER_IMPORT_FIELDS,
  guessCustomerMapping,
  guessHistoryMapping,
  looksLikeCombinedSheet,
  looksLikeHistorySheet,
  splitCombinedSheet,
} from "./customerImport";

describe("guessCustomerMapping", () => {
  it("given typical Thai legacy headers > maps all six fields", () => {
    const headers = ["ทะเบียนรถ", "จังหวัด", "ชื่อลูกค้า", "เบอร์โทร", "รุ่นรถ", "หมายเหตุ"];
    expect(guessCustomerMapping(headers)).toEqual({
      license_plate: "ทะเบียนรถ",
      plate_province: "จังหวัด",
      customer_name: "ชื่อลูกค้า",
      phone: "เบอร์โทร",
      car_model: "รุ่นรถ",
      notes: "หมายเหตุ",
    });
  });

  it("given English headers > maps case-insensitively", () => {
    const headers = ["License Plate", "PROVINCE", "Customer Name", "Tel.", "Model", "Note"];
    expect(guessCustomerMapping(headers)).toEqual({
      license_plate: "License Plate",
      plate_province: "PROVINCE",
      customer_name: "Customer Name",
      phone: "Tel.",
      car_model: "Model",
      notes: "Note",
    });
  });

  it("given unrelated headers > maps nothing", () => {
    expect(guessCustomerMapping(["สินค้า", "ราคา", "Qty"])).toEqual({});
  });

  it("given a province header that also mentions ทะเบียน > plate prefers the header that starts with its synonym", () => {
    // "จังหวัดที่จดทะเบียน" contains ทะเบียน; the pure "ทะเบียน" column must win for plate, either order.
    expect(guessCustomerMapping(["จังหวัดที่จดทะเบียน", "ทะเบียน"])).toEqual({
      license_plate: "ทะเบียน",
      plate_province: "จังหวัดที่จดทะเบียน",
    });
    expect(guessCustomerMapping(["ทะเบียน", "จังหวัดที่จดทะเบียน"])).toEqual({
      license_plate: "ทะเบียน",
      plate_province: "จังหวัดที่จดทะเบียน",
    });
  });

  it("given a header matching two fields > each header is claimed once, by the higher-priority field", () => {
    // "Customer Phone" matches phone (priority) and customer_name; phone claims it, name stays unmapped.
    expect(guessCustomerMapping(["Customer Phone"])).toEqual({ phone: "Customer Phone" });
  });

  it("exports the six import fields with UI labels, plate first", () => {
    expect(CUSTOMER_IMPORT_FIELDS.map((f) => f.field)).toEqual([
      "license_plate",
      "plate_province",
      "customer_name",
      "phone",
      "car_model",
      "notes",
    ]);
    expect(CUSTOMER_IMPORT_FIELDS[0]?.label).toBe("License plate");
  });
});

describe("guessHistoryMapping", () => {
  it("given the history template headers > maps all three fields", () => {
    expect(guessHistoryMapping(["ทะเบียน", "วันที่", "รายการ"])).toEqual({
      license_plate: "ทะเบียน",
      happened_at: "วันที่",
      description: "รายการ",
    });
  });

  it("given English headers > maps case-insensitively", () => {
    expect(guessHistoryMapping(["Plate", "Date", "Description"])).toEqual({
      license_plate: "Plate",
      happened_at: "Date",
      description: "Description",
    });
  });

  it("exports the three history fields with UI labels, plate first", () => {
    expect(CUSTOMER_HISTORY_FIELDS.map((f) => f.field)).toEqual([
      "license_plate",
      "happened_at",
      "description",
    ]);
  });
});

describe("looksLikeHistorySheet", () => {
  it("history headers (plate + date + work text) > true", () => {
    expect(looksLikeHistorySheet(["ทะเบียน", "วันที่", "รายการ"])).toBe(true);
  });
  it("directory headers (no date/work columns) > false", () => {
    expect(looksLikeHistorySheet(["ทะเบียนรถ", "จังหวัด", "ชื่อลูกค้า", "เบอร์โทร"])).toBe(false);
  });
});

describe("splitCombinedSheet (one sheet, one block per customer)", () => {
  const HEADER = [
    "ทะเบียน",
    "จังหวัด",
    "ชื่อลูกค้า",
    "เบอร์โทร",
    "รุ่นรถ",
    "หมายเหตุ",
    "วันที่",
    "รายการ",
  ];

  it("splits customer blocks into a customers sheet and a history sheet (blank plate = same car)", () => {
    const rows = [
      HEADER,
      [
        "1กข 1234",
        "สุรินทร์",
        "สมชาย",
        "0812345678",
        "Vigo 2015",
        "",
        "31 มีค 68",
        "คอม508 ตู้432",
      ],
      ["", "", "", "", "", "", "10 เมย 68", "เบิกชนวนกันร้อน"],
      ["", "", "", "", "", "", "8 สค 68", "โอริงใหญ่"],
      ["2ขค 555", "", "สมหญิง", "", "Jazz 2014", "", "", ""],
    ];
    const out = splitCombinedSheet(rows);
    expect(out.customers).toEqual([
      ["ทะเบียน", "จังหวัด", "ชื่อลูกค้า", "เบอร์โทร", "รุ่นรถ", "หมายเหตุ"],
      ["1กข 1234", "สุรินทร์", "สมชาย", "0812345678", "Vigo 2015", ""],
      ["2ขค 555", "", "สมหญิง", "", "Jazz 2014", ""],
    ]);
    expect(out.history).toEqual([
      ["ทะเบียน", "วันที่", "รายการ"],
      ["1กข 1234", "31 มีค 68", "คอม508 ตู้432"],
      ["1กข 1234", "10 เมย 68", "เบิกชนวนกันร้อน"],
      ["1กข 1234", "8 สค 68", "โอริงใหญ่"],
    ]);
    // server errors on generated history rows must map back to the SHEET's row numbers
    expect(out.historySourceRows).toEqual([1, 2, 3]);
    expect(out.errors).toEqual([]);
  });

  it("merges customer info scattered across a block (first non-empty value wins per field)", () => {
    const rows = [
      HEADER,
      ["1กข 1234", "", "สมชาย", "", "", "", "31 มีค 68", "งาน A"],
      ["", "สุรินทร์", "", "0812345678", "", "", "", ""], // remembered details later
    ];
    const out = splitCombinedSheet(rows);
    expect(out.customers[1]).toEqual(["1กข 1234", "สุรินทร์", "สมชาย", "0812345678", "", ""]);
  });

  it("reports a history line with no car above it, and a date without items", () => {
    const rows = [
      HEADER,
      ["", "", "", "", "", "", "31 มีค 68", "งานลอย ไม่มีทะเบียน"],
      ["1กข 1234", "", "", "", "", "", "9 พค 65", ""],
    ];
    const out = splitCombinedSheet(rows);
    expect(out.errors).toEqual([
      { rowIndex: 1, reason: expect.stringContaining("ทะเบียน") },
      { rowIndex: 2, reason: expect.stringContaining("รายการ") },
    ]);
    expect(out.history).toHaveLength(1); // header only
  });
});

describe("looksLikeCombinedSheet", () => {
  it("true when the header carries BOTH customer info and history columns", () => {
    expect(
      looksLikeCombinedSheet([
        "ทะเบียน",
        "จังหวัด",
        "ชื่อลูกค้า",
        "เบอร์โทร",
        "รุ่นรถ",
        "หมายเหตุ",
        "วันที่",
        "รายการ",
      ]),
    ).toBe(true);
  });
  it("false for the plain history sheet and the plain customers sheet", () => {
    expect(looksLikeCombinedSheet(["ทะเบียน", "วันที่", "รายการ"])).toBe(false);
    expect(looksLikeCombinedSheet(["ทะเบียน", "จังหวัด", "ชื่อลูกค้า", "เบอร์โทร"])).toBe(false);
  });
});
