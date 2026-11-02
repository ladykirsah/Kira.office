import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import type { Anchor } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { STAFF_ICON } from "./parts";

export type PlusChoice = "add" | "dayOff" | "salary" | "advance";

const MENU_WIDTH = 250;

/**
 * ＋ in the header (canvas v292, 2.1), the same on every tab: add a person, then — set apart — the
 * three records: a day off, a salary, an advance. It opens just under the ＋.
 */
export function PlusMenu(props: {
  at: Anchor | null;
  onClose: () => void;
  onPick: (choice: PlusChoice) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  if (!props.at) return null;
  const top = props.at.y + props.at.height + 6;
  const item = (choice: PlusChoice, icon: string, label: string, line: boolean) => (
    <Pressable
      key={choice}
      onPress={() => {
        props.onClose();
        props.onPick(choice);
      }}
      accessibilityRole="menuitem"
      style={({ pressed }) => [
        styles.item,
        pressed && { backgroundColor: theme.hover },
        line && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}
    >
      <LineIcon d={icon} color={theme.text} size={20} strokeWidth={1.9} />
      <Text style={[TYPE.body, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
  return (
    <Modal visible transparent animationType="fade" onRequestClose={props.onClose}>
      <Pressable
        style={[StyleSheet.absoluteFill, styles.dim]}
        onPress={props.onClose}
        accessibilityRole="button"
        accessibilityLabel={t({ th: "ปิด", en: "Close" })}
      />
      <View
        accessibilityRole="menu"
        style={[styles.menu, { top, right: SPACE.l, backgroundColor: theme.surface }]}
      >
        {item("add", STAFF_ICON.personAdd, t({ th: "เพิ่มคน", en: "Add a person" }), false)}
        <View style={[styles.gap, { backgroundColor: theme.segBg }]} />
        {item(
          "dayOff",
          STAFF_ICON.calendar,
          t({ th: "บันทึกวันหยุด", en: "Record a day off" }),
          true,
        )}
        {item("salary", STAFF_ICON.money, t({ th: "จ่ายเงินเดือน", en: "Pay a salary" }), true)}
        {item(
          "advance",
          STAFF_ICON.wallet,
          t({ th: "บันทึกเงินเบิก", en: "Record an advance" }),
          false,
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: "rgba(0,0,0,0.08)" },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 14,
    overflow: "hidden",
    boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
  } as never,
  item: {
    minHeight: 46,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  gap: { height: 8 },
});
