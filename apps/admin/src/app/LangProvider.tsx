"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import { say, type Lang, type Phrase } from "@/lib/lang";

/**
 * The page's language, handed down from the server so client and server agree on the first render.
 *
 * Defaults to Thai if a component is somehow rendered outside the provider — a screen in the wrong
 * language is a small bug, a crashed screen is a big one.
 */
const LangContext = createContext<Lang>("th");

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

/** The current language, when a component needs the value rather than a phrase. */
export function useLang(): Lang {
  return useContext(LangContext);
}

/**
 * `const t = useT()` — then `t({ th: "วันหยุด", en: "Days off" })`.
 *
 * MEMOISED ON THE LANGUAGE, so the function keeps the same identity between renders. Without that
 * it is a fresh closure every time, which is harmless while rendering but makes it impossible to
 * name in a `useEffect` or `useCallback` dependency list: including it re-runs the effect on every
 * render — a refetch loop — and leaving it out is the lint warning that says so. Stable identity
 * means a screen can simply do the correct thing.
 */
export function useT(): (p: Phrase) => string {
  const lang = useContext(LangContext);
  return useCallback((p: Phrase) => say(lang, p), [lang]);
}
