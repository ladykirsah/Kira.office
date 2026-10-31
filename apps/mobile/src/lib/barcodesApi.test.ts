import { describe, expect, it } from "vitest";
import { readLabelShop } from "./barcodesApi";
import type { FetchFn } from "./signIn";

function replying(reply: () => Promise<Response>) {
  const urls: string[] = [];
  const fetchFn: FetchFn = async (url) => {
    urls.push(url);
    return reply();
  };
  return { urls, fetchFn };
}

describe("readLabelShop", () => {
  it("given เด่นแอร์'s shop details > then the name and phone the label prints", async () => {
    const { urls, fetchFn } = replying(async () =>
      Response.json({ name: " เด่นแอร์ เซอร์วิส ", phone: " 061 939 6144 ", address: "x" }),
    );
    expect(await readLabelShop(fetchFn, "http://api", "tok")).toEqual({
      name: "เด่นแอร์ เซอร์วิส",
      phone: "061 939 6144",
    });
    expect(urls).toEqual(["http://api/shop-info/denair"]);
  });

  it("given no phone saved yet > then an empty phone (the label leaves the line out)", async () => {
    const { fetchFn } = replying(async () => Response.json({ name: "เด่นแอร์", phone: null }));
    expect(await readLabelShop(fetchFn, "http://api", "tok")).toEqual({
      name: "เด่นแอร์",
      phone: "",
    });
  });

  it("given the server fails > then it says so instead of printing a blank shop", async () => {
    const { fetchFn } = replying(async () => new Response("nope", { status: 500 }));
    await expect(readLabelShop(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});
