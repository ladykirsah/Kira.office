/**
 * Pages Scan hands over to that are not rebuilt in this app yet (owner, 2026-10-26: "open the old
 * back office for Add product, the product page and ทำบิล until those pages are rebuilt"). Both
 * apps read the same shop data, so a new code arrives there intact. Each of these goes away when its
 * page moves here; ทำบิล moved on 30 Oct 2026.
 */
export const OLD_BACK_OFFICE =
  process.env.EXPO_PUBLIC_ADMIN_BASE ?? "https://admin.airplusauto.com";

export function addProductPage(base: string, code: string): string {
  return `${base}/products/new?ref=${encodeURIComponent(code)}`;
}

export function productPage(base: string, productId: string): string {
  return `${base}/products/${encodeURIComponent(productId)}`;
}
