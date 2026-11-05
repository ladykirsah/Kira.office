import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { cleanCount, cleanMoney } from "@/lib/couponPage";
import {
  costLines,
  grouped,
  pickLine,
  pickable,
  priceProblem,
  profitLines,
  saleLines,
  toSatang,
  totalCost,
  type FlashLine,
  type SheetLine,
} from "@/lib/flashPage";
import { formatBaht } from "@/lib/money";
import type { ProductRow } from "@/lib/productList";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { BigButton } from "../BigButton";
import { Dot } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { DOWN, InputRow, Line, SearchBox, UP } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { OffPhoto } from "./parts";
import { CodeCopy } from "../CodeCopy";

/**
 * เพิ่มสินค้า (canvas v259, แฟลชเซล 4): search by name or code; each product that can be sold on
 * AirPlus with its code and "เหลือ 12 · ฿3,450" (the amber dot at 3 or fewer); one already in the
 * sale has the red ✓. A tap opens its ราคาลด.
 */
export function AddProductSheet(props: {
  rows: ProductRow[] | null;
  failed: boolean;
  onRetry: () => void;
  query: string;
  onQuery: (q: string) => void;
  inSale: ReadonlySet<string>;
  onPick: (row: ProductRow) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const shown = props.rows ? pickable(props.rows, props.query.trim()) : [];
  const body = () => {
    if (!props.rows) {
      return props.failed ? (
        <Retry onPress={props.onRetry} />
      ) : (
        <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
      );
    }
    if (shown.length === 0) {
      return (
        <Text style={[TYPE.headline, styles.none, { color: theme.text }]}>
          {props.query.trim()
            ? t({ th: `ไม่พบ “${props.query.trim()}”`, en: `No “${props.query.trim()}”` })
            : t({ th: "ไม่มีสินค้าที่ขายได้", en: "Nothing to sell" })}
        </Text>
      );
    }
    return (
      <Group>
        {shown.map((r, i) => (
          <PickLine
            key={r.variantId}
            row={r}
            picked={props.inSale.has(r.variantId)}
            onPress={() => props.onPick(r)}
            last={i === shown.length - 1}
          />
        ))}
      </Group>
    );
  };
  return (
    <Sheet title={t({ th: "เพิ่มสินค้า", en: "Add a product" })} onClose={props.onClose} tall>
      <SearchBox
        value={props.query}
        onChange={props.onQuery}
        placeholder={t({ th: "ค้นชื่อ หรือพิมพ์รหัส", en: "Search a name or code" })}
      />
      {body()}
    </Sheet>
  );
}

/** A product to pick: photo, name, code, then how many are left · the price; ✓ once it is in. */
function PickLine(props: { row: ProductRow; picked: boolean; onPress: () => void; last: boolean }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const line = pickLine(props.row);
  const body = (
    <View style={[styles.pick, !props.last && styles.rule, { borderBottomColor: theme.border }]}>
      <OffPhoto imageKey={props.row.imageKey} size={44} />
      <View style={styles.grow}>
        <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={2}>
          {props.row.name}
        </Text>
        <CodeCopy code={props.row.productRef} style={[TYPE.subhead, { color: theme.textMuted }]} />
        <View style={styles.dotLine}>
          {line.low && <Dot color={theme.waiting} />}
          <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]} numberOfLines={1}>
            {t(line.text)}
          </Text>
        </View>
      </View>
      <View style={styles.tick}>
        {props.picked && (
          <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
        )}
      </View>
    </View>
  );
  // One already in the sale is changed from the form (tap its row there), not picked twice.
  if (props.picked) return body;
  return (
    <Pressable onPress={props.onPress} accessibilityRole="link" accessibilityLabel={props.row.name}>
      {body}
    </Pressable>
  );
}

type Opened = "cost" | "base" | "sale";

/**
 * ราคาลด (canvas v259): the product, then ต้นทุน (only for who may see cost) · ราคาปกติ · ราคาลด, each ⌄
 * opening its lines — the cost and its VAT, the profit at the normal price, how much off and the
 * profit or the loss per piece (the price turns red under the cost) — then จำกัด. Picked from
 * เพิ่มสินค้า it ends in เพิ่มเข้าแคมเปญ; opened from the form (แก้ราคาลด) the red ✓ keeps it.
 */
export function PriceSheet(props: {
  line: FlashLine;
  product: ProductRow | null;
  seesCost: boolean;
  /** Picked just now: ‹ เพิ่มสินค้า goes back to the list. */
  onBack?: () => void;
  onClose: () => void;
  onDone: (sale: string, cap: string) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const adding = !!props.onBack;
  const [sale, setSale] = useState(props.line.sale);
  const [cap, setCap] = useState(props.line.cap);
  const [open, setOpen] = useState<ReadonlySet<Opened>>(new Set());
  const [tried, setTried] = useState(false);

  // The sums use the price the sale cuts from (the server's, for a product already in it). A
  // product no longer in the catalogue still shows how much off, without the cost lines.
  const base = props.line.basePriceSatang;
  const costed = props.product
    ? { ...props.product, onlinePriceSatang: base }
    : { itemCostSatang: 0, taxOnCost: 0, onlineCommissionBp: 0, onlinePriceSatang: base };
  const cost = props.seesCost && props.product ? costed : null;
  const saleRows = sale ? saleLines(costed, toSatang(sale), !!cost) : [];
  const loss = saleRows.some((l) => l.loss);
  const problem = tried ? priceProblem(sale) : null;

  const toggle = (key: Opened) =>
    setOpen((o) => {
      const next = new Set(o);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const done = () => {
    setTried(true);
    if (priceProblem(sale)) return;
    props.onDone(sale, cap);
  };

  return (
    <Sheet
      title={
        adding
          ? t({ th: "ราคาลด", en: "Sale price" })
          : t({ th: "แก้ราคาลด", en: "Edit sale price" })
      }
      onClose={props.onClose}
      left={
        props.onBack
          ? { label: t({ th: "‹ เพิ่มสินค้า", en: "‹ Add a product" }), onPress: props.onBack }
          : undefined
      }
      onDone={adding ? undefined : done}
    >
      <Group>
        <View style={styles.product}>
          <OffPhoto imageKey={props.line.imageKey} size={44} />
          <View style={styles.grow}>
            <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={2}>
              {props.line.name}
            </Text>
            {props.line.productRef ? (
              <CodeCopy
                code={props.line.productRef}
                style={[TYPE.subhead, { color: theme.textMuted }]}
              />
            ) : null}
          </View>
        </View>
      </Group>

      <View>
        <Group>
          {cost && (
            <OpenRow
              label={t({ th: "ต้นทุน", en: "Cost" })}
              value={formatBaht(totalCost(cost))}
              lines={costLines(cost)}
              open={open.has("cost")}
              onToggle={() => toggle("cost")}
            />
          )}
          <OpenRow
            label={t({ th: "ราคาปกติ", en: "Normal price" })}
            value={formatBaht(props.line.basePriceSatang)}
            lines={cost ? profitLines(cost, props.line.basePriceSatang) : []}
            open={open.has("base")}
            onToggle={() => toggle("base")}
          />
          <OpenRow
            label={t({ th: "ราคาลด", en: "Sale price" })}
            input={{ value: sale, onChange: (v) => setSale(cleanMoney(v)), loss }}
            lines={saleRows}
            open={open.has("sale")}
            onToggle={() => toggle("sale")}
            last
          />
        </Group>
        {problem && <FieldError text={t(problem)} />}
      </View>

      <Group>
        <InputRow
          label={t({ th: "จำกัด", en: "Limit" })}
          value={cap}
          placeholder={t({ th: "ไม่จำกัด", en: "No limit" })}
          unit={cap ? t({ th: "ชิ้น", en: "pcs" }) : undefined}
          keyboardType="number-pad"
          onChange={(v) => setCap(cleanCount(v).replace(/^0+/, ""))}
          last={adding || !props.line.priceId}
        />
        {!adding && props.line.priceId && (
          <Line
            label={t({ th: "ขายแล้ว", en: "Sold" })}
            right={
              <Text style={[TYPE.body, styles.nums, { color: theme.text }]}>
                {t({ th: `${props.line.soldCount} ชิ้น`, en: `${props.line.soldCount} pcs` })}
              </Text>
            }
            last
          />
        )}
      </Group>

      {adding && (
        <BigButton label={t({ th: "เพิ่มเข้าแคมเปญ", en: "Add to the sale" })} onPress={done} />
      )}
    </Sheet>
  );
}

/** A row with ⌄: its value (or the price box), and under it, once opened, its grey lines. */
function OpenRow(props: {
  label: string;
  value?: string;
  input?: { value: string; onChange: (v: string) => void; loss: boolean };
  lines: SheetLine[];
  open: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const opens = props.lines.length > 0;
  const shown = opens && props.open;
  const red = props.input?.loss ? theme.danger : theme.text;
  const chevron = opens ? (
    <LineIcon d={shown ? UP : DOWN} color={theme.textFaint} size={15} strokeWidth={2.4} />
  ) : null;
  return (
    <View style={[styles.open, !props.last && styles.rule, { borderBottomColor: theme.border }]}>
      {props.input ? (
        // The box takes typing; the label and ⌄ open the lines (a box inside a press would do both).
        <View style={styles.openTop}>
          <Pressable onPress={opens ? props.onToggle : undefined} style={styles.grow}>
            <Text style={[TYPE.body, { color: theme.text }]}>{props.label}</Text>
          </Pressable>
          <TextInput
            value={props.input.value ? `฿${grouped(props.input.value)}` : ""}
            onChangeText={(v) => props.input!.onChange(v.split("฿").join(""))}
            placeholder="฿0"
            placeholderTextColor={theme.textFaint}
            keyboardType="decimal-pad"
            accessibilityLabel={props.label}
            style={[TYPE.body, styles.box, { color: red }]}
          />
          {chevron && (
            <Pressable
              onPress={props.onToggle}
              accessibilityRole="button"
              accessibilityLabel={t({ th: `ดู${props.label}`, en: `Show ${props.label}` })}
              hitSlop={10}
            >
              {chevron}
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable
          onPress={opens ? props.onToggle : undefined}
          accessibilityRole={opens ? "button" : undefined}
          style={styles.openTop}
        >
          <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{props.label}</Text>
          <Text style={[TYPE.body, styles.nums, { color: theme.text }]}>{props.value}</Text>
          {chevron}
        </Pressable>
      )}
      {shown && (
        <View style={[styles.inner, { backgroundColor: theme.bg }]}>
          {props.lines.map((l, i) => (
            <View
              key={l.label.en}
              style={[
                styles.innerLine,
                i < props.lines.length - 1 && styles.rule,
                { borderBottomColor: theme.border },
              ]}
            >
              <Text
                style={[
                  TYPE.subhead,
                  styles.grow,
                  { color: l.loss ? theme.danger : theme.textMuted },
                ]}
              >
                {t(l.label)}
              </Text>
              <Text
                style={[TYPE.subhead, styles.nums, { color: l.loss ? theme.danger : theme.text }]}
              >
                {l.text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  nums: { fontVariant: ["tabular-nums"] },
  none: { textAlign: "center", marginTop: SPACE.xxxl },
  rule: { borderBottomWidth: StyleSheet.hairlineWidth },
  pick: {
    marginLeft: SPACE.l,
    paddingVertical: SPACE.s,
    paddingRight: SPACE.l,
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  dotLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  tick: { width: 22, alignItems: "flex-end" },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.l,
  },
  open: { marginLeft: SPACE.l, paddingVertical: 10, paddingRight: SPACE.l, minHeight: 52 },
  openTop: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 10 },
  box: { minWidth: 90, textAlign: "right", fontVariant: ["tabular-nums"], padding: 0 },
  inner: {
    marginTop: SPACE.s,
    borderRadius: 12,
    paddingVertical: SPACE.xs,
    paddingHorizontal: SPACE.m,
  },
  innerLine: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: SPACE.s },
});
