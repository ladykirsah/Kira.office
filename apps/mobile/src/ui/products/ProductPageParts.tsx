import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import { yearRange } from "@/lib/productList";
import { boxText, priceRows, weightText, type PriceRow } from "@/lib/productPage";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { RADIUS, SPACE, TYPE } from "../theme";
import { DOWN, Line, SwitchRow, UP } from "./parts";
import type { ProductPage } from "./useProductPage";

/**
 * หน้าสินค้า's rows, the same on a phone (each list under its heading) and on a computer (each list
 * in its own card, DeskProducts board): prices, stock, cars, the part's details, where it is sold.
 */

export function Value({ text, grey }: { text: string; grey?: boolean }) {
  const { theme } = useTheme();
  return (
    <Text style={[TYPE.body, styles.value, { color: grey ? theme.textMuted : theme.text }]}>
      {text}
    </Text>
  );
}

/** ต้นทุน first, then the four prices; Shopee's ⌄ takes off the shop's Shopee fees (ข้อมูลร้าน). */
export function PriceLines({ page }: { page: ProductPage }) {
  const d = page.detail!;
  return (
    <>
      {priceRows(d.pricing, page.rights.seesCost, page.shopeeFeeBp).map((row, i, all) => (
        <PriceItem key={row.key} row={row} last={i === all.length - 1} />
      ))}
    </>
  );
}

/** A price with its plain ⌄; tapping drops the sum or the profit (no press-and-hold). */
function PriceItem({ row, last }: { row: PriceRow; last: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const right = (
    <View style={styles.priceRight}>
      <Value text={row.satang ? formatBaht(row.satang) : "—"} />
      {row.lines.length > 0 && (
        <LineIcon d={open ? UP : DOWN} color={theme.textFaint} size={15} strokeWidth={2.4} />
      )}
    </View>
  );
  return (
    <View>
      <Line
        label={t(row.label)}
        right={right}
        last={last && !open}
        onPress={row.lines.length > 0 ? () => setOpen(!open) : undefined}
      />
      {open && (
        <View style={[styles.drop, { backgroundColor: theme.bg }]}>
          {row.lines.map((line) => (
            <View key={line.label.th} style={styles.dropLine}>
              <Text style={[TYPE.footnote, styles.grow, { color: theme.textMuted }]}>
                {t(line.label)}
              </Text>
              <Text
                style={[
                  TYPE.footnote,
                  styles.value,
                  { color: line.loss ? theme.danger : theme.text },
                ]}
              >
                {line.text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** ขายได้ and งานนอก. */
export function StockLines({ page }: { page: ProductPage }) {
  const { t } = useLang();
  const d = page.detail!;
  return (
    <>
      <Line label={t({ th: "ขายได้", en: "For sale" })} right={<Value text={String(d.onHand)} />} />
      <Line
        label={t({ th: "งานนอก", en: "Out on jobs" })}
        right={<Value text={String(d.held)} />}
        last
      />
    </>
  );
}

/** The cars it fits, each with its years; a dash when none. */
export function CarLines({ page }: { page: ProductPage }) {
  const d = page.detail!;
  if (d.fitments.length === 0) return <Line label="—" last />;
  return (
    <>
      {d.fitments.map((f, i) => (
        <Line
          key={`${f.carBrand}|${f.carModel}|${f.yearFrom}|${f.yearTo}`}
          label={[f.carBrand, f.carModel].filter(Boolean).join(" ")}
          right={<Value text={yearRange(f.yearFrom, f.yearTo)} grey />}
          last={i === d.fitments.length - 1}
        />
      ))}
    </>
  );
}

/** ยี่ห้ออะไหล่ … ขนาดกล่อง, with the code to copy. */
export function DetailLines({ page }: { page: ProductPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const p = page.detail!.product;
  return (
    <>
      <Line
        label={t({ th: "ยี่ห้ออะไหล่", en: "Part brand" })}
        right={<Value text={page.label("brands", p.brandName)} grey />}
      />
      <Line
        label={t({ th: "ระบบรถ", en: "Car system" })}
        right={<Value text={page.label("usages", p.usageName)} grey />}
      />
      <Line
        label={t({ th: "ชื่ออะไหล่", en: "Part name" })}
        right={<Value text={page.label("types", p.typeName)} grey />}
      />
      <Line
        label={t({ th: "รหัสสินค้า", en: "Product code" })}
        right={
          <View style={styles.priceRight}>
            <Value text={p.productRef} grey />
            <Pressable
              onPress={() => page.copy(p.productRef)}
              accessibilityRole="button"
              accessibilityLabel={t({ th: `คัดลอก ${p.productRef}`, en: `Copy ${p.productRef}` })}
              hitSlop={10}
            >
              <LineIcon d={ICON.copy} color={theme.textMuted} size={14} strokeWidth={2} />
            </Pressable>
          </View>
        }
      />
      <Line
        label={t({ th: "น้ำหนัก", en: "Weight" })}
        right={<Value text={t(weightText(p.weightGrams))} grey />}
      />
      <Line
        label={t({ th: "ขนาดกล่อง", en: "Box size" })}
        right={<Value text={t(boxText(p.widthMm, p.lengthMm, p.heightMm))} grey />}
        last
      />
    </>
  );
}

/** AirPlus and Shopee, as switches that only show (they change on แก้ไข). */
export function OnlineLines({ page }: { page: ProductPage }) {
  const p = page.detail!.product;
  return (
    <>
      <SwitchRow label="AirPlus" value={p.status === "active"} />
      <SwitchRow label="Shopee" value={p.shopeeListed === 1} last />
    </>
  );
}

/** ลบสินค้า, the owner's only. */
export function DeleteLine({ onPress }: { onPress: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.deleteRow}>
      <Text style={[TYPE.body, { color: theme.danger }]}>
        {t({ th: "ลบสินค้า", en: "Delete product" })}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  value: { fontVariant: ["tabular-nums"], textAlign: "right" },
  priceRight: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  drop: {
    marginHorizontal: SPACE.l,
    marginBottom: SPACE.m,
    borderRadius: RADIUS.field,
    paddingVertical: SPACE.xs,
  },
  dropLine: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.m,
    paddingVertical: 6,
  },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
});
