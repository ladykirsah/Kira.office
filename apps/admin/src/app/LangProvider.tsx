"use client";

import { createContext, useContext, type ReactNode } from "react";
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

/** `const t = useT()` — then `t({ th: "วันหยุด", en: "Days off" })`. */
export function useT(): (p: Phrase) => string {
  const lang = useContext(LangContext);
  return (p: Phrase) => say(lang, p);
}
