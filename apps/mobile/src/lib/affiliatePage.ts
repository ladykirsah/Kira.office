import type { Phrase } from "@l-shopee/shared/lang";

/**
 * สินค้านายหน้า (canvas v238, built 1 Nov 2026): cards that send AirPlus customers to a Shopee or
 * Lazada page. The list groups them by category, with the ones not yet filed behind จัดหมวด; one
 * form adds and edits; a Lazada link fills its price in by itself. No screen code here.
 */

export type AffiliateSource = "shopee" | "lazada" | "other";

/** One card as /affiliate-items lists it, with its lifetime clicks. */
export interface AffiliateItem {
  id: string;
  title: string;
  imageKey: string | null;
  /** Display text ("฿1,290"); never used for sums. */
  priceText: string | null;
  source: AffiliateSource;
  targetUrl: string;
  sortOrder: number;
  status: "active" | "disabled";
  createdAt: number;
  categoryId: string | null;
  categoryName: string | null;
  /** 1 = pinned to the AirPlus home page shelf. */
  pinned: number;
  clicks: number;
}

export interface AffiliateCategory {
  id: string;
  name: string;
  sortOrder: number;
}

/** The form, in the order the owner set: store, then ลิงก์ · ชื่อ · ราคา · หมวดหมู่, then แสดง · ปักหมุด. */
export interface AffiliateForm {
  source: AffiliateSource;
  link: string;
  name: string;
  price: string;
  categoryId: string | null;
  shown: boolean;
  pinned: boolean;
}

export type PriceLookup = "idle" | "looking" | "found" | "failed";

/** The AirPlus home page shows this many pinned cards; the rest wait their turn. */
export const HOME_SLOTS = 6;

export const SOURCES: readonly AffiliateSource[] = ["shopee", "lazada", "other"];

export const SOURCE_LABEL: Record<AffiliateSource, Phrase> = {
  shopee: { th: "Shopee", en: "Shopee" },
  lazada: { th: "Lazada", en: "Lazada" },
  other: { th: "อื่น ๆ", en: "Other" },
};

export function emptyForm(): AffiliateForm {
  return {
    source: "shopee",
    link: "",
    name: "",
    price: "",
    categoryId: null,
    shown: true,
    pinned: false,
  };
}

export function formOf(item: AffiliateItem): AffiliateForm {
  return {
    source: item.source,
    link: item.targetUrl,
    name: item.title,
    price: item.priceText ?? "",
    categoryId: item.categoryId,
    shown: item.status === "active",
    pinned: item.pinned === 1,
  };
}

/** On the home page shelf: pinned, and shown (the shop never shows a card that is off). */
const onHome = (i: AffiliateItem) => i.pinned === 1 && i.status === "active";

/** The filed cards, one group per category by name; inside a group, the shop's running order. */
export function filedGroups(
  items: AffiliateItem[],
): { id: string; name: string; items: AffiliateItem[] }[] {
  const groups = new Map<string, { id: string; name: string; items: AffiliateItem[] }>();
  for (const i of items) {
    if (!i.categoryId) continue;
    const group = groups.get(i.categoryId);
    if (group) group.items.push(i);
    else groups.set(i.categoryId, { id: i.categoryId, name: i.categoryName ?? "", items: [i] });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, "th"));
}

/** Cards with no category yet; customers find them only on the home page. */
export function unfiled(items: AffiliateItem[]): AffiliateItem[] {
  return items.filter((i) => !i.categoryId);
}

/** ปักหมุดหน้าแรก's value: "3 จาก 6", or "7 · แสดง 6 อันแรก" once there are more than fit. */
export function pinLine(items: AffiliateItem[]): Phrase {
  const n = items.filter(onHome).length;
  if (n <= HOME_SLOTS) return { th: `${n} จาก ${HOME_SLOTS}`, en: `${n} of ${HOME_SLOTS}` };
  return {
    th: `${n} · แสดง ${HOME_SLOTS} อันแรก`,
    en: `${n} · the first ${HOME_SLOTS} show`,
  };
}

/** A row's second line: "Shopee · ฿1,290", or just the store when there is no price. */
export function rowSub(item: AffiliateItem): Phrase {
  const store = SOURCE_LABEL[item.source] ?? SOURCE_LABEL.other;
  if (!item.priceText) return store;
  return { th: `${store.th} · ${item.priceText}`, en: `${store.en} · ${item.priceText}` };
}

/** A row's third line: its clicks and a pin when it is on the home page, or ปิดอยู่ when off. */
export function rowState(
  item: AffiliateItem,
): { kind: "off" } | { kind: "on"; clicks: number; home: boolean } {
  if (item.status !== "active") return { kind: "off" };
  return { kind: "on", clicks: item.clicks, home: item.pinned === 1 };
}

const HTTPS = /^https:\/\/\S+$/i;

/** What the server would refuse, said under the field (canvas: บันทึกไม่ได้ → บอกตรงช่องที่ผิด). */
export function formErrors(form: AffiliateForm): { name?: Phrase; link?: Phrase } {
  const errors: { name?: Phrase; link?: Phrase } = {};
  if (!HTTPS.test(form.link.trim())) {
    errors.link = {
      th: "ลิงก์ต้องขึ้นต้นด้วย https://",
      en: "The link must start with https://",
    };
  }
  if (!form.name.trim()) errors.name = { th: "ต้องมีชื่อ", en: "Needs a name" };
  return errors;
}

/** A typed number becomes the shop's "฿1,290"; any other words stay as typed; blank is no price. */
export function priceText(typed: string): string | null {
  const s = typed.trim();
  if (!s) return null;
  const m = /^฿?\s*([\d,]+(?:\.\d+)?)$/.exec(s);
  if (!m) return s;
  const baht = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(baht)) return s;
  const whole = Number.isInteger(baht);
  return `฿${baht.toLocaleString("en-US", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** A new card goes straight after the last one in the shop's running order. */
export function createBody(form: AffiliateForm, items: AffiliateItem[]) {
  return {
    title: form.name.trim(),
    targetUrl: form.link.trim(),
    priceText: priceText(form.price),
    source: form.source,
    sortOrder: items.length ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 0,
    categoryId: form.categoryId,
    pinned: form.pinned,
  };
}

/** แก้ไข saves every field; แสดง is the card's status. */
export function patchBody(form: AffiliateForm) {
  return {
    title: form.name.trim(),
    targetUrl: form.link.trim(),
    priceText: priceText(form.price),
    source: form.source,
    categoryId: form.categoryId,
    pinned: form.pinned,
    status: form.shown ? ("active" as const) : ("disabled" as const),
  };
}

/** How many cards will be on the home page once this form is saved (`id`: the card being edited). */
export function pinnedAfterSave(
  items: AffiliateItem[],
  form: AffiliateForm,
  id: string | null,
): number {
  const others = items.filter((i) => i.id !== id && onHome(i)).length;
  return others + (form.pinned && form.shown ? 1 : 0);
}

/** Said on the list after a save that pinned more than the home page shows. */
export function pinToast(count: number): { title: Phrase; detail: Phrase } | null {
  if (count <= HOME_SLOTS) return null;
  return {
    title: { th: `ปักหมุดแล้ว ${count} รายการ`, en: `${count} cards pinned` },
    detail: {
      th: `หน้าแรกแสดง ${HOME_SLOTS} อันแรก · ถอดหมุดอันที่ไม่ใช้ออก`,
      en: `The home page shows the first ${HOME_SLOTS} · unpin the ones you don't need`,
    },
  };
}

/** Only a Lazada Thailand https link is worth asking the server about (Shopee blocks reading). */
export function isLazadaLink(link: string): boolean {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  return url.hostname === "lazada.co.th" || url.hostname.endsWith(".lazada.co.th");
}

/** The grey line under การ์ด while a Lazada link's price is looked up (canvas v238). */
export function priceNote(state: PriceLookup): Phrase | null {
  switch (state) {
    case "looking":
      return { th: "กำลังดูราคาจาก Lazada…", en: "Checking the price on Lazada…" };
    case "found":
      return {
        th: "ราคาต่ำสุดจาก Lazada · แก้ได้",
        en: "Lowest price on Lazada · you can change it",
      };
    case "failed":
      return { th: "ดูราคาจากลิงก์ไม่ได้ · พิมพ์เอง", en: "Couldn't read the price · type it" };
    default:
      return null;
  }
}
