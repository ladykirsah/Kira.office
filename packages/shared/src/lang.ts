/**
 * Thai or English, chosen with a button in the top bar and remembered (owner, 2026-08-25).
 *
 * NOT THE SAME MACHINERY AS DARK MODE, and the owner was told why before this was built. Dark mode
 * is colour: the browser repaints text that is already on the page, so `localStorage` and a CSS
 * attribute are enough and nothing has to be fetched. Language is the text ITSELF, and most of this
 * app writes its text on the server before it reaches the browser. So the choice has to be
 * something the server can read on the next request — a cookie — and switching costs one render
 * rather than one repaint. Same button, same place, same "remembers what you picked".
 *
 * BOTH LANGUAGES ARE WRITTEN AT THE POINT OF USE, as `{ th: "…", en: "…" }`, rather than as keys
 * pointing into a dictionary file. With no translator in the loop, keys buy nothing and cost real
 * accuracy: a phrase and its translation sitting on one line cannot drift apart, a screen can be
 * reviewed by reading the screen's own file, and nothing can rot into an orphan key in a file
 * nobody opens. The trade — no machine-extractable string table — is a trade worth making for one
 * shop's back office.
 */

export type Lang = "th" | "en";

/** One thing to say, in both languages. Written together so they cannot drift apart. */
export interface Phrase {
  th: string;
  en: string;
}

export const LANG_COOKIE = "kira-lang";

/**
 * THAI IS THE DEFAULT (owner, 2026-08-25): a Thai mechanic signing in for the first time should not
 * have to find a button before the screen speaks to them.
 *
 * Anything unrecognised falls back rather than being passed on. The cookie is typed by whoever holds
 * the browser, so it is untrusted input like any other — and a raw value reaching a lookup as a key
 * is how `__proto__` stops being funny.
 */
export function readLang(raw: string | null): Lang {
  return raw === "en" ? "en" : "th";
}

/** The one the button would switch to — what its label has to promise. */
export function otherLang(lang: Lang): Lang {
  return lang === "th" ? "en" : "th";
}

export function say(lang: Lang, p: Phrase): string {
  return p[lang];
}
