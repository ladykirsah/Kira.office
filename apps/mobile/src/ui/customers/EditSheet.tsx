import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldRow } from "../pos/fields";
import { SPACE, TYPE } from "../theme";
import type { CarPage } from "./useCarPage";

/** แก้ไขลูกค้า: name, every phone (＋ เพิ่มเบอร์), and the note. Blank fields keep what is saved. */
export function EditSheet({ page }: { page: CarPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const edit = page.edit!;
  const set = (next: Partial<typeof edit>) => page.setEdit({ ...edit, ...next });
  return (
    <Sheet
      title={t({ th: "แก้ไขลูกค้า", en: "Edit customer" })}
      onClose={() => page.setEdit(null)}
      tall
    >
      <Group>
        <FieldRow
          label={t({ th: "ชื่อ", en: "Name" })}
          value={edit.name}
          placeholder="—"
          onChange={(name) => set({ name })}
          last
        />
      </Group>
      <Group spaced>
        {edit.phones.map((p, i) => (
          <FieldRow
            key={i}
            label={
              i === 0 ? t({ th: "เบอร์โทร", en: "Phone" }) : t({ th: "เบอร์อื่น", en: "Other" })
            }
            value={p}
            placeholder="—"
            keyboardType="phone-pad"
            onChange={(v) => set({ phones: edit.phones.map((x, j) => (j === i ? v : x)) })}
          />
        ))}
        <Pressable
          onPress={() => set({ phones: [...edit.phones, ""] })}
          accessibilityRole="button"
          style={styles.add}
        >
          <Text style={[TYPE.body, { color: theme.primary }]}>
            {t({ th: "＋ เพิ่มเบอร์", en: "＋ Add a phone" })}
          </Text>
        </Pressable>
      </Group>
      <Text style={[TYPE.footnote, styles.label, { color: theme.textMuted }]}>
        {t({ th: "หมายเหตุ", en: "Note" })}
      </Text>
      <View style={[styles.note, { backgroundColor: theme.surface }]}>
        <TextInput
          value={edit.notes}
          onChangeText={(notes) => set({ notes })}
          placeholder="—"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={t({ th: "หมายเหตุ", en: "Note" })}
          multiline
          style={[TYPE.body, styles.noteInput, { color: theme.text }]}
        />
      </View>
      <Text style={[TYPE.footnote, styles.hint, { color: theme.textMuted }]}>
        {t({
          th: "ใส่หรือไม่ใส่ก็ได้ทุกช่อง · ช่องว่างไม่ลบข้อมูลเดิม",
          en: "Every field is optional · a blank keeps what is saved",
        })}
      </Text>
      <View style={styles.save}>
        <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void page.save()} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  add: { minHeight: 50, justifyContent: "center", paddingHorizontal: SPACE.l },
  label: { marginTop: SPACE.xxl, marginBottom: SPACE.s, marginHorizontal: SPACE.l },
  note: { borderRadius: 12, padding: SPACE.l, minHeight: 88 },
  noteInput: {
    minHeight: 56,
    paddingVertical: 0,
    textAlignVertical: "top",
    outlineStyle: "none",
  } as never,
  hint: { marginTop: SPACE.s, marginHorizontal: SPACE.l },
  save: { marginTop: SPACE.xxl },
});
