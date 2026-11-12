import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { billLineName } from "@/lib/billName";
import { choicePhoto } from "@/lib/productChoices";
import { editedLine } from "@/lib/productPage";
import { useLang, useTheme } from "../AppProviders";
import { CodeCopy } from "../CodeCopy";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { Group, SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { Heading } from "./parts";
import { PriceLines, StockLines } from "./ProductPageParts";
import { Gallery } from "./ProductScreen";
import { useProductPage } from "./useProductPage";

/**
 * One choice's own page (board ChoicesGroup row 1, "แตะ 3/8 เล็ก ›"): its photo (1:1), its name with
 * the product's under it, its code to copy, then its own ราคา (ต้นทุน first, ⌄ as on หน้าสินค้า) and
 * สต็อก. แก้ไข opens แก้ไขตัวเลือก.
 */
export function ChoiceScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "", variantId = "" } = useLocalSearchParams<{ id: string; variantId: string }>();
  const page = useProductPage(id);
  const d = page.detail;
  const c = d?.choices?.find((x) => x.variantId === variantId) ?? null;
  const productName = d
    ? billLineName(
        {
          name: d.product.name,
          typeName: d.product.typeName ? page.label("types", d.product.typeName) : null,
          brandName: d.product.brandName,
        },
        "customer",
      )
    : t({ th: "สินค้า", en: "Product" });

  useScreenChrome(null, [], {
    back: {
      label: productName,
      onPress: () =>
        router.canGoBack()
          ? router.back()
          : router.replace(`/products/${encodeURIComponent(id)}` as never),
    },
    ownTitle: true,
    toast: page.toast ? { title: t(page.toast.title), detail: t(page.toast.detail) } : null,
  });

  if (!d) {
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
    ) : page.problem === "gone" ? (
      <Empty
        icon={ICON.search}
        title={t({ th: "ไม่มีสินค้านี้แล้ว", en: "This product is gone" })}
        detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been deleted" })}
      />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  if (!c) {
    return (
      <Empty
        icon={ICON.search}
        title={t({ th: "ไม่มีตัวเลือกนี้แล้ว", en: "This choice is gone" })}
        detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been removed" })}
      />
    );
  }
  const edited = editedLine(d.product.updatedAt);
  const photo = choicePhoto(c, d.product.imageKey);
  return (
    <View>
      {page.rights.edits && (
        <Pressable
          onPress={() =>
            router.push(
              `/products/${encodeURIComponent(id)}/choices/${encodeURIComponent(variantId)}/edit` as never,
            )
          }
          accessibilityRole="button"
          style={[styles.editPill, { backgroundColor: theme.glass, borderColor: theme.glassLine }]}
        >
          <Text style={[TYPE.body, { color: theme.text }]}>{t({ th: "แก้ไข", en: "Edit" })}</Text>
        </Pressable>
      )}
      <Gallery keys={photo ? [photo] : []} />
      <Text style={[TYPE.title2, styles.title, { color: theme.text }]} accessibilityRole="header">
        {c.value}
      </Text>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{d.product.name}</Text>
      {c.code ? (
        <CodeCopy
          code={c.code}
          style={[TYPE.subhead, { color: theme.textMuted }]}
          onCopied={(said) => page.showToast(said)}
        />
      ) : null}
      {edited && <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(edited)}</Text>}

      <Heading text={t({ th: "ราคา", en: "Prices" })} />
      <Group>
        <PriceLines page={page} pricing={c.pricing} />
      </Group>

      <Heading text={t({ th: "สต็อก", en: "Stock" })} />
      <Group>
        <StockLines page={page} stock={c} />
      </Group>
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
  title: { marginTop: SPACE.l },
});
