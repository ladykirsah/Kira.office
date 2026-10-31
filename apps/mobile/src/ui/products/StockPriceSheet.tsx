import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import {
  formFrom,
  saveBody,
  stockMoves,
  validateForm,
  type ProductDetail,
  type ProductForm,
} from "@/lib/productEdit";
import type { ProductRow } from "@/lib/productList";
import { countStock, fetchProductDetail, saveProduct } from "@/lib/productsApi";
import { moveHold } from "@/lib/scanApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
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
 * สต็อกและราคา (canvas v194): count the two stock numbers and fix the four prices without opening the
 * product. Sell prices are the owner's; anyone else sees them as plain values.
 */
export function StockPriceSheet({ list, row }: { list: ProductList; row: ProductRow }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const auth = useAuth();
  const token = auth.status === "signed-in" ? auth.token : "";
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [form, setForm] = useState<ProductForm | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const close = () => list.setStockFor(null);

  useEffect(() => {
    let live = true;
    fetchProductDetail(fetch, API_BASE, token, row.id)
      .then((d) => {
        if (!live) return;
        if (!d) return setFailed(true);
        setDetail(d);
        setForm(formFrom(d));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [token, row.id]);

  const errors = form ? validateForm(form) : {};
  const save = async () => {
    if (!detail || !form || busy || Object.keys(errors).length > 0) return;
    setBusy(true);
    try {
      // This form only moves the prices and the stock, so the rest of the product goes back as it was.
      const stored = formFrom(detail);
      if (list.rights.prices && PRICES.some((p) => form[p.key] !== stored[p.key])) {
        await saveProduct(fetch, API_BASE, token, saveBody(detail, form, list.rights));
      }
      const moves = stockMoves(detail, form);
      const refused: string[] = [];
      if (moves.adjust) {
        const res = await countStock(fetch, API_BASE, token, moves.adjust);
        if (!res.applied && res.reason) refused.push(res.reason);
      }
      if (moves.hold) {
        const [res] = await moveHold(fetch, API_BASE, token, [moves.hold]);
        if (res && !res.applied && res.reason) refused.push(res.reason);
      }
      close();
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
    <Sheet title={t({ th: "สต็อกและราคา", en: "Stock & prices" })} onClose={close}>
      <View style={styles.head}>
        <Photo imageKey={row.imageKey} size={48} radius={10} />
        <Text style={[TYPE.headline, styles.grow, { color: theme.text }]} numberOfLines={2}>
          {row.name}
        </Text>
      </View>
      {!form ? (
        failed ? (
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {t({
              th: "โหลดสินค้านี้ไม่ได้ ลองอีกครั้ง",
              en: "This product did not load. Try again",
            })}
          </Text>
        ) : (
          <ActivityIndicator color={theme.textMuted} />
        )
      ) : (
        <>
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
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: SPACE.m },
  grow: { flex: 1, minWidth: 0 },
});
