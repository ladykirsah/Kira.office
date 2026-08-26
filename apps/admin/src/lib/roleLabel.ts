import type { Phrase } from "./lang";

/**
 * What each role is CALLED on screen, in both languages, in one place.
 *
 * It was written out three times — the chip in the top bar, the staff profile editor and the /me
 * page — and two of those copies were English-only. Three copies of three words is three chances
 * for the shop owner to be called something different on different screens.
 *
 * `super_admin` reads as **เจ้าของร้าน** rather than a literal translation: in this shop there is
 * exactly one, and "the owner" is what everybody actually calls them.
 */
export const ROLE_LABEL: Record<string, Phrase> = {
  super_admin: { th: "เจ้าของร้าน", en: "Super admin" },
  admin: { th: "ผู้ดูแล", en: "Admin" },
  mechanic: { th: "ช่าง", en: "Mechanic" },
};
