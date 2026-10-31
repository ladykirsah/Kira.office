import { describe, expect, it } from "vitest";
import {
  codeTakenBy,
  countStock,
  createAttribute,
  createCarBrand,
  createCarModel,
  deleteProduct,
  fetchProductDetail,
  fetchProductRows,
  findByCode,
  imageProblem,
  saveProduct,
  uploadProductImage,
} from "./productsApi";
import type { FetchFn } from "./signIn";

function recording(replies: Array<() => Promise<Response>>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn: FetchFn = async (url, init) => {
    calls.push({ url, init });
    const reply = replies[calls.length - 1];
    if (!reply) throw new Error(`unexpected call ${url}`);
    return reply();
  };
  return { calls, fetchFn };
}

const header = (init: RequestInit | undefined, name: string) =>
  (init?.headers as Record<string, string> | undefined)?.[name];

describe("fetchProductRows", () => {
  it("given the catalogue > then every row, with an empty car list where the server sent none", async () => {
    const { calls, fetchFn } = recording([
      async () =>
        Response.json({
          products: [{ id: "p1", fitments: [{ carBrand: "Toyota" }] }, { id: "p2" }],
        }),
    ]);
    const rows = await fetchProductRows(fetchFn, "http://api", "tok");
    expect(calls[0]!.url).toBe("http://api/products");
    expect(header(calls[0]!.init, "X-Staff-Session")).toBe("tok");
    expect(rows.map((r) => r.fitments)).toEqual([[{ carBrand: "Toyota" }], []]);
  });
});

describe("fetchProductDetail", () => {
  it("given a product that is gone > then null, not an error", async () => {
    const { fetchFn } = recording([async () => new Response("{}", { status: 404 })]);
    expect(await fetchProductDetail(fetchFn, "http://api", "tok", "p 1")).toBeNull();
  });
  it("given a broken connection > then it throws with the server's sentence", async () => {
    const { fetchFn } = recording([async () => Response.json({ error: "down" }, { status: 500 })]);
    await expect(fetchProductDetail(fetchFn, "http://api", "tok", "p1")).rejects.toThrow("down");
  });
});

describe("codeTakenBy", () => {
  it("given a code another product uses > then that product", async () => {
    const match = { id: "p9", name: "คอม 10S17C", productRef: "DN-447230", status: "active" };
    const { calls, fetchFn } = recording([async () => Response.json({ match })]);
    expect(await codeTakenBy(fetchFn, "http://api", "tok", " DN-447230 ", "p1")).toEqual(match);
    expect(calls[0]!.url).toBe("http://api/products/identifier-check?kind=ref&value=DN-447230");
  });
  it("given the product's own code > then nobody else has it", async () => {
    const match = { id: "p1", name: "self", productRef: "DN-1", status: "active" };
    const { fetchFn } = recording([async () => Response.json({ match })]);
    expect(await codeTakenBy(fetchFn, "http://api", "tok", "DN-1", "p1")).toBeNull();
  });
});

describe("saveProduct", () => {
  it("given a body > then one POST to /products/full and the product's id back", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ productId: "p1" })]);
    expect(await saveProduct(fetchFn, "http://api", "tok", { id: "p1" } as never)).toBe("p1");
    expect(calls[0]!.url).toBe("http://api/products/full");
    expect(calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({ id: "p1" });
  });
  it("given a refusal > then the server's own sentence", async () => {
    const { fetchFn } = recording([
      async () => Response.json({ error: "Only the shop owner can change" }, { status: 403 }),
    ]);
    await expect(saveProduct(fetchFn, "http://api", "tok", { id: "p1" } as never)).rejects.toThrow(
      "Only the shop owner can change",
    );
  });
});

describe("countStock", () => {
  it("given a count > then it goes to the stock ledger as counted", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ applied: true })]);
    const move = {
      productVariantId: "v1",
      countedOnHand: 2,
      movementType: "manual_adjustment" as const,
      reason: "r",
    };
    expect(await countStock(fetchFn, "http://api", "tok", move)).toEqual({ applied: true });
    expect(calls[0]!.url).toBe("http://api/stock/adjust");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual(move);
  });
});

describe("deleteProduct", () => {
  it("given a product with no past > then deleted", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ ok: true })]);
    expect(await deleteProduct(fetchFn, "http://api", "tok", "p1")).toBe("deleted");
    expect(calls[0]!.init?.method).toBe("DELETE");
  });
  it("given a product that was sold or counted > then the server's no, as a reason", async () => {
    const { fetchFn } = recording([
      async () => Response.json({ error: "…", reason: "has_history" }, { status: 409 }),
    ]);
    expect(await deleteProduct(fetchFn, "http://api", "tok", "p1")).toBe("has_history");
  });
});

describe("imageProblem / uploadProductImage", () => {
  it("given a photo type the shop cannot keep > then said before anything is sent", () => {
    expect(imageProblem({ type: "image/heic", size: 10 })).toEqual({
      th: "ใช้รูป JPG, PNG หรือ WebP",
      en: "Use a JPG, PNG or WebP photo",
    });
  });
  it("given a photo over 5 MB > then too big", () => {
    expect(imageProblem({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 })).toEqual({
      th: "รูปใหญ่เกิน 5 MB",
      en: "The photo is over 5 MB",
    });
  });
  it("given a good photo > then no problem", () => {
    expect(imageProblem({ type: "image/png", size: 1000 })).toBeNull();
  });
  it("given a photo > then its bytes go up with their own type", async () => {
    const { calls, fetchFn } = recording([
      async () => Response.json({ id: "i1", imageKey: "products/p1/x.png" }, { status: 201 }),
    ]);
    const blob = new Blob(["x"], { type: "image/png" });
    expect(await uploadProductImage(fetchFn, "http://api", "tok", "p1", blob)).toEqual({
      id: "i1",
      imageKey: "products/p1/x.png",
    });
    expect(calls[0]!.url).toBe("http://api/products/p1/images");
    expect(header(calls[0]!.init, "content-type")).toBe("image/png");
  });
});

describe("createAttribute", () => {
  it("given a new part name > then its names and car system are sent", async () => {
    const made = { id: "t1", name: "Pressure switch" };
    const { calls, fetchFn } = recording([async () => Response.json(made, { status: 201 })]);
    await createAttribute(fetchFn, "http://api", "tok", "type", {
      nameEn: "Pressure switch",
      nameTh: "สวิตช์แรงดัน",
      usageId: "uc-ac",
    });
    expect(calls[0]!.url).toBe("http://api/attributes/type");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
      name: "Pressure switch",
      nameEn: "Pressure switch",
      nameTh: "สวิตช์แรงดัน",
      usageId: "uc-ac",
    });
  });
});

describe("createCarBrand / createCarModel", () => {
  it("given a new car brand > then it is made, then given its Thai and English names", async () => {
    const { calls, fetchFn } = recording([
      async () => Response.json({ id: "cb1", name: "Suzuki" }, { status: 201 }),
      async () => Response.json({ ok: true }),
    ]);
    expect(await createCarBrand(fetchFn, "http://api", "tok", "Suzuki", "ซูซูกิ")).toEqual({
      id: "cb1",
      name: "Suzuki",
      nameTh: "ซูซูกิ",
      nameEn: "Suzuki",
      models: [],
    });
    expect(calls[0]!.url).toBe("http://api/car-fitment/brands");
    expect(calls[1]!.url).toBe("http://api/attributes/car_brand/cb1");
    expect(calls[1]!.init?.method).toBe("PATCH");
  });
  it("given a new model > then it is made under its brand with its years", async () => {
    const { calls, fetchFn } = recording([
      async () => Response.json({ id: "cm1", name: "Yaris Ativ" }, { status: 201 }),
      async () => Response.json({ ok: true }),
    ]);
    const model = await createCarModel(fetchFn, "http://api", "tok", "cb-toyota", {
      nameEn: "Yaris Ativ",
      nameTh: "ยาริส เอทีฟ",
      yearFrom: 2022,
      yearTo: null,
    });
    expect(model).toEqual({
      id: "cm1",
      name: "Yaris Ativ",
      nameTh: "ยาริส เอทีฟ",
      nameEn: "Yaris Ativ",
      yearFrom: 2022,
      yearTo: null,
    });
    expect(calls[0]!.url).toBe("http://api/car-fitment/brands/cb-toyota/models");
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual({
      name: "Yaris Ativ",
      yearFrom: 2022,
      yearTo: null,
    });
  });
});

describe("findByCode", () => {
  it("given a scanned code a product has > then that product's id", async () => {
    const { calls, fetchFn } = recording([async () => Response.json({ productId: "p 1" })]);
    expect(await findByCode(fetchFn, "http://api", "tok", "TG/447")).toBe("p 1");
    expect(calls[0]!.url).toBe("http://api/products/by-barcode/TG%2F447");
  });
  it("given a code no product has > then null", async () => {
    const { fetchFn } = recording([async () => new Response("{}", { status: 404 })]);
    expect(await findByCode(fetchFn, "http://api", "tok", "TG447190")).toBeNull();
  });
});
