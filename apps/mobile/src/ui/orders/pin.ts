import { createContext, useContext, useEffect, useId, useRef } from "react";
import type { ChromeButton } from "../ScreenChrome";

/**
 * The stage's main action is pinned at the bottom of the order page, never inside the job box
 * (owner approved the Shopee-style drawing, 29 Oct 2026). A job box keeps its facts and its
 * pickers; it hands its buttons up here and the page passes them to the frame's pinned bar.
 */
type SetPins = (owner: string, buttons: ChromeButton[] | null) => void;

const PinContext = createContext<SetPins | null>(null);

export const PinProvider = PinContext.Provider;

/**
 * Pins `buttons` while the calling box is on screen. Only the labels and kinds decide when the bar
 * redraws; each tap calls the box's latest handler, as useScreenChrome does.
 */
export function usePin(buttons: ChromeButton[]): void {
  const set = useContext(PinContext);
  const owner = useId();
  const latest = useRef(buttons);
  useEffect(() => {
    latest.current = buttons;
  });
  const shape = JSON.stringify(buttons.map((b) => [b.label, b.kind ?? "red"]));
  useEffect(() => {
    if (!set) return;
    set(
      owner,
      latest.current.map((b, i) => ({
        label: b.label,
        kind: b.kind,
        onPress: () => latest.current[i]?.onPress(),
      })),
    );
  }, [set, owner, shape]);
  useEffect(() => () => set?.(owner, null), [set, owner]);
}
