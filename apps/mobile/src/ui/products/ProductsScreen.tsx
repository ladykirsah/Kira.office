import { useRef, useState, type ComponentRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { listSubtitle, PRODUCT_SORTS, PRODUCT_TABS } from "@/lib/productList";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { BrandSheet, CarSheet, ScanSheet, SystemSheet } from "./ListSheets";
import { Chip, RoundTool, SearchBox, SORT_ICON, UnderlineTabs } from "./parts";
import { ProductCard } from "./ProductCard";
import { StockPriceSheet } from "./StockPriceSheet";
import { useProductList, type ProductList } from "./useProductList";

/**
 * สินค้า (the owner asked to build the drawing, canvas v194, 31 Oct 2026): count tabs, one search
 * with scan and sort beside it, three filters, then a card per product. The pinned เพิ่มสินค้า still
 * opens the old back office until that page is rebuilt.
 */
export function ProductsScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const list = useProductList();
  const typed = list.q.trim();
  const notFound = typed !== "" && list.shown?.length === 0;

  useScreenChrome(
    null,
    list.rights.edits
      ? [
          {
            label: notFound
              ? t({ th: `เพิ่มสินค้า ${typed}`, en: `Add product ${typed}` })
              : t({ th: "เพิ่มสินค้า", en: "Add product" }),
            onPress: () => list.addProduct(notFound ? typed : ""),
          },
        ]
      : [],
    { toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null },
  );

  return (
    <View>
      {list.rows && list.shown && (
        <Text style={[TYPE.subhead, styles.subtitle, { color: theme.textMuted }]}>
          {t(listSubtitle(list.rows, list.shown.length, list.q, list.filters))}
        </Text>
      )}
      <View style={styles.searchRow}>
        <SearchBox
          grow
          value={list.q}
          onChange={list.setQ}
          placeholder={t({ th: "รหัสหรือชื่อสินค้า", en: "Code or product name" })}
        />
        <RoundTool
          icon={ICON.scan}
          label={t({ th: "สแกน", en: "Scan" })}
          onPress={() => list.setSheet("scan")}
        />
        <SortMenu list={list} />
      </View>
      {list.counts && (
        <UnderlineTabs
          tabs={PRODUCT_TABS.map((tab) => ({ key: tab.key, label: t(tab.label) }))}
          counts={list.counts}
          value={list.tab}
          onPick={list.setTab}
        />
      )}
      <Chips list={list} />
      {list.failed && (
        <View style={styles.retry}>
          <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]}>
            {t({ th: "โหลดรายการไม่ได้", en: "The list did not load" })}
          </Text>
          <SmallButton
            label={t({ th: "ลองอีกครั้ง", en: "Try again" })}
            onPress={() => void list.load()}
          />
        </View>
      )}
      <Cards list={list} />
      {list.sheet === "brand" && <BrandSheet list={list} />}
      {list.sheet === "system" && <SystemSheet list={list} />}
      {list.sheet === "car" && <CarSheet list={list} />}
      {list.sheet === "scan" && <ScanSheet list={list} />}
      {list.stockFor && <StockPriceSheet list={list} row={list.stockFor} />}
    </View>
  );
}

function Chips({ list }: { list: ProductList }) {
  const { t } = useLang();
  const f = list.filters;
  const system = f.type
    ? list.label("types", f.type)
    : f.usage
      ? list.label("usages", f.usage)
      : null;
  // The chip names the model only; its years are in the sheet.
  const car = f.car ? (f.car.carModel ?? f.car.carBrand) : null;
  return (
    <View style={styles.chips}>
      <Chip
        label={f.brand ? list.label("brands", f.brand) : t({ th: "ยี่ห้อ", en: "Brand" })}
        on={f.brand != null}
        onPress={() => list.setSheet("brand")}
      />
      <Chip
        label={system ?? t({ th: "ระบบ", en: "System" })}
        on={system != null}
        onPress={() => list.setSheet("system")}
      />
      <Chip
        label={car ?? t({ th: "รถ", en: "Car" })}
        on={car != null}
        onPress={() => list.setSheet("car")}
      />
    </View>
  );
}

/** A search icon in a grey circle: nothing found (option A until the owner picks one, canvas v194). */
const NOT_FOUND_ICON = ICON.search;

function Cards({ list }: { list: ProductList }) {
  const { t } = useLang();
  if (!list.rows || !list.shown) return null;
  if (list.shown.length === 0) {
    const typed = list.q.trim() !== "";
    return (
      <Empty
        icon={NOT_FOUND_ICON}
        title={
          typed
            ? t({ th: "ไม่มีสินค้าที่ตรงกับที่ค้นหา", en: "No product matches the search" })
            : list.rows.length === 0
              ? t({ th: "ยังไม่มีสินค้า", en: "No products yet" })
              : t({ th: "ไม่มีสินค้าในรายการนี้", en: "Nothing in this list" })
        }
        detail={
          typed
            ? t({
                th: "ลองค้นด้วยชื่อ หรือสแกนบาร์โค้ดบนกล่อง",
                en: "Try the name, or scan the barcode on the box",
              })
            : t({ th: "ลองเปลี่ยนแท็บหรือตัวกรอง", en: "Try another tab or filter" })
        }
      />
    );
  }
  return (
    <View style={styles.cards}>
      {list.shown.map((row) => (
        <ProductCard
          key={row.id}
          row={row}
          canEdit={list.rights.edits}
          onCopy={list.copy}
          onStock={() => list.setStockFor(row)}
        />
      ))}
    </View>
  );
}

const MENU_WIDTH = 232;

/** ⇅ opens a short menu under it; one tap picks the order (as drawn). */
function SortMenu({ list }: { list: ProductList }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { width } = useWindowDimensions();
  const anchor = useRef<ComponentRef<typeof View>>(null);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const open = () =>
    anchor.current?.measureInWindow((x, y, w, h) =>
      setAt({ x: Math.min(x + w - MENU_WIDTH, width - MENU_WIDTH - SPACE.l), y: y + h + 6 }),
    );
  return (
    <>
      <View ref={anchor} collapsable={false}>
        <RoundTool icon={SORT_ICON} label={t({ th: "เรียงตาม", en: "Sort" })} onPress={open} />
      </View>
      <Modal visible={!!at} transparent animationType="fade" onRequestClose={() => setAt(null)}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.08)" }]}
          onPress={() => setAt(null)}
          accessibilityRole="button"
          accessibilityLabel={t({ th: "ปิด", en: "Close" })}
        />
        {at && (
          <View
            accessibilityRole="menu"
            style={[
              styles.menu,
              { top: at.y, left: Math.max(SPACE.l, at.x), backgroundColor: theme.surface },
            ]}
          >
            {PRODUCT_SORTS.map((o, i) => (
              <Pressable
                key={o.key}
                onPress={() => {
                  setAt(null);
                  list.setSort(o.key);
                }}
                accessibilityRole="menuitem"
                accessibilityState={{ checked: o.key === list.sort }}
                style={({ pressed }) => [
                  styles.item,
                  pressed && { backgroundColor: theme.hover },
                  i < PRODUCT_SORTS.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: theme.border,
                  },
                ]}
              >
                <View style={styles.tick}>
                  {o.key === list.sort && (
                    <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
                  )}
                </View>
                <Text style={[TYPE.body, { color: theme.text }]}>{t(o.label)}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  subtitle: { marginTop: -SPACE.xs, marginHorizontal: 2 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.m },
  chips: { flexDirection: "row", gap: SPACE.s, marginTop: SPACE.m, flexWrap: "wrap" },
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.m },
  grow: { flex: 1 },
  cards: { marginTop: SPACE.l, gap: SPACE.m },
  menu: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  item: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
    paddingHorizontal: SPACE.m,
  },
  tick: { width: 20 },
});
