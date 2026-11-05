import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { SPACE, TYPE } from "../theme";

interface ScanBoxProps {
  onCode: (code: string) => void;
  /** The scan mark at the box's start opens or closes the computer's own camera (a webcam). */
  camera: boolean;
  onCamera: () => void;
}

/**
 * สแกน on a computer (DeskScan board, 4 Nov 2026): one big box in the camera's place. A USB barcode
 * scanner types the code and Enter here — or anywhere on the page — and a code typed by hand goes
 * in with Enter or ค้นหา. The box keeps the cursor, so the next scan lands in it too.
 */
export function ScanBox({ onCode, camera, onCamera }: ScanBoxProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [code, setCode] = useState("");
  const [empty, setEmpty] = useState(false);
  const label = t({ th: "สแกนหรือพิมพ์รหัสสินค้า", en: "Scan or type a product code" });

  const submit = () => {
    const clean = code.trim();
    if (!clean) {
      setEmpty(true);
      return;
    }
    setCode("");
    onCode(clean);
  };

  return (
    <>
      <View style={[styles.box, { backgroundColor: theme.surface, borderColor: theme.text }]}>
        <Pressable
          onPress={onCamera}
          accessibilityRole="button"
          accessibilityLabel={
            camera
              ? t({ th: "ปิดกล้อง", en: "Close the camera" })
              : t({ th: "สแกนด้วยกล้อง", en: "Scan with the camera" })
          }
          accessibilityState={{ expanded: camera }}
          hitSlop={8}
        >
          <LineIcon d={ICON.scan} color={theme.text} size={30} strokeWidth={1.7} />
        </Pressable>
        <TextInput
          value={code}
          onChangeText={(v) => {
            setCode(v);
            setEmpty(false);
          }}
          onSubmitEditing={submit}
          blurOnSubmit={false}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          placeholder={label}
          placeholderTextColor={theme.textMuted}
          accessibilityLabel={label}
          style={[styles.input, { color: theme.text }]}
        />
        <Pressable
          onPress={submit}
          accessibilityRole="button"
          style={(state) => [
            styles.find,
            {
              backgroundColor:
                (state as { hovered?: boolean }).hovered || state.pressed
                  ? theme.border
                  : theme.hover,
            },
          ]}
        >
          <Text style={[TYPE.subhead, styles.findText, { color: theme.text }]}>
            {t({ th: "ค้นหา", en: "Look up" })}
          </Text>
        </Pressable>
      </View>
      {empty && (
        <Text
          style={[TYPE.subhead, styles.note, { color: theme.text }]}
          accessibilityLiveRegion="polite"
        >
          {t({ th: "ใส่รหัสก่อน", en: "Type a code first" })}
        </Text>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 76,
    borderRadius: 18,
    borderWidth: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.l,
    paddingLeft: 22,
    paddingRight: 14,
  },
  input: {
    ...TYPE.body,
    fontSize: 20,
    lineHeight: 26,
    flex: 1,
    minWidth: 0,
    outlineStyle: "none",
  } as never,
  find: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  findText: { fontWeight: "600" },
  note: { marginTop: SPACE.s, marginHorizontal: SPACE.xs },
});
