import { describe, it, expect } from "vitest";
import {
  buildWorkerProxyUrl,
  workerProxyForwardHeaders,
  workerProxyResponseHeaders,
  ACCESS_JWT_HEADER,
} from "./workerProxy";

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

describe("workerProxyResponseHeaders", () => {
  it("drops the encoding/length headers fetch() has already consumed, keeps the rest", () => {
    const upstream = new Headers({
      "content-type": "application/json",
      "content-encoding": "gzip",
      "content-length": "123",
      "transfer-encoding": "chunked",
      "access-control-allow-origin": "*",
    });
    const out = workerProxyResponseHeaders(upstream);
    // fetch() decompresses the body; forwarding these makes the browser re-decode plain
    // bytes (net::ERR_CONTENT_DECODING_FAILED on every proxied API response).
    expect(out.get("content-encoding")).toBeNull();
    expect(out.get("content-length")).toBeNull();
    expect(out.get("transfer-encoding")).toBeNull();
    expect(out.get("content-type")).toBe("application/json");
    expect(out.get("access-control-allow-origin")).toBe("*");
  });
});
