import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import type { CarBrand } from "@/lib/posApi";
import {
  billLineText,
  discountOf,
  subtotal,
  withMechanicPrice,
  type Discount,
} from "@/lib/posBill";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { ChoiceRow, FieldRow } from "./fields";
import { PartPicker, ServicePicker } from "./Pickers";
import { usePos } from "./PosSessionProvider";
import { CodeCopy } from "../CodeCopy";

/** เพิ่มสินค้า — search by name or code, or scan. Sold-out parts never show. */
export function AddPartSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <Sheet
      title={t({ th: "เพิ่มสินค้า", en: "Add part" })}
      closeLabel={t({ th: "เสร็จ", en: "Done" })}
      onClose={onClose}
      tall
    >
      <PartPicker />
    </Sheet>
  );
}

/** เพิ่มบริการ — one of the shop's services, or a line typed in (no stock either way). */
export function AddServiceSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  return (
    <Sheet
      title={t({ th: "เพิ่มบริการ", en: "Add service" })}
      closeLabel={t({ th: "เสร็จ", en: "Done" })}
      onClose={onClose}
      tall
    >
      <ServicePicker />
    </Sheet>
  );
}

/** แก้รายการ — the price, ใช้ราคาช่าง, or take the line off. */
export function EditLineSheet({ lineKey, onClose }: { lineKey: string; onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const line = pos.bill.lines.find((l) => l.key === lineKey);
  const [draft, setDraft] = useState(line);
  const [price, setPrice] = useState(line ? String(line.priceSatang / 100) : "");
  if (!line || !draft) return null;
  const save = () => {
    const baht = parseFloat(price.replace(/,/g, ""));
    const priceSatang = baht >= 0 ? Math.round(baht * 100) : draft.priceSatang;
    pos.updateLine({
      ...draft,
      priceSatang,
      useMechanic: draft.mechanicSatang > 0 && priceSatang === draft.mechanicSatang,
    });
    onClose();
  };
  return (
    <Sheet title={t({ th: "แก้รายการ", en: "Edit item" })} onClose={onClose}>
      <View>
        <Text style={[TYPE.headline, { color: theme.text }]}>
          {billLineText(line, pos.bill.buyer)}
        </Text>
        {line.kind === "part" &&
          (line.productRef ? (
            <CodeCopy
              code={line.productRef}
              tag={line.choiceValue}
              after={` · ${t({ th: `เหลือ ${line.onHand ?? 0}`, en: `${line.onHand ?? 0} left` })}`}
              style={[TYPE.subhead, { color: theme.textMuted }]}
            />
          ) : (
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
              {t({ th: `เหลือ ${line.onHand ?? 0}`, en: `${line.onHand ?? 0} left` })}
            </Text>
          ))}
      </View>
      <Group>
        <FieldRow
          label={t({ th: "ราคาต่อชิ้น ฿", en: "Unit price ฿" })}
          value={price}
          placeholder="0"
          keyboardType="decimal-pad"
          onChange={setPrice}
          last={!(line.kind === "part" && line.mechanicSatang > 0)}
        />
        {line.kind === "part" && line.mechanicSatang > 0 && (
          <View style={styles.switchRow}>
            <View style={styles.grow}>
              <Text style={[TYPE.body, { color: theme.text }]}>
                {t({ th: "ใช้ราคาช่าง", en: "Mechanic price" })}
              </Text>
              <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                {t({
                  th: `ราคาช่าง ${formatBaht(line.mechanicSatang)} · ราคาปกติ ${formatBaht(line.walkInSatang)}`,
                  en: `Mechanic ${formatBaht(line.mechanicSatang)} · normal ${formatBaht(line.walkInSatang)}`,
                })}
              </Text>
            </View>
            <Switch
              value={draft.useMechanic}
              onValueChange={(on) => {
                const next = withMechanicPrice(draft, on);
                setDraft(next);
                setPrice(String(next.priceSatang / 100));
              }}
              trackColor={{ true: theme.primary, false: theme.border }}
              accessibilityLabel={t({ th: "ใช้ราคาช่าง", en: "Mechanic price" })}
            />
          </View>
        )}
      </Group>
      <Pressable
        onPress={() => {
          pos.removeLine(line.key);
          onClose();
        }}
        accessibilityRole="button"
        style={styles.remove}
      >
        <Text style={[TYPE.body, { color: theme.danger }]}>
          {t({ th: "ลบรายการนี้", en: "Remove this item" })}
        </Text>
      </Pressable>
      <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={save} />
    </Sheet>
  );
}

/** ส่วนลดทั้งบิล — baht or percent, with the totals it gives. */
export function DiscountSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const [d, setD] = useState<Discount>(pos.bill.discount);
  const sub = subtotal(pos.bill.lines);
  const off = discountOf(sub, d);
  return (
    <Sheet title={t({ th: "ส่วนลดทั้งบิล", en: "Bill discount" })} onClose={onClose}>
      <Segmented
        label={t({ th: "แบบส่วนลด", en: "Discount type" })}
        options={[
          { value: "thb", label: t({ th: "฿ บาท", en: "฿ Baht" }) },
          { value: "pct", label: t({ th: "% เปอร์เซ็นต์", en: "% Percent" }) },
        ]}
        value={d.kind}
        onChange={(kind) => setD({ ...d, kind: kind as Discount["kind"] })}
      />
      <Group>
        <FieldRow
          label={
            d.kind === "thb"
              ? t({ th: "ส่วนลด ฿", en: "Discount ฿" })
              : t({ th: "ส่วนลด %", en: "Discount %" })
          }
          value={d.value}
          placeholder="0"
          keyboardType="decimal-pad"
          onChange={(value) => setD({ ...d, value })}
          last
        />
      </Group>
      <Group>
        <Line label={t({ th: "รวมย่อย", en: "Subtotal" })} value={formatBaht(sub)} />
        <Line label={t({ th: "ส่วนลด", en: "Discount" })} value={`−${formatBaht(off)}`} />
        <Line
          label={t({ th: "รวมทั้งสิ้น", en: "Total" })}
          value={formatBaht(sub - off)}
          bold
          last
        />
      </Group>
      <BigButton
        label={t({ th: "ใช้ส่วนลด", en: "Apply" })}
        onPress={() => {
          pos.setDiscount(d);
          onClose();
        }}
      />
      <Pressable
        onPress={() => {
          pos.setDiscount({ kind: "thb", value: "" });
          onClose();
        }}
        accessibilityRole="button"
        style={styles.remove}
      >
        <Text style={[TYPE.body, { color: theme.primary }]}>
          {t({ th: "ไม่ให้ส่วนลด", en: "No discount" })}
        </Text>
      </Pressable>
    </Sheet>
  );
}

function Line(props: { label: string; value: string; bold?: boolean; last?: boolean }) {
  const { theme } = useTheme();
  const style = props.bold ? TYPE.headline : TYPE.body;
  return (
    <View
      style={[
        styles.sum,
        !props.last && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <Text style={[style, styles.grow, { color: theme.text }]}>{props.label}</Text>
      <Text style={[style, { color: props.bold ? theme.text : theme.textMuted }]}>
        {props.value}
      </Text>
    </View>
  );
}

/** รถ — brand, then model, then the year (optional). Printed as "Toyota Vigo 2014". */
export function CarSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const pos = usePos();
  const [brand, setBrand] = useState<CarBrand | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState("");
  const done = () => {
    if (!brand || !model) return;
    pos.setBill((b) => ({ ...b, car: [brand.name, model, year.trim()].filter(Boolean).join(" ") }));
    onClose();
  };
  if (!brand) {
    return (
      <Sheet title={t({ th: "ยี่ห้อรถ", en: "Car brand" })} onClose={onClose} tall>
        <Group>
          {pos.data.cars.map((b, i) => (
            <ChoiceRow
              key={b.id}
              label={b.name}
              onPress={() => setBrand(b)}
              last={i === pos.data.cars.length - 1}
            />
          ))}
        </Group>
      </Sheet>
    );
  }
  if (!model) {
    return (
      <Sheet
        title={brand.name}
        left={{ label: t({ th: "‹ ยี่ห้อ", en: "‹ Brands" }), onPress: () => setBrand(null) }}
        onClose={onClose}
        tall
      >
        <Group>
          {brand.models.map((m, i) => (
            <ChoiceRow
              key={m.id}
              label={m.name}
              onPress={() => setModel(m.name)}
              last={i === brand.models.length - 1}
            />
          ))}
        </Group>
      </Sheet>
    );
  }
  return (
    <Sheet
      title={`${brand.name} ${model}`}
      left={{ label: t({ th: "‹ รุ่น", en: "‹ Models" }), onPress: () => setModel(null) }}
      onClose={onClose}
      onDone={done}
    >
      <Group>
        <FieldRow
          label={t({ th: "ปี", en: "Year" })}
          value={year}
          placeholder={t({ th: "ไม่บังคับ เช่น 2014", en: "Optional, e.g. 2014" })}
          keyboardType="number-pad"
          onChange={setYear}
          last
        />
      </Group>
      <BigButton label={t({ th: "ใช้รถคันนี้", en: "Use this car" })} onPress={done} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: 10,
  },
  remove: { alignItems: "center", paddingVertical: SPACE.s },
  sum: { minHeight: 52, paddingHorizontal: SPACE.l, flexDirection: "row", alignItems: "center" },
});
