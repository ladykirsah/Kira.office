import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { nameCodeProblem } from "@/lib/productAdd";
import { bahtText, belowCost, parseBaht } from "@/lib/productEdit";
import { totalCostSatang } from "@/lib/productPage";
import { nameLabel } from "@/lib/productPickers";
import { useLang, useTheme } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { SPACE, TYPE } from "../theme";
import {
  BoxError,
  BoxField,
  FieldLine,
  LineBox,
  LinePick,
  LinePlain,
  SideBox,
  TextBox,
} from "./DeskFields";
import { PhotoStrip } from "./PhotoStrip";
import { DESK_GAP, DeskColumns, LEAD_PHOTO, Rule, Section } from "./ProductDesk";
import {
  CarRows,
  CodeTaken,
  FieldSheets,
  HINTS,
  OnlineSwitches,
  PRICES,
  StockSteppers,
  type Mode,
} from "./ProductFields";
import { SwitchRow } from "./parts";
import type { ProductFormState } from "./useProductEdit";

/**
 * The product form on a computer, laid out like its product page A2 (DeskProductPage board 10b,
 * owner 5 Nov 2026: "show me new edit form" → "Yes, build it"): one card on top with the photos
 * (the first big) beside ชื่อสินค้า, รหัสสินค้า, the cars and the text; under it three columns,
 * รายละเอียดอะไหล่ | สต็อก + ขายออนไลน์ | ราคา (cost first). Each card is one column of rows, the name
 * on the left and its box on the right. The same fields, words and sheets as the phone's form; a
 * price typed under the total cost shows red (owner, แฟลชเซล 1 Nov). เพิ่มสินค้า uses it too.
 */
export function DeskProductFields({
  edit,
  mode,
  onAutoName,
}: {
  edit: ProductFormState;
  mode: Mode;
  onAutoName?: () => void;
}) {
  const { t } = useLang();
  const [scanning, setScanning] = useState(false);
  return (
    <>
      <View style={styles.page}>
        <DeskCard>
          <View style={styles.top}>
            <PhotoStrip edit={edit} lead={LEAD_PHOTO} />
            <View style={styles.facts}>
              <NameAndCode
                edit={edit}
                mode={mode}
                onAutoName={onAutoName}
                onScan={() => setScanning(true)}
              />
              <Rule />
              <Section title={t({ th: "ใช้ได้กับรถ", en: "Fits these cars" })}>
                <View style={styles.rows}>
                  <CarRows edit={edit} />
                </View>
              </Section>
              <Section title={t({ th: "รายละเอียด", en: "Description" })}>
                <View style={styles.textGap}>
                  <TextBox
                    label={t({ th: "รายละเอียด", en: "Description" })}
                    value={edit.form!.description}
                    onChange={(description) => edit.set({ description })}
                    placeholder={t(HINTS[mode].text)}
                  />
                </View>
              </Section>
            </View>
          </View>
        </DeskCard>
        <DeskColumns>
          <PartCard edit={edit} mode={mode} />
          <>
            <DeskCard title={t({ th: "สต็อก", en: "Stock" })} pad={4}>
              <StockSteppers edit={edit} />
            </DeskCard>
            <DeskCard title={t({ th: "ขายออนไลน์", en: "Sold online" })} pad={4}>
              <OnlineSwitches edit={edit} />
            </DeskCard>
          </>
          <PriceCard edit={edit} mode={mode} />
        </DeskColumns>
      </View>
      <FieldSheets edit={edit} scanning={scanning} onScanned={() => setScanning(false)} />
    </>
  );
}

/** ชื่อสินค้า and รหัสสินค้า (scan at its end), what is wrong under them, ตั้งชื่อให้อัตโนมัติ. */
function NameAndCode(props: {
  edit: ProductFormState;
  mode: Mode;
  onAutoName?: () => void;
  onScan: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { edit, mode } = props;
  const f = edit.form!;
  const hint = HINTS[mode];
  // เพิ่มสินค้า says a missing name and code in one line; แก้ไข says each under its box.
  const both = mode === "add" ? nameCodeProblem(edit.errors) : null;
  const under = (p: Phrase | null | undefined) => (p ? <BoxError text={t(p)} /> : null);
  return (
    <>
      <BoxField
        label={t({ th: "ชื่อสินค้า", en: "Name" })}
        value={f.name}
        placeholder={hint.name && t(hint.name)}
        onChange={(name) => edit.set({ name })}
        red={!!edit.errors.name}
        wraps
        below={mode === "edit" ? under(edit.errors.name) : null}
      />
      <BoxField
        label={t({ th: "รหัสสินค้า", en: "Code" })}
        value={f.code}
        placeholder={hint.code && t(hint.code)}
        onChange={(code) => edit.set({ code })}
        red={!!edit.errors.code || !!edit.codeOwner}
        tool={
          <Pressable
            onPress={props.onScan}
            accessibilityRole="button"
            accessibilityLabel={t({ th: "สแกนรหัสสินค้า", en: "Scan the code" })}
            hitSlop={8}
          >
            <LineIcon d={ICON.scan} color={theme.textMuted} size={18} strokeWidth={1.8} />
          </Pressable>
        }
        below={
          <>
            {mode === "edit" ? under(edit.errors.code) : under(both)}
            {edit.codeOwner && <CodeTaken edit={edit} />}
          </>
        }
      />
      {props.onAutoName && (
        <Pressable onPress={props.onAutoName} accessibilityRole="button" style={styles.autoName}>
          <Text style={[TYPE.subhead, { color: theme.primary }]}>
            {t({ th: "ตั้งชื่อให้อัตโนมัติ", en: "Name it for me" })}
          </Text>
        </Pressable>
      )}
    </>
  );
}

/** ต้นทุนสินค้า, บวก VAT 7% and ต้นทุนรวม, then the four prices — one row each. */
function PriceCard({ edit, mode }: { edit: ProductFormState; mode: Mode }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const f = edit.form!;
  const blank = HINTS[mode].money;
  const baht = t({ th: "บาท", en: "THB" });
  const cost = parseBaht(f.cost);
  const total = cost == null ? "—" : bahtText(totalCostSatang(cost, f.vat)) || blank;
  const error = (p: Phrase | undefined) => (p ? <BoxError text={t(p)} /> : null);
  return (
    <DeskCard title={t({ th: "ราคา", en: "Prices" })} pad={4}>
      <FieldLine label={t({ th: "ต้นทุนสินค้า", en: "Item cost" })} below={error(edit.errors.cost)}>
        <LineBox
          label={t({ th: "ต้นทุนสินค้า", en: "Item cost" })}
          value={f.cost}
          unit={baht}
          placeholder={blank}
          keyboardType="decimal-pad"
          onChange={(c) => edit.set({ cost: c })}
          red={!!edit.errors.cost}
        />
      </FieldLine>
      <SwitchRow
        label={t({ th: "บวก VAT 7%", en: "Add 7% VAT" })}
        value={f.vat}
        onChange={(vat) => edit.set({ vat })}
      />
      <FieldLine label={t({ th: "ต้นทุนรวม", en: "Total cost" })}>
        <LinePlain>
          <Text style={[TYPE.subhead, styles.nums, { color: theme.text }]}>{total}</Text>
          {total !== "—" && <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{baht}</Text>}
        </LinePlain>
      </FieldLine>
      {PRICES.map((p, i) => (
        <FieldLine
          key={p.key}
          label={t(p.label)}
          below={error(edit.errors[p.key])}
          last={i === PRICES.length - 1}
        >
          <LineBox
            label={t(p.label)}
            value={f[p.key]}
            unit={baht}
            placeholder={blank}
            keyboardType="decimal-pad"
            editable={edit.rights.prices}
            onChange={(v) => edit.set({ [p.key]: v })}
            red={!!edit.errors[p.key]}
            valueRed={belowCost(f[p.key], f.cost, f.vat)}
          />
        </FieldLine>
      ))}
    </DeskCard>
  );
}

/** ยี่ห้ออะไหล่, ระบบรถ, ชื่ออะไหล่ (each opens its pick list), then น้ำหนัก and ขนาดกล่อง. */
function PartCard({ edit, mode }: { edit: ProductFormState; mode: Mode }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const f = edit.form!;
  const hint = HINTS[mode];
  const label = (kind: "brands" | "usages" | "types", name: string | null) =>
    name ? t(nameLabel(edit.attrs?.[kind] ?? [], name)) : null;
  const pick = (
    said: Phrase,
    kind: "brands" | "usages" | "types",
    sheet: "brand" | "usage" | "type",
    value: string | null,
  ) => (
    <FieldLine label={t(said)}>
      <LinePick
        label={t(said)}
        value={label(kind, value)}
        hint={t(hint.pick)}
        onPress={() => edit.setSheet(sheet)}
      />
    </FieldLine>
  );
  const side = (key: "widthCm" | "lengthCm" | "heightCm", said: Phrase, blank: Phrase) => (
    <SideBox
      value={f[key]}
      onChange={(v) => edit.set({ [key]: v })}
      placeholder={t(blank)}
      said={t(said)}
      red={!!edit.errors.box}
    />
  );
  const times = <Text style={[TYPE.subhead, { color: theme.text }]}>×</Text>;
  return (
    <DeskCard title={t({ th: "รายละเอียดอะไหล่", en: "Part details" })} pad={4}>
      {pick({ th: "ยี่ห้ออะไหล่", en: "Part brand" }, "brands", "brand", f.brand)}
      {pick({ th: "ระบบรถ", en: "Car system" }, "usages", "usage", f.usage)}
      {pick({ th: "ชื่ออะไหล่", en: "Part name" }, "types", "type", f.type)}
      <FieldLine
        label={t({ th: "น้ำหนัก", en: "Weight" })}
        below={edit.errors.weight ? <BoxError text={t(edit.errors.weight)} /> : null}
      >
        <LineBox
          label={t({ th: "น้ำหนัก", en: "Weight" })}
          value={f.weightKg}
          unit={t({ th: "กก.", en: "kg" })}
          placeholder={hint.money}
          keyboardType="decimal-pad"
          onChange={(weightKg) => edit.set({ weightKg })}
          red={!!edit.errors.weight}
          width={120}
        />
      </FieldLine>
      <FieldLine
        label={t({ th: "ขนาดกล่อง", en: "Box size" })}
        below={edit.errors.box ? <BoxError text={t(edit.errors.box)} /> : null}
        last
      >
        <LinePlain>
          {side("widthCm", { th: "กว้าง", en: "Width" }, hint.sides[0])}
          {times}
          {side("lengthCm", { th: "ยาว", en: "Length" }, hint.sides[1])}
          {times}
          {side("heightCm", { th: "สูง", en: "Height" }, hint.sides[2])}
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {t({ th: "ซม.", en: "cm" })}
          </Text>
        </LinePlain>
      </FieldLine>
    </DeskCard>
  );
}

const styles = StyleSheet.create({
  page: { gap: DESK_GAP },
  // The photos and the fields side by side; the fields go under the photos when there is no room.
  top: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", gap: 32 },
  facts: { flex: 1, minWidth: 300, gap: 14 },
  // The rows' words line up with the bold name above them, as on the product page.
  rows: { marginLeft: -SPACE.l },
  textGap: { paddingTop: SPACE.s },
  autoName: { alignSelf: "flex-start" },
  nums: { fontVariant: ["tabular-nums"] },
});
