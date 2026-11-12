import { useEffect } from "react";
import { Platform, type ViewStyle } from "react-native";
import { pinnedPosition, scrollsWithPage } from "@/lib/pageScroll";

/** The class public/index.html reads to let the whole page scroll. */
const PAGE_SCROLL_CLASS = "page-scroll";

/** The phone frame on this platform scrolls as one whole page (the website) or inside itself. */
export const PHONE_PAGE_SCROLLS = scrollsWithPage(Platform.OS, true);

/**
 * Holds a part (tab bar, pinned buttons, search field) to the screen while the page scrolls under
 * it. React Native's types know no "fixed"; react-native-web hands it to the page as it is.
 */
export const PINNED_TO_SCREEN = { position: pinnedPosition(Platform.OS) } as unknown as ViewStyle;

/**
 * While the phone frame is on screen, the website scrolls as one page. Each page opens at its top,
 * as it did when the frame scrolled inside itself.
 */
export function usePhonePageScroll(path: string): void {
  useEffect(() => {
    if (!PHONE_PAGE_SCROLLS) return;
    const root = document.documentElement;
    root.classList.add(PAGE_SCROLL_CLASS);
    return () => root.classList.remove(PAGE_SCROLL_CLASS);
  }, []);
  useEffect(() => {
    if (PHONE_PAGE_SCROLLS) window.scrollTo(0, 0);
  }, [path]);
}

/** The colour Safari shows behind its clock and bottom bar: the page's own, light or dark. */
export function usePageColour(color: string): void {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
  }, [color]);
}
