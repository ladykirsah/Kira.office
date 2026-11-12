import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { updateChoice } from "@/lib/choicesApi";
import { API_BASE } from "@/lib/config";
import {
  choiceBody,
  choiceFormFrom,
  choiceMoves,
  choicePhoto,
  choicePrice,
  choiceStock,
  refusalText,
  validateChoiceForm,
  type Choice,
  type ChoiceForm,
} from "@/lib/productChoices";
import type { ProductDetail } from "@/lib/productEdit";
import type { ProductRow } from "@/lib/productList";
import { countStock } from "@/lib/productsApi";
import { moveHold } from "@/lib/scanApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { SPACE, TYPE } from "../theme";
import { InputRow, Line, Photo, SmallHeading, Stepper } from "./parts";
import type { ProductList } from "./useProductList";

const PRICES = [
  { key: "den", label: { th: "เด่นแอร์", en: "Den Air" } },
  { key: "mechanic", label: { th: "ช่าง", en: "Mechanic" } },
  { key: "airplus", label: { th: "AirPlus", en: "AirPlus" } },
  { key: "shopee", label: { th: "Shopee", en: "Shopee" } },
] as const;

/**
 * สต็อกและราคา for a product with sizes (owner, 11 Nov 2026: picked as drawn): each size keeps its own
 * stock and prices, so the sheet first asks which size (เลือกขนาด), then counts and prices THAT size.
 * ‹ ขนาด goes back to the sizes.
 */
export function SizeStockSheet(props: {
  list: ProductList;
  row: ProductRow;
  detail: ProductDetail;
}) {
  const [picked, setPicked] = useState<Choice | null>(null);
  const close = () => props.list.setStockFor(null);
  return picked ? (
    <SizeForm {...props} choice={picked} onBack={() => setPicked(null)} onDone={close} />
  ) : (
    <SizePick {...props} onPick={setPicked} onClose={close} />
  );
}

function SizePick(props: {
  row: ProductRow;
  detail: ProductDetail;
  onPick: (c: Choice) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const choices = props.detail.choices ?? [];
  return (
    <Sheet title={t({ th: "เลือกขนาด", en: "Pick a size" })} onClose={props.onClose}>
      <Group>
        {choices.map((c, i) => (
          <Pressable
            key={c.variantId}
            onPress={() => props.onPick(c)}
            accessibilityRole="button"
            accessibilityLabel={c.value}
            style={({ pressed }) => [
              styles.row,
              i < choices.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.border,
              },
              pressed && { backgroundColor: theme.hover },
            ]}
          >
            <Photo imageKey={choicePhoto(c, props.row.imageKey)} size={44} radius={10} />
            <View style={styles.grow}>
              <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={1}>
                {c.value}
              </Text>
              <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
                {`${t(choiceStock(c))} · ${choicePrice(c)}`}
              </Text>
            </View>
            <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
          </Pressable>
        ))}
      </Group>
      <Text style={[TYPE.footnote, styles.note, { color: theme.textMuted }]}>
        {t({
          th: "สต็อกและราคาแยกตามขนาด · แตะขนาด → แก้ของขนาดนั้น",
          en: "Each size has its own stock and prices · tap one to change it",
        })}
      </Text>
    </Sheet>
  );
}

function SizeForm(props: {
  list: ProductList;
  row: ProductRow;
  choice: Choice;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const { list, row, choice } = props;
  const stored = choiceFormFrom(choice);
  const [form, setForm] = useState<ChoiceForm>(stored);
  const [busy, setBusy] = useState(false);
  // Only the four prices can be wrong here; the name and the code are not on this sheet.
  const all = validateChoiceForm(form);
  const errors = Object.fromEntries(
    PRICES.filter((p) => all[p.key]).map((p) => [p.key, all[p.key]!]),
  ) as Partial<Record<(typeof PRICES)[number]["key"], (typeof all)["den"]>>;

  const save = async () => {
    if (busy || Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      const refused: string[] = [];
      if (list.rights.prices && PRICES.some((p) => form[p.key] !== stored[p.key])) {
        const out = await updateChoice(
          fetch,
          API_BASE,
          token,
          row.id,
          choice.variantId,
          choiceBody(form, choice.pricing, list.rights.prices),
        );
        if (!out.ok) refused.push(t(refusalText(out.reason)));
      }
      const moves = choiceMoves(choice, choice.variantId, form);
      if (moves.adjust) {
        const res = await countStock(fetch, API_BASE, token, moves.adjust);
        if (!res.applied && res.reason) refused.push(res.reason);
      }
      if (moves.hold) {
        const [res] = await moveHold(fetch, API_BASE, token, [moves.hold]);
        if (res && !res.applied && res.reason) refused.push(res.reason);
      }
      props.onDone();
      await list.load();
      list.showToast(
        refused.length
          ? { th: "บันทึกบางส่วน", en: "Partly saved" }
          : { th: "บันทึกแล้ว", en: "Saved" },
        refused.length ? { th: refused.join(" · "), en: refused.join(" · ") } : undefined,
      );
    } catch (e) {
      const why = e instanceof Error ? e.message : "";
      list.showToast(
        { th: "บันทึกไม่สำเร็จ", en: "Not saved" },
        { th: why || "ลองอีกครั้ง", en: why || "Try again" },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t({ th: "สต็อกและราคา", en: "Stock & prices" })}
      onClose={props.onDone}
      left={{ label: t({ th: "‹ ขนาด", en: "‹ Sizes" }), onPress: props.onBack }}
    >
      <View style={styles.head}>
        <Photo imageKey={choicePhoto(choice, row.imageKey)} size={48} radius={10} />
        <View style={styles.grow}>
          <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={1}>
            {choice.value}
          </Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
            {row.name}
          </Text>
        </View>
      </View>
      <Group>
        <Line
          label={t({ th: "ขายได้", en: "For sale" })}
          right={
            <Stepper
              value={form.sellable}
              label={t({ th: "ขายได้", en: "For sale" })}
              onChange={(n) => setForm({ ...form, sellable: n })}
            />
          }
        />
        <Line
          label={t({ th: "งานนอก", en: "Out on jobs" })}
          last
          right={
            <Stepper
              value={form.held}
              label={t({ th: "งานนอก", en: "Out on jobs" })}
              onChange={(n) => setForm({ ...form, held: n })}
            />
          }
        />
      </Group>
      <SmallHeading text={t({ th: "ราคา", en: "Prices" })} />
      <Group>
        {PRICES.map((p, i) => (
          <View key={p.key}>
            <InputRow
              label={t(p.label)}
              value={form[p.key]}
              unit={t({ th: "บาท", en: "THB" })}
              placeholder="—"
              keyboardType="decimal-pad"
              editable={list.rights.prices}
              onChange={(v) => setForm({ ...form, [p.key]: v })}
              last={i === PRICES.length - 1}
            />
            {errors[p.key] ? <FieldError text={t(errors[p.key]!)} /> : null}
          </View>
        ))}
      </Group>
      <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: 10,
  },
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.m },
  grow: { flex: 1, minWidth: 0 },
  note: { marginHorizontal: SPACE.l },
});
