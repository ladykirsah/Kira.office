import type { Phrase } from "@l-shopee/shared/lang";
import { NAV_GROUPS, activeHref } from "@l-shopee/shared/nav";

const HOME: Phrase = { th: "หน้าหลัก", en: "Home" };
const NOT_FOUND: Phrase = { th: "ไม่พบหน้านี้", en: "Page not found" };

/**
 * The large title at the top of a screen. It is the menu link's own name, so the title, the bottom
 * bar and the ☰ menu always say the same word; a page under a link (a customer, a product) shows
 * its parent's name until that page is designed with a title of its own.
 */
export function pageTitle(path: string): Phrase {
  if (path === "/") return HOME;
  const href = activeHref(path);
  const link = NAV_GROUPS.flatMap((g) => g.links).find((l) => l.href === href);
  return link?.label ?? NOT_FOUND;
}
