import { describe, it, expect } from "vitest";
import { buildCheckoutCustomerUpsert } from "./checkout";

describe("buildCheckoutCustomerUpsert", () => {
  it("builds a plate+province upsert, trimming both", () => {
    expect(buildCheckoutCustomerUpsert({ plate: " 6ฉฉ2345 ", province: " สุรินทร์ " })).toEqual({
      licensePlate: "6ฉฉ2345",
      plateProvince: "สุรินทร์",
    });
  });

  it("returns null when there is no plate to key on", () => {
    expect(buildCheckoutCustomerUpsert({ plate: "   ", province: "สุรินทร์" })).toBeNull();
  });

  it("returns null when no province was entered (nothing to enrich)", () => {
    expect(buildCheckoutCustomerUpsert({ plate: "6ฉฉ2345", province: "  " })).toBeNull();
  });
});
