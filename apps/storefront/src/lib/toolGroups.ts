import { toolCategorySlug } from "./toolSlug";

/**
 * The /tools shelf: one section per category, busiest first.
 *
 * Cards with no category are dropped — the owner's call (2026-07-29): the shop stays tidy, and the
 * admin list flags an unfiled card so hiding is never silent. Ordering by real clicks means the
 * section customers actually use rises on its own, with no ordering field to maintain.
 */

/** Cards rendered per section: 5 desktop columns × 2 rows. The rest live behind ดูทั้งหมด. */
export const SECTION_CARDS = 10;

export interface ToolCard {
  categoryName: string | null;
  clicks: number;
}

export interface ToolSection<T> {
  name: string;
  slug: string;
  /** every card in the category, not just the ones shown — this is what ดูทั้งหมด counts */
  total: number;
  items: T[];
}

export function groupToolsByCategory<T extends ToolCard>(items: T[]): ToolSection<T>[] {
  const byName = new Map<string, T[]>();
  for (const item of items) {
    const name = item.categoryName?.trim();
    if (!name) continue; // unfiled → not on the shop
    const bucket = byName.get(name);
    if (bucket) bucket.push(item);
    else byName.set(name, [item]);
  }

  return [...byName.entries()]
    .map(([name, cards]) => ({
      name,
      slug: toolCategorySlug(name),
      total: cards.length,
      items: cards.slice(0, SECTION_CARDS),
      clicks: cards.reduce((sum, c) => sum + (c.clicks || 0), 0),
    }))
    .sort((a, b) => b.clicks - a.clicks || a.name.localeCompare(b.name))
    .map(({ clicks: _clicks, ...section }) => section);
}
