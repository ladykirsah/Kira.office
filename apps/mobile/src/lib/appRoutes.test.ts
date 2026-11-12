import { describe, expect, it } from "vitest";
import { SHOP_INFO_ROUTE, addProductRoute, partRoute, productRoute } from "./appRoutes";

/**
 * Scan and การชำระเงิน used to hand over to the old back office for these pages. Since the new app
 * takes over admin.airplusauto.com (owner, 4 Nov 2026: "i want to swap for the old one"), they open
 * the app's own pages instead.
 */
describe("app routes", () => {
  it("addProductRoute > given a new code > เพิ่มสินค้า opens with the code filled in", () => {
    expect(addProductRoute("8851234567898")).toBe("/products/new?code=8851234567898");
  });

  it("addProductRoute > given spaces or symbols > the code reaches the page unchanged", () => {
    expect(addProductRoute("AP 10/46#2")).toBe("/products/new?code=AP%2010%2F46%232");
  });

  it("partRoute > given a scanned size > that size's own page opens (11 Nov 2026)", () => {
    expect(partRoute({ productId: "oring", variantId: "v 2", choiceValue: "1/2 กลาง" })).toBe(
      "/products/oring/choices/v%202",
    );
  });
  it("partRoute > given a part without sizes > the product's page opens", () => {
    expect(partRoute({ productId: "p-1", variantId: "v1" })).toBe("/products/p-1");
  });
  it("productRoute > given a product > its own page opens", () => {
    expect(productRoute("p-1")).toBe("/products/p-1");
  });

  it("SHOP_INFO_ROUTE > ไปที่ ข้อมูลร้าน opens the shop page", () => {
    expect(SHOP_INFO_ROUTE).toBe("/settings/shop");
  });
});
