/**
 * Affiliate cards, grouped for display by their managed category.
 *
 * The order inside a group is left exactly as the API sent it (sort_order, then newest) — that is
 * the order the storefront shelf uses, so the admin list shows the real running order rather than
 * re-sorting it into something that doesn't match the shop.
 */

/**
 * Where a newly added card goes in the running order: straight after the last one.
 *
 * The Add form no longer asks for this — the owner's point was that a hand-typed order number is
 * work with no payoff. Reordering, when they want it, is a separate job on the list itself.
 */
export function nextSortOrder(items: { sortOrder: number }[]): number {
  if (items.length === 0) return 0;
  return Math.max(...items.map((i) => i.sortOrder)) + 1;
}

export interface GroupableItem {
  categoryName: string | null;
  pinned: number;
}

export interface AffiliateGroup<T> {
  name: string;
  items: T[];
  /** How many of this group's cards are pinned to the AirPlus homepage. */
  pinnedCount: number;
}

const UNCATEGORISED = "Uncategorised";

export function groupAffiliateItems<T extends GroupableItem>(items: T[]): AffiliateGroup<T>[] {
  const byName = new Map<string, T[]>();
  for (const item of items) {
    const name = item.categoryName?.trim() || UNCATEGORISED;
    const bucket = byName.get(name);
    if (bucket) bucket.push(item);
    else byName.set(name, [item]);
  }

  return [...byName.entries()]
    .map(([name, groupItems]) => ({
      name,
      items: groupItems,
      pinnedCount: groupItems.filter((i) => i.pinned).length,
    }))
    .sort((a, b) => {
      // Filed groups first, alphabetically; the loose pile always sits at the bottom.
      if (a.name === UNCATEGORISED) return 1;
      if (b.name === UNCATEGORISED) return -1;
      return a.name.localeCompare(b.name);
    });
}
