import { describe, it, expect } from "vitest";
import {
  buildWorkerProxyUrl,
  workerProxyForwardHeaders,
  workerProxyResponseHeaders,
  fetchUpstream,
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

describe("fetchUpstream", () => {
  // The admin proxy's fetch() had no catch: one transient upstream blip surfaced to the owner as a
  // bare Next.js 500 on /banners, /shop-info and /payments. The API Worker logged Errors: 0 across
  // those same hours, which is what proves the request died in the hop rather than at the API.
  const ok = () => new Response('{"ok":true}', { status: 200 });

  it("given upstream resolves > passes the response straight through", async () => {
    const res = await fetchUpstream(async () => ok(), "https://api.example.com/banners", {}, "GET");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
  });

  it("given upstream returns 4xx/5xx > passes it through untouched, does NOT retry", async () => {
    // A real 401 from the API is a legitimate answer — retrying it would double every auth failure.
    let calls = 0;
    const res = await fetchUpstream(
      async () => {
        calls++;
        return new Response('{"error":"unauthorized"}', { status: 401 });
      },
      "https://api.example.com/banners",
      {},
      "GET",
    );
    expect(res.status).toBe(401);
    expect(calls).toBe(1);
  });

  it("given a GET that throws once > retries and returns the second attempt", async () => {
    let calls = 0;
    const res = await fetchUpstream(
      async () => {
        calls++;
        if (calls === 1) throw new TypeError("network error");
        return ok();
      },
      "https://api.example.com/banners",
      {},
      "GET",
    );
    expect(calls).toBe(2);
    expect(res.status).toBe(200);
  });

  it("given a GET that throws every time > answers 502, never throws", async () => {
    const res = await fetchUpstream(
      async () => {
        throw new TypeError("network error");
      },
      "https://api.example.com/banners",
      {},
      "GET",
    );
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: "upstream_unreachable" });
  });

  it("given a POST that throws > does NOT retry, so a failed order can't be submitted twice", async () => {
    let calls = 0;
    const res = await fetchUpstream(
      async () => {
        calls++;
        throw new TypeError("network error");
      },
      "https://api.example.com/orders",
      {},
      "POST",
    );
    expect(calls).toBe(1);
    expect(res.status).toBe(502);
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
