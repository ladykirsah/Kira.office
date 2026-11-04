import type { Phrase } from "@l-shopee/shared/lang";
import { navGroupsFor } from "@l-shopee/shared/nav";
import { DEFAULT_VIEW, ORDER_TABS, tabCounts, type OrderListRow, type OrderTab } from "./orderList";
import type { StaffRole } from "./signIn";

/**
 * หน้าหลัก as drawn (canvas v331, owner OK 4 Nov 2026): the order to-do tiles and the Shopee update
 * list the old back office's dashboard had. Words and rules only, no screen code.
 */

/** The four Orders tabs that need someone, in the drawing's order and in the tabs' own words. */
const TILE_TABS: readonly OrderTab[] = ["pending", "toship", "shipped", "refundclaim"];

export const HOME_TILES: readonly { tab: OrderTab; label: Phrase }[] = TILE_TABS.map((tab) => ({
  tab,
  label: ORDER_TABS.find((t) => t.key === tab)!.label,
}));

/** Each tile is a whole-tab shortcut: the number is what that tab shows when the Orders page opens. */
export function homeCounts(rows: readonly OrderListRow[], now: number): Record<OrderTab, number> {
  return tabCounts(rows, DEFAULT_VIEW, now);
}

/** The server's change since the last Shopee update (never 0 — it leaves those out). */
export function shopeeChange(delta: number): Phrase {
  const n = Math.abs(delta);
  return delta < 0
    ? { th: `ลดใน Shopee ${n}`, en: `Lower on Shopee by ${n}` }
    : { th: `เพิ่มใน Shopee ${n}`, en: `Raise on Shopee by ${n}` };
}

export const doneLine = (done: number, total: number): Phrase => ({
  th: `ทำแล้ว ${done} จาก ${total}`,
  en: `${done} of ${total} done`,
});

const DAYS: readonly Phrase[] = [
  { th: "อาทิตย์", en: "Sunday" },
  { th: "จันทร์", en: "Monday" },
  { th: "อังคาร", en: "Tuesday" },
  { th: "พุธ", en: "Wednesday" },
  { th: "พฤหัสบดี", en: "Thursday" },
  { th: "ศุกร์", en: "Friday" },
  { th: "เสาร์", en: "Saturday" },
];

const MONTHS: readonly Phrase[] = [
  { th: "มกราคม", en: "January" },
  { th: "กุมภาพันธ์", en: "February" },
  { th: "มีนาคม", en: "March" },
  { th: "เมษายน", en: "April" },
  { th: "พฤษภาคม", en: "May" },
  { th: "มิถุนายน", en: "June" },
  { th: "กรกฎาคม", en: "July" },
  { th: "สิงหาคม", en: "August" },
  { th: "กันยายน", en: "September" },
  { th: "ตุลาคม", en: "October" },
  { th: "พฤศจิกายน", en: "November" },
  { th: "ธันวาคม", en: "December" },
];

/** The grey line under the title: "พุธ 4 พฤศจิกายน" — no year, no clock time. */
export function todayLine(ms: number): Phrase {
  const d = new Date(ms);
  const day = DAYS[d.getDay()]!;
  const month = MONTHS[d.getMonth()]!;
  return {
    th: `${day.th} ${d.getDate()} ${month.th}`,
    en: `${day.en} ${d.getDate()} ${month.en}`,
  };
}

export const ordersTabRoute = (tab: OrderTab): string => `/orders?tab=${tab}`;

/** A tick stays until ล้างที่ทำแล้ว; one whose product already left the list goes with it. */
export function stillTicked(
  ticked: readonly string[],
  items: readonly { productId: string }[],
): string[] {
  const listed = new Set(items.map((i) => i.productId));
  return ticked.filter((id) => listed.has(id));
}

/** The ticks this phone saved; anything unreadable counts as none. */
export function readTicked(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** ดูภาพรวม AirPlus only for whoever has ภาพรวม AirPlus in their menu (today: the owner). */
export function showsInsightButton(role: StaffRole): boolean {
  return navGroupsFor(role).some((g) => g.links.some((l) => l.href === "/insights"));
}
