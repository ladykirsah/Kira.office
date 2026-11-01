import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { deleteItem } from "@/lib/affiliateApi";
import { SOURCE_LABEL, type AffiliateItem } from "@/lib/affiliatePage";
import { API_BASE } from "@/lib/config";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { openPage } from "../openPage";
import { Heading, Line } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { CardPhoto, Retry, ValueRow } from "./parts";
import { useAffiliateList } from "./useAffiliateList";

const BASE = "/settings/affiliate-items";

/**
 * One card (canvas v238, นายหน้า 4): the photo across the top, then the same order as its form —
 * the store, การ์ด (ลิงก์ › · ชื่อ · ราคา · หมวดหมู่ · คลิก), แสดงที่ไหน — values only; แก้ไข changes
 * them. ลบรายการ asks first.
 */
export function AffiliateItemScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const list = useAffiliateList();
  const [deleting, setDeleting] = useState(false);
  const item = list.items?.find((i) => i.id === id) ?? null;

  useScreenChrome(null, [], {
    back: {
      label: t({ th: "สินค้านายหน้า", en: "Affiliate" }),
      onPress: () => (router.canGoBack() ? router.back() : router.replace(BASE as never)),
    },
    ownTitle: true,
    toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null,
  });

  if (!list.items) {
    return list.failed ? (
      <Retry onPress={() => void list.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  if (!item) {
    return (
      <Empty
        icon={ICON.search}
        title={t({ th: "ไม่มีรายการนี้แล้ว", en: "This card is gone" })}
        detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been deleted" })}
      />
    );
  }
  const on = t({ th: "เปิด", en: "On" });
  const off = t({ th: "ปิด", en: "Off" });
  const category = item.categoryName ?? t({ th: "ไม่มีหมวด", en: "No category" });
  return (
    <View>
      <Pressable
        onPress={() => router.push(`${BASE}/${encodeURIComponent(item.id)}/edit` as never)}
        accessibilityRole="button"
        style={[styles.editPill, { backgroundColor: theme.glass, borderColor: theme.glassLine }]}
      >
        <Text style={[TYPE.body, { color: theme.text }]}>{t({ th: "แก้ไข", en: "Edit" })}</Text>
      </Pressable>
      <View style={styles.photo}>
        <CardPhoto imageKey={item.imageKey} height={240} radius={RADIUS.card} />
      </View>
      <View style={styles.store}>
        <Group>
          <Line label={t(SOURCE_LABEL[item.source] ?? SOURCE_LABEL.other)} last />
        </Group>
      </View>

      <Heading text={t({ th: "การ์ด", en: "Card" })} />
      <Group>
        <ValueRow
          label={t({ th: "ลิงก์", en: "Link" })}
          value={item.targetUrl}
          onPress={() => openPage(item.targetUrl)}
        />
        <ValueRow label={t({ th: "ชื่อ", en: "Name" })} value={item.title} />
        <ValueRow label={t({ th: "ราคา", en: "Price" })} value={item.priceText ?? "—"} />
        <ValueRow label={t({ th: "หมวดหมู่", en: "Category" })} value={category} />
        <ValueRow
          label={t({ th: "คลิก", en: "Clicks" })}
          value={t({ th: `${item.clicks} ครั้ง`, en: `${item.clicks}` })}
          last
        />
      </Group>

      <Heading text={t({ th: "แสดงที่ไหน", en: "Where it shows" })} />
      <Group>
        <Line
          label={t({ th: "แสดง", en: "Show" })}
          right={<Grey text={item.status === "active" ? on : off} />}
        />
        <Line
          label={t({ th: "ปักหมุด", en: "Pin" })}
          right={<Grey text={item.pinned === 1 ? on : off} />}
          last
        />
      </Group>

      <View style={styles.deleteGroup}>
        <Group>
          <Pressable
            onPress={() => setDeleting(true)}
            accessibilityRole="button"
            style={styles.deleteRow}
          >
            <Text style={[TYPE.body, { color: theme.danger }]}>
              {t({ th: "ลบรายการ", en: "Delete card" })}
            </Text>
          </Pressable>
        </Group>
      </View>
      {deleting && (
        <DeleteSheet
          item={item}
          token={list.token}
          onClose={() => setDeleting(false)}
          onFailed={(why) =>
            list.showToast(
              { th: "ลบไม่สำเร็จ", en: "Not deleted" },
              { th: why || "ลองอีกครั้ง", en: why || "Try again" },
            )
          }
        />
      )}
    </View>
  );
}

function Grey({ text }: { text: string }) {
  const { theme } = useTheme();
  return <Text style={[TYPE.body, { color: theme.textMuted }]}>{text}</Text>;
}

/** ลบการ์ดนี้? — the name, what goes with it, a red ลบ and a grey ไม่ลบ (canvas v238). */
function DeleteSheet(props: {
  item: AffiliateItem;
  token: string;
  onClose: () => void;
  onFailed: (why: string) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteItem(fetch, API_BASE, props.token, props.item.id);
      props.onClose();
      router.canGoBack() ? router.back() : router.replace(BASE as never);
    } catch (e) {
      props.onClose();
      props.onFailed(e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet title={t({ th: "ลบการ์ดนี้?", en: "Delete this card?" })} onClose={props.onClose}>
      <View style={styles.sheetText}>
        <Text style={[TYPE.headline, { color: theme.text }]}>{props.item.title}</Text>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t({
            th: `ลบแล้วเอากลับไม่ได้ · ตัวเลขคลิก ${props.item.clicks} ครั้งหายด้วย`,
            en: `It can't be undone · its ${props.item.clicks} clicks go too`,
          })}
        </Text>
      </View>
      <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={() => void remove()} />
      <BigButton label={t({ th: "ไม่ลบ", en: "Keep it" })} kind="grey" onPress={props.onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
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
  photo: { marginTop: SPACE.s },
  store: { marginTop: SPACE.xl },
  deleteGroup: { marginTop: SPACE.xxl },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
  sheetText: { gap: SPACE.xs },
});
