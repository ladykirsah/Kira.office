import { describe, it, expect } from "vitest";
import {
  bangkokDay,
  branchLabel,
  nextTaxDocNumber,
  normalizeTaxId,
  shopTaxMissing,
  taxBuyerProblem,
  taxIdProblem,
  vatBillingOn,
} from "./taxDocs";

// VAT billing (plan 10.2, owner 17 Nov 2026): B2C → cash bill; B2B → cash bill or tax invoice,
// picked per sale, the company's details kept in a book. Practice IDs below are made up; only their
// check digit is real.

describe("taxIdProblem > the 13-digit tax ID", () => {
  it("given a valid ID, with or without dashes and spaces > then fine", () => {
    expect(taxIdProblem("1234567890121")).toBeNull();
    expect(taxIdProblem("0-1055-36000-31-3")).toBeNull();
    expect(taxIdProblem(" 3101000000005 ")).toBeNull();
  });

  it("given the wrong length or letters > then 13 digits are asked for", () => {
    expect(taxIdProblem("123456789012")).toBe("tax ID must be 13 digits");
    expect(taxIdProblem("12345678901ab")).toBe("tax ID must be 13 digits");
    expect(taxIdProblem("")).toBe("tax ID must be 13 digits");
  });

  it("given a typo that breaks the check digit > then refused", () => {
    expect(taxIdProblem("1234567890122")).toBe("tax ID check digit is wrong");
  });

  it("normalizeTaxId > keeps the digits only", () => {
    expect(normalizeTaxId("0-1055-36000-31-3")).toBe("0105536000313");
  });
});

describe("branchLabel > สำนักงานใหญ่ or สาขาที่", () => {
  it("given 00000 or blank > then head office; a number > then that branch", () => {
    expect(branchLabel("00000")).toEqual({ th: "สำนักงานใหญ่", en: "Head office" });
    expect(branchLabel("")).toEqual({ th: "สำนักงานใหญ่", en: "Head office" });
    expect(branchLabel("00002")).toEqual({ th: "สาขาที่ 00002", en: "Branch 00002" });
  });
});

describe("vatBillingOn > the shop's switch", () => {
  it("given never set > then on (Den Air is VAT-registered; today's bills already carry VAT)", () => {
    expect(vatBillingOn(null)).toBe(true);
    expect(vatBillingOn("")).toBe(true);
    expect(vatBillingOn("on")).toBe(true);
  });

  it("given switched off > then off", () => {
    expect(vatBillingOn("off")).toBe(false);
  });
});

describe("shopTaxMissing > what the shop must fill in before a tax invoice", () => {
  const full = {
    taxId: "1234567890121",
    taxName: "บริษัท เด่นแอร์ เซอร์วิส จำกัด",
    taxAddress: "1 ถนนตัวอย่าง กรุงเทพฯ 10110",
    taxBranch: "",
  };

  it("given everything > then nothing missing (blank branch = head office)", () => {
    expect(shopTaxMissing(full)).toEqual([]);
  });

  it("given gaps or a bad ID > then each is named", () => {
    expect(shopTaxMissing({ ...full, taxName: " ", taxAddress: "" })).toEqual([
      "taxName",
      "taxAddress",
    ]);
    expect(shopTaxMissing({ ...full, taxId: "1234567890122" })).toEqual(["taxId"]);
    expect(shopTaxMissing({ ...full, taxBranch: "12" })).toEqual(["taxBranch"]);
  });
});

describe("taxBuyerProblem > a company in the book", () => {
  const company = {
    name: "บริษัท ขนส่งตัวอย่าง จำกัด",
    taxId: "0105536000313",
    branch: "00000",
    address: "99 ถนนตัวอย่าง เชียงใหม่ 50000",
  };

  it("given name, tax ID, branch and address > then fine", () => {
    expect(taxBuyerProblem(company)).toBeNull();
    expect(taxBuyerProblem({ ...company, branch: undefined })).toBeNull();
  });

  it("given a gap > then the first one is named", () => {
    expect(taxBuyerProblem({ ...company, name: "" })).toBe("company name is required");
    expect(taxBuyerProblem({ ...company, taxId: "123" })).toBe("tax ID must be 13 digits");
    expect(taxBuyerProblem({ ...company, branch: "1" })).toBe("branch must be 5 digits");
    expect(taxBuyerProblem({ ...company, address: " " })).toBe("address is required");
  });
});

describe("nextTaxDocNumber > made by the server, Thai month, no gaps", () => {
  // 30 Nov 2026 23:30 in Bangkok = 16:30 UTC — still November in Thailand.
  const lateNov = Date.UTC(2026, 10, 30, 16, 30);

  it("given no document yet this month > then 0001", () => {
    expect(nextTaxDocNumber("TI", [], lateNov)).toBe("TI202611-0001");
    expect(nextTaxDocNumber("CN", [], lateNov)).toBe("CN202611-0001");
  });

  it("given this month's numbers > then one after the highest of the same kind", () => {
    expect(
      nextTaxDocNumber(
        "TI",
        ["TI202611-0007", "TI202611-0012", "TI202610-0099", "CN202611-0040"],
        lateNov,
      ),
    ).toBe("TI202611-0013");
  });

  it("given just after midnight on 1 Dec in Bangkok > then December starts at 0001", () => {
    const firstDec = Date.UTC(2026, 10, 30, 17, 5);
    expect(nextTaxDocNumber("TI", ["TI202611-0013"], firstDec)).toBe("TI202612-0001");
  });
});

describe("bangkokDay > the Thai calendar day", () => {
  it("given 23:30 and 00:05 in Bangkok > then the day each falls on there", () => {
    expect(bangkokDay(Date.UTC(2026, 10, 17, 16, 30))).toBe("2026-11-17");
    expect(bangkokDay(Date.UTC(2026, 10, 17, 17, 5))).toBe("2026-11-18");
  });
});
