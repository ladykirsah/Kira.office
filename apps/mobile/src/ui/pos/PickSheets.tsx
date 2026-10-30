import { useState } from "react";
import { Image, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { searchParts, type CarBrand } from "@/lib/posApi";
import { discountOf, subtotal, withMechanicPrice, type Discount } from "@/lib/posBill";
import { lookupPart } from "@/lib/scanApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { CameraBox } from "../scan/CameraBox";
import { Segmented } from "../Segmented";
import { RADIUS, SPACE, TYPE } from "../theme";
import { ChoiceRow, FieldRow, Note } from "./fields";
import { usePos } from "./PosSessionProvider";

/** How many matches the list draws at once; the count above it is always the full number. */
const SHOWN = 60;

/** เพิ่มสินค้า — search by name or code, or scan. Sold-out parts never show. */
export function AddPartSheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const pos = usePos();
  const [query, setQuery] = useState("");
  const [camera, setCamera] = useState(false);
  const found = searchParts(pos.data.products, query);

  const onCode = async (code: string) => {
    setCamera(false);
    const token = auth.status === "signed-in" ? auth.token : "";
    try {
      const part = await lookupPart(fetch, API_BASE, token, code);
      const row = part && pos.data.products.find((p) => p.variantId === part.variantId);
      if (!part || !row) {
        pos.showToast({ th: "ไม่พบสินค้า", en: "No such part" }, { th: code, en: code });
      } else if (part.onHand <= 0) {
        pos.showToast(
          { th: "สินค้าหมด", en: "Sold out" },
          { th: `${row.name} · ไม่เพิ่มเข้าบิล`, en: `${row.name} · not added` },
        );
      } else {
        pos.addPart({ ...row, onHand: part.onHand });
      }
    } catch {
      pos.showToast(
        { th: "สแกนไม่ได้", en: "Scan failed" },
        { th: "ไม่มีเน็ต ค้นด้วยชื่อแทน", en: "No internet; search by name instead" },
      );
    }
  };

  return (
    <Sheet
      title={t({ th: "เพิ่มสินค้า", en: "Add part" })}
      closeLabel={t({ th: "เสร็จ", en: "Done" })}
      onClose={onClose}
      tall
    >
      <View style={[styles.search, { backgroundColor: theme.surface }]}>
        <LineIcon d={ICON.search} color={theme.textMuted} size={18} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t({ th: "ชื่อ หรือรหัสสินค้า", en: "Name or code" })}
          placeholderTextColor={theme.textFaint}
          autoFocus
          accessibilityLabel={t({ th: "ค้นหาสินค้า", en: "Search parts" })}
          style={[TYPE.body, styles.searchInput, { color: theme.text }]}
        />
        <Pressable
          onPress={() => setCamera((c) => !c)}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "สแกน", en: "Scan" })}
          hitSlop={8}
        >
          <LineIcon d={ICON.scan} color={theme.text} size={20} />
        </Pressable>
      </View>
      {camera && <CameraBox height={142} showHint={false} onCode={(c) => void onCode(c)} />}
      <Text style={[TYPE.subhead, styles.count, { color: theme.text }]}>
        {t({ th: `พบ ${found.length} รายการ`, en: `${found.length} found` })}
      </Text>
      {found.length > 0 && (
        <Group>
          {found.slice(0, SHOWN).map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.result,
                i < Math.min(found.length, SHOWN) - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              {p.imageKey ? (
                <Image
                  source={{ uri: `${API_BASE}/img/${p.imageKey}` }}
                  style={[styles.thumb, { backgroundColor: theme.bg }]}
                />
              ) : (
                <View style={[styles.thumb, { backgroundColor: theme.bg }]} />
              )}
              <View style={styles.grow}>
                <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={2}>
                  {p.name}
                </Text>
                <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                  {[p.productRef, t({ th: `เหลือ ${p.onHand}`, en: `${p.onHand} left` })]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Text style={[TYPE.body, { color: theme.text }]}>
                {formatBaht(p.offlinePriceSatang)}
              </Text>
              <Pressable
                onPress={() => pos.addPart(p)}
                accessibilityRole="button"
                accessibilityLabel={t({ th: `เพิ่ม ${p.name}`, en: `Add ${p.name}` })}
                style={[styles.plus, { backgroundColor: theme.hover }]}
              >
                <LineIcon d={ICON.plus} color={theme.text} size={16} strokeWidth={2.4} />
              </Pressable>
            </View>
          ))}
        </Group>
      )}
      <Note>
        {t({
          th: "สินค้าที่หมด (เหลือ 0) ไม่ขึ้นในรายการ · สแกนตัวที่หมดจะบอกว่าหมด ไม่เพิ่มเข้าบิล",
          en: "Sold-out parts never show · scanning one says so and adds nothing",
        })}
      </Note>
    </Sheet>
  );
}

/** เพิ่มบริการ — one of the shop's services, or a line typed in (no stock either way). */
export function AddServiceSheet({ onClose }: { onClose: () => void }) {
  const { t, lang } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const addTyped = () => {
    const baht = parseFloat(price.replace(/,/g, ""));
    if (!name.trim()) return setError(t({ th: "ใส่ชื่อรายการ", en: "Enter a name" }));
    if (!(baht >= 0)) return setError(t({ th: "ใส่ราคา", en: "Enter a price" }));
    pos.addService({ name: name.trim(), priceSatang: Math.round(baht * 100) });
    setName("");
    setPrice("");
    setError(null);
  };
  return (
    <Sheet
      title={t({ th: "เพิ่มบริการ", en: "Add service" })}
      closeLabel={t({ th: "เสร็จ", en: "Done" })}
      onClose={onClose}
      tall
    >
      <Text style={[TYPE.subhead, styles.label, { color: theme.text }]}>
        {t({ th: "บริการของร้าน", en: "The shop's services" })}
      </Text>
      <Group>
        {pos.data.services.map((s, i) => {
          const name = lang === "en" && s.nameEn ? s.nameEn : s.name;
          return (
            <View
              key={s.id}
              style={[
                styles.result,
                i < pos.data.services.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: theme.border,
                },
              ]}
            >
              <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{name}</Text>
              <Text style={[TYPE.body, { color: theme.textMuted }]}>
                {formatBaht(s.basePriceSatang)}
              </Text>
              <Pressable
                onPress={() => pos.addService({ name: s.name, priceSatang: s.basePriceSatang })}
                accessibilityRole="button"
                accessibilityLabel={t({ th: `เพิ่ม ${name}`, en: `Add ${name}` })}
                style={[styles.plus, { backgroundColor: theme.hover }]}
              >
                <LineIcon d={ICON.plus} color={theme.text} size={16} strokeWidth={2.4} />
              </Pressable>
            </View>
          );
        })}
      </Group>
      <Text style={[TYPE.subhead, styles.label, { color: theme.text }]}>
        {t({ th: "รายการอื่น (พิมพ์เอง)", en: "Something else (type it)" })}
      </Text>
      <Group>
        <FieldRow
          label={t({ th: "ชื่อรายการ", en: "Name" })}
          value={name}
          placeholder={t({ th: "เช่น ค่าเดินทาง", en: "e.g. Travel" })}
          onChange={setName}
        />
        <FieldRow
          label={t({ th: "ราคา ฿", en: "Price ฿" })}
          value={price}
          placeholder="0"
          keyboardType="decimal-pad"
          onChange={setPrice}
          error={error}
          last
        />
      </Group>
      <BigButton label={t({ th: "เพิ่มรายการนี้", en: "Add it" })} kind="grey" onPress={addTyped} />
      <Note>
        {t({
          th: "บริการและรายการอื่นไม่ตัดสต็อก · ราคาแก้ได้ในบิล",
          en: "Services take no stock · the price can change on the bill",
        })}
      </Note>
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
        <Text style={[TYPE.headline, { color: theme.text }]}>{line.name}</Text>
        {line.kind === "part" && (
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {[
              line.productRef,
              t({ th: `เหลือ ${line.onHand ?? 0}`, en: `${line.onHand ?? 0} left` }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        )}
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
  search: {
    height: 44,
    borderRadius: RADIUS.field,
    paddingHorizontal: SPACE.m,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  searchInput: { flex: 1, minWidth: 0, outlineStyle: "none" } as never,
  count: { fontWeight: "600", marginHorizontal: SPACE.xs },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: 10,
  },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  grow: { flex: 1, minWidth: 0 },
  plus: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  label: { fontWeight: "600", marginHorizontal: SPACE.xs },
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
