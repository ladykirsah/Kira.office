/**
 * Shopee stock-sync delta (pure). Given local available stock per variant, the variant→Shopee-model
 * links, and the last-synced Shopee stock per model, computes which linked models need an update job
 * and the new quantity to push. The Worker/queue turns these into `product.update_stock` calls (or a
 * CSV stock export). Unlinked variants and no-change models are skipped.
 */

export interface VariantModelLink {
  productVariantId: string;
  shopeeModelId: string;
}

export interface ShopeeStockUpdate {
  shopeeModelId: string;
  newStock: number;
}

export function computeShopeeStockUpdates(
  localAvailableByVariant: Readonly<Record<string, number>>,
  links: VariantModelLink[],
  lastSyncedByModel: Readonly<Record<string, number>>,
): ShopeeStockUpdate[] {
  const updates: ShopeeStockUpdate[] = [];
  for (const link of links) {
    const newStock = localAvailableByVariant[link.productVariantId] ?? 0;
    if (newStock !== lastSyncedByModel[link.shopeeModelId]) {
      updates.push({ shopeeModelId: link.shopeeModelId, newStock });
    }
  }
  return updates;
}
