import type { Phrase } from "@l-shopee/shared/lang";
import type { NewProductBody, OpeningStock } from "./productAdd";
import type { ProductDetail, SaveBody, StockCount } from "./productEdit";
import type { ProductRow } from "./productList";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * สินค้า's calls — the same endpoints the web back office's product pages use. Every call carries
 * the signed-in session; the API decides who may change what (sell prices and channels are the
 * owner's, a mechanic edits no product).
 */

/** A brand, car system or part name; `name` is its identity, the other two are what people read. */
export interface Attribute {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  /** Part names only: the car system they belong to. */
  usageId?: string | null;
}

export interface Attributes {
  brands: Attribute[];
  usages: Attribute[];
  types: Attribute[];
}

export interface CarModel {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  yearFrom: number | null;
  yearTo: number | null;
}

export interface CarBrand {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  models: CarModel[];
}

export interface CodeOwner {
  id: string;
  name: string;
  productRef: string;
  status: string;
}

const productUrl = (base: string, id: string) => `${base}/products/${encodeURIComponent(id)}`;

async function readJson<T>(fetchFn: FetchFn, url: string, token: string, what: string): Promise<T> {
  const res = await fetchFn(url, { headers: session(token) });
  if (!res.ok) throw await failure(res, what);
  return (await res.json()) as T;
}

export async function fetchProductRows(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<ProductRow[]> {
  const body = await readJson<{ products: ProductRow[] }>(
    fetchFn,
    `${base}/products`,
    token,
    "Products failed to load",
  );
  return body.products.map((r) => ({ ...r, fitments: r.fitments ?? [] }));
}

/** Null when the product is gone (deleted on another phone); any other failure throws. */
export async function fetchProductDetail(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<ProductDetail | null> {
  const res = await fetchFn(productUrl(base, id), { headers: session(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, "Product failed to load");
  return (await res.json()) as ProductDetail;
}

export const fetchAttributes = (fetchFn: FetchFn, base: string, token: string) =>
  readJson<Attributes>(fetchFn, `${base}/attributes`, token, "Lists failed to load");

export const fetchCarBrands = async (fetchFn: FetchFn, base: string, token: string) =>
  (
    await readJson<{ brands: CarBrand[] }>(
      fetchFn,
      `${base}/car-fitment`,
      token,
      "Cars failed to load",
    )
  ).brands;

/** The product a scanned code belongs to; null when none has it (then the list offers to add one). */
export async function findByCode(
  fetchFn: FetchFn,
  base: string,
  token: string,
  code: string,
): Promise<string | null> {
  const res = await fetchFn(`${base}/products/by-barcode/${encodeURIComponent(code.trim())}`, {
    headers: session(token),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw await failure(res, "Lookup failed");
  return ((await res.json()) as { productId: string }).productId;
}

/**
 * Which OTHER product already has this code. The save itself cannot say (a clash there is a bare
 * server error), so the page asks first and says so under the field.
 */
export async function codeTakenBy(
  fetchFn: FetchFn,
  base: string,
  token: string,
  code: string,
  selfId: string | null,
): Promise<CodeOwner | null> {
  const value = encodeURIComponent(code.trim());
  const { match } = await readJson<{ match: CodeOwner | null }>(
    fetchFn,
    `${base}/products/identifier-check?kind=ref&value=${value}`,
    token,
    "Code check failed",
  );
  return match && match.id !== selfId ? match : null;
}

/** The whole product in one write (fields, prices, cars); returns its id and its stock row's. */
export async function saveProduct(
  fetchFn: FetchFn,
  base: string,
  token: string,
  body: SaveBody | NewProductBody,
): Promise<{ productId: string; variantId: string }> {
  const res = await fetchFn(`${base}/products/full`, sendJson(token, body));
  if (!res.ok) throw await failure(res, "Product was not saved");
  const saved = (await res.json()) as { productId: string; variantId: string };
  return { productId: saved.productId, variantId: saved.variantId };
}

export async function countStock(
  fetchFn: FetchFn,
  base: string,
  token: string,
  move: StockCount | OpeningStock,
): Promise<{ applied: boolean; reason?: string }> {
  const res = await fetchFn(`${base}/stock/adjust`, sendJson(token, move));
  if (!res.ok) throw await failure(res, "Stock was not saved");
  return (await res.json()) as { applied: boolean; reason?: string };
}

/** "deleted", or "has_history" — the owner's rule: a product with a past is turned off, not deleted. */
export async function deleteProduct(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<"deleted" | "has_history"> {
  const res = await fetchFn(productUrl(base, id), { method: "DELETE", headers: session(token) });
  if (res.status === 409) return "has_history";
  if (!res.ok) throw await failure(res, "Product was not deleted");
  return "deleted";
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/** What the server would refuse, said in the shop's words before the photo is sent. */
export function imageProblem(photo: { type: string; size: number }): Phrase | null {
  if (!PHOTO_TYPES.includes(photo.type)) {
    return { th: "ใช้รูป JPG, PNG หรือ WebP", en: "Use a JPG, PNG or WebP photo" };
  }
  if (photo.size > MAX_PHOTO_BYTES) return { th: "รูปใหญ่เกิน 5 MB", en: "The photo is over 5 MB" };
  return null;
}

export async function uploadProductImage(
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  photo: Blob,
): Promise<{ id: string; imageKey: string }> {
  const res = await fetchFn(`${productUrl(base, productId)}/images`, {
    method: "POST",
    headers: { ...session(token), "content-type": photo.type || "image/jpeg" },
    body: photo,
  });
  if (!res.ok) throw await failure(res, "Photo was not saved");
  const made = (await res.json()) as { id: string; imageKey: string };
  return { id: made.id, imageKey: made.imageKey };
}

export async function deleteProductImage(
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  imageId: string,
): Promise<void> {
  const res = await fetchFn(
    `${productUrl(base, productId)}/images/${encodeURIComponent(imageId)}`,
    {
      method: "DELETE",
      headers: session(token),
    },
  );
  if (!res.ok) throw await failure(res, "Photo was not removed");
}

/** A new part brand, car system or part name. Its English name is its identity. */
export async function createAttribute(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: "brand" | "usage" | "type",
  names: { nameEn: string; nameTh: string; usageId?: string },
): Promise<Attribute> {
  const body = {
    name: names.nameEn.trim(),
    nameEn: names.nameEn.trim(),
    nameTh: names.nameTh.trim() || null,
    ...(names.usageId ? { usageId: names.usageId } : {}),
  };
  const res = await fetchFn(`${base}/attributes/${kind}`, sendJson(token, body));
  if (!res.ok) throw await failure(res, "Not added");
  return (await res.json()) as Attribute;
}

async function nameIt(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: "car_brand" | "car_model",
  id: string,
  names: { nameEn: string; nameTh: string | null },
): Promise<void> {
  const res = await fetchFn(`${base}/attributes/${kind}/${encodeURIComponent(id)}`, {
    ...sendJson(token, names),
    method: "PATCH",
  });
  if (!res.ok) throw await failure(res, "Names were not saved");
}

export async function createCarBrand(
  fetchFn: FetchFn,
  base: string,
  token: string,
  nameEn: string,
  nameTh: string,
): Promise<CarBrand> {
  const names = { nameEn: nameEn.trim(), nameTh: nameTh.trim() || null };
  const res = await fetchFn(`${base}/car-fitment/brands`, sendJson(token, { name: names.nameEn }));
  if (!res.ok) throw await failure(res, "Car brand was not added");
  const made = (await res.json()) as { id: string; name: string };
  await nameIt(fetchFn, base, token, "car_brand", made.id, names);
  return { id: made.id, name: made.name, ...names, models: [] };
}

export async function createCarModel(
  fetchFn: FetchFn,
  base: string,
  token: string,
  brandId: string,
  model: { nameEn: string; nameTh: string; yearFrom: number | null; yearTo: number | null },
): Promise<CarModel> {
  const names = { nameEn: model.nameEn.trim(), nameTh: model.nameTh.trim() || null };
  const res = await fetchFn(
    `${base}/car-fitment/brands/${encodeURIComponent(brandId)}/models`,
    sendJson(token, { name: names.nameEn, yearFrom: model.yearFrom, yearTo: model.yearTo }),
  );
  if (!res.ok) throw await failure(res, "Car model was not added");
  const made = (await res.json()) as { id: string; name: string };
  await nameIt(fetchFn, base, token, "car_model", made.id, names);
  return { id: made.id, name: made.name, ...names, yearFrom: model.yearFrom, yearTo: model.yearTo };
}
