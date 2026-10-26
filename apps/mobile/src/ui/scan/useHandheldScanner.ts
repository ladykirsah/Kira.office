import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { EMPTY_WEDGE, feedKey } from "@/lib/wedge";

/**
 * A handheld scanner paired with the phone or computer types like a keyboard. On the web its keys
 * reach the page wherever the cursor is, so Scan listens to the whole page — except while someone
 * is typing in a field, where the keys are theirs. It listens before any button does, so the
 * scanner's closing Enter can never press a button that happens to have focus.
 *
 * On a phone app the keys go to the focused text field instead; that path comes with the app builds.
 */
export function useHandheldScanner(onCode: (code: string) => void, listening: boolean): void {
  const latest = useRef(onCode);
  useEffect(() => {
    latest.current = onCode;
  });

  useEffect(() => {
    if (Platform.OS !== "web" || !listening) return;
    let wedge = EMPTY_WEDGE;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      const out = feedKey(wedge, e.key, e.timeStamp);
      wedge = out.wedge;
      if (out.code) {
        e.preventDefault();
        e.stopPropagation();
        latest.current(out.code);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [listening]);
}
