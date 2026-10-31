import { describe, expect, it } from "vitest";
import {
  eraseAccount,
  fetchAccount,
  fetchAccounts,
  fetchCarList,
  fetchSummary,
  recalcAllCredit,
  setMarketing,
} from "./customersApi";
import type { FetchFn } from "./signIn";

function recording(reply: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    return reply();
  };
  return { calls, fetchFn };
}

describe("customersApi", () => {
  it("fetchCarList > searches the cars by what was typed", async () => {
    const { calls, fetchFn } = recording(async () =>
      Response.json({ customers: [{ licensePlate: "1กก" }] }),
    );
    expect(await fetchCarList(fetchFn, "http://api", "tok", " Altis ")).toEqual([
      { licensePlate: "1กก" },
    ]);
    expect(calls[0]?.url).toBe("http://api/customers?q=Altis");
  });

  it("fetchSummary > reads the เด่นแอร์ or AirPlus counts", async () => {
    const summary = { total: 126, activeThisMonth: 18, newThisMonth: 5, months: [] };
    const { calls, fetchFn } = recording(async () => Response.json(summary));
    expect(await fetchSummary(fetchFn, "http://api", "tok", "airplus")).toEqual(summary);
    await fetchSummary(fetchFn, "http://api", "tok", "shop");
    expect(calls.map((c) => c.url)).toEqual([
      "http://api/storefront-customers/summary",
      "http://api/customers/summary",
    ]);
  });

  it("fetchAccounts / fetchAccount > read the AirPlus list and one account", async () => {
    const { calls, fetchFn } = recording(async () =>
      Response.json({ customers: [], customer: null, orders: [] }),
    );
    await fetchAccounts(fetchFn, "http://api", "tok", "C-0412");
    await fetchAccount(fetchFn, "http://api", "tok", "a/1");
    expect(calls.map((c) => c.url)).toEqual([
      "http://api/storefront-customers?q=C-0412",
      "http://api/storefront-customers/a%2F1",
    ]);
  });

  it("setMarketing / eraseAccount / recalcAllCredit > send the account's changes", async () => {
    const { calls, fetchFn } = recording(async () => Response.json({ ok: true }));
    await setMarketing(fetchFn, "http://api", "tok", "a1", false);
    await eraseAccount(fetchFn, "http://api", "tok", "a1");
    await recalcAllCredit(fetchFn, "http://api", "tok");
    expect(calls.map((c) => [c.url, c.init?.method])).toEqual([
      ["http://api/storefront-customers/a1/marketing", "PUT"],
      ["http://api/storefront-customers/a1/anonymize", "POST"],
      ["http://api/storefront-customers/recalculate-credit-all", "POST"],
    ]);
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ optedIn: false });
  });

  it("a failed call > throws instead of showing an empty page", async () => {
    const { fetchFn } = recording(async () => new Response("no", { status: 500 }));
    await expect(fetchCarList(fetchFn, "http://api", "tok", "")).rejects.toThrow();
  });
});
