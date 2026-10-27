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

/** A choice pinned just above the bottom button, e.g. why a count went down. */
export interface ChromeChoice {
  label: string;
  options: { value: string; label: string }[];
  /** Null until one is picked. */
  value: string | null;
  onChange: (value: string) => void;
}

/** A short dark message above the bottom button that goes away on its own. */
export interface ChromeToast {
  title: string;
  detail: string;
}

export interface Chrome {
  header: HeaderButton | null;
  footer: ChromeButton[];
  choice: ChromeChoice | null;
  toast: ChromeToast | null;
}

export const NO_CHROME: Chrome = { header: null, footer: [], choice: null, toast: null };

const SetChromeContext = createContext<((chrome: Chrome) => void) | null>(null);

/** The frame (Shell) provides this; screens fill it through useScreenChrome. */
export const ChromeProvider = SetChromeContext.Provider;

/**
 * Puts a screen's header button and its pinned bottom buttons (with an optional choice and message
 * above them) into the frame. Only what is shown decides when the frame redraws; each tap calls the
 * screen's latest handler, so a screen may pass fresh functions on every render without the two
 * redrawing each other in a loop.
 */
export function useScreenChrome(
  header: HeaderButton | null,
  footer: ChromeButton[],
  above: { choice?: ChromeChoice | null; toast?: ChromeToast | null } = {},
): void {
  const set = useContext(SetChromeContext);
  const choice = above.choice ?? null;
  const toast = above.toast ?? null;
  const latest = useRef({ header, footer, choice, toast });
  useEffect(() => {
    latest.current = { header, footer, choice, toast };
  });
  const shape = JSON.stringify([
    header && [header.label, header.icon],
    footer.map((b) => [b.label, b.kind ?? "red"]),
    choice && [choice.label, choice.options, choice.value],
    toast,
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
      choice: now.choice && {
        label: now.choice.label,
        options: now.choice.options,
        value: now.choice.value,
        onChange: (value) => latest.current.choice?.onChange(value),
      },
      toast: now.toast,
    });
  }, [set, shape]);
  useEffect(() => () => set?.(NO_CHROME), [set]);
}
