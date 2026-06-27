import { describe, it, expect } from "vitest";
import { buildWorkerProxyUrl, workerProxyForwardHeaders, ACCESS_JWT_HEADER } from "./workerProxy";

describe("buildWorkerProxyUrl", () => {
  it("joins path segments onto the API base", () => {
    expect(buildWorkerProxyUrl("https://api.example.com", ["products", "p1"], "")).toBe(
      "https://api.example.com/products/p1",
    );
  });

  it("preserves the query string", () => {
    expect(buildWorkerProxyUrl("https://api.example.com/", ["sales"], "?limit=5")).toBe(
      "https://api.example.com/sales?limit=5",
    );
  });
});

describe("workerProxyForwardHeaders", () => {
  it("forwards content-type and the Access JWT only", () => {
    const incoming = new Headers({
      "content-type": "application/json",
      [ACCESS_JWT_HEADER]: "jwt-token",
      host: "app.example.com",
    });
    const out = workerProxyForwardHeaders(incoming);
    expect(out.get("content-type")).toBe("application/json");
    expect(out.get(ACCESS_JWT_HEADER)).toBe("jwt-token");
    expect(out.get("host")).toBeNull();
  });
});
