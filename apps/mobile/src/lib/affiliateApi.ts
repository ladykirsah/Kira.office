import type { AffiliateCategory, AffiliateItem } from "./affiliatePage";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * สินค้านายหน้า's calls — the endpoints the web back office's page uses, plus /affiliate-price (the
 * price on a Lazada link). Every call carries the signed-in session.
 */

const itemUrl = (base: string, id: string) => `${base}/affiliate-items/${encodeURIComponent(id)}`;

async function readJson<T>(fetchFn: FetchFn, url: string, token: string, what: string): Promise<T> {
  const res = await fetchFn(url, { headers: session(token) });
  if (!res.ok) throw await failure(res, what);
  return (await res.json()) as T;
}

/** The cards (with clicks) and the categories, read together. */
export async function fetchAffiliate(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<{ items: AffiliateItem[]; categories: AffiliateCategory[] }> {
  const [items, categories] = await Promise.all([
    readJson<{ items: AffiliateItem[] }>(
      fetchFn,
      `${base}/affiliate-items`,
      token,
      "Cards failed to load",
    ),
    readJson<{ categories: AffiliateCategory[] }>(
      fetchFn,
      `${base}/affiliate-categories`,
      token,
      "Categories failed to load",
    ),
  ]);
  return { items: items.items, categories: categories.categories };
}

/** A new card; its photo goes up after, under the id this returns. */
export async function createItem(
  fetchFn: FetchFn,
  base: string,
  token: string,
  body: unknown,
): Promise<string> {
  const res = await fetchFn(`${base}/affiliate-items`, sendJson(token, body));
  if (!res.ok) throw await failure(res, "Card was not saved");
  return ((await res.json()) as { id: string }).id;
}

/** Only the fields sent change. */
export async function updateItem(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  patch: unknown,
): Promise<void> {
  const res = await fetchFn(itemUrl(base, id), { ...sendJson(token, patch), method: "PATCH" });
  if (!res.ok) throw await failure(res, "Card was not saved");
}

/** Gone for good, with its click count. */
export async function deleteItem(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<void> {
  const res = await fetchFn(itemUrl(base, id), { method: "DELETE", headers: session(token) });
  if (!res.ok) throw await failure(res, "Card was not deleted");
}

/** Puts (or replaces) the card's one photo; its new image key comes back. */
export async function uploadItemImage(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  photo: Blob,
): Promise<string> {
  const res = await fetchFn(`${itemUrl(base, id)}/image`, {
    method: "POST",
    headers: { ...session(token), "content-type": photo.type || "image/jpeg" },
    body: photo,
  });
  if (!res.ok) throw await failure(res, "Photo was not saved");
  return ((await res.json()) as { key: string }).key;
}

/** A new category; a name that is already there comes back as that one, never a twin. */
export async function createCategory(
  fetchFn: FetchFn,
  base: string,
  token: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const res = await fetchFn(`${base}/affiliate-categories`, sendJson(token, { name }));
  if (!res.ok) throw await failure(res, "Category was not added");
  return (await res.json()) as { id: string; name: string };
}

/** The price on a link, or null — any failure just means the person types it. */
export async function fetchLinkPrice(
  fetchFn: FetchFn,
  base: string,
  token: string,
  link: string,
): Promise<string | null> {
  try {
    const res = await fetchFn(`${base}/affiliate-price?url=${encodeURIComponent(link)}`, {
      headers: session(token),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { price?: unknown };
    return typeof body.price === "string" && body.price ? body.price : null;
  } catch {
    return null;
  }
}
