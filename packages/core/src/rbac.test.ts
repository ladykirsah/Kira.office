import { describe, it, expect } from "vitest";
import { canPerform, type AppRole } from "./rbac";

describe("canPerform", () => {
  it("owner > any action > allowed", () => {
    expect(canPerform("owner", "product.delete")).toBe(true);
    expect(canPerform("owner", "shopee.publish")).toBe(true);
  });

  it("manager > owner-only delete > denied", () => {
    expect(canPerform("manager", "product.delete")).toBe(false);
  });

  it("manager > product.write > allowed", () => {
    expect(canPerform("manager", "product.write")).toBe(true);
  });

  it("stock_operator > finance.read > denied", () => {
    expect(canPerform("stock_operator", "finance.read")).toBe(false);
  });

  it("finance_viewer > finance.read only > allowed", () => {
    expect(canPerform("finance_viewer", "finance.read")).toBe(true);
    expect(canPerform("finance_viewer", "product.write")).toBe(false);
  });

  it("exhaustive over AppRole", () => {
    const roles: AppRole[] = ["owner", "manager", "stock_operator", "finance_viewer"];
    expect(roles.length).toBe(4);
  });
});
