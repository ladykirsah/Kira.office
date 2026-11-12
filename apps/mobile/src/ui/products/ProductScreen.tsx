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
import { hasChoices } from "@/lib/productChoices";
import { editedLine, galleryKeys } from "@/lib/productPage";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { Group, SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { ChoicesSection, GroupSection } from "./ChoiceSections";
import { DeleteSheet } from "./DeleteSheet";
import { Heading } from "./parts";
import { ProductDesk } from "./ProductDesk";
import {
  CarLines,
  DeleteLine,
  DetailLines,
  OnlineLines,
  PriceLines,
  StockLines,
} from "./ProductPageParts";
import { useProductPage } from "./useProductPage";

/** A pencil (the computer's แก้ไข button beside the title). */
const EDIT_ICON = "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4";

/**
 * หน้าสินค้า (canvas v194): the photos, the name, one ราคา list (ต้นทุน first; ⌄ drops the sum or the
 * profit), stock, the cars it fits, the part's details and where it is sold. แก้ไข edits it all.
 * A computer keeps ‹ สินค้า and แก้ไข on one line above the page's own layout (ProductDesk, A2).
 * ตัวเลือกสินค้า and กลุ่มสินค้า sit under the stock (board ChoicesGroup, 7 Nov 2026); a product with
 * choices shows no ราคา or สต็อก of its own — each choice's are on its own page. Photos are 1:1.
 */
export function ProductScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const page = useProductPage(id);
  const wide = useWide();
  const [deleting, setDeleting] = useState(false);
  const edit = () =>
    router.push(`/products/${encodeURIComponent(page.detail?.product.id ?? id)}/edit` as never);

  useScreenChrome(
    wide && page.rights.edits && page.detail
      ? { label: t({ th: "แก้ไข", en: "Edit" }), icon: EDIT_ICON, onPress: edit }
      : null,
    [],
    {
      back: {
        label: t({ th: "สินค้า", en: "Products" }),
        onPress: () => (router.canGoBack() ? router.back() : router.replace("/products" as never)),
      },
      // The computer draws the name in the page's top card, beside the photo (A2), as the phone does.
      ownTitle: true,
      toast: page.toast ? { title: t(page.toast.title), detail: t(page.toast.detail) } : null,
      // The computer's A2 layout uses the full width (DeskProductPage board 10b).
      layout: "full",
    },
  );

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
  const sheet = deleting && <DeleteSheet page={page} onClose={() => setDeleting(false)} />;
  if (wide) {
    return (
      <>
        <ProductDesk page={page} onDelete={() => setDeleting(true)} />
        {sheet}
      </>
    );
  }
  return (
    <View>
      {page.rights.edits && (
        <Pressable
          onPress={edit}
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

      {!hasChoices(d) && (
        <>
          <Heading text={t({ th: "ราคา", en: "Prices" })} />
          <Group>
            <PriceLines page={page} />
          </Group>

          <Heading text={t({ th: "สต็อก", en: "Stock" })} />
          <Group>
            <StockLines page={page} />
          </Group>
        </>
      )}

      <ChoicesSection page={page} />
      <GroupSection page={page} />

      <Heading text={t({ th: "ใช้ได้กับรถ", en: "Fits these cars" })} />
      <Group>
        <CarLines page={page} />
      </Group>

      <Heading text={t({ th: "รายละเอียดอะไหล่", en: "Part details" })} />
      <Group>
        <DetailLines page={page} />
      </Group>

      <Heading text={t({ th: "รายละเอียด", en: "Description" })} />
      <View
        style={[
          styles.textCard,
          {
            backgroundColor: theme.surface,
            borderWidth: theme.cardLine,
            borderColor: theme.border,
          },
        ]}
      >
        <Text style={[TYPE.body, { color: theme.text }]}>{p.description?.trim() || "—"}</Text>
      </View>

      <Heading text={t({ th: "ขายออนไลน์", en: "Sold online" })} />
      <Group>
        <OnlineLines page={page} />
      </Group>

      {page.rights.deletes && (
        <View style={styles.deleteGroup}>
          <Group>
            <DeleteLine onPress={() => setDeleting(true)} />
          </Group>
        </View>
      )}
      {sheet}
    </View>
  );
}

/** The product's photos, one at a time, with dots under them — square, as every product photo is. */
export function Gallery({ keys }: { keys: string[] }) {
  const { theme } = useTheme();
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  if (keys.length === 0) {
    return (
      <View
        style={[styles.photo, styles.square, { backgroundColor: theme.hover }]}
        onLayout={onLayout}
      />
    );
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
            style={[
              styles.photo,
              { width: width || 1, height: width || 1, backgroundColor: theme.hover },
            ]}
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
  photo: { borderRadius: 16 },
  square: { aspectRatio: 1 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: SPACE.s },
  dot: { width: 6, height: 6, borderRadius: 3 },
  title: { marginTop: SPACE.l },
  textCard: { borderRadius: RADIUS.card, padding: SPACE.l },
  deleteGroup: { marginTop: SPACE.xxl },
});
