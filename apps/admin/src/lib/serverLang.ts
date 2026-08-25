import { cookies } from "next/headers";
import { LANG_COOKIE, readLang, say, type Lang, type Phrase } from "./lang";

/**
 * The language for THIS request, for server components — the layout, and every page that writes its
 * own headings before the browser sees them.
 *
 * Separate from lib/lang.ts because `next/headers` cannot be imported into a client component; the
 * pure decision lives there and can be tested without a request at all.
 */
export async function serverLang(): Promise<Lang> {
  return readLang((await cookies()).get(LANG_COOKIE)?.value ?? null);
}

/** `const t = await serverT()` — then `t({ th: "…", en: "…" })`, same call as on the client. */
export async function serverT(): Promise<(p: Phrase) => string> {
  const lang = await serverLang();
  return (p: Phrase) => say(lang, p);
}
