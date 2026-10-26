import { describe, expect, it } from "vitest";
import { pageTitle } from "./pageTitle";

describe("pageTitle", () => {
  it("given the home path > then it is Home", () => {
    expect(pageTitle("/")).toEqual({ th: "หน้าหลัก", en: "Home" });
  });

  it("given a menu page > then it is that menu link's name", () => {
    expect(pageTitle("/scan")).toEqual({ th: "สแกน", en: "Scan here" });
  });

  it("given a page under a menu link > then it takes the parent link's name", () => {
    expect(pageTitle("/customers/1กก1234")).toEqual({ th: "ลูกค้า", en: "Customers" });
  });

  it("given a path the menu does not know > then it says the page was not found", () => {
    expect(pageTitle("/nowhere")).toEqual({ th: "ไม่พบหน้านี้", en: "Page not found" });
  });
});
