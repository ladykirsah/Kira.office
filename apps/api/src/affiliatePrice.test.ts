import { describe, expect, it } from "vitest";
import { isLazadaLink, lazadaPriceFromHtml, priceFromLink } from "./affiliatePrice";

const PAGE = (price: string) =>
  `<html><head><title>SECO</title></head><body><script>var pdp={"tracking":{"pdt_name":"SECO","pdt_price":"${price}"}}</script></body></html>`;

type Call = { url: string; init?: RequestInit };

/** A fake network: each URL answers from the table; anything else is a test failure. */
function network(table: Record<string, () => Response>) {
  const calls: Call[] = [];
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    const answer = table[url];
    if (!answer) throw new Error(`unexpected fetch ${url}`);
    return answer();
  };
  return { calls, fetchFn };
}

const redirect = (to: string) => () =>
  new Response(null, { status: 302, headers: { location: to } });

describe("lazadaPriceFromHtml", () => {
  it("given a Lazada page > then it reads the price the page shows, as the shop writes it", () => {
    expect(lazadaPriceFromHtml(PAGE("฿1,965.00"))).toBe("฿1,965");
  });

  it("given a price with satang > then the satang stay", () => {
    expect(lazadaPriceFromHtml(PAGE("฿1,965.50"))).toBe("฿1,965.50");
  });

  it("given a page without a price > then there is none", () => {
    expect(lazadaPriceFromHtml("<html><body>captcha</body></html>")).toBeNull();
    expect(lazadaPriceFromHtml(PAGE(""))).toBeNull();
    expect(lazadaPriceFromHtml(PAGE("฿0.00"))).toBeNull();
  });
});

describe("isLazadaLink", () => {
  it("given Lazada Thailand https links > then yes", () => {
    expect(isLazadaLink("https://s.lazada.co.th/s.ZkQ2c")).toBe(true);
    expect(isLazadaLink("https://www.lazada.co.th/products/seco-i3078296105.html")).toBe(true);
    expect(isLazadaLink("  https://lazada.co.th/x  ")).toBe(true);
  });

  it("given anything else > then no", () => {
    expect(isLazadaLink("http://www.lazada.co.th/products/x.html")).toBe(false);
    expect(isLazadaLink("https://lazada.co.th.evil.example/x")).toBe(false);
    expect(isLazadaLink("https://notlazada.co.th/x")).toBe(false);
    expect(isLazadaLink("https://s.shopee.co.th/9zXa1")).toBe(false);
    expect(isLazadaLink("https://user@evil.example/?www.lazada.co.th")).toBe(false);
    expect(isLazadaLink("not a link")).toBe(false);
  });
});

describe("priceFromLink", () => {
  const SHORT = "https://s.lazada.co.th/s.ZkQ2c";
  const ITEM = "https://www.lazada.co.th/products/seco-i3078296105.html";

  it("given a Lazada short link > then it follows it to the item and returns the price", async () => {
    const { calls, fetchFn } = network({
      [SHORT]: redirect(ITEM),
      [ITEM]: () => new Response(PAGE("฿1,965.00")),
    });
    expect(await priceFromLink(fetchFn, SHORT)).toBe("฿1,965");
    expect(calls.map((c) => c.url)).toEqual([SHORT, ITEM]);
    // Each hop is checked before it is followed, never left to fetch.
    expect(calls.every((c) => c.init?.redirect === "manual")).toBe(true);
  });

  it("given a redirect away from Lazada > then it stops without opening that page", async () => {
    const { calls, fetchFn } = network({ [SHORT]: redirect("https://evil.example/") });
    expect(await priceFromLink(fetchFn, SHORT)).toBeNull();
    expect(calls).toHaveLength(1);
  });

  it("given a relative redirect > then it stays on the same Lazada host", async () => {
    const { fetchFn } = network({
      [ITEM]: redirect("/products/seco-i3078296105.html?x=1"),
      [`${ITEM}?x=1`]: () => new Response(PAGE("฿1,190.00")),
    });
    expect(await priceFromLink(fetchFn, ITEM)).toBe("฿1,190");
  });

  it("given endless redirects > then it gives up", async () => {
    const a = "https://www.lazada.co.th/a";
    const b = "https://www.lazada.co.th/b";
    const { calls, fetchFn } = network({ [a]: redirect(b), [b]: redirect(a) });
    expect(await priceFromLink(fetchFn, a)).toBeNull();
    expect(calls.length).toBeLessThanOrEqual(6);
  });

  it("given Lazada refuses, or the network fails > then there is no price, not an error", async () => {
    const refused = network({ [ITEM]: () => new Response("blocked", { status: 403 }) });
    expect(await priceFromLink(refused.fetchFn, ITEM)).toBeNull();
    const broken = async () => {
      throw new TypeError("network down");
    };
    expect(await priceFromLink(broken, ITEM)).toBeNull();
  });

  it("given a Shopee or other link > then it never asks the network", async () => {
    const { calls, fetchFn } = network({});
    expect(await priceFromLink(fetchFn, "https://s.shopee.co.th/9zXa1")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
