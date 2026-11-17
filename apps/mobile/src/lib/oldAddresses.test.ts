import { describe, expect, it } from "vitest";
import { addressOf, movedAddress, returnPath, signInAddress } from "./oldAddresses";

describe("movedAddress > an old back-office address", () => {
  it.each([
    ["/me", "/profile"],
    ["/settings/warranty", "/settings/attributes"],
    ["/settings/staff/salary", "/settings/staff?tab=pay"],
    ["/settings/staff/days-off", "/settings/staff?tab=off"],
    ["/settings/staff/activity", "/settings/staff?tab=history"],
    ["/login", "/sign-in"],
    ["/recover", "/sign-in"],
    ["/import", "/products/new"],
    ["/terms", "/settings/attributes"],
  ])("given %s > then it jumps to %s", (old, now) => {
    expect(movedAddress(old, {})).toBe(now);
  });

  it("given a trailing slash or an old month > then it still jumps", () => {
    expect(movedAddress("/me/", {})).toBe("/profile");
    expect(movedAddress("/settings/staff/salary", { month: "2026-10" })).toBe(
      "/settings/staff?tab=pay",
    );
  });

  it("given an old car link > then it opens that car", () => {
    expect(movedAddress("/customers", { plate: "1กก 1234" })).toBe(
      `/customers/${encodeURIComponent("1กก 1234")}`,
    );
  });

  it("given an old add-product link with a code > then the code is filled in", () => {
    expect(movedAddress("/products/new", { ref: "AC-CMP-01" })).toBe(
      "/products/new?code=AC-CMP-01",
    );
  });

  it("given a page this app has, or an address nobody knows > then it stays put", () => {
    expect(movedAddress("/customers", {})).toBeNull();
    expect(movedAddress("/customers/1กก 1234", { plate: "1กก 1234" })).toBeNull();
    expect(movedAddress("/products/new", { code: "AC-CMP-01" })).toBeNull();
    expect(movedAddress("/settings/staff", { tab: "pay" })).toBeNull();
    expect(movedAddress("/no-such-page", {})).toBeNull();
    expect(movedAddress("/", {})).toBeNull();
  });
});

describe("addressOf > the page's own address, to come back to after the PIN", () => {
  it("given a page with a tab > then the tab comes along", () => {
    expect(addressOf("/settings/staff", ["(app)", "settings", "staff"], { tab: "pay" })).toBe(
      "/settings/staff?tab=pay",
    );
  });

  it("given a page whose name is part of the address > then it is not repeated as a query", () => {
    expect(
      addressOf("/customers/1กก 1234", ["(app)", "customers", "[plate]"], { plate: "1กก 1234" }),
    ).toBe("/customers/1กก 1234");
    expect(addressOf("/me", ["(app)", "[...route]"], { route: ["me"] })).toBe("/me");
  });
});

describe("returnPath > where sign-in may send someone back to", () => {
  it("given a page of this app > then it goes back there", () => {
    expect(returnPath("/profile")).toBe("/profile");
    expect(returnPath("/settings/staff?tab=pay")).toBe("/settings/staff?tab=pay");
    expect(returnPath("/customers/1กก 1234")).toBe("/customers/1กก 1234");
    expect(returnPath(["/orders"])).toBe("/orders");
  });

  it("given anything that could lead off this app > then it is ignored", () => {
    expect(returnPath("//evil.example/x")).toBeNull();
    expect(returnPath("/\\evil.example")).toBeNull();
    expect(returnPath("https://evil.example")).toBeNull();
    expect(returnPath("javascript:alert(1)")).toBeNull();
    expect(returnPath("/orders\n/x")).toBeNull();
  });

  it("given nothing, หน้าหลัก or the sign-in page itself > then nothing to go back to", () => {
    expect(returnPath(undefined)).toBeNull();
    expect(returnPath("")).toBeNull();
    expect(returnPath("/")).toBeNull();
    expect(returnPath("/sign-in")).toBeNull();
    expect(returnPath("/sign-in?to=/orders")).toBeNull();
  });
});

describe("signInAddress > the PIN screen, from a page opened while signed out", () => {
  it("given the app was just opened on a page > then the PIN screen remembers it", () => {
    expect(signInAddress("/settings/staff?tab=pay", false)).toBe(
      `/sign-in?to=${encodeURIComponent("/settings/staff?tab=pay")}`,
    );
  });

  it("given someone signed out on purpose, or was on หน้าหลัก > then the next sign-in starts at หน้าหลัก", () => {
    expect(signInAddress("/profile", true)).toBe("/sign-in");
    expect(signInAddress("/", false)).toBe("/sign-in");
  });
});
