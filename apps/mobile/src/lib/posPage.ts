import type { Phrase } from "@l-shopee/shared/lang";

/**
 * ทำบิล on a computer (DeskPos board, 4 Nov 2026): the picker stays open on the left and a USB
 * barcode scanner types into its search box, ending with Enter. No screen code here.
 */

export type EnterPick<T> =
  { kind: "none" } | { kind: "add"; row: T } | { kind: "code"; code: string };

/** Enter in the picker's search box: one match goes on the bill; no match is a barcode to look up. */
export function pickOnEnter<T>(found: readonly T[], query: string): EnterPick<T> {
  const code = query.trim();
  if (!code) return { kind: "none" };
  if (found.length === 1) return { kind: "add", row: found[0]! };
  return found.length === 0 ? { kind: "code", code } : { kind: "none" };
}

/** The drafts panel's note: a phone swipes a row left to delete; a computer has a bin icon. */
export function draftsNote(desk: boolean): Phrase {
  return desk
    ? {
        th: "แตะเพื่อทำบิลต่อ · บิลที่ทำค้างไว้เก็บเป็นร่างให้ก่อน · แตะถังขยะเพื่อลบ (ถามก่อนลบ) · ฉบับร่างไม่ตัดสต็อก",
        en: "Click to carry on · the bill on screen is kept first · the bin deletes (asked first) · drafts take no stock",
      }
    : {
        th: "แตะเพื่อทำบิลต่อ · บิลที่ทำค้างไว้เก็บเป็นร่างให้ก่อน · ปัดซ้ายเพื่อลบ (ถามก่อนลบ) · ฉบับร่างไม่ตัดสต็อก",
        en: "Tap to carry on · the bill on screen is kept first · swipe left to delete (asked first) · drafts take no stock",
      };
}
