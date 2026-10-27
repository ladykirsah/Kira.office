import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { RADIUS, SPACE, TYPE } from "../theme";

interface CodeSheetProps {
  onCode: (code: string) => void;
  onClose: () => void;
}

/** Typing a code by hand — for a torn label, or a phone with no camera and no handheld scanner. */
export function CodeSheet({ onCode, onClose }: CodeSheetProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState("");
  const [empty, setEmpty] = useState(false);

  const submit = () => {
    const clean = code.trim();
    if (!clean) {
      setEmpty(true);
      return;
    }
    onCode(clean);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* The dim backdrop runs behind the sheet too, so its rounded top corners show. */}
      <View style={[styles.fill, { backgroundColor: theme.scrim }]}>
        <Pressable
          style={styles.fill}
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
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            {t({ th: "พิมพ์รหัส", en: "Type a code" })}
          </Text>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setEmpty(false);
            }}
            onSubmitEditing={submit}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            placeholder={t({ th: "รหัสสินค้าหรือบาร์โค้ด", en: "Product ID or barcode" })}
            placeholderTextColor={theme.textMuted}
            accessibilityLabel={t({ th: "รหัสสินค้าหรือบาร์โค้ด", en: "Product ID or barcode" })}
            style={[styles.field, { backgroundColor: theme.surface, color: theme.text }]}
          />
          {empty && (
            <Text style={[styles.note, { color: theme.text }]} accessibilityLiveRegion="polite">
              {t({ th: "ใส่รหัสก่อน", en: "Type a code first" })}
            </Text>
          )}
          <BigButton label={t({ th: "ค้นหา", en: "Look up" })} onPress={submit} />
          <Pressable onPress={onClose} accessibilityRole="button" style={styles.cancel}>
            <Text style={[styles.cancelText, { color: theme.primary }]}>
              {t({ th: "ยกเลิก", en: "Cancel" })}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sheet: {
    borderTopLeftRadius: RADIUS.sheet,
    borderTopRightRadius: RADIUS.sheet,
    paddingTop: SPACE.xl,
    paddingHorizontal: SPACE.l,
    gap: SPACE.m,
  },
  title: { ...TYPE.title2 },
  field: {
    height: 44,
    borderRadius: RADIUS.field,
    paddingHorizontal: 14,
    ...TYPE.body,
  },
  note: { ...TYPE.subhead },
  cancel: { alignSelf: "center", paddingVertical: SPACE.s },
  cancelText: { ...TYPE.body },
});
