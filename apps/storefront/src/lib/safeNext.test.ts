import { describe, expect, it } from "vitest";
import { safeNext } from "./safeNext";

describe("safeNext", () => {
  it("given a same-site path > then it is kept, with its query and anchor", () => {
    expect(safeNext("/account")).toBe("/account");
    expect(safeNext("/products?type=evap&ctx=cat#top")).toBe("/products?type=evap&ctx=cat#top");
  });

  it("given nothing > then the account page", () => {
    expect(safeNext(null)).toBe("/account");
    expect(safeNext(undefined)).toBe("/account");
    expect(safeNext("")).toBe("/account");
  });

  it("given another site > then the account page (bug hunt 15 Nov: open redirect)", () => {
    expect(safeNext("https://evil.example")).toBe("/account");
    expect(safeNext("//evil.example")).toBe("/account");
    // A backslash or a tab after the first slash is read by browsers as "//": another site.
    expect(safeNext("/\\evil.example")).toBe("/account");
    expect(safeNext("/\t/evil.example")).toBe("/account");
    expect(safeNext("/\n/evil.example")).toBe("/account");
  });

  it("given a path that becomes // once . and .. are cleaned up > then the account page", () => {
    // Each of these is read as "//evil.example" — another site — after the dots are resolved.
    expect(safeNext("/.//evil.example")).toBe("/account");
    expect(safeNext("/a/..//evil.example")).toBe("/account");
    expect(safeNext("/%2e//evil.example")).toBe("/account");
  });

  it("given a path that only looks odd > then it stays on this site", () => {
    expect(safeNext("/account/../orders")).toBe("/orders");
  });
});
