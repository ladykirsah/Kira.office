import { describe, expect, it } from "vitest";
import { rowSizeCode, sizeCode } from "./sizeLine";

describe("sizeCode > the grey size tag in front of the code, on every row (owner's pick A, 11 Nov 2026)", () => {
  it("given a size with its own code > then its value as the tag and its own code", () => {
    expect(
      sizeCode({
        choiceValue: "1/2 กลาง",
        choiceCode: "TG949142-00204D",
        productRef: "TG949142-00104D",
      }),
    ).toEqual({ tag: "1/2 กลาง", code: "TG949142-00204D" });
  });

  it("given a product without sizes > then no tag and the product's code", () => {
    expect(sizeCode({ choiceValue: null, choiceCode: null, productRef: "DN-447220" })).toEqual({
      tag: null,
      code: "DN-447220",
    });
  });

  it("given a size that has no code of its own yet > then the product's code stands in", () => {
    expect(
      sizeCode({ choiceValue: "5/8 ใหญ่", choiceCode: " ", productRef: "TG949142-00104D" }),
    ).toEqual({
      tag: "5/8 ใหญ่",
      code: "TG949142-00104D",
    });
  });

  it("given a blank size value > then no tag", () => {
    expect(sizeCode({ choiceValue: "  ", productRef: "DN-447220" }).tag).toBeNull();
  });

  it("given no code at all (an old record) > then no code, never an empty one", () => {
    expect(sizeCode({ productRef: "" })).toEqual({ tag: null, code: null });
  });
});

describe("rowSizeCode > the per-size product list's row (ทำบิล, labels, แฟลชเซล pick lists)", () => {
  it("given a size row > then its value and its own code", () => {
    expect(rowSizeCode({ optionValue: "3/8 เล็ก", code: "TG-001", productRef: "TG-001" })).toEqual({
      tag: "3/8 เล็ก",
      code: "TG-001",
    });
  });
  it("given a product without sizes > then its own code, no tag", () => {
    expect(rowSizeCode({ optionValue: null, code: "X", productRef: "DN-447220" })).toEqual({
      tag: null,
      code: "DN-447220",
    });
  });
});
