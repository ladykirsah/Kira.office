/**
 * Pages Scan and การชำระเงิน open inside this app. They used to hand over to the old back office
 * (owner, 2026-10-26: "open the old back office for Add product, the product page …"); every one of
 * them is rebuilt here now, and this app takes over admin.airplusauto.com (owner, 4 Nov 2026).
 */

/** เพิ่มสินค้า with a code Scan did not find already filled in (AddProductScreen reads `code`). */
export const addProductRoute = (code: string): string =>
  `/products/new?code=${encodeURIComponent(code)}`;

export const productRoute = (productId: string): string =>
  `/products/${encodeURIComponent(productId)}`;

/** ข้อมูลร้าน, where PromptPay accounts and their names are set. */
export const SHOP_INFO_ROUTE = "/settings/shop";
