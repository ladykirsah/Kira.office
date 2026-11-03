import type { Brand, CarSystem, Category, Kind } from "./partsSetupPage";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * ตั้งค่าอะไหล่'s server calls: one read of every brand, system and category (with product counts),
 * then small writes. The English name is the identity: `name` on add, never rewritten after —
 * renaming sets the two display names only (the server writes both every time).
 */

export interface PartsSetup {
  brands: Brand[];
  systems: CarSystem[];
  categories: Category[];
}

const SERVER_KIND: Record<Kind, "brand" | "usage" | "type"> = {
  brand: "brand",
  system: "usage",
  category: "type",
};

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

export async function fetchPartsSetup(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<PartsSetup> {
  const res = await fetchFn(`${base}/parts-setup`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Part setup did not load");
  const body = (await res.json()) as {
    brands: (ServerName & { imageKey: string | null; productCount: number })[];
    systems: ServerName[];
    categories: (ServerName & {
      usageId: string | null;
      warrantyDays: number | null;
      imageKey: string | null;
      description: string | null;
      productCount: number;
    })[];
  };
  return {
    brands: body.brands.map((b) => ({
      ...names(b),
      imageKey: b.imageKey,
      productCount: b.productCount,
    })),
    systems: body.systems.map(names),
    categories: body.categories.map((c) => ({
      ...names(c),
      systemId: c.usageId,
      warrantyDays: c.warrantyDays,
      imageKey: c.imageKey,
      description: c.description,
      productCount: c.productCount,
    })),
  };
}

/** A new brand, system or category; gives its id. */
export async function addPart(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: Kind,
  n: { nameEn: string; nameTh: string; systemId?: string | null },
): Promise<string> {
  const en = n.nameEn.trim();
  const body = {
    name: en,
    nameEn: en,
    nameTh: n.nameTh.trim() || null,
    ...(kind === "category" && n.systemId ? { usageId: n.systemId } : {}),
  };
  const res = await fetchFn(`${base}/attributes/${SERVER_KIND[kind]}`, sendJson(token, body));
  if (!res.ok) throw await failure(res, "Not added");
  return ((await res.json()) as { id: string }).id;
}

function put(token: string, body: unknown): RequestInit {
  return { ...sendJson(token, body), method: "PUT" };
}

export async function renamePart(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: Kind,
  id: string,
  n: { nameEn: string; nameTh: string },
): Promise<void> {
  const body = { nameEn: n.nameEn.trim() || null, nameTh: n.nameTh.trim() || null };
  const res = await fetchFn(`${base}/attributes/${SERVER_KIND[kind]}/${encodeURIComponent(id)}`, {
    ...sendJson(token, body),
    method: "PATCH",
  });
  if (!res.ok) throw await failure(res, "Not saved");
}

/** "in-use" when the server refuses (409): products or categories still hold it. */
export async function deletePart(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: Kind,
  id: string,
): Promise<"deleted" | "in-use"> {
  const res = await fetchFn(`${base}/attributes/${SERVER_KIND[kind]}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: session(token),
  });
  if (res.status === 409) return "in-use";
  if (!res.ok) throw await failure(res, "Not deleted");
  return "deleted";
}

async function putCategory(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  what: string,
  body: unknown,
) {
  const res = await fetchFn(
    `${base}/product-types/${encodeURIComponent(id)}/${what}`,
    put(token, body),
  );
  if (!res.ok) throw await failure(res, "Not saved");
}

export const setCategorySystem = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  systemId: string | null,
) => putCategory(fetchFn, base, token, id, "car-system", { usageId: systemId });

/** 0 = ไม่มีรับประกัน (stored as none). */
export const setWarranty = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  days: number,
) => putCategory(fetchFn, base, token, id, "warranty", { warrantyDays: days > 0 ? days : null });

export const setDescription = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  text: string,
) => putCategory(fetchFn, base, token, id, "description", { description: text });

/** A brand's logo or a category's AirPlus picture: its key, or "wrong-picture" when refused (type/size). */
export async function uploadPicture(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: "brand" | "type" | "car-brand",
  id: string,
  photo: Blob,
): Promise<string> {
  const res = await fetchFn(`${base}/taxonomy-images/${kind}/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { ...session(token), "content-type": photo.type || "image/jpeg" },
    body: photo,
  });
  if (res.status === 400) return "wrong-picture";
  if (!res.ok) throw await failure(res, "Picture was not saved");
  return ((await res.json()) as { key: string }).key;
}

export async function removePicture(
  fetchFn: FetchFn,
  base: string,
  token: string,
  kind: "brand" | "type" | "car-brand",
  id: string,
): Promise<void> {
  const res = await fetchFn(`${base}/taxonomy-images/${kind}/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: session(token),
  });
  if (!res.ok) throw await failure(res, "Picture was not removed");
}
