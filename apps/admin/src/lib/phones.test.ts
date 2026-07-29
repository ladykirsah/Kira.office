import { describe, it, expect } from "vitest";
import { joinPhones, splitPhones } from "./phones";

describe("joinPhones", () => {
  it("joins several numbers into the single phone column", () => {
    expect(joinPhones(["081-234-5678", "02-111-2222"])).toBe("081-234-5678, 02-111-2222");
  });

  it("trims each number and drops the empty rows", () => {
    expect(joinPhones([" 081-234-5678 ", "", "   ", "02-111-2222"])).toBe(
      "081-234-5678, 02-111-2222",
    );
  });

  it("drops a number typed twice", () => {
    expect(joinPhones(["081-234-5678", "081-234-5678"])).toBe("081-234-5678");
  });

  it("given nothing to save > returns an empty string", () => {
    expect(joinPhones([])).toBe("");
    expect(joinPhones(["", "  "])).toBe("");
  });
});

describe("splitPhones", () => {
  it("reads the stored column back as separate numbers", () => {
    expect(splitPhones("081-234-5678, 02-111-2222")).toEqual(["081-234-5678", "02-111-2222"]);
  });

  it("copes with untidy separators from the Excel import", () => {
    expect(splitPhones("081-234-5678,,  02-111-2222 ")).toEqual(["081-234-5678", "02-111-2222"]);
  });

  it("given nothing stored > returns no numbers", () => {
    expect(splitPhones("")).toEqual([]);
    expect(splitPhones(null)).toEqual([]);
  });

  it("survives a round trip", () => {
    const numbers = ["081-234-5678", "02-111-2222"];
    expect(splitPhones(joinPhones(numbers))).toEqual(numbers);
  });
});
