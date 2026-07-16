/**
 * "สินค้าแนะนำ" selection for the /search page — pure, so both cases are unit-tested with no DB/DOM.
 *
 * The server builds ONE ordered candidate pool (on-sale → best-sellers → latest, de-duped). The
 * /search page shows the pool head to a new visitor; for a returning visitor the client re-ranks the
 * SAME pool to surface products of the part-types they've recently viewed (so cards stay identical
 * and no extra request is needed). Both transforms live here.
 */

/** Minimal shapes — generic over the real CatalogItem so tests need no DB rows. */
export interface PoolItem {
  variantId: string;
  productId: string;
  typeName: string | null;
}

/** One ordered, de-duped candidate pool: on-sale → best-sellers → latest, capped. */
export function suggestionPool<T extends { variantId: string }>(
  onSale: T[],
  best: T[],
  latest: T[],
  cap = 16,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...onSale, ...best, ...latest]) {
    if (seen.has(item.variantId)) continue;
    seen.add(item.variantId);
    out.push(item);
    if (out.length >= cap) break;
  }
  return out;
}

/** Returning-visitor order: not-yet-viewed items of an interested part-type first, then the other
 *  not-viewed items, then already-viewed items as filler (so the grid stays full even on a small
 *  catalog). Since viewed items are only appended, they never appear while enough fresh items exist,
 *  and an all-viewed pool falls back to its head. Each group keeps the pool's original order. */
export function rerankByInterest<T extends PoolItem>(
  pool: T[],
  viewedProductIds: string[],
  interestedTypes: string[],
  cap = 6,
): T[] {
  const viewed = new Set(viewedProductIds);
  const interested = new Set(interestedTypes.filter(Boolean));
  const isMatch = (item: T) => item.typeName !== null && interested.has(item.typeName);
  const notViewed = pool.filter((item) => !viewed.has(item.productId));
  const viewedItems = pool.filter((item) => viewed.has(item.productId));
  return [
    ...notViewed.filter(isMatch),
    ...notViewed.filter((x) => !isMatch(x)),
    ...viewedItems, // filler only — appears after every fresh item
  ].slice(0, cap);
}
