import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { yearRange } from "@/lib/productList";
import {
  boxText,
  editedLine,
  galleryKeys,
  priceRows,
  weightText,
  type PriceRow,
} from "@/lib/productPage";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group, SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { DeleteSheet } from "./DeleteSheet";
import { DOWN, Heading, Line, SwitchRow, UP } from "./parts";
import { useProductPage, type ProductPage } from "./useProductPage";

/**
 * หน้าสินค้า (canvas v194): the photos, the name, one ราคา list (ต้นทุน first; ⌄ drops the sum or the
 * profit), stock, the cars it fits, the part's details and where it is sold. แก้ไข edits it all.
 */
export function ProductScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const page = useProductPage(id);
  const [deleting, setDeleting] = useState(false);

  useScreenChrome(null, [], {
    back: {
      label: t({ th: "สินค้า", en: "Products" }),
      onPress: () => (router.canGoBack() ? router.back() : router.replace("/products" as never)),
    },
    ownTitle: true,
    toast: page.toast ? { title: t(page.toast.title), detail: t(page.toast.detail) } : null,
  });

  if (!page.detail) {
    if (page.problem === "gone") {
      return (
        <Empty
          icon={ICON.search}
          title={t({ th: "ไม่มีสินค้านี้แล้ว", en: "This product is gone" })}
          detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been deleted" })}
        />
      );
    }
    return page.problem === "failed" ? (
      <View style={styles.retry}>
        <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]}>
          {t({ th: "โหลดหน้านี้ไม่ได้", en: "This page did not load" })}
        </Text>
        <SmallButton
          label={t({ th: "ลองอีกครั้ง", en: "Try again" })}
          onPress={() => void page.load()}
        />
      </View>
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  const d = page.detail;
  const p = d.product;
  const edited = editedLine(p.updatedAt);
  return (
    <View>
      {page.rights.edits && (
        <Pressable
          onPress={() => router.push(`/products/${encodeURIComponent(p.id)}/edit` as never)}
          accessibilityRole="button"
          style={[styles.editPill, { backgroundColor: theme.glass, borderColor: theme.glassLine }]}
        >
          <Text style={[TYPE.body, { color: theme.text }]}>{t({ th: "แก้ไข", en: "Edit" })}</Text>
        </Pressable>
      )}
      <Gallery keys={galleryKeys(p.imageKey, d.images)} />
      <Text style={[TYPE.title2, styles.title, { color: theme.text }]} accessibilityRole="header">
        {p.name}
      </Text>
      {edited && <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(edited)}</Text>}

      <Heading text={t({ th: "ราคา", en: "Prices" })} />
      <Group>
        {priceRows(d.pricing, page.rights.seesCost).map((row, i, all) => (
          <PriceItem key={row.key} row={row} last={i === all.length - 1} />
        ))}
      </Group>

      <Heading text={t({ th: "สต็อก", en: "Stock" })} />
      <Group>
        <Line
          label={t({ th: "ขายได้", en: "For sale" })}
          right={<Value text={String(d.onHand)} />}
        />
        <Line
          label={t({ th: "งานนอก", en: "Out on jobs" })}
          right={<Value text={String(d.held)} />}
          last
        />
      </Group>

      <Heading text={t({ th: "ใช้ได้กับรถ", en: "Fits these cars" })} />
      <Group>
        {d.fitments.length === 0 ? (
          <Line label="—" last />
        ) : (
          d.fitments.map((f, i) => (
            <Line
              key={`${f.carBrand}|${f.carModel}|${f.yearFrom}|${f.yearTo}`}
              label={[f.carBrand, f.carModel].filter(Boolean).join(" ")}
              right={<Value text={yearRange(f.yearFrom, f.yearTo)} grey />}
              last={i === d.fitments.length - 1}
            />
          ))
        )}
      </Group>

      <Details page={page} />

      <Heading text={t({ th: "รายละเอียด", en: "Description" })} />
      <View style={[styles.textCard, { backgroundColor: theme.surface }]}>
        <Text style={[TYPE.body, { color: theme.text }]}>{p.description?.trim() || "—"}</Text>
      </View>

      <Heading text={t({ th: "ขายออนไลน์", en: "Sold online" })} />
      <Group>
        <SwitchRow label="AirPlus" value={p.status === "active"} />
        <SwitchRow label="Shopee" value={p.shopeeListed === 1} last />
      </Group>

      {page.rights.deletes && (
        <View style={styles.deleteGroup}>
          <Group>
            <Pressable
              onPress={() => setDeleting(true)}
              accessibilityRole="button"
              style={styles.deleteRow}
            >
              <Text style={[TYPE.body, { color: theme.danger }]}>
                {t({ th: "ลบสินค้า", en: "Delete product" })}
              </Text>
            </Pressable>
          </Group>
        </View>
      )}
      {deleting && <DeleteSheet page={page} onClose={() => setDeleting(false)} />}
    </View>
  );
}

function Value({ text, grey }: { text: string; grey?: boolean }) {
  const { theme } = useTheme();
  return (
    <Text style={[TYPE.body, styles.value, { color: grey ? theme.textMuted : theme.text }]}>
      {text}
    </Text>
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

function Details({ page }: { page: ProductPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const p = page.detail!.product;
  return (
    <>
      <Heading text={t({ th: "รายละเอียดอะไหล่", en: "Part details" })} />
      <Group>
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
      </Group>
    </>
  );
}

/** The product's photos, one at a time, with dots under them. */
function Gallery({ keys }: { keys: string[] }) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  if (keys.length === 0) {
    return <View style={[styles.photo, { backgroundColor: theme.hover }]} onLayout={onLayout} />;
  }
  return (
    <View onLayout={onLayout}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => width && setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        scrollEventThrottle={32}
        style={styles.photos}
      >
        {keys.map((key) => (
          <Image
            key={key}
            source={{ uri: `${API_BASE}/img/${key}` }}
            style={[styles.photo, { width: width || 1, backgroundColor: theme.hover }]}
          />
        ))}
      </ScrollView>
      {keys.length > 1 && (
        <View style={styles.dots} aria-hidden>
          {keys.map((key, i) => (
            <View
              key={key}
              style={[styles.dot, { backgroundColor: i === page ? theme.text : theme.textFaint }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.m },
  // The frame's ‹ back pill is 36 tall with 8 under it; แก้ไข sits on the same line, on the right.
  editPill: {
    alignSelf: "flex-end",
    marginTop: -44,
    marginBottom: SPACE.s,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  } as never,
  photos: { borderRadius: 16 },
  photo: { height: 240, borderRadius: 16 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: SPACE.s },
  dot: { width: 6, height: 6, borderRadius: 3 },
  title: { marginTop: SPACE.l },
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
  textCard: { borderRadius: RADIUS.card, padding: SPACE.l },
  deleteGroup: { marginTop: SPACE.xxl },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
});
