import { describe, expect, it } from "vitest";
import { fetchInsights } from "./insightsApi";
import type { FetchFn } from "./signIn";

function replying(reply: () => Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    return reply();
  };
  return { calls, fetchFn };
}

const BODY = { period: "30d", sources: [], products: [] };

describe("fetchInsights", () => {
  it("given a period > then it asks for that period, signed in, and returns the page's numbers", async () => {
    const { calls, fetchFn } = replying(async () => Response.json(BODY));
    expect(await fetchInsights(fetchFn, "http://api", "tok", "30d")).toEqual(BODY);
    expect(calls.map((c) => c.url)).toEqual(["http://api/insights?period=30d"]);
    expect(JSON.stringify(calls[0]?.init?.headers)).toContain("tok");
  });

  it("given the server fails > then it says so instead of showing an empty page", async () => {
    const { fetchFn } = replying(async () => new Response("nope", { status: 500 }));
    await expect(fetchInsights(fetchFn, "http://api", "tok", "realtime")).rejects.toThrow();
  });
});
