/**
 * Storefront contact links.
 *
 * All "ช่วยหาอะไหล่ / ช่วยเหลือ / เพิ่มเพื่อน LINE" actions route to the in-app `/line` page, which shows
 * the owner-provided LINE OA add-friend QR (public/line-oa-qr.png). This is an INTERNAL path, so link
 * to it with next/link (not a new-tab external `<a>`).
 * TODO(owner input): once the LINE add-friend DEEP LINK (`https://lin.ee/<code>` or `@<basic-id>`) is
 * provided, add a "เปิด LINE" button on /line so mobile shoppers add the OA in one tap.
 */
export const LINE_OA_URL = "/line";
