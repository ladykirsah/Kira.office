/**
 * Storefront: group the product categories index by car system (usage_categories). Product
 * categories are a subset of car systems (product_types.usage_id, migration 0064); the /categories
 * page shows each system as a heading with its categories beneath, so shoppers see the hierarchy.
 * Pure + tested; the page and the DB query stay thin.
 */

export interface CategoryRow {
  id: string;
  name: string;
  nameTh: string | null;
  nameEn: string | null;
  productCount: number;
  imageKey: string | null;
  /** Car system link (migration 0064). null → unlinked (shouldn't happen once all are backfilled). */
  usageId: string | null;
  systemName: string | null;
  systemNameTh: string | null;
  systemNameEn: string | null;
}

export interface SystemGroup {
  /** The car system heading; null for the trailing "unlinked" bucket. */
  system: { id: string; name: string; nameTh: string | null; nameEn: string | null } | null;
  categories: CategoryRow[];
}

export function groupCategoriesBySystem(cats: CategoryRow[]): SystemGroup[] {
  const bySystem = new Map<string, SystemGroup>(); // insertion order = first-seen system order
  let unlinked: SystemGroup | null = null;
  for (const c of cats) {
    if (c.usageId) {
      let group = bySystem.get(c.usageId);
      if (!group) {
        group = {
          system: {
            id: c.usageId,
            name: c.systemName ?? "",
            nameTh: c.systemNameTh,
            nameEn: c.systemNameEn,
          },
          categories: [],
        };
        bySystem.set(c.usageId, group);
      }
      group.categories.push(c);
    } else {
      (unlinked ??= { system: null, categories: [] }).categories.push(c);
    }
  }
  const groups = [...bySystem.values()];
  if (unlinked) groups.push(unlinked); // trailing bucket for stray/unlinked categories
  return groups;
}
