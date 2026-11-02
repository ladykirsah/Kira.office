import { failure, sendJson, session } from "./scanApi";
import type { ShopInfo, ShopProfile, TextDraft } from "./shopInfoPage";
import type { FetchFn } from "./signIn";

/** ข้อมูลร้าน's calls — the same shop-info endpoints the web back office's Shop page uses. */

const shopUrl = (base: string, profile: ShopProfile) => `${base}/shop-info/${profile}`;

const TEXT_KEYS: (keyof TextDraft)[] = [
  "name",
  "nameEn",
  "address",
  "addressEn",
  "quoteNote",
  "quoteNoteEn",
  "qrHeadline",
  "qrHeadlineEn",
  "qrSubtitle",
  "qrSubtitleEn",
  "lineUrl",
  "shipFromPhone",
  "shipFromPostcode",
  "phone",
  "linktreeUrl",
];

/** One shop's details; a field the server does not send yet reads empty. */
export async function fetchShopInfo(
  fetchFn: FetchFn,
  base: string,
  token: string,
  profile: ShopProfile,
): Promise<ShopInfo> {
  const res = await fetchFn(shopUrl(base, profile), { headers: session(token) });
  if (!res.ok) throw await failure(res, "Shop details failed to load");
  const body = (await res.json()) as Record<string, string | null | undefined>;
  const text = Object.fromEntries(TEXT_KEYS.map((k) => [k, body[k] ?? ""])) as TextDraft;
  return {
    ...text,
    paymentMethods: body.paymentMethods ?? "",
    logoKey: body.logoKey ?? null,
    qrKey: body.qrKey ?? null,
  };
}

/** Only the fields sent change; the server keeps the rest. */
export async function saveShopFields(
  fetchFn: FetchFn,
  base: string,
  token: string,
  profile: ShopProfile,
  patch: Partial<TextDraft> & { paymentMethods?: string },
): Promise<void> {
  const res = await fetchFn(shopUrl(base, profile), { ...sendJson(token, patch), method: "PUT" });
  if (!res.ok) throw await failure(res, "Shop details were not saved");
}

/**
 * The logo or the contact QR: the new picture's key, or "wrong-picture" when the server refuses it
 * (not JPG/PNG/WebP, or over 5MB) — the page says so and keeps the old one.
 */
export async function uploadShopImage(
  fetchFn: FetchFn,
  base: string,
  token: string,
  profile: ShopProfile,
  slot: "logo" | "qr",
  photo: Blob,
): Promise<string> {
  const res = await fetchFn(`${shopUrl(base, profile)}/${slot}`, {
    method: "POST",
    headers: { ...session(token), "content-type": photo.type || "image/jpeg" },
    body: photo,
  });
  if (res.status === 400) return "wrong-picture";
  if (!res.ok) throw await failure(res, "Picture was not saved");
  return ((await res.json()) as { key: string }).key;
}
