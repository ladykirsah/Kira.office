import { describe, expect, it } from "vitest";
import {
  addPart,
  deletePart,
  fetchPartsSetup,
  removePicture,
  renamePart,
  setCategorySystem,
  setDescription,
  setTerms,
  setWarranty,
  uploadPicture,
} from "./partsSetupApi";
import { session } from "./scanApi";
import type { FetchFn } from "./signIn";

function replying(status: number, body: unknown) {
  const calls: {
    url: string;
    method: string;
    auth: string | null;
    type: string | null;
    body: unknown;
  }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method: init?.method ?? "GET",
      auth: headers.get(Object.keys(session("x"))[0]!),
      type: headers.get("content-type"),
      body: init?.body instanceof Blob ? "blob" : init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchFn };
}

const SERVER = {
  brands: [
    {
      id: "br-denso",
      name: "DENSO",
      nameTh: "เดนโซ่",
      nameEn: null,
      imageKey: null,
      productCount: 86,
    },
  ],
  systems: [{ id: "uc-ac", name: "A/C", nameTh: "แอร์", nameEn: "A/C" }],
  categories: [
    {
      id: "pt-evap",
      name: "Evaporator",
      nameTh: "ตู้แอร์",
      nameEn: null,
      usageId: "uc-ac",
      warrantyDays: 365,
      imageKey: null,
      description: "x",
      terms: "สินค้า: {{product_name}}",
      sample: { name: "Evap A", brand: "DENSO", description: null },
      productCount: 40,
    },
  ],
};

describe("partsSetupApi", () => {
  it("fetchPartsSetup > GET /parts-setup behind the session; the English name falls back to the identity", async () => {
    const { calls, fetchFn } = replying(200, SERVER);
    const out = await fetchPartsSetup(fetchFn, "https://api", "tok");
    expect(calls[0]).toMatchObject({ url: "https://api/parts-setup", method: "GET", auth: "tok" });
    expect(out.brands[0]).toEqual({
      id: "br-denso",
      name: "DENSO",
      nameTh: "เดนโซ่",
      nameEn: "DENSO",
      imageKey: null,
      productCount: 86,
    });
    expect(out.systems[0]).toEqual({ id: "uc-ac", name: "A/C", nameTh: "แอร์", nameEn: "A/C" });
    expect(out.categories[0]).toMatchObject({
      nameEn: "Evaporator",
      systemId: "uc-ac",
      description: "x",
      terms: "สินค้า: {{product_name}}",
      sample: { name: "Evap A", brand: "DENSO", description: null },
    });
  });

  it("fetchPartsSetup > server down > throws with its words", async () => {
    const { fetchFn } = replying(500, { error: "boom" });
    await expect(fetchPartsSetup(fetchFn, "https://api", "tok")).rejects.toThrow("boom");
  });

  it("addPart > POST /attributes/<server kind> with the English name as the identity", async () => {
    const { calls, fetchFn } = replying(201, { id: "n1", name: "Cooling" });
    expect(
      await addPart(fetchFn, "https://api", "tok", "system", {
        nameEn: " Cooling ",
        nameTh: "ระบบหล่อเย็น",
      }),
    ).toBe("n1");
    expect(calls[0]).toMatchObject({
      url: "https://api/attributes/usage",
      method: "POST",
      body: { name: "Cooling", nameEn: "Cooling", nameTh: "ระบบหล่อเย็น" },
    });
    await addPart(fetchFn, "https://api", "tok", "category", {
      nameEn: "Switch",
      nameTh: "",
      systemId: "uc-ac",
    });
    expect(calls[1]).toMatchObject({
      url: "https://api/attributes/type",
      body: { name: "Switch", nameEn: "Switch", nameTh: null, usageId: "uc-ac" },
    });
  });

  it("renamePart > PATCH both names (the server writes both every time)", async () => {
    const { calls, fetchFn } = replying(200, { ok: true });
    await renamePart(fetchFn, "https://api", "tok", "brand", "br 1", {
      nameEn: "DENSO",
      nameTh: "",
    });
    expect(calls[0]).toMatchObject({
      url: "https://api/attributes/brand/br%201",
      method: "PATCH",
      body: { nameEn: "DENSO", nameTh: null },
    });
  });

  it("deletePart > 200 = deleted; 409 = still in use", async () => {
    const ok = replying(200, { ok: true });
    expect(await deletePart(ok.fetchFn, "https://api", "tok", "category", "pt-1")).toBe("deleted");
    expect(ok.calls[0]).toMatchObject({
      url: "https://api/attributes/type/pt-1",
      method: "DELETE",
    });
    const busy = replying(409, { error: "still used by 2 product(s)", count: 2 });
    expect(await deletePart(busy.fetchFn, "https://api", "tok", "brand", "br-1")).toBe("in-use");
  });

  it("category settings > PUT system, warranty, description and เงื่อนไข", async () => {
    const { calls, fetchFn } = replying(200, { ok: true });
    await setCategorySystem(fetchFn, "https://api", "tok", "pt-1", "uc-ac");
    await setWarranty(fetchFn, "https://api", "tok", "pt-1", 0);
    await setDescription(fetchFn, "https://api", "tok", "pt-1", "a\n\nb");
    await setTerms(fetchFn, "https://api", "tok", "pt-1", "{{brand}}");
    expect(calls.map((c) => [c.url, c.method, c.body])).toEqual([
      ["https://api/product-types/pt-1/car-system", "PUT", { usageId: "uc-ac" }],
      ["https://api/product-types/pt-1/warranty", "PUT", { warrantyDays: null }],
      ["https://api/product-types/pt-1/description", "PUT", { description: "a\n\nb" }],
      ["https://api/product-types/pt-1/terms", "PUT", { terms: "{{brand}}" }],
    ]);
  });

  it("uploadPicture > PUT the photo's bytes with its type; 400 = wrong-picture", async () => {
    const photo = new Blob([new Uint8Array([1, 2])], { type: "image/png" });
    const { calls, fetchFn } = replying(200, { key: "taxonomy/brand-b-1.png" });
    expect(await uploadPicture(fetchFn, "https://api", "tok", "brand", "b", photo)).toBe(
      "taxonomy/brand-b-1.png",
    );
    expect(calls[0]).toMatchObject({
      url: "https://api/taxonomy-images/brand/b",
      method: "PUT",
      type: "image/png",
      body: "blob",
    });
    const bad = replying(400, { error: "unsupported image type" });
    expect(await uploadPicture(bad.fetchFn, "https://api", "tok", "type", "t", photo)).toBe(
      "wrong-picture",
    );
  });

  it("removePicture > DELETE /taxonomy-images/<kind>/<id>", async () => {
    const { calls, fetchFn } = replying(200, { ok: true });
    await removePicture(fetchFn, "https://api", "tok", "type", "pt-1");
    expect(calls[0]).toMatchObject({
      url: "https://api/taxonomy-images/type/pt-1",
      method: "DELETE",
    });
  });
});
