import { CAR_BRAND_LOGO } from "./labels";
import { imgUrl } from "./img";

/**
 * The one place that decides which image represents a car brand.
 *
 * Precedence: the owner's uploaded cover (Kira.office → Car fitment) ALWAYS wins over the bundled
 * `/public/brands/*.png` fallback, which only ever covered three makes. `null` means neither
 * exists, and the caller renders its ✦ placeholder.
 *
 * This is a function rather than an inline expression because the rule was duplicated at three
 * call sites and one of them (the /search car grid) silently dropped `imageKey` — so an uploaded
 * logo appeared on the home page and /brands but not on /search, making the admin upload look
 * broken. One rule, one place, so the three surfaces cannot drift apart again.
 */
export function resolveBrandLogo(brand: string, imageKey: string | null): string | null {
  if (imageKey) return imgUrl(imageKey);
  return CAR_BRAND_LOGO[brand] ?? null;
}
