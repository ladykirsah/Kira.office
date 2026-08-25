"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LANG_COOKIE, otherLang } from "@/lib/lang";
import { useLang } from "./LangProvider";

/**
 * Thai ⇄ English, sitting beside the moon because it is the same kind of thing: a setting about how
 * you want to read this screen, not an action on the shop.
 *
 * A COOKIE AND A REFRESH, not localStorage — see lib/lang.ts for why. The cookie is written first so
 * the refresh that follows is already served in the new language; `useTransition` keeps the old text
 * on screen while that happens rather than blanking the page, so the switch reads as a change of
 * words rather than as a page reload.
 *
 * A FLAG, not the letters "EN" (owner, 2026-08-25: "look similar as mode, by using emoji"). The two
 * buttons sit side by side and are the same kind of thing — how you want to read this screen — so
 * they should read as a pair rather than as a control and a label.
 *
 * It shows the language you would GET, exactly as the moon shows the mode you would get. A button
 * that pictures the state you are already in leaves you guessing what pressing it does.
 */
export function LanguageToggle() {
  const lang = useLang();
  const router = useRouter();
  const [pending, start] = useTransition();
  const next = otherLang(lang);

  function switchTo() {
    // A year, path-wide, and lax so it survives a normal link click. Nothing secret is in it, so it
    // does not need to be httpOnly — and being readable by the browser is what lets the first paint
    // after a hard reload already be right.
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <button
      className="theme-toggle"
      onClick={switchTo}
      disabled={pending}
      aria-label={next === "th" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English"}
      title={next === "th" ? "ภาษาไทย" : "English"}
    >
      {next === "th" ? "🇹🇭" : "🇬🇧"}
    </button>
  );
}
