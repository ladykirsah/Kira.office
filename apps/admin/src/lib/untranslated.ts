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
 * WHERE TEXT HIDES. The first version of this looked only at JSX text sitting on one line and at a
 * short list of attributes, and it called the coupons screen clean while a third of it was English
 * (2026-08-26). Four blind spots, all of them ordinary code:
 *   - text prettier WRAPPED onto its own line, or across several
 *   - a phrase picked inside braces — `{busy ? "Saving…" : "Save"}`
 *   - a message that POPS UP — `toast("Draft saved")` is a screen too, and is not JSX at all
 *   - a label built with a BACKTICK — `` `Added ${p.name}` ``
 * So every string literal is judged now, wherever it sits, and the question moved from "is this in
 * a place I know about" to "does this read like something a person reads".
 *
 * WHAT COUNTS AS A MISS:
 *   - an English phrase anywhere a person could read it
 *   - a bare Thai string, which shows Thai even when the page is in English
 *
 * WHAT DOES NOT, and why each one is deliberate rather than an oversight:
 *   - SHOUTY_CONSTANTS, css classes, ids, urls: matched by machines, not read by people
 *   - names: AirPlus, Shopee, Kira.office, Den Air Service — a name is not a word to translate
 *   - the name of a keyboard key, a font, an import path, an object key
 *   - anything already inside `t({ th, en })`
 *
 * A FINDER THAT CRIES WOLF GETS IGNORED, which is the same as not having one. Every exclusion above
 * is a test, not a note.
 */

const ATTRS = ["label", "placeholder", "title", "aria-label", "alt", "subtitle", "hint"];
/**
 * Thai LETTERS, deliberately excluding ฿ (U+0E3F). The baht sign lives in the Thai Unicode block but
 * is not Thai text — it appears in English labels like "Item cost ฿", and a naive block test called
 * every one of those an untranslated Thai string. That false alarm cost a pass of this sweep.
 */
const THAI = /[ก-฾เ-๿]/;

/** Names, not words. Translating these would be wrong, not merely unnecessary. */
const NAMES = [
  "AirPlus",
  "AirPlus Auto",
  "Shopee",
  "Kira.office",
  "Den Air Service",
  "Air+Plus",
  "AC on Sales",
];

function stripComments(src: string): string {
  return (
    src
      .replace(/\/\*[\s\S]*?\*\//g, (m) => "\n".repeat((m.match(/\n/g) ?? []).length))
      .replace(/^[ \t]*\/\/.*$/gm, "")
      // A comment at the END of a line of code counts too. One of these, sitting between two JSX
      // branches, was reported as text on a screen. The character before the slashes must not be a
      // colon, or every https:// link in the file would lose its tail.
      .replace(/([^:'"`\\])\/\/.*$/gm, "$1")
  );
}

/** Is this a phrase a person reads, rather than something a machine matches? */
export function isUserFacing(value: string): boolean {
  // Leading emoji and punctuation are stripped before judging: "💵 Cash bill" is a phrase a person
  // reads, but it does not START with a capital, so the test below skipped four POS buttons.
  const v = value.trim().replace(/^[^\p{L}]+/u, "");
  if (v.length < 3) return false;
  if (NAMES.includes(v)) return false;
  if (THAI.test(v)) return true;
  if (!/[a-z]/.test(v)) return false; // SHOUTY constants and codes
  if (/^[a-z0-9_.\-/]+$/.test(v)) return false; // classes, keys, paths
  if (/^(https?:|\/|#|var\(|--)/.test(v)) return false;
  if (/^[A-Z][A-Za-z]/.test(v)) return true;
  return readsLikeProse(value, v);
}

/**
 * A phrase does not have to start with a capital. `" · editing now"` and `"queued sale(s) could not
 * sync"` were both sitting in English on the POS screen, and neither begins with one.
 *
 * The line between prose and a style value is drawn at THREE WORDS with no digit anywhere: a css
 * declaration that survives that ("solid var border") is not a thing anyone writes, while a
 * sentence short enough to fail it is rare. Digits rule out the whole `1px solid …` family in one
 * stroke — checked against the string as typed, before the leading `1` is trimmed off.
 */
function readsLikeProse(raw: string, trimmed: string): boolean {
  if (/[0-9]/.test(raw)) return false;
  if (!/^[a-z]/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter((w) => /^[a-zA-Z][a-zA-Z'’().,—-]*$/.test(w));
  return words.length >= 3 && words.filter((w) => w.length >= 3).length >= 2;
}

/**
 * What sits immediately before a string can settle that it is not a phrase on a screen. Checked by
 * context rather than by a list of words, so that banning the KEY "Delete" does not also ban the
 * BUTTON "Delete".
 */
function machineSlot(before: string): boolean {
  const tail = before.slice(-48);
  return (
    /\.key\s*(===|!==|==|!=)\s*$/.test(tail) || // e.key === "Escape"
    /\bcase\s*$/.test(tail) || // case "ArrowDown":
    /\bfont(Family|-family)?\s*[:=]\s*$/i.test(tail) || // fontFamily: "Thonburi"
    /\bfrom\s*$/.test(tail) || // import … from "…"
    /\b(import|require)\(\s*$/.test(tail)
  );
}

/**
 * Already one half of a `t({ th, en })` pair — the one place a single language is the right answer.
 *
 * The `th:`/`en:` window is generous because prettier puts a long phrase on its own line, leaving
 * the key a line and an indent behind it.
 */
function insidePhrase(before: string): boolean {
  if (/\b(th|en):\s*$/.test(before.slice(-24))) return true;
  const open = before.lastIndexOf("t({");
  return open !== -1 && !before.slice(open).includes("})");
}

/**
 * Takes the `${…}` holes out of a backtick label, braces inside them included, leaving only the
 * words actually written here. A hole holds CODE — and code that reads `t({ th: "ย่อ", en:
 * "Collapse" })` is the answer, not the problem. Counting braces rather than stopping at the first
 * `}` is the whole point: `t({ … })` closes two of them.
 */
function withoutHoles(template: string): string {
  let out = "";
  for (let i = 0; i < template.length; i++) {
    if (template[i] !== "$" || template[i + 1] !== "{") {
      out += template[i];
      continue;
    }
    let depth = 1;
    i += 2;
    while (i < template.length && depth > 0) {
      if (template[i] === "{") depth++;
      else if (template[i] === "}") depth--;
      i++;
    }
    i--;
    out += " ";
  }
  return out;
}

export interface Untranslated {
  line: number;
  text: string;
}

export function findUntranslated(source: string): Untranslated[] {
  const src = stripComments(source);
  const at = (i: number) => src.slice(0, i).split("\n").length;
  const out: Untranslated[] = [];
  const seen = new Set<string>();
  const add = (index: number, text: string) => {
    const key = `${index}|${text}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ line: at(index), text });
  };

  // The attributes a person reads keep their own shape in the report — `placeholder="…"` says more
  // about where to look than the bare words do.
  const spoken: Array<[number, number]> = [];
  const attr = new RegExp(`\\b(${ATTRS.join("|")})="([^"]{2,})"`, "g");
  for (const m of src.matchAll(attr)) {
    spoken.push([m.index, m.index + m[0].length]);
    if (isUserFacing(m[2]!)) add(m.index, `${m[1]}="${m[2]}"`);
  }
  const alreadyReported = (i: number) => spoken.some(([a, b]) => i >= a && i < b);

  // JSX text on the tag's own line. `=>` is an arrow, not a tag: `() => Promise<void>` was being
  // read as the word "Promise" sitting on a screen.
  for (const m of src.matchAll(/(.)>[ \t]*([^<>{}\n][^<>{}\n]*?)[ \t]*</g)) {
    if (m[1] === "=") continue;
    if (isUserFacing(m[2]!)) add(m.index, m[2]!.trim());
  }
  // Text with a count in the middle of it — `Items ({lines.length})`, `{held} on hold` — where the
  // expression ends one run of text and starts another. Each half is looked at on its own.
  for (const m of src.matchAll(/(.)>[ \t]*([^<>{}\n][^<>{}\n]*?)[ \t]*\{/g)) {
    // `>` closes a tag in JSX and means GREATER THAN everywhere else. A tag's `>` follows the last
    // thing in the tag or sits alone on its own line; a comparison's has a space in front of it and
    // an `=` behind it. That tells the two apart without parsing the file.
    if (m[1] === "=" || m[1] === " ") continue;
    if (isUserFacing(m[2]!)) add(m.index, m[2]!.trim());
  }
  for (const m of src.matchAll(/\}[ \t]*([^<>{}\n][^<>{}\n]*?)[ \t]*</g)) {
    if (isUserFacing(m[1]!)) add(m.index, m[1]!.trim());
  }

  // JSX text prettier wrapped onto its own line, or across several of them. This reach — from one
  // `>` to the next `<` — can step over the CODE between two JSX branches, so a line that declares
  // something is not a line anybody reads.
  for (const m of src.matchAll(/(.)>[ \t]*\n([^<>{}]+?)\n[ \t]*</g)) {
    if (m[1] === "=") continue;
    const text = m[2]!.trim().replace(/\s+/g, " ");
    if (/(^|\s)(const|let|var|return|function)\s+\w+\s*[=;]/.test(text)) continue;
    if (isUserFacing(text)) add(m.index, text);
  }

  // Every other string: ternaries, toasts, props outside the list above.
  for (const m of src.matchAll(/"([^"\n]+)"/g)) {
    const value = m[1]!;
    if (alreadyReported(m.index)) continue;
    if (src[m.index + m[0].length] === ":") continue; // an object key, read by no one
    const before = src.slice(Math.max(0, m.index - 400), m.index);
    if (insidePhrase(before) || machineSlot(before)) continue;
    if (THAI.test(value)) add(m.index, `bare Thai: ${value}`);
    else if (isUserFacing(value)) add(m.index, value);
  }

  // Labels built with a backtick. Judged on the words, reported whole — the ${…} holes are where
  // the data goes, and hiding them would make the hit hard to find in the file.
  for (const m of src.matchAll(/`([^`]+)`/g)) {
    const value = m[1]!;
    const before = src.slice(Math.max(0, m.index - 400), m.index);
    if (insidePhrase(before) || machineSlot(before)) continue;
    const words = withoutHoles(value);
    if (THAI.test(words)) add(m.index, `bare Thai: ${value}`);
    else if (isUserFacing(words)) add(m.index, value);
  }
  return out;
}
