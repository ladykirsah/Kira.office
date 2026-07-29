/**
 * A customer can give more than one number (owner, driver, office). They share the single
 * `customers.phone` column, comma-separated — the same shape the Excel import already produces —
 * so multiple numbers needed no schema change.
 */

const SEPARATOR = ", ";

/** Collapse the phone rows into the stored column: trimmed, no blanks, no duplicates. */
export function joinPhones(numbers: string[]): string {
  const seen: string[] = [];
  for (const raw of numbers) {
    const n = (raw ?? "").trim();
    if (n && !seen.includes(n)) seen.push(n);
  }
  return seen.join(SEPARATOR);
}

/** Read the stored column back as separate numbers, tolerating untidy imported data. */
export function splitPhones(stored: string | null | undefined): string[] {
  return (stored ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}
