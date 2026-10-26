import { createContext, useContext, useEffect, useRef } from "react";

/** A big button: the guide's one red main action, or grey for the quiet alternative beside it. */
export interface ChromeButton {
  label: string;
  onPress: () => void;
  kind?: "red" | "grey";
}

/** A round glass button left of the account badge, for the screen's own tool (e.g. type a code). */
export interface HeaderButton {
  label: string;
  /** One SVG path on a 24-unit grid (see LineIcon). */
  icon: string;
  onPress: () => void;
}

export interface Chrome {
  header: HeaderButton | null;
  footer: ChromeButton[];
}

export const NO_CHROME: Chrome = { header: null, footer: [] };

const SetChromeContext = createContext<((chrome: Chrome) => void) | null>(null);

/** The frame (Shell) provides this; screens fill it through useScreenChrome. */
export const ChromeProvider = SetChromeContext.Provider;

/**
 * Puts a screen's header button and its pinned bottom buttons into the frame. Only the labels decide
 * when the frame redraws; each tap calls the screen's latest handler, so a screen may pass fresh
 * functions on every render without the two redrawing each other in a loop.
 */
export function useScreenChrome(header: HeaderButton | null, footer: ChromeButton[]): void {
  const set = useContext(SetChromeContext);
  const latest = useRef({ header, footer });
  useEffect(() => {
    latest.current = { header, footer };
  });
  const shape = JSON.stringify([
    header && [header.label, header.icon],
    footer.map((b) => [b.label, b.kind ?? "red"]),
  ]);
  useEffect(() => {
    if (!set) return;
    const now = latest.current;
    set({
      header: now.header && {
        label: now.header.label,
        icon: now.header.icon,
        onPress: () => latest.current.header?.onPress(),
      },
      footer: now.footer.map((b, i) => ({
        label: b.label,
        kind: b.kind,
        onPress: () => latest.current.footer[i]?.onPress(),
      })),
    });
  }, [set, shape]);
  useEffect(() => () => set?.(NO_CHROME), [set]);
}
