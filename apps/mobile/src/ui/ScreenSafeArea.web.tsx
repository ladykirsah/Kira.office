import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  type Rect,
} from "react-native-safe-area-context";
import { NO_INSETS, insetsFromPadding, sameInsets, type Insets } from "@/lib/screenInsets";

/**
 * The website's safe-area provider. The library's web provider measures its own box against the
 * window; once the phone page scrolls whole (owner, 7 Nov 2026, "B · Full slide-under"), that box is
 * taller than the screen and the edges it reports grow with the page — a loop. Here a hidden probe
 * padded by env(safe-area-inset-*) reads the screen's edges alone.
 */
export function ScreenSafeArea({ children }: { children: ReactNode }) {
  const [insets, setInsets] = useState<Insets>(NO_INSETS);
  const [frame, setFrame] = useState<Rect>(windowFrame);
  useEffect(() => {
    const probe = document.createElement("div");
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;" +
      "padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
    const read = () => {
      const next = insetsFromPadding(window.getComputedStyle(probe));
      setInsets((prev) => (sameInsets(prev, next) ? prev : next));
      setFrame(windowFrame());
    };
    read();
    window.addEventListener("resize", read);
    window.addEventListener("orientationchange", read);
    return () => {
      window.removeEventListener("resize", read);
      window.removeEventListener("orientationchange", read);
      probe.remove();
    };
  }, []);
  return (
    <SafeAreaFrameContext.Provider value={frame}>
      <SafeAreaInsetsContext.Provider value={insets}>
        {/* The one full-size box the library's provider drew around the app. */}
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
    </SafeAreaFrameContext.Provider>
  );
}

const windowFrame = (): Rect => ({
  x: 0,
  y: 0,
  width: typeof window === "undefined" ? 0 : window.innerWidth,
  height: typeof window === "undefined" ? 0 : window.innerHeight,
});
