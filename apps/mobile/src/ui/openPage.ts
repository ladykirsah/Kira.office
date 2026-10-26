import { Linking, Platform } from "react-native";

/**
 * Opens a page of the current web back office beside this app (Scan's hand-overs). On the web it
 * opens a new tab, so this app — and its sign-in, which lives only in this tab — stays put.
 *
 * Browsers only allow a new tab during a tap. Call these from the tap itself, never after an await.
 */
export function openPage(url: string): boolean {
  if (Platform.OS !== "web") {
    void Linking.openURL(url);
    return true;
  }
  // Not the "noopener" feature: with it the browser answers null even when the tab opened, and a
  // blocked tab could not be told apart. Cutting the link by hand gives the same protection.
  const tab = window.open(url, "_blank");
  if (!tab) return false;
  tab.opener = null;
  return true;
}

/**
 * For a page whose address is known only after saving — the parked bill. The tab opens empty during
 * the tap and is pointed at the page once the save succeeds, or closed if it fails. `go` answers
 * false when the browser blocked the tab, so the screen can offer a link to tap instead.
 */
export function openPageAfterSave(): { go: (url: string) => boolean; cancel: () => void } {
  if (Platform.OS !== "web") {
    return {
      go: (url) => {
        void Linking.openURL(url);
        return true;
      },
      cancel: () => {},
    };
  }
  const tab = window.open("", "_blank");
  if (tab) tab.opener = null;
  return {
    go: (url) => {
      if (!tab || tab.closed) return false;
      tab.location.href = url;
      return true;
    },
    cancel: () => tab?.close(),
  };
}
