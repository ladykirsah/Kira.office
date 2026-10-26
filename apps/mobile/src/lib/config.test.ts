import { describe, expect, it } from "vitest";
import { isLocalApi } from "./config";

describe("isLocalApi", () => {
  it("given an API on this machine > offers the practice copy's one-click sign-in", () => {
    expect(isLocalApi("http://localhost:8788")).toBe(true);
    expect(isLocalApi("http://127.0.0.1:8788")).toBe(true);
  });

  it("given the real API, a look-alike host or garbage > never offers it", () => {
    expect(isLocalApi("https://api.airplusauto.com")).toBe(false);
    expect(isLocalApi("https://localhost.evil.example")).toBe(false);
    expect(isLocalApi("not a url")).toBe(false);
  });
});
