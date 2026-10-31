import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { bahtText, parseBaht } from "@/lib/productEdit";
import { yearRange } from "@/lib/productList";
import { totalCostSatang } from "@/lib/productPage";
import { nameLabel } from "@/lib/productPickers";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { ChoiceRow, FieldError } from "../pos/fields";
import { RADIUS, SPACE, TYPE } from "../theme";
import { CarAddSheet } from "./CarAddSheet";
import { FormPage } from "./FormPage";
import { AddRow, Heading, InputRow, Line, Stepper, SwitchRow } from "./parts";
import { PartSheet } from "./PartSheets";
import { PhotoStrip } from "./PhotoStrip";
import { ScanCodeSheet } from "./ScanCodeSheet";
import { useProductEdit, type ProductEdit } from "./useProductEdit";

/**
 * แก้ไขสินค้า (canvas v194): everything on one page — photos, name and code, cost and prices, stock,
 * cars, the part's details, the description and where it is sold — saved by the pinned บันทึก.
 * Sell prices and the two shop switches are the owner's; others see them as plain values.
 */
export function EditProductScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const edit = useProductEdit(id);
  const [scanning, setScanning] = useState(false);
  const title = t({ th: "แก้ไขสินค้า", en: "Edit product" });

  if (!edit.rights.edits) {
    return (
      <FormPage title={title} onCancel={edit.leave}>
        <Empty
          icon={ICON.alert}
          title={t({
            th: "แก้ไขสินค้าได้เฉพาะเจ้าของร้านและแอดมิน",
            en: "Only the owner and admins edit products",
          })}
          detail={t({
            th: "นับสต็อกได้จากปุ่ม สต็อกและราคา",
            en: "Stock can be counted from Stock & prices",
          })}
        />
      </FormPage>
    );
  }
  if (!edit.form || !edit.detail) {
    return (
      <FormPage title={title} onCancel={edit.leave}>
        {edit.failed ? (
          <Text style={[TYPE.subhead, { color: theme.text }]}>
            {t({
              th: "โหลดสินค้านี้ไม่ได้ ลองอีกครั้ง",
              en: "This product did not load. Try again",
            })}
          </Text>
        ) : (
          <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
        )}
      </FormPage>
    );
  }
  const f = edit.form;
  return (
    <FormPage
      title={title}
      onCancel={edit.leave}
      save={{ label: t({ th: "บันทึก", en: "Save" }), onPress: () => void edit.save() }}
      toast={edit.toast ? { title: t(edit.toast.title), detail: t(edit.toast.detail) } : null}
    >
      <PhotoStrip edit={edit} />
      <View style={styles.firstGroup}>
        <Group>
          <InputRow
            label={t({ th: "ชื่อสินค้า", en: "Name" })}
            value={f.name}
            onChange={(name) => edit.set({ name })}
          />
          <InputRow
            label={t({ th: "รหัสสินค้า", en: "Code" })}
            value={f.code}
            onChange={(code) => edit.set({ code })}
            last
            tool={
              <Pressable
                onPress={() => setScanning(true)}
                accessibilityRole="button"
                accessibilityLabel={t({ th: "สแกนรหัสสินค้า", en: "Scan the code" })}
                hitSlop={8}
              >
                <LineIcon d={ICON.scan} color={theme.textMuted} size={18} strokeWidth={1.8} />
              </Pressable>
            }
          />
        </Group>
        {edit.errors.name && <FieldError text={t(edit.errors.name)} />}
        {edit.errors.code && <FieldError text={t(edit.errors.code)} />}
        {edit.codeOwner && <CodeTaken edit={edit} />}
      </View>
      <Prices edit={edit} />
      <Heading text={t({ th: "สต็อก", en: "Stock" })} />
      <Group>
        <Line
          label={t({ th: "ขายได้", en: "For sale" })}
          right={
            <Stepper
              value={f.sellable}
              label={t({ th: "ขายได้", en: "For sale" })}
              onChange={(n) => edit.set({ sellable: n })}
            />
          }
        />
        <Line
          label={t({ th: "งานนอก", en: "Out on jobs" })}
          last
          right={
            <Stepper
              value={f.held}
              label={t({ th: "งานนอก", en: "Out on jobs" })}
              onChange={(n) => edit.set({ held: n })}
            />
          }
        />
      </Group>
      <Cars edit={edit} />
      <PartDetails edit={edit} />
      <Heading text={t({ th: "รายละเอียด", en: "Description" })} />
      <View style={[styles.textCard, { backgroundColor: theme.surface }]}>
        <TextInput
          value={f.description}
          onChangeText={(description) => edit.set({ description })}
          placeholder="—"
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={t({ th: "รายละเอียด", en: "Description" })}
          multiline
          style={[TYPE.body, styles.textInput, { color: theme.text }]}
        />
      </View>
      <Heading text={t({ th: "ขายออนไลน์", en: "Sold online" })} />
      <Group>
        <SwitchRow
          label="AirPlus"
          value={f.onAirplus}
          onChange={edit.rights.channels ? (onAirplus) => edit.set({ onAirplus }) : undefined}
        />
        <SwitchRow
          label="Shopee"
          value={f.onShopee}
          onChange={edit.rights.channels ? (onShopee) => edit.set({ onShopee }) : undefined}
          last
        />
      </Group>
      {edit.sheet === "car" && <CarAddSheet edit={edit} />}
      {(edit.sheet === "brand" || edit.sheet === "usage" || edit.sheet === "type") && (
        <PartSheet edit={edit} kind={edit.sheet} />
      )}
      {scanning && (
        <ScanCodeSheet
          onClose={() => setScanning(false)}
          onCode={(code) => {
            setScanning(false);
            edit.set({ code });
          }}
        />
      )}
    </FormPage>
  );
}

/** The code is another product's: say whose, under the field, and let it be opened. */
function CodeTaken({ edit }: { edit: ProductEdit }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const owner = edit.codeOwner!;
  return (
    <View>
      <FieldError
        text={t({
          th: `รหัสนี้ใช้แล้วกับ “${owner.name}”`,
          en: `This code belongs to “${owner.name}”`,
        })}
      />
      <Pressable
        onPress={() => router.push(`/products/${encodeURIComponent(owner.id)}` as never)}
        accessibilityRole="link"
        style={styles.openOther}
      >
        <Text style={[TYPE.footnote, { color: theme.danger }]}>
          {t({ th: "เปิดสินค้านั้น", en: "Open that product" })}
        </Text>
      </Pressable>
    </View>
  );
}

const PRICES = [
  { key: "den", label: { th: "เด่นแอร์", en: "Den Air" } },
  { key: "mechanic", label: { th: "ช่าง", en: "Mechanic" } },
  { key: "airplus", label: { th: "AirPlus", en: "AirPlus" } },
  { key: "shopee", label: { th: "Shopee", en: "Shopee" } },
] as const;

/** Cost first (with the VAT switch and the total), then the four prices. */
function Prices({ edit }: { edit: ProductEdit }) {
  const { t } = useLang();
  const f = edit.form!;
  const baht = t({ th: "บาท", en: "THB" });
  const cost = parseBaht(f.cost);
  const total = cost == null ? "—" : bahtText(totalCostSatang(cost, f.vat));
  return (
    <>
      <Heading text={t({ th: "ราคา", en: "Prices" })} />
      <Group>
        <InputRow
          label={t({ th: "ต้นทุนสินค้า", en: "Item cost" })}
          value={f.cost}
          unit={baht}
          placeholder="—"
          keyboardType="decimal-pad"
          onChange={(cost) => edit.set({ cost })}
        />
        <SwitchRow
          label={t({ th: "บวก VAT 7%", en: "Add 7% VAT" })}
          value={f.vat}
          onChange={(vat) => edit.set({ vat })}
        />
        <InputRow
          label={t({ th: "ต้นทุนรวม", en: "Total cost" })}
          value={total}
          unit={baht}
          editable={false}
          onChange={() => undefined}
          last
        />
      </Group>
      {edit.errors.cost && <FieldError text={t(edit.errors.cost)} />}
      <View style={styles.spaced}>
        <Group>
          {PRICES.map((p, i) => (
            <View key={p.key}>
              <InputRow
                label={t(p.label)}
                value={f[p.key]}
                unit={baht}
                placeholder="—"
                keyboardType="decimal-pad"
                editable={edit.rights.prices}
                onChange={(v) => edit.set({ [p.key]: v })}
                last={i === PRICES.length - 1}
              />
              {edit.errors[p.key] && <FieldError text={t(edit.errors[p.key]!)} />}
            </View>
          ))}
        </Group>
      </View>
    </>
  );
}

function Cars({ edit }: { edit: ProductEdit }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const f = edit.form!;
  return (
    <>
      <Heading text={t({ th: "ใช้ได้กับรถ", en: "Fits these cars" })} />
      <Group>
        {f.fitments.map((car, i) => (
          <Line
            key={`${car.carBrand}|${car.carModel}|${car.yearFrom}|${car.yearTo}`}
            label={[car.carBrand, car.carModel].filter(Boolean).join(" ")}
            right={
              <View style={styles.carRight}>
                <Text style={[TYPE.body, { color: theme.textMuted }]}>
                  {yearRange(car.yearFrom, car.yearTo)}
                </Text>
                <Pressable
                  onPress={() => edit.set({ fitments: f.fitments.filter((_, j) => j !== i) })}
                  accessibilityRole="button"
                  accessibilityLabel={t({
                    th: `เอา ${car.carModel ?? ""} ออก`,
                    en: `Remove ${car.carModel ?? ""}`,
                  })}
                  hitSlop={10}
                >
                  <LineIcon d={ICON.close} color={theme.textMuted} size={14} strokeWidth={2.2} />
                </Pressable>
              </View>
            }
          />
        ))}
        <AddRow
          label={t({ th: "เพิ่มรถ", en: "Add a car" })}
          onPress={() => edit.setSheet("car")}
        />
      </Group>
    </>
  );
}

function PartDetails({ edit }: { edit: ProductEdit }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const f = edit.form!;
  const label = (kind: "brands" | "usages" | "types", name: string | null) =>
    t(nameLabel(edit.attrs?.[kind] ?? [], name));
  const side = (key: "widthCm" | "lengthCm" | "heightCm", said: string) => (
    <TextInput
      value={f[key]}
      onChangeText={(v) => edit.set({ [key]: v })}
      keyboardType="decimal-pad"
      placeholder="—"
      placeholderTextColor={theme.textFaint}
      accessibilityLabel={said}
      style={[TYPE.body, styles.side, { color: theme.text }]}
    />
  );
  return (
    <>
      <Heading text={t({ th: "รายละเอียดอะไหล่", en: "Part details" })} />
      <Group>
        <ChoiceRow
          label={t({ th: "ยี่ห้ออะไหล่", en: "Part brand" })}
          value={label("brands", f.brand)}
          onPress={() => edit.setSheet("brand")}
        />
        <ChoiceRow
          label={t({ th: "ระบบรถ", en: "Car system" })}
          value={label("usages", f.usage)}
          onPress={() => edit.setSheet("usage")}
        />
        <ChoiceRow
          label={t({ th: "ชื่ออะไหล่", en: "Part name" })}
          value={label("types", f.type)}
          onPress={() => edit.setSheet("type")}
        />
        <InputRow
          label={t({ th: "น้ำหนัก", en: "Weight" })}
          value={f.weightKg}
          unit={t({ th: "กก.", en: "kg" })}
          placeholder="—"
          keyboardType="decimal-pad"
          onChange={(weightKg) => edit.set({ weightKg })}
        />
        <Line
          label={t({ th: "ขนาดกล่อง", en: "Box size" })}
          last
          right={
            <View style={styles.carRight}>
              {side("widthCm", t({ th: "กว้าง", en: "Width" }))}
              <Text style={[TYPE.body, { color: theme.text }]}>×</Text>
              {side("lengthCm", t({ th: "ยาว", en: "Length" }))}
              <Text style={[TYPE.body, { color: theme.text }]}>×</Text>
              {side("heightCm", t({ th: "สูง", en: "Height" }))}
              <Text style={[TYPE.body, { color: theme.textMuted }]}>
                {t({ th: "ซม.", en: "cm" })}
              </Text>
            </View>
          }
        />
      </Group>
      {edit.errors.weight && <FieldError text={t(edit.errors.weight)} />}
      {edit.errors.box && <FieldError text={t(edit.errors.box)} />}
    </>
  );
}

const styles = StyleSheet.create({
  firstGroup: { marginTop: SPACE.l },
  spaced: { marginTop: SPACE.m },
  openOther: { marginLeft: SPACE.l + 21, marginTop: 2 },
  carRight: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  side: { width: 36, textAlign: "center", paddingVertical: 0, outlineStyle: "none" } as never,
  textCard: { borderRadius: RADIUS.card, padding: SPACE.l, minHeight: 88 },
  textInput: {
    minHeight: 56,
    paddingVertical: 0,
    textAlignVertical: "top",
    outlineStyle: "none",
  } as never,
});
