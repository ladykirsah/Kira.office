import { describe, it, expect } from "vitest";
import {
  isDocStage,
  canConvert,
  isEditable,
  countsAsRevenue,
  deductsStock,
  numberPrefixFor,
} from "./onsiteDoc";

describe("isDocStage", () => {
  it("recognises the three stages and rejects anything else", () => {
    expect(isDocStage("draft")).toBe(true);
    expect(isDocStage("quotation")).toBe(true);
    expect(isDocStage("bill")).toBe(true);
    expect(isDocStage("void")).toBe(false);
    expect(isDocStage("")).toBe(false);
  });
});

describe("canConvert", () => {
  it("given a draft > can become a quotation or a bill", () => {
    expect(canConvert("draft", "quotation")).toBe(true);
    expect(canConvert("draft", "bill")).toBe(true);
  });

  it("given a quotation > can convert to a bill", () => {
    expect(canConvert("quotation", "bill")).toBe(true);
  });

  it("given a bill > is terminal", () => {
    expect(canConvert("bill", "quotation")).toBe(false);
    expect(canConvert("bill", "draft")).toBe(false);
  });

  it("cannot convert into a draft, or to the same stage", () => {
    expect(canConvert("quotation", "draft")).toBe(false);
    expect(canConvert("draft", "draft")).toBe(false);
    expect(canConvert("quotation", "quotation")).toBe(false);
  });
});

describe("isEditable", () => {
  it("drafts and quotations are editable; a bill is locked", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("quotation")).toBe(true);
    expect(isEditable("bill")).toBe(false);
  });
});

describe("countsAsRevenue", () => {
  it("given a completed bill > is revenue", () => {
    expect(countsAsRevenue("bill", "completed")).toBe(true);
  });

  it("drafts, quotations, and refunded bills are not revenue", () => {
    expect(countsAsRevenue("draft", "completed")).toBe(false);
    expect(countsAsRevenue("quotation", "completed")).toBe(false);
    expect(countsAsRevenue("bill", "refunded")).toBe(false);
  });
});

describe("deductsStock", () => {
  it("only a bill deducts stock", () => {
    expect(deductsStock("bill")).toBe(true);
    expect(deductsStock("draft")).toBe(false);
    expect(deductsStock("quotation")).toBe(false);
  });
});

describe("numberPrefixFor", () => {
  it("quotation → QT, bill → DAS, draft → none", () => {
    expect(numberPrefixFor("quotation")).toBe("QT");
    expect(numberPrefixFor("bill")).toBe("DAS");
    expect(numberPrefixFor("draft")).toBeNull();
  });
});
