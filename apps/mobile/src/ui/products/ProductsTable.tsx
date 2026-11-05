import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { channelWords, stockWords, type ProductRow } from "@/lib/productList";
import { useLang, useTheme } from "../AppProviders";
import { Dot } from "../customers/parts";
import { DeskCard } from "../desk/DeskCard";
import { Table, type TableColumn } from "../desk/Table";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { SPACE, TYPE } from "../theme";
import { Photo } from "./parts";

interface ProductsTableProps {
  rows: readonly ProductRow[];
  canEdit: boolean;
  onCopy: (code: string) => void;
  onStock: (row: ProductRow) => void;
}

const open = (row: ProductRow, path = "") =>
  router.push(`/products/${encodeURIComponent(row.id)}${path}` as never);

/**
 * สินค้า on a computer (DeskProducts board, 4 Nov 2026): one row per product — photo, the full name
 * on two lines with the code to copy under it, what is left, where it is sold, then the card's two
 * buttons. No price in a row (as on the phone card). The row's buttons sit beside its open areas,
 * never inside one (a button may not hold another on the web).
 */
export function ProductsTable({ rows, canEdit, onCopy, onStock }: ProductsTableProps) {
  const { t } = useLang();
  const { theme } = useTheme();
  const columns: TableColumn<ProductRow>[] = [
    {
      key: "product",
      label: t({ th: "สินค้า", en: "Product" }),
      cell: (row) => <ProductCell row={row} onCopy={onCopy} />,
    },
    {
      key: "stock",
      label: t({ th: "สต็อก", en: "Stock" }),
      width: 130,
      cell: (row) => {
        const { level, text } = stockWords(row);
        return (
          <OpenArea row={row}>
            <View style={styles.stock}>
              {level === "low" && <Dot color={theme.waiting} />}
              {level === "out" && <Dot color={theme.textFaint} />}
              <Text style={[TYPE.subhead, { color: theme.textMuted }]} numberOfLines={1}>
                {t(text)}
              </Text>
            </View>
          </OpenArea>
        );
      },
    },
    {
      key: "where",
      label: t({ th: "ขายบน", en: "Sold on" }),
      width: 130,
      cell: (row) => {
        const where = channelWords(row);
        return (
          <OpenArea row={row}>
            <Text
              style={[TYPE.subhead, { color: where ? theme.textMuted : theme.textFaint }]}
              numberOfLines={1}
            >
              {where || "—"}
            </Text>
          </OpenArea>
        );
      },
    },
    {
      key: "buttons",
      label: "",
      width: 196,
      align: "right",
      cell: (row) => (
        <View style={styles.buttons}>
          <RowButton
            label={t({ th: "สต็อกและราคา", en: "Stock & prices" })}
            onPress={() => onStock(row)}
          />
          {canEdit && (
            <RowButton label={t({ th: "แก้ไข", en: "Edit" })} onPress={() => open(row, "/edit")} />
          )}
        </View>
      ),
    },
    {
      key: "open",
      label: "",
      width: 14,
      align: "right",
      cell: (row) => (
        <OpenArea row={row}>
          <LineIcon d={ICON.chevron} color={theme.textFaint} size={14} strokeWidth={2.4} />
        </OpenArea>
      ),
    },
  ];
  return (
    <DeskCard pad={4}>
      <Table columns={columns} rows={rows} rowKey={(row) => row.id} minRowHeight={68} />
    </DeskCard>
  );
}

/**
 * The product cell: one link under the photo, the name and the code, with the copy icon on top of
 * it as its own button (side by side for the browser, not one inside the other).
 */
function ProductCell({ row, onCopy }: { row: ProductRow; onCopy: (code: string) => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={styles.cell}>
      <Pressable
        onPress={() => open(row)}
        accessibilityRole="link"
        accessibilityLabel={`${row.name} ${row.productRef}`}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.product} pointerEvents="box-none">
        <View pointerEvents="none">
          <Photo imageKey={row.imageKey} size={40} radius={10} />
        </View>
        <View style={styles.words} pointerEvents="box-none">
          <View pointerEvents="none">
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
              {row.name}
            </Text>
          </View>
          <View style={styles.code} pointerEvents="box-none">
            <View pointerEvents="none" style={styles.shrink}>
              <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
                {row.productRef}
              </Text>
            </View>
            <Pressable
              onPress={() => onCopy(row.productRef)}
              accessibilityRole="button"
              accessibilityLabel={t({
                th: `คัดลอก ${row.productRef}`,
                en: `Copy ${row.productRef}`,
              })}
              hitSlop={8}
            >
              <LineIcon d={ICON.copy} color={theme.textMuted} size={13} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/** A cell the mouse can click to open the product too; the name's link is the one a reader hears. */
function OpenArea({ row, children }: { row: ProductRow; children: ReactNode }) {
  return (
    <Pressable
      onPress={() => open(row)}
      focusable={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.openArea}
    >
      {children}
    </Pressable>
  );
}

/** The phone card's grey button, sized to its words (สต็อกและราคา, แก้ไข). */
function RowButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? theme.border : theme.hover },
      ]}
    >
      <Text style={[TYPE.footnote, styles.buttonText, { color: theme.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: { minWidth: 0, justifyContent: "center", paddingVertical: 2 },
  product: { flexDirection: "row", alignItems: "center", gap: SPACE.m, minWidth: 0 },
  words: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, lineHeight: 20 },
  code: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" },
  sub: { fontSize: 13, lineHeight: 18 },
  shrink: { flexShrink: 1, minWidth: 0 },
  stock: { flexDirection: "row", alignItems: "center", gap: 6 },
  openArea: { alignSelf: "stretch", justifyContent: "center", minHeight: 44 },
  buttons: { flexDirection: "row", gap: 6, justifyContent: "flex-end" },
  button: { height: 30, paddingHorizontal: SPACE.m, borderRadius: 15, justifyContent: "center" },
  buttonText: { fontWeight: "600" },
});
