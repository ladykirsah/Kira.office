import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { UPDATE_CHECK_MS, hasNewVersion, runningEntry } from "@/lib/appUpdate";
import { useLang, useTheme } from "./AppProviders";
import { LineIcon } from "./LineIcon";
import { ICON } from "./orders/icons";
import { SPACE, TYPE } from "./theme";

const REFRESH = "M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7";

/**
 * True once the website serves a newer version than the one this open page is running. It looks each
 * time the app comes back on screen and every 5 minutes while open. Web only; the dev server and the
 * phone app name no bundle, so it never shows there.
 */
function useNewVersion(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const running = runningEntry(Array.from(document.scripts, (s) => s.src));
    if (!running) return;
    let stopped = false;
    const look = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store" });
        if (res.ok && hasNewVersion(running, await res.text()) && !stopped) setReady(true);
      } catch {
        // No connection right now: the bar waits for a clear answer on the next look.
      }
    };
    const timer = setInterval(look, UPDATE_CHECK_MS);
    document.addEventListener("visibilitychange", look);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", look);
    };
  }, []);
  return ready;
}

/**
 * "มีเวอร์ชันใหม่ · แตะเพื่ออัปเดต" at the top of every signed-in page, above its name (owner approved
 * the drawing, 4 Nov 2026). It stays until tapped; a tap loads the new version from หน้าหลัก, and the
 * PIN is asked again as on every open.
 */
export function UpdateBar() {
  const ready = useNewVersion();
  const { t } = useLang();
  const { theme } = useTheme();
  if (!ready) return null;
  return (
    <Pressable
      onPress={() => window.location.assign("/")}
      accessibilityRole="button"
      style={[
        styles.bar,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.graphite }]}>
        <LineIcon d={REFRESH} color="#FFFFFF" size={16} strokeWidth={2.4} />
      </View>
      <Text style={[TYPE.subhead, styles.words, { color: theme.text }]}>
        {t({ th: "มีเวอร์ชันใหม่ · แตะเพื่ออัปเดต", en: "New version · tap to update" })}
      </Text>
      <LineIcon d={ICON.chevron} color={theme.textFaint} size={14} strokeWidth={2.6} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 48,
    marginBottom: SPACE.m,
    paddingVertical: SPACE.s,
    paddingLeft: SPACE.s,
    paddingRight: 14,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    boxShadow: "0 4px 14px rgba(0,0,0,0.08)",
  },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  words: { flex: 1 },
});
