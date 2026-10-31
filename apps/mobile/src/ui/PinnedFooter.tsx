import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "./AppProviders";
import { BigButton } from "./BigButton";
import type { Chrome } from "./ScreenChrome";
import { Segmented } from "./Segmented";
import { SPACE, TYPE } from "./theme";

/** A pinned button (50) and the gap under it. */
const BUTTON_ROW = 60;
/** The choice above the buttons (32 + its padding) and the gap under it. */
const CHOICE_ROW = 46;
/** The band stays solid this far above the top of the pinned stack, then fades out over FADE. */
const SOLID_ABOVE = 20;
const FADE = 28;

/** How much the pinned stack covers, so the page can leave room for it under its last card. */
export function pinnedHeight(chrome: Chrome): number {
  return chrome.footer.length * BUTTON_ROW + (chrome.choice ? CHOICE_ROW : 0);
}

interface PinnedFooterProps {
  chrome: Chrome;
  /** Distance from the screen's bottom edge to the bottom of the pinned stack. */
  bottom: number;
}

/**
 * The screen's pinned bottom button(s), with an optional choice and short message above them, on a
 * band of the page colour that fades out upward — so cards scroll underneath instead of showing
 * through the button (owner, 2026-10-26).
 */
export function PinnedFooter({ chrome, bottom }: PinnedFooterProps) {
  const { theme } = useTheme();
  if (chrome.footer.length === 0 && !chrome.toast) return null;
  const solid = bottom + pinnedHeight(chrome) + SOLID_ABOVE;
  const band = solid + FADE;
  return (
    <>
      <View style={[styles.band, { height: band }]} pointerEvents="none">
        <Svg width="100%" height={band}>
          <Defs>
            <LinearGradient id="pinned-band" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.bg} stopOpacity={0} />
              <Stop offset={FADE / band} stopColor={theme.bg} stopOpacity={1} />
              <Stop offset="1" stopColor={theme.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={band} fill="url(#pinned-band)" />
        </Svg>
      </View>
      <View style={[styles.stack, { bottom }]} pointerEvents="box-none">
        {chrome.toast && (
          <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text style={styles.toastTitle}>{chrome.toast.title}</Text>
            {chrome.toast.detail ? (
              <Text style={styles.toastDetail}>{chrome.toast.detail}</Text>
            ) : null}
          </View>
        )}
        {chrome.choice && (
          <View style={[styles.choice, { backgroundColor: theme.bg }]}>
            <Segmented
              label={chrome.choice.label}
              options={chrome.choice.options}
              value={chrome.choice.value ?? ""}
              onChange={chrome.choice.onChange}
            />
          </View>
        )}
        {chrome.footer.map((b) => (
          <BigButton
            key={b.label}
            label={b.label}
            onPress={b.onPress}
            kind={b.kind}
            icon={b.icon}
          />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  band: { position: "absolute", left: 0, right: 0, bottom: 0 },
  stack: { position: "absolute", left: SPACE.l, right: SPACE.l, gap: 10 },
  choice: { borderRadius: 10 },
  toast: {
    marginHorizontal: SPACE.l,
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.l,
    borderRadius: 16,
    backgroundColor: "rgba(28,28,30,0.92)",
    alignItems: "center",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  },
  toastTitle: { ...TYPE.subhead, color: "#FFFFFF", textAlign: "center" },
  toastDetail: { ...TYPE.subhead, color: "rgba(255,255,255,0.72)", textAlign: "center" },
});
