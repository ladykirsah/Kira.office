import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { LabelSize } from "@/lib/barcodeLabel";
import { NO_FILTERS, visibleRows, type ProductRow } from "@/lib/productList";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Empty } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Sheet } from "../orders/Sheet";
import { Divider, Line, Photo, RoundTool, SearchBox, Stepper } from "../products/parts";
import { ScanCodeSheet } from "../products/ScanCodeSheet";
import { Segmented } from "../Segmented";
import { RADIUS, SPACE, TYPE } from "../theme";
import { LabelArt } from "./LabelArt";
import { SHEET_PX_PER_MM, sizeWords } from "./LabelSheets";
import type { Barcodes } from "./useBarcodes";

interface Start {
  productId?: string;
  query?: string;
  notFound?: string;
}

/**
 * เพิ่มป้าย, two steps in one sheet (as drawn): เลือกสินค้า — search or scan the box; then
 * ตั้งแบบป้าย — the label as it will print, its size (by width) and how many, then เพิ่มลงแผ่น.
 * Every label has the QR of its product code, so there is no barcode switch.
 */
export function AddLabelSheet({ list, start }: { list: Barcodes; start: Start }) {
  const [picked, setPicked] = useState<string | null>(start.productId ?? null);
  const [q, setQ] = useState(start.query ?? "");
  const [notFound, setNotFound] = useState(start.notFound ?? null);
  const [scanning, setScanning] = useState(false);
  const close = () => list.setSheet(null);
  const row = picked ? list.byId.get(picked) : undefined;

  if (scanning) {
    return (
      <ScanCodeSheet
        onClose={() => setScanning(false)}
        onCode={(code) => {
          setScanning(false);
          void list.scanned(code);
        }}
      />
    );
  }
  if (row) return <SetLabel list={list} row={row} onBack={() => setPicked(null)} onClose={close} />;
  return (
    <PickProduct
      list={list}
      q={q}
      setQ={(v) => {
        setQ(v);
        setNotFound(null);
      }}
      notFound={notFound}
      onScan={() => setScanning(true)}
      onPick={setPicked}
      onClose={close}
    />
  );
}

function PickProduct(props: {
  list: Barcodes;
  q: string;
  setQ: (q: string) => void;
  notFound: string | null;
  onScan: () => void;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { list, q } = props;
  const found = list.rows
    ? visibleRows(list.rows, { tab: "all", q, filters: NO_FILTERS, sort: "name" })
    : [];
  return (
    <Sheet
      title={t({ th: "เพิ่มป้าย", en: "Add labels" })}
      sub={t({ th: "เลือกสินค้า", en: "Pick a product" })}
      onClose={props.onClose}
      tall
    >
      <View style={styles.searchRow}>
        <SearchBox
          grow
          value={q}
          onChange={props.setQ}
          placeholder={t({ th: "รหัสหรือชื่อสินค้า", en: "Code or product name" })}
        />
        <RoundTool icon={ICON.scan} label={t({ th: "สแกน", en: "Scan" })} onPress={props.onScan} />
      </View>
      {props.notFound ? (
        <Empty
          icon={ICON.search}
          title={t({ th: `ไม่พบรหัส ${props.notFound}`, en: `No product has ${props.notFound}` })}
          detail=""
          action={
            <Pressable
              onPress={() => list.addProduct(props.notFound!)}
              accessibilityRole="link"
              hitSlop={8}
            >
              <Text style={[TYPE.subhead, { color: theme.primary }]}>
                {t({ th: "เพิ่มสินค้ารหัสนี้", en: "Add a product with this code" })}
              </Text>
            </Pressable>
          }
        />
      ) : found.length === 0 && list.rows ? (
        <Empty
          icon={ICON.search}
          title={t({ th: `ไม่พบ “${q.trim()}”`, en: `Nothing found for “${q.trim()}”` })}
          detail={t({
            th: "ลองค้นด้วยรหัส หรือสแกนบาร์โค้ดบนกล่อง",
            en: "Try the code, or scan the barcode on the box",
          })}
        />
      ) : (
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          {found.map((r, i) => (
            <View key={r.id}>
              <Pressable
                onPress={() => props.onPick(r.id)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.product,
                  pressed && { backgroundColor: theme.hover },
                ]}
              >
                <Photo imageKey={r.imageKey} size={44} radius={10} />
                <View style={styles.grow}>
                  <Text style={[TYPE.body, { color: theme.text }]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
                    {r.productRef}
                  </Text>
                </View>
                <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
              </Pressable>
              {i < found.length - 1 && <Divider />}
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}

/** The product's first car, as the product list shows it ("Toyota Altis"). */
function firstCar(row: ProductRow): string {
  const f = row.fitments[0];
  return f ? [f.carBrand, f.carModel].filter(Boolean).join(" ") : "";
}

function SetLabel(props: {
  list: Barcodes;
  row: ProductRow;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { list, row } = props;
  const [size, setSize] = useState<LabelSize>("L");
  const [qty, setQty] = useState(1);
  const text = list.texts.get(row.id);
  const sub = [row.productRef, firstCar(row)].filter(Boolean).join(" · ");
  return (
    <Sheet
      title={t({ th: "เพิ่มป้าย", en: "Add labels" })}
      sub={t({ th: "ตั้งแบบป้าย", en: "Set the label" })}
      left={{ label: t({ th: "‹ เลือกสินค้า", en: "‹ Products" }), onPress: props.onBack }}
      onClose={props.onClose}
      tall
    >
      <View style={[styles.card, styles.product, { backgroundColor: theme.surface }]}>
        <Photo imageKey={row.imageKey} size={44} radius={10} />
        <View style={styles.grow}>
          <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={2}>
            {row.name}
          </Text>
          {sub ? (
            <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
      {text && (
        <View style={[styles.preview, { backgroundColor: theme.surface }]}>
          <LabelArt text={text} size={size} shop={list.shop} pxPerMm={SHEET_PX_PER_MM} />
        </View>
      )}
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Line
          label={t({ th: "ขนาด", en: "Size" })}
          right={
            <View style={styles.sizes}>
              <Segmented
                label={t({ th: "ขนาด", en: "Size" })}
                options={(["L", "S"] as const).map((s) => ({ value: s, label: t(sizeWords(s)) }))}
                value={size}
                onChange={setSize}
              />
            </View>
          }
        />
        <Line
          label={t({ th: "จำนวน", en: "How many" })}
          last
          right={
            <Stepper
              value={qty}
              label={t({ th: "จำนวน", en: "amount" })}
              onChange={(n) => setQty(Math.max(1, n))}
            />
          }
        />
      </View>
      <BigButton
        label={t({ th: "เพิ่มลงแผ่น", en: "Add to the sheet" })}
        onPress={() => list.add(row.id, size, qty)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingHorizontal: SPACE.l,
    paddingVertical: 10,
  },
  grow: { flex: 1, minWidth: 0 },
  preview: {
    borderRadius: RADIUS.card,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.l,
    alignItems: "center",
  },
  sizes: { width: 236 },
});
