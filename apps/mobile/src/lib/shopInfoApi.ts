import { failure, sendJson, session } from "./scanApi";
import type { ShopIdentity, ShopInfo, ShopProfile, TextDraft } from "./shopInfoPage";
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
  "bankName",
  "bankAccountName",
  "bankAccountNumber",
  "vatBilling",
  "taxId",
  "taxBranch",
  "taxName",
  "taxAddress",
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

/** Den Air with both its cards — what a server from before plan 10.3 means. */
const DEN_AIR: ShopIdentity = {
  id: "denair",
  name: "Den Air Service",
  profiles: ["denair", "airplus"],
};

/** Which shop the app is open on and its ข้อมูลร้าน cards (plan 10.3). */
export async function fetchShop(
  fetchFn: FetchFn,
  base: string,
  token: string,
): Promise<ShopIdentity> {
  const res = await fetchFn(`${base}/shop`, { headers: session(token) });
  // Only for the minutes a new app could meet the server before it learned about shops.
  if (res.status === 404) return DEN_AIR;
  if (!res.ok) throw await failure(res, "Shop failed to load");
  const body = (await res.json()) as { id?: string; name?: string; profiles?: string[] };
  return {
    id: body.id ?? "",
    name: body.name ?? "",
    profiles: (body.profiles ?? []).filter(
      (p): p is ShopProfile => p === "denair" || p === "airplus",
    ),
  };
}
