import type { ChoiceBody } from "./productChoices";
import { failure, session } from "./scanApi";
import type { FetchFn } from "./signIn";

/**
 * The calls behind หน้าสินค้า's ตัวเลือกสินค้า and กลุ่มสินค้า (7 Nov 2026). A refusal the server
 * explains (a taken code, an empty box, a choice already sold) comes back as its reason, so the page
 * can put it under the right box; anything else — no connection, a broken server — throws.
 */

export type ApiResult<T extends object = object> =
  ({ ok: true } & T) | { ok: false; reason: string };

const productUrl = (base: string, id: string) => `${base}/products/${encodeURIComponent(id)}`;

async function send<T extends object>(
  fetchFn: FetchFn,
  url: string,
  token: string,
  method: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetchFn(url, {
    method,
    headers:
      body === undefined
        ? session(token)
        : { ...session(token), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.ok) return { ok: true, ...((await res.json().catch(() => ({}))) as T) };
  if (res.status >= 400 && res.status < 500) {
    const said = (await res
      .clone()
      .json()
      .catch(() => ({}))) as { reason?: unknown };
    if (typeof said.reason === "string") return { ok: false, reason: said.reason };
  }
  throw await failure(res, "Not saved");
}

/** The first เพิ่มตัวเลือก sheet: the option's name and its values. */
export const setUpOptions = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  name: string,
  values: string[],
) =>
  send<object>(fetchFn, `${productUrl(base, productId)}/options`, token, "POST", {
    name,
    values,
  }).then(only);

/** ชื่อกลุ่ม in แก้ไข. */
export const renameOption = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  name: string,
) =>
  send<object>(fetchFn, `${productUrl(base, productId)}/options`, token, "PUT", {
    name,
  }).then(only);

export async function addChoice(
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  body: ChoiceBody,
): Promise<ApiResult<{ variantId: string }>> {
  const out = await send<{ variantId: string }>(
    fetchFn,
    `${productUrl(base, productId)}/choices`,
    token,
    "POST",
    body,
  );
  return out.ok ? { ok: true, variantId: out.variantId } : out;
}

export const updateChoice = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  variantId: string,
  body: ChoiceBody,
) =>
  send<object>(
    fetchFn,
    `${productUrl(base, productId)}/choices/${encodeURIComponent(variantId)}`,
    token,
    "PUT",
    body,
  ).then(only);

export const removeChoice = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  variantId: string,
) =>
  send<object>(
    fetchFn,
    `${productUrl(base, productId)}/choices/${encodeURIComponent(variantId)}`,
    token,
    "DELETE",
  ).then(only);

/** The choice's one photo; its stored key back. */
export async function uploadChoicePhoto(
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  variantId: string,
  photo: Blob,
): Promise<string> {
  const res = await fetchFn(
    `${productUrl(base, productId)}/choices/${encodeURIComponent(variantId)}/image`,
    {
      method: "POST",
      headers: { ...session(token), "content-type": photo.type || "image/jpeg" },
      body: photo,
    },
  );
  if (!res.ok) throw await failure(res, "Photo was not saved");
  return ((await res.json()) as { imageKey: string }).imageKey;
}

export const addToGroup = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  productIds: string[],
) =>
  send<object>(fetchFn, `${productUrl(base, productId)}/group`, token, "POST", {
    productIds,
  }).then(only);

export const removeFromGroup = (
  fetchFn: FetchFn,
  base: string,
  token: string,
  productId: string,
  memberId: string,
) =>
  send<object>(
    fetchFn,
    `${productUrl(base, productId)}/group/${encodeURIComponent(memberId)}`,
    token,
    "DELETE",
  ).then(only);

/** A plain yes, without whatever else the server said. */
function only(out: ApiResult): ApiResult {
  return out.ok ? { ok: true } : out;
}
