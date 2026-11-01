import type { Banner } from "./bannerPage";
import { failure, sendJson, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * แบนเนอร์'s calls — the endpoints the web back office's banner page uses. Every call carries the
 * signed-in session. The picture goes up on its own, after the banner is saved.
 */

const bannerUrl = (base: string, id: string) => `${base}/banners/${encodeURIComponent(id)}`;

/** Every banner, both slots, on or off. */
export async function fetchBanners(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<Banner[]> {
  const res = await fetchFn(`${base}/banners`, { headers: session(token) });
  if (!res.ok) throw await failure(res, "Banners failed to load");
  return ((await res.json()) as { banners: Banner[] }).banners;
}

/** A new banner; its picture goes up after, under the id this returns. */
export async function createBanner(
  fetchFn: FetchFn,
  base: string,
  token: string,
  body: unknown,
): Promise<string> {
  const res = await fetchFn(`${base}/banners`, sendJson(token, body));
  if (!res.ok) throw await failure(res, "Banner was not saved");
  return ((await res.json()) as { id: string }).id;
}

/** Only the fields sent change. */
export async function updateBanner(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  patch: unknown,
): Promise<void> {
  const res = await fetchFn(bannerUrl(base, id), { ...sendJson(token, patch), method: "PATCH" });
  if (!res.ok) throw await failure(res, "Banner was not saved");
}

/** Gone for good, with its picture. */
export async function deleteBanner(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
): Promise<void> {
  const res = await fetchFn(bannerUrl(base, id), { method: "DELETE", headers: session(token) });
  if (!res.ok) throw await failure(res, "Banner was not deleted");
}

/** ▲ / ▼: each moved row gets its new place, one after another. */
export async function reorderBanners(
  fetchFn: FetchFn,
  base: string,
  token: string,
  patches: readonly { id: string; sortOrder: number }[],
): Promise<void> {
  for (const p of patches) {
    await updateBanner(fetchFn, base, token, p.id, { sortOrder: p.sortOrder });
  }
}

/** Puts (or replaces) the banner's picture; its new image key comes back. */
export async function uploadBannerImage(
  fetchFn: FetchFn,
  base: string,
  token: string,
  id: string,
  photo: Blob,
): Promise<string> {
  const res = await fetchFn(`${bannerUrl(base, id)}/image`, {
    method: "POST",
    headers: { ...session(token), "content-type": photo.type || "image/jpeg" },
    body: photo,
  });
  if (!res.ok) throw await failure(res, "Picture was not saved");
  return ((await res.json()) as { key: string }).key;
}
