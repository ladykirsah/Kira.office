import type { CarBrand, modelSave } from "./carFitmentPage";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * รุ่นรถที่ใช้ได้'s server calls: one read of every car brand with its models (and how many products
 * fit each), then small writes. The English name is the identity (`name` on add, never rewritten
 * after — product fitments name it); renaming sets the two display names only. A brand's รูปปก goes
 * through partsSetupApi's uploadPicture / removePicture as "car-brand".
 */

type ModelSave = ReturnType<typeof modelSave>;
interface Names {
  nameTh: string;
  nameEn: string;
}
interface ServerName {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
}
const names = (r: ServerName) => ({
  id: r.id,
  name: r.name,
  nameTh: r.nameTh?.trim() || null,
  nameEn: r.nameEn?.trim() || r.name,
});

export async function fetchCarFitment(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<CarBrand[]> {
  const res = await fetchFn(`${base}/car-fitment`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Car fitment did not load");
  const body = (await res.json()) as {
    brands: (ServerName & {
      imageKey?: string | null;
      productCount?: number;
      models: (ServerName & {
        generationCode: string | null;
        yearFrom: number | null;
        yearTo: number | null;
        refrigerant: string | null;
        oringUsage: { size: string; qty: number }[];
        coolantLiters: string | null;
        notes: string | null;
        productCount?: number;
      })[];
    })[];
  };
  return body.brands.map((b) => ({
    ...names(b),
    imageKey: b.imageKey ?? null,
    productCount: b.productCount ?? 0,
    models: b.models.map((m) => ({
      ...names(m),
      yearFrom: m.yearFrom,
      yearTo: m.yearTo,
      chassis: m.generationCode,
      refrigerant: m.refrigerant,
      coolant: m.coolantLiters,
      orings: m.oringUsage ?? [],
      notes: m.notes,
      productCount: m.productCount ?? 0,
    })),
  }));
}

const patch = (token: string, body: unknown): RequestInit => ({
  ...sendJson(token, body),
  method: "PATCH",
});

async function rename(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: "car_brand" | "car_model",
  id: string,
  n: Names,
) {
  const body = { nameTh: n.nameTh.trim() || null, nameEn: n.nameEn.trim() || null };
  const res = await fetchFn(
    `${base}/attributes/${kind}/${encodeURIComponent(id)}`,
    patch(token, body),
  );
  if (!res.ok) throw await failure(res, "Not saved");
}

async function remove(fetchFn: FetchFn, url: string, token: string): Promise<"deleted" | "in-use"> {
  const res = await fetchFn(url, { method: "DELETE", headers: session(token) });
  if (res.status === 409) return "in-use";
  if (!res.ok) throw await failure(res, "Not deleted");
  return "deleted";
}

/** A new car brand; gives its id. */
export async function addCarBrand(
  fetchFn: FetchFn,
  base: string,
  token: string,
  n: Names,
): Promise<string> {
  const en = n.nameEn.trim();
  const body = { name: en, nameEn: en, nameTh: n.nameTh.trim() || null };
  const res = await fetchFn(`${base}/attributes/car_brand`, sendJson(token, body));
  if (!res.ok) throw await failure(res, "Not added");
  return ((await res.json()) as { id: string }).id;
}

export const renameCarBrand = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  n: Names,
) => rename(fetchFn, base, token, "car_brand", id, n);

/** "in-use" when the server refuses (409): products still fit it. */
export const deleteCarBrand = (fetchFn: FetchFn, base: string, token: string, id: string) =>
  remove(fetchFn, `${base}/car-fitment/brands/${encodeURIComponent(id)}`, token);

/** A new model under its brand (names and years; service info is added on its page); gives its id. */
export async function addCarModel(
  fetchFn: FetchFn,
  base: string,
  token: string,
  brandId: string,
  s: ModelSave,
): Promise<string> {
  const res = await fetchFn(
    `${base}/car-fitment/brands/${encodeURIComponent(brandId)}/models`,
    sendJson(token, { name: s.names.nameEn, yearFrom: s.yearFrom, yearTo: s.yearTo }),
  );
  if (!res.ok) throw await failure(res, "Not added");
  const id = ((await res.json()) as { id: string }).id;
  await rename(fetchFn, base, token, "car_model", id, s.names);
  return id;
}

/** The model page's บันทึก: its two names, then its years and service info. */
export async function saveCarModel(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  s: ModelSave,
): Promise<void> {
  await rename(fetchFn, base, token, "car_model", id, s.names);
  const res = await fetchFn(
    `${base}/car-fitment/models/${encodeURIComponent(id)}`,
    patch(token, s.info),
  );
  if (!res.ok) throw await failure(res, "Not saved");
}

/** "in-use" when the server refuses (409): products still fit it. */
export const deleteCarModel = (fetchFn: FetchFn, base: string, token: string, id: string) =>
  remove(fetchFn, `${base}/car-fitment/models/${encodeURIComponent(id)}`, token);
