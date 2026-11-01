import type { Phrase } from "@l-shopee/shared/lang";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { DOWN, UP } from "../products/parts";

/** The banner's shape on the website, 16:6 (as drawn: 358 × 134 on the form, 334 × 125 in the list). */
export const BANNER_RATIO = 16 / 6;
export const PICTURE_RADIUS = 14;
export const PICTURE_ICON = "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9h.01";

/** A message the form leaves for the list it goes back to (shown once). */
let waiting: { title: Phrase; detail: Phrase } | null = null;

export function leaveToast(toast: { title: Phrase; detail: Phrase } | null): void {
  waiting = toast;
}

export function takeToast(): { title: Phrase; detail: Phrase } | null {
  const toast = waiting;
  waiting = null;
  return toast;
}

/** The banner's picture, a picked one not yet saved, or the grey ไม่มีรูป box. */
export function BannerPicture(props: { imageKey: string | null; uri?: string }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const box = [styles.picture, { backgroundColor: theme.hover }];
  const uri = props.uri ?? (props.imageKey ? `${API_BASE}/img/${props.imageKey}` : null);
  if (uri) return <Image source={{ uri }} style={box} resizeMode="cover" />;
  return (
    <View style={[box, styles.center]}>
      <Text style={[styles.none, { color: theme.textMuted }]}>
        {t({ th: "ไม่มีรูป", en: "No picture" })}
      </Text>
    </View>
  );
}

/** ▲ or ▼ beside a row; faded where the row can't go further (as drawn). */
export function MoveButton(props: {
  up: boolean;
  enabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={props.enabled ? props.onPress : undefined}
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled: !props.enabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.move,
        { backgroundColor: pressed && props.enabled ? theme.border : theme.hover },
        !props.enabled && styles.faded,
      ]}
    >
      <LineIcon d={props.up ? UP : DOWN} color={theme.text} size={16} strokeWidth={2.4} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  picture: { width: "100%", aspectRatio: BANNER_RATIO, borderRadius: PICTURE_RADIUS },
  center: { alignItems: "center", justifyContent: "center" },
  none: { fontSize: 15 },
  move: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  faded: { opacity: 0.35 },
});
