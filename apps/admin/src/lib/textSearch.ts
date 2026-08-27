/**
 * The one place free-text "does this row match what I typed" is decided.
 *
 * WHY IT IS ITS OWN FILE: every product picker in the admin wrote this line by hand —
 * `p.productRef.toLowerCase().includes(q)` — and every one of them crashed the whole screen on a
 * product saved without a Product ID. A blank field is not an error; it just does not match.
 */

/** True if the query appears in any of the fields. A missing field never matches. Empty = all. */
export function matchesText(query: string, ...fields: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/**
 * True if the field IS the query — a LOOKUP, not a filter, which is why an empty query finds
 * nothing here while it matches everything above. "Show me the row I typed the code of" has no
 * answer when nothing has been typed. A missing field is never equal to anything.
 */
export function equalsText(query: string, field: string | null | undefined): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return (field ?? "").trim().toLowerCase() === q;
}
