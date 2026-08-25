import type { ProductRow } from "./api";
import type { Phrase } from "./lang";

/**
 * "What is stopping this product from selling?" — the second line in the Status cell.
 *
 * WHY IT EXISTS (owner, 2026-08-24). After migration 0088 the Not live tab held eight products and
 * every one of them read **Paused** — which is the name of the tab you are already looking at.
 * Nothing on screen said which could go back on the shop that afternoon and which needed a photo
 * shoot first; you had to open all eight to find out. Against the real eight this line splits them
 * into two ready, one needing stock, and five needing photos.
 *
 * The owner then asked for it on EVERY tab, not just Not live — so a product that is selling right
 * now without a picture says so too.
 *
 * IT NEVER REPEATS THE PILL. `productStatusTag` already flags stock on a live product as Out or
 * Low, so for a live product this line stays quiet about stock. A paused or draft product is pilled
 * for being off the shop, which says nothing about stock, so there the line does mention it. Saying
 * the same thing twice in one cell reads as a bug, not as emphasis.
 */
export interface ReadinessNote {
  text: Phrase;
  /** Nothing missing AND not live — the "you could put this back on sale" cue. Drawn in green. */
  ready: boolean;
}

/** The gaps, in a fixed order so the line reads the same way every time. */
function gaps(p: ProductRow): { short: Phrase; long: Phrase }[] {
  const live = p.status === "active";
  const out: { short: Phrase; long: Phrase }[] = [];
  if (!p.imageKey)
    out.push({
      short: { th: "ไม่มีรูป", en: "no photo" },
      long: { th: "ไม่มีรูป", en: "No photo" },
    });
  if (p.onlinePriceSatang <= 0)
    out.push({
      short: { th: "ไม่มีราคา", en: "no price" },
      long: { th: "ไม่มีราคา", en: "No price" },
    });
  // Only when the pill is not already saying it — see the note above.
  if (!live && p.onHand <= 0)
    out.push({
      short: { th: "ไม่มีสต็อก", en: "no stock" },
      long: { th: "ไม่มีสต็อก", en: "No stock" },
    });
  return out;
}

export function readinessNote(p: ProductRow): ReadinessNote | null {
  const found = gaps(p);
  if (found.length) {
    return {
      text: {
        th: found.map((g) => g.short.th).join(" · "),
        en: found.map((g) => g.short.en).join(" · "),
      },
      ready: false,
    };
  }
  // Nothing missing. A live product is already selling, so there is nothing worth a line.
  if (p.status === "active") return null;
  return { text: { th: "พร้อมขาย", en: "ready to sell" }, ready: true };
}

/**
 * The same facts as Sort by / Filter values, so "show me everything missing a photo" is one click
 * in the toolbar that already exists. A healthy live product has no value and sorts last, which is
 * how every other dimension already behaves.
 */
export function readinessValues(p: ProductRow): string[] {
  const found = gaps(p);
  if (found.length) return found.map((g) => g.long.en);
  return p.status === "active" ? [] : ["Ready to sell"];
}
