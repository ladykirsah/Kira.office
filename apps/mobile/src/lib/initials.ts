/** Thai vowels written before their consonant; a name's "first letter" is the consonant after them. */
const LEADING_VOWELS = new Set(["เ", "แ", "โ", "ใ", "ไ"]);

/** The letters on the round account badge: the first letter of the first two names, e.g. "KS". */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => [...word].find((ch) => !LEADING_VOWELS.has(ch)) ?? "")
    .join("")
    .toUpperCase();
  return letters || "?";
}
