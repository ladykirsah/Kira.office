import { describe, expect, it } from "vitest";
import { drawerFor } from "./menuDrawer";

const hrefs = (d: ReturnType<typeof drawerFor>) =>
  d.groups.flatMap((g) => g.links.map((l) => l.href));
const lit = (d: ReturnType<typeof drawerFor>) =>
  d.groups.flatMap((g) => g.links.filter((l) => l.on).map((l) => l.href));

describe("drawerFor (☰ menu, design C)", () => {
  it("given the owner on หน้าหลัก > then หน้าหลัก is lit and every one of the 20 pages is listed", () => {
    const d = drawerFor("super_admin", "/");

    expect(d.home.on).toBe(true);
    expect(d.groups.map((g) => g.section.th)).toEqual([
      "งานประจำวัน",
      "สต็อก",
      "การตลาด AirPlus",
      "การจัดการทั่วไป",
    ]);
    expect(hrefs(d)).toHaveLength(20);
    expect(lit(d)).toEqual([]);
  });

  it("given a page under a menu page > then that page is lit and หน้าหลัก is not", () => {
    const d = drawerFor("super_admin", "/settings/coupons/c-1");

    expect(d.home.on).toBe(false);
    expect(lit(d)).toEqual(["/settings/coupons"]);
  });

  it("given เพิ่มสินค้า > then only เพิ่มสินค้า is lit, not สินค้า too", () => {
    expect(lit(drawerFor("super_admin", "/products/new"))).toEqual(["/products/new"]);
  });

  it("given a mechanic > then the pages a mechanic may not open are absent", () => {
    const d = drawerFor("mechanic", "/scan");

    expect(hrefs(d)).not.toContain("/sales");
    expect(hrefs(d)).not.toContain("/settings/coupons");
    expect(hrefs(d)).toContain("/scan");
    expect(lit(d)).toEqual(["/scan"]);
  });
});
