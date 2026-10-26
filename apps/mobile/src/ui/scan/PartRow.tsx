import { useEffect, useRef } from "react";
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import type { ScannedPart } from "@/lib/scanList";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { RADIUS, SPACE, TYPE } from "../theme";

const CHEVRON_DOWN = "M6 9l6 6 6-6";
/** How far left a row must be dragged before letting go removes it. */
const REMOVE_AT = -110;

type LineTone = "plain" | "problem" | "refused";

interface PartRowProps {
  part: ScannedPart;
  imageUrl: string | null;
  /** The grey second line — or, for a problem, plain words beside a coloured dot. */
  line: string;
  tone: LineTone;
  last: boolean;
  onQty: () => void;
  onRemove: () => void;
}

/**
 * One scanned part: photo, name (up to two lines, so the right part is easy to confirm), what will
 * change, and the amount as a big button. Swipe left to take it off the list.
 */
export function PartRow({ part, imageUrl, line, tone, last, onQty, onRemove }: PartRowProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const x = useRef(new Animated.Value(0)).current;
  const remove = useRef(onRemove);
  useEffect(() => {
    remove.current = onRemove;
  });

  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderRelease: (_, g) => {
        if (g.dx < REMOVE_AT) {
          Animated.timing(x, { toValue: -500, duration: 160, useNativeDriver: false }).start(() =>
            remove.current(),
          );
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
        }
      },
      onPanResponderTerminate: () =>
        Animated.spring(x, { toValue: 0, useNativeDriver: false }).start(),
    }),
  ).current;

  const dot = tone === "refused" ? theme.danger : tone === "problem" ? theme.waiting : null;
  const removeLabel = t({ th: "นำออก", en: "Remove" });
  return (
    <View style={styles.clip}>
      <View style={[styles.behind, { backgroundColor: theme.button }]}>
        <Text style={styles.behindText}>{removeLabel}</Text>
      </View>
      <Animated.View
        {...swipe.panHandlers}
        accessible
        accessibilityLabel={`${part.name}, ${line}, ${t({ th: "จำนวน", en: "amount" })} ${part.qty}`}
        accessibilityActions={[{ name: "delete", label: removeLabel }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === "delete" && onRemove()}
        style={[styles.row, { backgroundColor: theme.surface, transform: [{ translateX: x }] }]}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.photo} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[styles.photo, { backgroundColor: theme.hover }]} />
        )}
        <View
          style={[
            styles.inner,
            !last && {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={styles.text}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
              {part.name}
            </Text>
            <View style={styles.lineRow}>
              {dot && <View style={[styles.dot, { backgroundColor: dot }]} />}
              <Text style={[styles.line, { color: dot ? theme.text : theme.textMuted }]}>
                {line}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={onQty}
            accessibilityRole="button"
            accessibilityLabel={t({
              th: `แก้จำนวน ${part.name}`,
              en: `Change amount of ${part.name}`,
            })}
            style={[styles.qty, { backgroundColor: theme.hover }]}
          >
            <Text style={[styles.qtyText, { color: theme.text }]}>{part.qty}</Text>
            <LineIcon d={CHEVRON_DOWN} color={theme.textMuted} size={12} strokeWidth={3} />
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: "hidden" },
  behind: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: SPACE.xl,
  },
  behindText: { ...TYPE.headline, color: "#FFFFFF" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingLeft: SPACE.l, minHeight: 80 },
  photo: { width: 56, height: 56, borderRadius: RADIUS.thumb },
  inner: {
    flex: 1,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: SPACE.m,
    paddingRight: 14,
  },
  text: { flex: 1, gap: 2 },
  name: { ...TYPE.headline },
  lineRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  line: { ...TYPE.subhead, fontVariant: ["tabular-nums"] },
  qty: {
    minWidth: 56,
    height: 32,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 10,
  },
  qtyText: { ...TYPE.body, fontVariant: ["tabular-nums"] },
});
