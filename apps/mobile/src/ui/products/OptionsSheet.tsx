import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { setUpOptions } from "@/lib/choicesApi";
import { API_BASE } from "@/lib/config";
import { optionsErrors, refusalText } from "@/lib/productChoices";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { TRASH_ICON } from "../flash/parts";
import { LineIcon } from "../LineIcon";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { SPACE, TYPE } from "../theme";
import { AddRow, Divider, InputRow, Photo } from "./parts";
import type { ProductPage } from "./useProductPage";

const VALUE_PHOTO = 28;

/**
 * เพิ่มตัวเลือก, the first time (board ChoicesGroup row 1, last phone): the option's name (ชื่อกลุ่ม)
 * and its values. The first value IS this product — its code, prices and stock become that value's —
 * the others start empty, each to be filled on its own page. Every value shows the product's photo
 * until it gets its own.
 */
export function OptionsSheet({ page, onClose }: { page: ProductPage; onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const d = page.detail!;
  const [name, setName] = useState("");
  const [values, setValues] = useState<string[]>([""]);
  const [checked, setChecked] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const busy = useRef(false);
  const errors = optionsErrors({ name, values });
  const shown = checked ? errors : { name: null, values: values.map(() => null) };
  const first = values[0]?.trim() || t({ th: "ค่าแรก", en: "the first value" });

  const setValue = (i: number, v: string) => {
    setRefused(null);
    setValues((all) => all.map((x, j) => (j === i ? v : x)));
  };

  const save = async () => {
    setChecked(true);
    if (errors.name || errors.values.some(Boolean)) return;
    if (busy.current) return;
    busy.current = true;
    try {
      const out = await setUpOptions(fetch, API_BASE, page.token, d.product.id, name.trim(), [
        ...values.map((v) => v.trim()),
      ]);
      if (!out.ok) return setRefused(out.reason);
      await page.load();
      onClose();
    } catch {
      setRefused("failed");
    } finally {
      busy.current = false;
    }
  };

  return (
    <Sheet title={t({ th: "เพิ่มตัวเลือก", en: "Add choices" })} onClose={onClose} tall>
      <Group>
        <InputRow
          label={t({ th: "ชื่อกลุ่ม", en: "Option name" })}
          value={name}
          placeholder={t({ th: "เช่น ขนาด", en: "e.g. Size" })}
          onChange={(v) => {
            setName(v);
            setRefused(null);
          }}
          error={shown.name ? t(shown.name) : undefined}
        />
        {values.map((v, i) => (
          <View key={i}>
            <View style={styles.valueRow}>
              <Photo imageKey={d.product.imageKey} size={VALUE_PHOTO} radius={6} />
              <TextInput
                value={v}
                onChangeText={(text) => setValue(i, text)}
                placeholder={t({ th: "เช่น 3/8 เล็ก", en: "e.g. 3/8 small" })}
                placeholderTextColor={theme.textFaint}
                accessibilityLabel={t({ th: `ค่าที่ ${i + 1}`, en: `Value ${i + 1}` })}
                style={[TYPE.body, styles.valueInput, { color: theme.text }]}
              />
              {values.length > 1 && (
                <Pressable
                  onPress={() => setValues((all) => all.filter((_, j) => j !== i))}
                  accessibilityRole="button"
                  accessibilityLabel={t({ th: `ลบค่าที่ ${i + 1}`, en: `Remove value ${i + 1}` })}
                  hitSlop={10}
                >
                  <LineIcon d={TRASH_ICON} color={theme.danger} size={20} strokeWidth={1.9} />
                </Pressable>
              )}
            </View>
            {shown.values[i] && <FieldError text={t(shown.values[i]!)} />}
            <Divider />
          </View>
        ))}
        <AddRow
          label={t({ th: "เพิ่มค่า", en: "Add a value" })}
          onPress={() => setValues((all) => [...all, ""])}
        />
      </Group>
      <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
        {t({
          th: `${first} = สินค้านี้ · รหัส ราคา และสต็อกที่มีอยู่ เป็นของ ${first}`,
          en: `${first} = this product · its code, prices and stock become ${first}'s`,
        })}
      </Text>
      {refused && <FieldError text={t(refusalText(refused))} />}
      <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  valueRow: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  valueInput: { flex: 1, minWidth: 0, paddingVertical: 0, outlineStyle: "none" } as never,
  note: { marginTop: SPACE.s, marginBottom: SPACE.l, marginHorizontal: SPACE.l },
});
