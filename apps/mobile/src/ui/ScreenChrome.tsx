import { createContext, useContext, useEffect, useRef } from "react";

/** A big button: the guide's one red main action, or grey for the quiet alternative beside it. */
export interface ChromeButton {
  label: string;
  onPress: () => void;
  kind?: "red" | "grey";
  /** A small icon before the words (การชำระเงิน's "สร้าง QR รับเงิน"); one SVG path, see LineIcon. */
  icon?: string;
}

/** A round glass button left of the account badge, for the screen's own tool (e.g. type a code). */
export interface HeaderButton {
  label: string;
  /** One SVG path on a 24-unit grid (see LineIcon). Empty: the label shows as a word (บิลใหม่). */
  icon: string;
  onPress: () => void;
  /** A count on the button's corner (ทำบิล's drafts tray); none when 0. */
  badge?: number;
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

/** The glass "‹ ออเดอร์" pill above the title of a page that sits under another one. */
export interface BackLink {
  label: string;
  onPress: () => void;
}

/** A search field that takes the tab bar's place while a screen is searching (Apple's pattern). */
export interface SearchBar {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export interface Chrome {
  headers: HeaderButton[];
  footer: ChromeButton[];
  choice: ChromeChoice | null;
  toast: ChromeToast | null;
  /** The large title, when the page's own name is not the menu's (an order number). */
  title: string | null;
  back: BackLink | null;
  search: SearchBar | null;
  /** The page draws its own heading under the back link (a car's plate beside its brand). */
  ownTitle: boolean;
}

export const NO_CHROME: Chrome = {
  headers: [],
  footer: [],
  choice: null,
  toast: null,
  title: null,
  back: null,
  search: null,
  ownTitle: false,
};

const SetChromeContext = createContext<((chrome: Chrome) => void) | null>(null);

/** The frame (Shell) provides this; screens fill it through useScreenChrome. */
export const ChromeProvider = SetChromeContext.Provider;

interface Above {
  choice?: ChromeChoice | null;
  toast?: ChromeToast | null;
  title?: string | null;
  back?: BackLink | null;
  search?: SearchBar | null;
  ownTitle?: boolean;
}

/**
 * Puts a screen's header button(s), its title and back link, its pinned bottom buttons (with an
 * optional choice and message above them) and its search bar into the frame. Only what is shown
 * decides when the frame redraws; each tap calls the screen's latest handler, so a screen may pass
 * fresh functions on every render without the two redrawing each other in a loop.
 */
export function useScreenChrome(
  header: HeaderButton | readonly HeaderButton[] | null,
  footer: ChromeButton[],
  above: Above = {},
): void {
  const set = useContext(SetChromeContext);
  const headers: HeaderButton[] =
    header == null ? [] : Array.isArray(header) ? [...header] : [header as HeaderButton];
  const now = {
    headers,
    footer,
    choice: above.choice ?? null,
    toast: above.toast ?? null,
    title: above.title ?? null,
    back: above.back ?? null,
    search: above.search ?? null,
    ownTitle: above.ownTitle ?? false,
  };
  const latest = useRef(now);
  useEffect(() => {
    latest.current = now;
  });
  const shape = JSON.stringify([
    headers.map((h) => [h.label, h.icon, h.badge ?? 0]),
    footer.map((b) => [b.label, b.kind ?? "red", b.icon ?? ""]),
    now.choice && [now.choice.label, now.choice.options, now.choice.value],
    now.toast,
    now.title,
    now.back?.label,
    now.search && [now.search.value, now.search.placeholder],
    now.ownTitle,
  ]);
  useEffect(() => {
    if (!set) return;
    const cur = latest.current;
    set({
      headers: cur.headers.map((h, i) => ({
        label: h.label,
        icon: h.icon,
        badge: h.badge,
        onPress: () => latest.current.headers[i]?.onPress(),
      })),
      footer: cur.footer.map((b, i) => ({
        label: b.label,
        kind: b.kind,
        icon: b.icon,
        onPress: () => latest.current.footer[i]?.onPress(),
      })),
      choice: cur.choice && {
        label: cur.choice.label,
        options: cur.choice.options,
        value: cur.choice.value,
        onChange: (value) => latest.current.choice?.onChange(value),
      },
      toast: cur.toast,
      title: cur.title,
      back: cur.back && {
        label: cur.back.label,
        onPress: () => latest.current.back?.onPress(),
      },
      search: cur.search && {
        value: cur.search.value,
        placeholder: cur.search.placeholder,
        onChange: (value) => latest.current.search?.onChange(value),
        onClose: () => latest.current.search?.onClose(),
      },
      ownTitle: cur.ownTitle,
    });
  }, [set, shape]);
  useEffect(() => () => set?.(NO_CHROME), [set]);
}
