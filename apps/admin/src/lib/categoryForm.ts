/**
 * Pure helpers behind the Product categories / attribute add-forms.
 *
 * Kept out of the component so the rules that actually bit us in production are testable:
 * an empty submit used to do nothing at all (the Add button was `disabled` on empty input, so
 * the click never fired a request), and a duplicate submit used to report success because the
 * API's `addAttribute` is find-or-create.
 */

/**
 * Warranty window in whole days, or `null` for "not set" (the storefront then shows nothing).
 *
 * `null` and `0` are DIFFERENT: `0` is an explicit "no warranty on this category", `null` is
 * "no value entered". Unparseable text is `null`, never `0` — `Number(x) || 0` would quietly
 * turn a typo into a real "0 วัน" warranty on every product in the category.
 */
export function parseWarrantyDays(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n));
}

export type AttributeNameCheck = { ok: true; value: string } | { ok: false; error: string };

/**
 * Validate a new attribute/category name against the list already on screen.
 *
 * Duplicates are matched case-insensitively to mirror the API, whose lookup is
 * `WHERE name = ? COLLATE NOCASE` — otherwise "denso" would look accepted here and then silently
 * resolve to the existing DENSO row server-side.
 */
export function validateAttributeName(raw: string, existing: string[]): AttributeNameCheck {
  const value = raw.trim();
  if (value === "") return { ok: false, error: "Type a name first." };
  const clash = existing.some((e) => e.trim().toLowerCase() === value.toLowerCase());
  if (clash) return { ok: false, error: `“${value}” is already in the list.` };
  return { ok: true, value };
}
