import { describe, it, expect } from "vitest";
import { CUSTOMER_IMPORT_FIELDS, guessCustomerMapping } from "./customerImport";

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
