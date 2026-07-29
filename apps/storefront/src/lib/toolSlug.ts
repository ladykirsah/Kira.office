/**
 * Category → URL segment for /tools/[slug].
 *
 * Thai survives intact: the browser percent-encodes it on the wire but shows it readable in the bar,
 * and a Thai shop's URLs reading Thai is worth more than an ASCII transliteration nobody recognises.
 * There is deliberately NO slug column — categories are few, so the page matches on read. That keeps
 * renaming a category a one-field edit instead of a migration.
 */
export function toolCategorySlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      // \p{M} matters: Thai vowels and tone marks are combining marks, not letters — without it
      // "เกจวัดน้ำยา" slugs to "เกจว-ดน-ำยา".
      .replace(/[^\p{L}\p{N}\p{M}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
  );
}

/** The category name a slug came from, or null when nothing matches (the page then 404s). */
export function matchCategorySlug(names: string[], slug: string): string | null {
  const wanted = toolCategorySlug(slug);
  if (!wanted) return null;
  return names.find((n) => toolCategorySlug(n) === wanted) ?? null;
}
