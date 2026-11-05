import { useState, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SIDE_PANEL_WIDTH, sheetPlacement } from "@/lib/frame";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { PHONE_MAX_WIDTH, RADIUS, SPACE, TYPE } from "../theme";
import { ICON } from "./icons";

interface SheetProps {
  title: string;
  /**
   * A long title (a product's name): at most this many lines, then …, kept clear of the pills on
   * both sides (owner, 4 Nov: the ดูป้าย title ran under ปิด).
   */
  titleLines?: number;
  /** A second, grey line under the title — the order number. */
  sub?: string;
  /** A small tool right after the title — การเงิน's copy mark on a bill number. */
  titleTool?: ReactNode;
  /** Left pill; "ยกเลิก" (close) by default. */
  closeLabel?: string;
  /** A left pill that does something else than close — the filter's "ล้าง". `a11y` speaks a bare "‹". */
  left?: { label: string; onPress: () => void; a11y?: string };
  /** Closing by the backdrop, the system back, or the default left pill. */
  onClose: () => void;
  /** No left pill: a sheet whose one way on is its own button (รับเงินแล้ว → เสร็จ). */
  noPill?: boolean;
  /** A right pill that opens the next step — a details sheet's "แก้ไข" (ตั้งค่าอะไหล่). */
  right?: { label: string; onPress: () => void };
  /** The red ✓ on the right, for a sheet whose choices apply together (the filter). */
  onDone?: () => void;
  /** Tall sheets reach the top of the screen; short ones sit on the bottom. */
  tall?: boolean;
  children: ReactNode;
}

/**
 * The Orders pages' pop-up: rounded top, a pill to close on the left, the task named in the middle.
 * On a computer it opens as a panel on the right with the same header (computer guide, 4 Nov 2026).
 */
export function Sheet(props: SheetProps) {
  const { theme } = useTheme();
  const side = sheetPlacement(useWindowDimensions().width, PHONE_MAX_WIDTH) === "side";
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  // The widest pill, measured, so a long title can keep clear of both sides and stay centred.
  const [pillWidth, setPillWidth] = useState(0);
  const long = props.titleLines !== undefined;
  const measure = long
    ? (e: { nativeEvent: { layout: { width: number } } }) => {
        const w = e.nativeEvent.layout.width;
        setPillWidth((now) => Math.max(now, w));
      }
    : undefined;
  return (
    <Modal
      visible
      transparent
      animationType={side ? "fade" : "slide"}
      onRequestClose={props.onClose}
    >
      <View style={[styles.fill, side && styles.sideRow, { backgroundColor: theme.scrim }]}>
        <Pressable
          style={props.tall && !side ? styles.topGap : styles.fill}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิด", en: "Close" })}
        />
        <View
          style={[
            styles.sheet,
            props.tall && styles.fill,
            side && [styles.side, { width: SIDE_PANEL_WIDTH }],
            { backgroundColor: theme.bg, paddingBottom: insets.bottom + SPACE.xl },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.head, long && styles.longHead]}>
            {props.noPill ? (
              <View />
            ) : (
              <Pressable
                onPress={props.left?.onPress ?? props.onClose}
                onLayout={measure}
                accessibilityRole="button"
                accessibilityLabel={props.left?.a11y}
                style={[
                  styles.pill,
                  { backgroundColor: theme.surface, borderColor: theme.glassLine },
                ]}
              >
                <Text style={[styles.pillText, { color: theme.text }]}>
                  {props.left?.label ?? props.closeLabel ?? t({ th: "ยกเลิก", en: "Cancel" })}
                </Text>
              </Pressable>
            )}
            <View
              style={[
                styles.titles,
                long && [styles.longTitles, { paddingHorizontal: pillWidth + SPACE.s }],
              ]}
              pointerEvents={props.titleTool ? "box-none" : "none"}
            >
              <View style={styles.titleRow} pointerEvents="box-none">
                <Text
                  style={[styles.title, long && styles.longTitle, { color: theme.text }]}
                  accessibilityRole="header"
                  numberOfLines={props.titleLines}
                >
                  {props.title}
                </Text>
                {props.titleTool}
              </View>
              {props.sub ? (
                <Text style={[styles.sub, { color: theme.textMuted }]}>{props.sub}</Text>
              ) : null}
            </View>
            {props.right && !props.onDone && (
              <Pressable
                onPress={props.right.onPress}
                onLayout={measure}
                accessibilityRole="button"
                style={[
                  styles.pill,
                  { backgroundColor: theme.surface, borderColor: theme.glassLine },
                ]}
              >
                <Text style={[styles.pillText, { color: theme.text }]}>{props.right.label}</Text>
              </Pressable>
            )}
            {props.onDone && (
              <Pressable
                onPress={props.onDone}
                onLayout={measure}
                accessibilityRole="button"
                accessibilityLabel={t({ th: "ใช้ตัวกรอง", en: "Apply" })}
                style={[styles.done, { backgroundColor: theme.button }]}
              >
                <LineIcon d={ICON.check} color={theme.onPrimary} size={20} strokeWidth={2.8} />
              </Pressable>
            )}
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {props.children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  topGap: { height: 54 },
  sideRow: { flexDirection: "row" },
  /** The computer's right-hand panel: full height, square on the right edge. */
  side: {
    maxHeight: "100%",
    height: "100%",
    borderTopRightRadius: 0,
    borderTopLeftRadius: RADIUS.sheet,
    borderBottomLeftRadius: RADIUS.sheet,
    boxShadow: "-12px 0 40px rgba(0,0,0,0.14)",
  },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingTop: 14,
    paddingHorizontal: SPACE.l,
  },
  head: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  /** Room for a two-line title (2 × the headline's 24). */
  longHead: { height: 48 },
  pill: {
    height: 44,
    paddingHorizontal: SPACE.l,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    zIndex: 1,
  },
  pillText: { ...TYPE.body },
  titles: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  title: { ...TYPE.headline },
  longTitles: { top: 0, bottom: 0, justifyContent: "center" },
  longTitle: { flexShrink: 1, textAlign: "center" },
  sub: { ...TYPE.footnote },
  done: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  body: { paddingTop: SPACE.l, gap: SPACE.m },
});
