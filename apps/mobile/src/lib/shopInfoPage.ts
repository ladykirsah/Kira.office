import type { Phrase } from "@l-shopee/shared/lang";
import { defaultPaymentMethod, formatPromptPayTarget, type PaymentMethod } from "@l-shopee/core";

/**
 * ข้อมูลร้าน (canvas v275): two shop cards, then one page per shop with everything on it — ติดต่อ,
 * รับเงิน, ตั้งค่าบิล (and ส่งของ on AirPlus) — read in one language at a time by the ไทย | EN switch,
 * and edited in place. No screen code here.
 */

export type ShopProfile = "denair" | "airplus";
export type ShopLang = "th" | "en";

/** What GET /shop-info/:profile gives back. */
export interface ShopInfo {
  name: string;
  nameEn: string;
  address: string;
  addressEn: string;
  quoteNote: string;
  quoteNoteEn: string;
  qrHeadline: string;
  qrHeadlineEn: string;
  qrSubtitle: string;
  qrSubtitleEn: string;
  paymentMethods: string;
  lineUrl: string;
  shipFromPhone: string;
  shipFromPostcode: string;
  phone: string;
  linktreeUrl: string;
  logoKey: string | null;
  qrKey: string | null;
}

/** The boxes แก้ไข turns the page into; accounts and pictures save on their own. */
export type TextDraft = Omit<ShopInfo, "paymentMethods" | "logoKey" | "qrKey">;

/** The fields kept in Thai and English (`name` + `nameEn` …). */
export type Bilingual = "name" | "address" | "quoteNote" | "qrHeadline" | "qrSubtitle";

/** The box that holds `key` in `lang`. */
export function langField(key: Bilingual, lang: ShopLang): keyof TextDraft {
  return lang === "en" ? `${key}En` : key;
}

/** The shop's own name and address: in the chosen language, else the other, never blank. */
export function titleIn(info: ShopInfo, key: "name" | "address", lang: ShopLang): string {
  const own = info[langField(key, lang)].trim();
  return own || info[langField(key, lang === "en" ? "th" : "en")].trim();
}

/** A ตั้งค่าบิล text as the bill prints it in that language; a dash when there is none yet. */
export function shownIn(info: ShopInfo, key: Bilingual, lang: ShopLang): string {
  return info[langField(key, lang)].trim() || "—";
}

/** "พร้อมเพย์ 0812344421 · ค่าเริ่มต้น" under the account's name. */
export function accountLine(method: PaymentMethod, isDefault: boolean): Phrase {
  return {
    th: `พร้อมเพย์ ${method.promptpayId}${isDefault ? " · ค่าเริ่มต้น" : ""}`,
    en: `PromptPay ${method.promptpayId}${isDefault ? " · Default" : ""}`,
  };
}

/** The account sheet's boxes. `id` is null for ＋ เพิ่มบัญชี. */
export interface AccountDraft {
  id: string | null;
  label: string;
  position: string;
  accountName: string;
  promptpayId: string;
  isDefault: boolean;
}

/** A new account; the shop's first one is its default. */
export function blankDraft(list: PaymentMethod[]): AccountDraft {
  return {
    id: null,
    label: "",
    position: "",
    accountName: "",
    promptpayId: "",
    isDefault: list.length === 0,
  };
}

/** An account as its sheet shows it; with no flag saved, the first one is the default. */
export function draftOf(method: PaymentMethod, list: PaymentMethod[]): AccountDraft {
  return {
    id: method.id,
    label: method.label,
    position: method.position,
    accountName: method.accountName ?? "",
    promptpayId: method.promptpayId,
    isDefault: defaultPaymentMethod(list)?.id === method.id,
  };
}

function isPromptPay(id: string): boolean {
  try {
    formatPromptPayTarget(id);
    return true;
  } catch {
    return false;
  }
}

/** The red lines under the boxes: an empty name or PromptPay, or a PromptPay no QR can use. */
export function accountProblems(
  draft: AccountDraft,
): Partial<Record<"label" | "promptpayId", Phrase>> {
  const out: Partial<Record<"label" | "promptpayId", Phrase>> = {};
  if (!draft.label.trim()) out.label = { th: "ยังไม่ได้ใส่ชื่อ", en: "Name is empty" };
  const id = draft.promptpayId.trim();
  if (!id) out.promptpayId = { th: "ยังไม่ได้ใส่พร้อมเพย์", en: "PromptPay is empty" };
  else if (!isPromptPay(id)) {
    out.promptpayId = {
      th: "ใส่เบอร์มือถือ 10 หลัก เลขบัตร 13 หลัก หรือ e-wallet 15 หลัก",
      en: "Use a 10-digit mobile, a 13-digit ID or a 15-digit e-wallet",
    };
  }
  return out;
}

/** The list after บันทึก: an edit keeps its place, a new one goes last; one default at most. */
export function saveAccount(
  list: PaymentMethod[],
  draft: AccountDraft,
  newId: string,
): PaymentMethod[] {
  const id = draft.id ?? newId;
  const accountName = draft.accountName.trim();
  const saved: PaymentMethod = {
    id,
    position: draft.position.trim(),
    label: draft.label.trim(),
    promptpayId: draft.promptpayId.trim(),
    ...(accountName ? { accountName } : {}),
    ...(draft.isDefault ? { isDefault: true } : {}),
  };
  const others = (m: PaymentMethod): PaymentMethod => {
    if (!draft.isDefault || !m.isDefault) return m;
    const { isDefault: _dropped, ...rest } = m;
    return rest;
  };
  const kept = list.map((m) => (m.id === id ? saved : others(m)));
  return list.some((m) => m.id === id) ? kept : [...kept, saved];
}

export function removeAccount(list: PaymentMethod[], id: string): PaymentMethod[] {
  return list.filter((m) => m.id !== id);
}

/** The edit boxes, filled from what is saved. */
export function textDraft(info: ShopInfo): TextDraft {
  const { paymentMethods: _p, logoKey: _l, qrKey: _q, ...text } = info;
  return text;
}

/** Only what was changed goes to the server (it keeps every field not sent). */
export function changedFields(info: ShopInfo, draft: TextDraft): Partial<TextDraft> {
  const out: Partial<TextDraft> = {};
  for (const key of Object.keys(draft) as (keyof TextDraft)[]) {
    if (draft[key].trim() !== info[key].trim()) out[key] = draft[key].trim();
  }
  return out;
}

/** "คัดลอกเบอร์โทรแล้ว" — said only after the copy really happened. */
export function copiedToast(what: Phrase): Phrase {
  // Thai runs on without spaces, but an English word ("LINE OA") needs one before แล้ว.
  const gap = /[A-Za-z0-9]$/.test(what.th) ? " " : "";
  return { th: `คัดลอก${what.th}${gap}แล้ว`, en: `Copied the ${what.en}` };
}
