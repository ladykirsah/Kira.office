import { describe, expect, it } from "vitest";
import { addProductPage, productPage, shopInfoPage } from "./oldBackOffice";

const BASE = "https://admin.example";

describe("old back office pages", () => {
  it("given a new code > then Add product opens with the code filled in", () => {
    expect(addProductPage(BASE, "8851234567898")).toBe(
      "https://admin.example/products/new?ref=8851234567898",
    );
  });

  it("given a code with spaces or symbols > then it reaches the page unchanged", () => {
    expect(addProductPage(BASE, "AP 10/46#2")).toBe(
      "https://admin.example/products/new?ref=AP%2010%2F46%232",
    );
  });

  it("given a product > then its own page opens", () => {
    expect(productPage(BASE, "p-1")).toBe("https://admin.example/products/p-1");
  });

  it("given no PromptPay account yet > then ไปที่ ข้อมูลร้าน opens the shop page", () => {
    expect(shopInfoPage(BASE)).toBe("https://admin.example/settings/shop");
  });
});
