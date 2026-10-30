import type { Phrase } from "@l-shopee/shared/lang";
import { useRef, useState, type ComponentRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { SPACE, TYPE } from "../theme";
import { ICON } from "./icons";

const DOWN = "M7 10l5 5 5-5";
const MENU_WIDTH = 250;

interface MenuButtonProps<K extends string> {
  /** What the button says: the current choice. */
  label: string;
  /** A filter that is narrowing the list shows red, like every active choice (design guide). */
  on: boolean;
  options: readonly { key: K; label: Phrase }[];
  value: K;
  onPick: (key: K) => void;
  /** Read aloud before the choice, e.g. "ช่วงวันที่". */
  name: string;
}

/**
 * A small "label ▾" button that opens a short menu right under it (choice B, B3): one tap picks,
 * the menu closes, the list changes. The current choice has a tick.
 */
export function MenuButton<K extends string>(props: MenuButtonProps<K>) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { width } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const fg = props.on ? theme.primary : theme.text;
  const current = props.options.find((o) => o.key === props.value);

  const open = () =>
    anchor.current?.measureInWindow((x, y, _w, h) =>
      setAt({ x: Math.min(x, width - MENU_WIDTH - SPACE.l), y: y + h + 6 }),
    );

  return (
    <>
      <View ref={anchor} collapsable={false}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${props.name}: ${current ? t(current.label) : props.label}`}
          style={[
            styles.button,
            props.on
              ? { backgroundColor: theme.surface, borderColor: theme.primary, borderWidth: 1.5 }
              : { backgroundColor: theme.hover },
          ]}
        >
          <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
            {props.label}
          </Text>
          <LineIcon d={DOWN} color={fg} size={12} strokeWidth={2.6} />
        </Pressable>
      </View>
      <Modal visible={!!at} transparent animationType="fade" onRequestClose={() => setAt(null)}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.08)" }]}
          onPress={() => setAt(null)}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิด", en: "Close" })}
        />
        {at && (
          <View
            accessibilityRole="menu"
            style={[
              styles.menu,
              { top: at.y, left: Math.max(SPACE.l, at.x), backgroundColor: theme.surface },
            ]}
          >
            {props.options.map((o, i) => (
              <Pressable
                key={o.key}
                onPress={() => {
                  setAt(null);
                  props.onPick(o.key);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ checked: o.key === props.value }}
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
                  {o.key === props.value && (
                    <LineIcon d={ICON.check} color={theme.text} size={18} strokeWidth={2.6} />
                  )}
                </View>
                <Text style={[styles.itemText, { color: theme.text }]}>{t(o.label)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 32,
    paddingHorizontal: SPACE.m,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  text: { ...TYPE.subhead, maxWidth: 160 },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  item: {
    minHeight: 44,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  tick: { width: 18 },
  itemText: { ...TYPE.body },
});
