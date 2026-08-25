/**
 * Finds user-facing text that has not been through the language toggle.
 *
 * WHY THIS EXISTS: the bilingual sweep was done screen by screen, by eye, and by eye it kept
 * missing things — a `title=` here, one column heading there, a hint under a photo grid. The owner
 * asked for "every spot" (2026-08-25), and eyes are the wrong tool for that. This is the tool.
 *
 * It reads source text rather than running the app, so it finds strings on screens nobody thought
 * to open — error branches, empty states, the third tab of a form.
 *
 * WHAT COUNTS AS A MISS:
 *   - an English phrase sitting as JSX text, or in a label/placeholder/title/aria-label/alt
 *   - a bare Thai string, which shows Thai even when the page is in English
 *
 * WHAT DOES NOT, and why each one is deliberate rather than an oversight:
 *   - SHOUTY_CONSTANTS, css classes, ids, urls: matched by machines, not read by people
 *   - names: AirPlus, Shopee, Kira.office, Den Air Service — a name is not a word to translate
 *   - anything already inside `t({ th, en })`
 */

const ATTRS = ["label", "placeholder", "title", "aria-label", "alt", "subtitle", "hint"];
/**
 * Thai LETTERS, deliberately excluding ฿ (U+0E3F). The baht sign lives in the Thai Unicode block but
 * is not Thai text — it appears in English labels like "Item cost ฿", and a naive block test called
 * every one of those an untranslated Thai string. That false alarm cost a pass of this sweep.
 */
const THAI = /[\u0E01-\u0E3E\u0E40-\u0E7F]/;

/** Names, not words. Translating these would be wrong, not merely unnecessary. */
const NAMES = ["AirPlus", "Shopee", "Kira.office", "Den Air Service", "Air+Plus", "AC on Sales"];

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/** Is this a phrase a person reads, rather than something a machine matches? */
export function isUserFacing(value: string): boolean {
  const v = value.trim();
  if (v.length < 3) return false;
  if (NAMES.includes(v)) return false;
  if (THAI.test(v)) return true;
  if (!/[a-z]/.test(v)) return false; // SHOUTY constants and codes
  if (/^[a-z0-9_.\-/]+$/.test(v)) return false; // classes, keys, paths
  if (/^(https?:|\/|#|var\(|--)/.test(v)) return false;
  return /^[A-Z][A-Za-z]/.test(v);
}

export interface Untranslated {
  line: number;
  text: string;
}

export function findUntranslated(source: string): Untranslated[] {
  const src = stripComments(source);
  const at = (i: number) => src.slice(0, i).split("\n").length;
  const out: Untranslated[] = [];

  const attr = new RegExp(`\\b(${ATTRS.join("|")})="([^"]{2,})"`, "g");
  for (const m of src.matchAll(attr)) {
    if (isUserFacing(m[2]!)) out.push({ line: at(m.index), text: `${m[1]}="${m[2]}"` });
  }
  for (const m of src.matchAll(/(.)>\s*([^<>{}\n][^<>{}]*?)\s*</g)) {
    // `=>` is an arrow, not a JSX tag: `() => Promise<void>` was being read as the word "Promise"
    // sitting on a screen.
    if (m[1] === "=") continue;
    if (isUserFacing(m[2]!)) out.push({ line: at(m.index), text: m[2]!.trim() });
  }
  // A Thai literal NOT sitting in a `th:` slot renders Thai in English too. The window is generous
  // because prettier wraps a long phrase onto its own line, putting `th:` well behind it.
  for (const m of src.matchAll(/"([^"\n]*[\u0E01-\u0E3E\u0E40-\u0E7F][^"\n]*)"/g)) {
    const before = src.slice(Math.max(0, m.index - 400), m.index);
    if (/\bth:\s*$/.test(before.slice(-8))) continue;
    // Inside a t({ … }) call that has not been closed yet: the English side of a pair may legally
    // quote a Thai term, e.g. en: "…one “จัดส่งแล้ว” entry".
    const open = before.lastIndexOf("t({");
    if (open !== -1 && !before.slice(open).includes("})")) continue;
    out.push({ line: at(m.index), text: `bare Thai: ${m[1]}` });
  }
  return out;
}
