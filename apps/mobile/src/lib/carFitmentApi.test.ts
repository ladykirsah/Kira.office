import { describe, expect, it } from "vitest";
import {
  addCarBrand,
  addCarModel,
  deleteCarBrand,
  deleteCarModel,
  fetchCarFitment,
  renameCarBrand,
  saveCarModel,
} from "./carFitmentApi";
import { modelDraft, modelSave } from "./carFitmentPage";
import { session } from "./scanApi";
import type { FetchFn } from "./signIn";

function replying(status: number, body: unknown) {
  const calls: { url: string; method: string; auth: string | null; body: unknown }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url,
      method: init?.method ?? "GET",
      auth: headers.get(Object.keys(session("x"))[0]!),
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetchFn };
}

const SERVER = {
  brands: [
    {
      id: "cb-toyota",
      name: "Toyota",
      nameTh: "โตโยต้า",
      nameEn: null,
      imageKey: "taxonomy/car-brand-cb-toyota-1.jpg",
      productCount: 120,
      models: [
        {
          id: "cm-vigo",
          name: "Vigo",
          nameTh: " วีโก้ ",
          nameEn: null,
          generationCode: "KUN15",
          yearFrom: 2005,
          yearTo: 2014,
          refrigerant: "R134a",
          oringUsage: [{ size: '3/8"', qty: 2 }],
          coolantLiters: "8.5",
          notes: null,
          productCount: 34,
        },
      ],
    },
  ],
};

describe("fetchCarFitment", () => {
  it("given the server's tree > brands with their models, names cleaned, chassis = generation code", async () => {
    const { calls, fetchFn } = replying(200, SERVER);
    const brands = await fetchCarFitment(fetchFn, "http://api", "tok");
    expect(calls[0]).toMatchObject({ url: "http://api/car-fitment", auth: "tok" });
    expect(brands[0]).toMatchObject({
      id: "cb-toyota",
      nameTh: "โตโยต้า",
      nameEn: "Toyota",
      imageKey: "taxonomy/car-brand-cb-toyota-1.jpg",
      productCount: 120,
    });
    expect(brands[0]!.models[0]).toEqual({
      id: "cm-vigo",
      name: "Vigo",
      nameTh: "วีโก้",
      nameEn: "Vigo",
      yearFrom: 2005,
      yearTo: 2014,
      chassis: "KUN15",
      refrigerant: "R134a",
      coolant: "8.5",
      orings: [{ size: '3/8"', qty: 2 }],
      notes: null,
      productCount: 34,
    });
  });

  it("given the server fails > throws", async () => {
    const { fetchFn } = replying(500, { error: "x" });
    await expect(fetchCarFitment(fetchFn, "http://api", "tok")).rejects.toThrow();
  });
});

describe("brands", () => {
  it("adds with the English name as identity, and both display names", async () => {
    const { calls, fetchFn } = replying(201, { id: "cb-suzuki" });
    const id = await addCarBrand(fetchFn, "http://api", "tok", {
      nameTh: "ซูซูกิ",
      nameEn: " Suzuki ",
    });
    expect(id).toBe("cb-suzuki");
    expect(calls[0]).toMatchObject({
      url: "http://api/attributes/car_brand",
      method: "POST",
      body: { name: "Suzuki", nameEn: "Suzuki", nameTh: "ซูซูกิ" },
    });
  });

  it("renames the two display names only", async () => {
    const { calls, fetchFn } = replying(200, { ok: true });
    await renameCarBrand(fetchFn, "http://api", "tok", "cb-toyota", {
      nameTh: "",
      nameEn: "Toyota",
    });
    expect(calls[0]).toMatchObject({
      url: "http://api/attributes/car_brand/cb-toyota",
      method: "PATCH",
      body: { nameTh: null, nameEn: "Toyota" },
    });
  });

  it("deletes; a 409 says it is still in use", async () => {
    const gone = replying(200, { ok: true });
    expect(await deleteCarBrand(gone.fetchFn, "http://api", "tok", "cb-mazda")).toBe("deleted");
    expect(gone.calls[0]).toMatchObject({
      url: "http://api/car-fitment/brands/cb-mazda",
      method: "DELETE",
    });
    const busy = replying(409, { count: 2 });
    expect(await deleteCarBrand(busy.fetchFn, "http://api", "tok", "cb-toyota")).toBe("in-use");
  });
});

describe("models", () => {
  it("adds under its brand with its years, then sets both names", async () => {
    const { calls, fetchFn } = replying(201, { id: "cm-ativ" });
    const d = { ...modelDraft(), nameTh: "ยาริส เอทีฟ", nameEn: "Yaris Ativ", yearFrom: "2022" };
    expect(await addCarModel(fetchFn, "http://api", "tok", "cb-toyota", modelSave(d))).toBe(
      "cm-ativ",
    );
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      [
        "POST",
        "http://api/car-fitment/brands/cb-toyota/models",
        { name: "Yaris Ativ", yearFrom: 2022, yearTo: null },
      ],
      [
        "PATCH",
        "http://api/attributes/car_model/cm-ativ",
        { nameTh: "ยาริส เอทีฟ", nameEn: "Yaris Ativ" },
      ],
    ]);
  });

  it("saves names, then the service info", async () => {
    const { calls, fetchFn } = replying(200, { ok: true });
    const d = { ...modelDraft(), id: "cm-vigo", nameTh: "วีโก้", nameEn: "Vigo", yearFrom: "2005" };
    await saveCarModel(fetchFn, "http://api", "tok", "cm-vigo", modelSave(d));
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ["PATCH", "http://api/attributes/car_model/cm-vigo"],
      ["PATCH", "http://api/car-fitment/models/cm-vigo"],
    ]);
    expect(calls[1]!.body).toMatchObject({ yearFrom: 2005, yearTo: null, oringUsage: [] });
  });

  it("deletes; a 409 says it is still in use", async () => {
    const busy = replying(409, { count: 1 });
    expect(await deleteCarModel(busy.fetchFn, "http://api", "tok", "cm-vigo")).toBe("in-use");
    expect(busy.calls[0]).toMatchObject({
      url: "http://api/car-fitment/models/cm-vigo",
      method: "DELETE",
    });
  });
});
