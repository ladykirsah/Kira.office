import { describe, expect, it } from "vitest";
import { shortcutTarget } from "./shortcut";

const LOCAL = "http://localhost:8788";

describe("shortcutTarget", () => {
  it("given the shortcut link on this computer > then it signs in and lands on Scan", () => {
    expect(shortcutTarget(LOCAL, { practice: "1" })).toBe("/scan");
  });

  it("given the shortcut link with a page named > then it lands on that page", () => {
    expect(shortcutTarget(LOCAL, { practice: "1", to: "/orders" })).toBe("/orders");
  });

  it("given the real shop's server > then there is no shortcut, whatever the link says", () => {
    expect(shortcutTarget("https://api.airplusauto.com", { practice: "1" })).toBeNull();
  });

  it("given a plain sign-in, with no shortcut asked for > then nothing happens on its own", () => {
    expect(shortcutTarget(LOCAL, {})).toBeNull();
    expect(shortcutTarget(LOCAL, { practice: "0" })).toBeNull();
  });

  it("given a page that leads off this app > then it lands on Scan instead", () => {
    expect(shortcutTarget(LOCAL, { practice: "1", to: "//evil.example/x" })).toBe("/scan");
    expect(shortcutTarget(LOCAL, { practice: "1", to: "https://evil.example" })).toBe("/scan");
  });
});
