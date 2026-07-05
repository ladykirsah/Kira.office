import { describe, it, expect } from "vitest";
import { parseThaiDateMs } from "./thaiDate";

const bkk = (iso: string) => Date.parse(`${iso}T00:00:00+07:00`);

describe("parseThaiDateMs", () => {
  it("given abbreviated Thai month + 2-digit Buddhist year > parses to Bangkok midnight", () => {
    // Real samples from the shop's legacy per-car Excel files.
    expect(parseThaiDateMs("31 มีค 68")).toBe(bkk("2025-03-31"));
    expect(parseThaiDateMs("10 เมย 68")).toBe(bkk("2025-04-10"));
    expect(parseThaiDateMs("8 สค 68")).toBe(bkk("2025-08-08"));
    expect(parseThaiDateMs("9 พค 65")).toBe(bkk("2022-05-09"));
  });

  it("given dotted abbreviations and full month names > still parses", () => {
    expect(parseThaiDateMs("31 มี.ค. 68")).toBe(bkk("2025-03-31"));
    expect(parseThaiDateMs("9 พฤษภาคม 2565")).toBe(bkk("2022-05-09"));
  });

  it("given a 4-digit Buddhist year > converts (2568 → 2025)", () => {
    expect(parseThaiDateMs("31 มีค 2568")).toBe(bkk("2025-03-31"));
  });

  it("given numeric d/m/y with Buddhist years > parses (both 2- and 4-digit)", () => {
    expect(parseThaiDateMs("31/3/68")).toBe(bkk("2025-03-31"));
    expect(parseThaiDateMs("9/5/2565")).toBe(bkk("2022-05-09"));
  });

  it("given an ISO date > parses as Bangkok midnight (Christian year kept)", () => {
    expect(parseThaiDateMs("2025-03-31")).toBe(bkk("2025-03-31"));
  });

  it("given blank or garbage > returns null", () => {
    expect(parseThaiDateMs("")).toBeNull();
    expect(parseThaiDateMs("   ")).toBeNull();
    expect(parseThaiDateMs("ไม่ทราบ")).toBeNull();
    expect(parseThaiDateMs("31 xxx 68")).toBeNull();
  });
});
