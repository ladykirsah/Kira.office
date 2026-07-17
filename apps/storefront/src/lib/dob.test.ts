import { describe, it, expect } from "vitest";
import { toDobIso, daysInBeMonth } from "./dob";

describe("toDobIso", () => {
  it("given all three parts > converts the Buddhist year and zero-pads (พ.ศ. 2540 → 1997)", () => {
    expect(toDobIso("2540", "3", "20")).toBe("1997-03-20");
    expect(toDobIso("2547", "1", "1")).toBe("2004-01-01");
    expect(toDobIso("2543", "12", "31")).toBe("2000-12-31");
  });

  it("given any part unchosen > returns '' (incomplete is not invalid)", () => {
    expect(toDobIso("", "3", "20")).toBe("");
    expect(toDobIso("2540", "", "20")).toBe("");
    expect(toDobIso("2540", "3", "")).toBe("");
    expect(toDobIso("", "", "")).toBe("");
  });
});

describe("daysInBeMonth", () => {
  it("given a month > returns its real length", () => {
    expect(daysInBeMonth("2540", "1")).toBe(31); // ม.ค.
    expect(daysInBeMonth("2540", "4")).toBe(30); // เม.ย.
    expect(daysInBeMonth("2540", "12")).toBe(31); // ธ.ค.
  });

  it("given กุมภาพันธ์ > respects leap years in the Christian year (พ.ศ. − 543)", () => {
    expect(daysInBeMonth("2567", "2")).toBe(29); // 2024 CE — leap
    expect(daysInBeMonth("2568", "2")).toBe(28); // 2025 CE — not leap
    expect(daysInBeMonth("2543", "2")).toBe(29); // 2000 CE — leap (÷400)
    expect(daysInBeMonth("2443", "2")).toBe(28); // 1900 CE — NOT leap (÷100, not ÷400)
  });

  it("given an unchosen year or month > falls back to 31", () => {
    expect(daysInBeMonth("", "2")).toBe(31);
    expect(daysInBeMonth("2540", "")).toBe(31);
  });
});
