import { useRef, useState, type ComponentRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Line } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { Chevron } from "./parts";

const MENU_WIDTH = 250;

/**
 * A row whose value is picked from a short menu that opens just under it (เดือน, คนจ่าย — as 4.2 and
 * 2.12 draw it): the current choice ticked red, a grey note beside a choice when it has one.
 */
export function DropRow<K extends string>(props: {
  label: string;
  value: string;
  options: readonly { key: K; label: string; note?: string }[];
  chosen: K;
  onPick: (key: K) => void;
  last?: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, w, h) =>
      setAt({
        x: Math.max(SPACE.l, Math.min(x + w - MENU_WIDTH - SPACE.s, width - MENU_WIDTH - SPACE.l)),
        y: y + h - 6,
      }),
    );
  return (
    <View ref={anchor} collapsable={false}>
      <Line
        label={props.label}
        last={props.last}
        onPress={open}
        right={
          <View style={styles.right}>
            <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={1}>
              {props.value}
            </Text>
            <Chevron />
          </View>
        }
      />
      <Modal visible={!!at} transparent animationType="fade" onRequestClose={() => setAt(null)}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.dim]}
          onPress={() => setAt(null)}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิด", en: "Close" })}
        />
        {at && (
          <View
            accessibilityRole="menu"
            style={[styles.menu, { top: at.y, left: at.x, backgroundColor: theme.surface }]}
          >
            {props.options.map((o, i) => (
              <Pressable
                key={o.key}
                onPress={() => {
                  setAt(null);
                  props.onPick(o.key);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ checked: o.key === props.chosen }}
                style={({ pressed }) => [
                  styles.item,
                  pressed && { backgroundColor: theme.hover },
                  i < props.options.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.tick}>
                  {o.key === props.chosen && (
                    <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
                  )}
                </View>
                <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{o.label}</Text>
                {o.note ? (
                  <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{o.note}</Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.s, flexShrink: 1 },
  dim: { backgroundColor: "rgba(0,0,0,0.08)" },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
  } as never,
  item: {
    minHeight: 44,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tick: { width: 18 },
  grow: { flex: 1, minWidth: 0 },
});
