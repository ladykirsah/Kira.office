import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { RADIUS, SPACE, TYPE } from "../theme";
import { ICON } from "./icons";

interface SheetProps {
  title: string;
  /** A second, grey line under the title — the order number. */
  sub?: string;
  /** Left pill; "ยกเลิก" (close) by default. */
  closeLabel?: string;
  /** A left pill that does something else than close — the filter's "ล้าง". */
  left?: { label: string; onPress: () => void };
  /** Closing by the backdrop, the system back, or the default left pill. */
  onClose: () => void;
  /** No left pill: a sheet whose one way on is its own button (รับเงินแล้ว → เสร็จ). */
  noPill?: boolean;
  /** The red ✓ on the right, for a sheet whose choices apply together (the filter). */
  onDone?: () => void;
  /** Tall sheets reach the top of the screen; short ones sit on the bottom. */
  tall?: boolean;
  children: ReactNode;
}

/** The Orders pages' pop-up: rounded top, a pill to close on the left, the task named in the middle. */
export function Sheet(props: SheetProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={props.onClose}>
      <View style={[styles.fill, { backgroundColor: theme.scrim }]}>
        <Pressable
          style={props.tall ? styles.topGap : styles.fill}
          onPress={props.onClose}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิด", en: "Close" })}
        />
        <View
          style={[
            styles.sheet,
            props.tall && styles.fill,
            { backgroundColor: theme.bg, paddingBottom: insets.bottom + SPACE.xl },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.head}>
            {props.noPill ? (
              <View />
            ) : (
              <Pressable
                onPress={props.left?.onPress ?? props.onClose}
                accessibilityRole="button"
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
            <View style={styles.titles} pointerEvents="none">
              <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
                {props.title}
              </Text>
              {props.sub ? (
                <Text style={[styles.sub, { color: theme.textMuted }]}>{props.sub}</Text>
              ) : null}
            </View>
            {props.onDone && (
              <Pressable
                onPress={props.onDone}
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
  topGap: { height: 54 },
  sheet: {
    maxHeight: "92%",
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingTop: 14,
    paddingHorizontal: SPACE.l,
  },
  head: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
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
