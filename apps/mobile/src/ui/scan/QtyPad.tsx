import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { RADIUS, SPACE, TYPE } from "../theme";

/** More than this many of one part in one go is a typo, not a delivery. */
const MAX_DIGITS = 4;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "back"] as const;

interface QtyPadProps {
  name: string;
  qty: number;
  onDone: (qty: number) => void;
  onRemove: () => void;
  onClose: () => void;
}

/**
 * The amount as a big number pad in a half sheet — no tiny box to aim at with a thumb. "นำออก"
 * takes the part off the list from here too, for anyone who does not swipe.
 */
export function QtyPad({ name, qty, onDone, onRemove, onClose }: QtyPadProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  // Starts empty, showing the current amount faintly, so the first key replaces it rather than
  // turning 1 into 12.
  const [digits, setDigits] = useState("");

  const press = (key: (typeof KEYS)[number]) => {
    if (key === "clear") setDigits("");
    else if (key === "back") setDigits((d) => d.slice(0, -1));
    else setDigits((d) => (d === "0" ? key : (d + key).slice(0, MAX_DIGITS)));
  };
  const value = Number(digits) || qty;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.scrim, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t({ th: "ปิด", en: "Close" })}
      />
      <View
        style={[
          styles.sheet,
          { backgroundColor: theme.bg, paddingBottom: insets.bottom + SPACE.xl },
        ]}
      >
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {name}
        </Text>
        <Text
          style={[styles.value, { color: digits ? theme.text : theme.textFaint }]}
          accessibilityLiveRegion="polite"
        >
          {digits || String(qty)}
        </Text>
        <View style={styles.keys}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => press(key)}
              accessibilityRole="button"
              accessibilityLabel={
                key === "clear"
                  ? t({ th: "ล้าง", en: "Clear" })
                  : key === "back"
                    ? t({ th: "ลบตัวสุดท้าย", en: "Delete last digit" })
                    : key
              }
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: pressed ? theme.border : theme.surface },
              ]}
            >
              <Text
                style={[key === "clear" ? styles.keyWord : styles.keyText, { color: theme.text }]}
              >
                {key === "clear" ? t({ th: "ล้าง", en: "Clear" }) : key === "back" ? "⌫" : key}
              </Text>
            </Pressable>
          ))}
        </View>
        <BigButton
          label={t({ th: `ใช้จำนวน ${value}`, en: `Use ${value}` })}
          onPress={() => onDone(value)}
        />
        <Pressable onPress={onRemove} accessibilityRole="button" style={styles.remove}>
          <Text style={[styles.removeText, { color: theme.primary }]}>
            {t({ th: "นำออกจากรายการ", en: "Remove from the list" })}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1 },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingTop: SPACE.xl,
    paddingHorizontal: SPACE.l,
    gap: SPACE.m,
  },
  name: { ...TYPE.headline, textAlign: "center" },
  value: { fontSize: 44, lineHeight: 52, fontWeight: "700", textAlign: "center" },
  keys: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.s },
  key: {
    width: "31.5%",
    flexGrow: 1,
    height: 56,
    borderRadius: RADIUS.field,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 26, lineHeight: 32 },
  keyWord: { ...TYPE.body },
  remove: { alignSelf: "center", paddingVertical: SPACE.s },
  removeText: { ...TYPE.body },
});
