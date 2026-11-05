import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Phrase } from "@l-shopee/shared/lang";
import {
  coolantWords,
  modelHead,
  oringRows,
  titleOf,
  type CarBrand,
  type CarModel,
  type ModelDraft,
} from "@/lib/carFitmentPage";
import { useLang, useTheme } from "../AppProviders";
import { Group } from "../orders/parts";
import { ValueRow } from "../partsSetup/parts";
import { FieldError } from "../pos/fields";
import { AddRow, Divider, InputRow } from "../products/parts";
import { SPACE, TYPE } from "../theme";

/** หมายเหตุ: its label above the text, the shop page's ที่อยู่ row. */
function NoteRow(props: { label: string; children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.note}>
      <Text style={[TYPE.body, { color: theme.text }]}>{props.label}</Text>
      {props.children}
    </View>
  );
}

/**
 * A model as read (owner, 3 Nov 2026: "separate them into its own section without headline"):
 * แชสซี · น้ำยาแอร์ · น้ำหล่อเย็น / one row per o-ring size / หมายเหตุ — three cards, no headings.
 */
export function ModelView(props: { brand: CarBrand; model: CarModel }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const m = props.model;
  const orings = oringRows(m);
  return (
    <View>
      <Text style={[TYPE.title1, styles.title, { color: theme.text }]} accessibilityRole="header">
        {titleOf(m)}
      </Text>
      <Text style={[TYPE.subhead, styles.sub, { color: theme.textMuted }]}>
        {t(modelHead(props.brand, m))}
      </Text>
      <View style={styles.cards}>
        <Group>
          <ValueRow label={t({ th: "แชสซี", en: "Chassis" })} value={m.chassis ?? "—"} />
          <ValueRow
            label={t({ th: "น้ำยาแอร์", en: "Refrigerant" })}
            value={m.refrigerant ?? "—"}
          />
          <ValueRow
            label={t({ th: "น้ำหล่อเย็น", en: "Coolant" })}
            value={coolantWords(m.coolant)}
            last
          />
        </Group>
        {orings.length > 0 && (
          <Group>
            {orings.map((o, i) => (
              <ValueRow
                key={o.label}
                label={o.label}
                value={o.value}
                last={i === orings.length - 1}
              />
            ))}
          </Group>
        )}
        {m.notes && (
          <Group>
            <NoteRow label={t({ th: "หมายเหตุ", en: "Notes" })}>
              <Text style={[TYPE.subhead, { color: theme.text }]}>{m.notes}</Text>
            </NoteRow>
          </Group>
        )}
      </View>
    </View>
  );
}

const NUMBER = /^\d*(\.\d*)?$/;

/**
 * แก้ไข turns the page into its form: names and years, the same three cards as boxes (＋
 * เพิ่มขนาดโอริง adds a size you type, ✕ takes it away), then ลบรุ่นนี้ only when no product fits it.
 * The first `saved` o-ring rows are the model's own sizes: their amount changes, an empty one drops.
 */
export function ModelEdit(props: {
  draft: ModelDraft;
  saved: number;
  problems: Partial<Record<"nameEn" | "yearFrom", Phrase>>;
  onChange: (patch: Partial<ModelDraft>) => void;
  deleteRow: ReactNode;
  /** A computer: names and service info on the left, o-rings and the note on the right (canvas คอม 6). */
  wide?: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const d = props.draft;
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  const setOring = (i: number, patch: Partial<{ size: string; qty: string }>) =>
    props.onChange({ orings: d.orings.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const box = [styles.box, { backgroundColor: theme.segBg }];
  const names = (
    <View>
      <Group>
        <InputRow
          label={t({ th: "ชื่อไทย", en: "Thai name" })}
          value={d.nameTh}
          placeholder={t({ th: "เช่น วีโก้", en: "e.g. วีโก้" })}
          onChange={(nameTh) => props.onChange({ nameTh })}
        />
        <InputRow
          label={t({ th: "ชื่ออังกฤษ", en: "English name" })}
          value={d.nameEn}
          placeholder={t({ th: "เช่น Vigo", en: "e.g. Vigo" })}
          onChange={(nameEn) => props.onChange({ nameEn })}
        />
        <InputRow
          label={t({ th: "ปีเริ่ม", en: "From" })}
          value={d.yearFrom}
          placeholder={t({ th: "เช่น 2005", en: "e.g. 2005" })}
          keyboardType="number-pad"
          onChange={(v) => props.onChange({ yearFrom: digits(v) })}
        />
        <InputRow
          label={t({ th: "ปีสิ้นสุด", en: "To" })}
          value={d.yearTo}
          placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
          keyboardType="number-pad"
          onChange={(v) => props.onChange({ yearTo: digits(v) })}
          last
        />
      </Group>
      {props.problems.nameEn && <FieldError text={t(props.problems.nameEn)} />}
      {props.problems.yearFrom && <FieldError text={t(props.problems.yearFrom)} />}
    </View>
  );
  const info = (
    <Group>
      <InputRow
        label={t({ th: "แชสซี", en: "Chassis" })}
        value={d.chassis}
        placeholder={t({ th: "เช่น NSP151", en: "e.g. NSP151" })}
        onChange={(chassis) => props.onChange({ chassis })}
      />
      <InputRow
        label={t({ th: "น้ำยาแอร์", en: "Refrigerant" })}
        value={d.refrigerant}
        placeholder={t({ th: "เช่น R134a", en: "e.g. R134a" })}
        onChange={(refrigerant) => props.onChange({ refrigerant })}
      />
      <InputRow
        label={t({ th: "น้ำหล่อเย็น", en: "Coolant" })}
        value={d.coolant}
        placeholder={t({ th: "เช่น 6", en: "e.g. 6" })}
        unit={NUMBER.test(d.coolant.trim()) ? t({ th: "ลิตร", en: "L" }) : undefined}
        keyboardType="decimal-pad"
        onChange={(coolant) => props.onChange({ coolant })}
        last
      />
    </Group>
  );
  const rings = (
    <Group>
      {d.orings.map((o, i) =>
        i < props.saved ? (
          <InputRow
            key={`saved-${o.size}`}
            label={`โอริง ${o.size}`}
            value={o.qty}
            placeholder="0"
            keyboardType="number-pad"
            onChange={(v) => setOring(i, { qty: v.replace(/\D/g, "") })}
          />
        ) : (
          <View key={`new-${i}`}>
            <View style={styles.newRow}>
              <Text style={[TYPE.body, { color: theme.text }]}>โอริง</Text>
              <TextInput
                value={o.size}
                onChangeText={(size) => setOring(i, { size })}
                placeholder={t({ th: 'ขนาด เช่น 3/4"', en: 'Size, e.g. 3/4"' })}
                placeholderTextColor={theme.textMuted}
                accessibilityLabel={t({ th: "ขนาดโอริง", en: "O-ring size" })}
                style={[TYPE.body, box, styles.size, { color: theme.text }]}
              />
              <TextInput
                value={o.qty}
                onChangeText={(v) => setOring(i, { qty: v.replace(/\D/g, "") })}
                placeholder={t({ th: "จำนวน", en: "Qty" })}
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
                accessibilityLabel={t({ th: "จำนวนโอริง", en: "O-ring amount" })}
                style={[TYPE.body, box, styles.qty, { color: theme.text }]}
              />
              <Pressable
                onPress={() => props.onChange({ orings: d.orings.filter((_, j) => j !== i) })}
                accessibilityRole="button"
                accessibilityLabel={t({ th: "เอาขนาดนี้ออก", en: "Remove this size" })}
                hitSlop={11}
                style={[styles.x, { backgroundColor: theme.hover }]}
              >
                <Text style={[styles.xMark, { color: theme.textMuted }]}>✕</Text>
              </Pressable>
            </View>
            <Divider />
          </View>
        ),
      )}
      <AddRow
        label={t({ th: "เพิ่มขนาดโอริง", en: "Add an o-ring size" })}
        onPress={() => props.onChange({ orings: [...d.orings, { size: "", qty: "" }] })}
      />
    </Group>
  );
  const note = (
    <Group>
      <NoteRow label={t({ th: "หมายเหตุ", en: "Notes" })}>
        <TextInput
          value={d.notes}
          onChangeText={(notes) => props.onChange({ notes })}
          placeholder={t({ th: "ไม่ใส่ก็ได้", en: "Optional" })}
          placeholderTextColor={theme.textFaint}
          multiline
          accessibilityLabel={t({ th: "หมายเหตุ", en: "Notes" })}
          style={[TYPE.subhead, styles.noteInput, { color: theme.text }]}
        />
      </NoteRow>
    </Group>
  );
  if (props.wide) {
    return (
      <View style={styles.wideRow}>
        <View style={styles.wideCol}>
          {names}
          {info}
        </View>
        <View style={styles.wideCol}>
          {rings}
          {note}
          {props.deleteRow}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.cards}>
      {names}
      {info}
      {rings}
      {note}
      {props.deleteRow}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: SPACE.s, marginHorizontal: 2 },
  sub: { marginHorizontal: 2 },
  cards: { marginTop: SPACE.xl, gap: SPACE.xl },
  wideRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.xl },
  wideCol: { flex: 1, minWidth: 0, gap: SPACE.xl },
  note: { paddingVertical: 12, paddingHorizontal: SPACE.l, gap: 2 },
  noteInput: { padding: 0, minHeight: 22, outlineStyle: "none" } as never,
  newRow: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  box: {
    height: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 0,
    outlineStyle: "none",
  } as never,
  size: { flex: 1, minWidth: 0 },
  qty: { width: 72, textAlign: "center" },
  x: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  xMark: { fontSize: 13, lineHeight: 16 },
});
