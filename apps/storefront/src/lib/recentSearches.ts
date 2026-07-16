/**
 * Recent-search terms — a small client-only localStorage list powering the /search page's
 * "ค้นหาล่าสุด" chips (the same best-effort, no-server bet as the cart and recently-viewed).
 * The list transform is a pure function so the dedupe/cap/trim rules are unit-tested without a DOM;
 * the read/write wrappers are thin localStorage adapters.
 */

export const RECENT_SEARCHES_KEY = "airplus.search.v1";
export const RECENT_SEARCHES_CAP = 8;

/** Pure: the recent-search list after searching `term` — trimmed, case-insensitively de-duped to the
 *  front, most-recent first, capped. A blank term is a no-op (returns the list, still capped). */
export function nextRecentSearches(
  list: string[],
  term: string,
  cap: number = RECENT_SEARCHES_CAP,
): string[] {
  const trimmed = term.trim();
  if (!trimmed) return list.slice(0, cap);
  const rest = list.filter((x) => x.trim().toLowerCase() !== trimmed.toLowerCase());
  return [trimmed, ...rest].slice(0, cap);
}

/** Read the stored recent searches (most-recent first); [] when empty/blocked/malformed. */
export function readRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

/** Record a search term at the front (dedupe/cap/trim via nextRecentSearches); best-effort. */
export function pushRecentSearch(term: string): void {
  try {
    window.localStorage.setItem(
      RECENT_SEARCHES_KEY,
      JSON.stringify(nextRecentSearches(readRecentSearches(), term)),
    );
  } catch {
    // localStorage blocked/full — recent searches are best-effort, never break search
  }
}
