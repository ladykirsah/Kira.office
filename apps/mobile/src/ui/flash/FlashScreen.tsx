import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { deleteSale } from "@/lib/flashApi";
import {
  flashState,
  offPercent,
  pageStatus,
  pageWindow,
  soldLine,
  type FlashItem,
  type FlashSale,
} from "@/lib/flashPage";
import { formatBaht } from "@/lib/money";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { BigButton } from "../BigButton";
import { Empty } from "../customers/parts";
import { Columns } from "../desk/Columns";
import { DeskCard } from "../desk/DeskCard";
import { Table, type TableColumn } from "../desk/Table";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { Heading, Line } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { FLASH_BASE, ItemRow, OffPhoto, StateDot, useNow } from "./parts";
import { useFlashList } from "./useFlashList";
import { SizedCodeCopy } from "../CodeCopy";
import { sizeCode } from "@/lib/sizeLine";

/**
 * One sale (canvas v259, แฟลชเซล 3): its name, สถานะ (a live one says how long is left), ช่วงเวลา, then
 * every product with its sale price and how many sold. แก้ไข opens the form; ลบแคมเปญ asks first.
 */
export function FlashScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const list = useFlashList();
  const now = useNow();
  const [deleting, setDeleting] = useState(false);
  const wide = useWide();
  const sale = list.sales?.find((s) => s.id === id) ?? null;

  useScreenChrome(null, [], {
    back: {
      label: t({ th: "แฟลชเซล", en: "Flash sales" }),
      onPress: () => (router.canGoBack() ? router.back() : router.replace(FLASH_BASE as never)),
    },
    ownTitle: true,
    toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null,
  });

  if (!list.sales) {
    return list.failed ? (
      <Retry onPress={() => void list.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  if (!sale) {
    return (
      <Empty
        icon={ICON.search}
        title={t({ th: "ไม่มีแคมเปญนี้แล้ว", en: "This sale is gone" })}
        detail={t({ th: "อาจถูกลบไปแล้ว", en: "It may have been deleted" })}
      />
    );
  }

  const head = (
    <>
      <Pressable
        onPress={() => router.push(`${FLASH_BASE}/${encodeURIComponent(sale.id)}/edit` as never)}
        accessibilityRole="button"
        style={[styles.editPill, { backgroundColor: theme.glass, borderColor: theme.glassLine }]}
      >
        <Text style={[TYPE.body, { color: theme.text }]}>{t({ th: "แก้ไข", en: "Edit" })}</Text>
      </Pressable>
      <Text style={[TYPE.title1, styles.name, { color: theme.text }]} accessibilityRole="header">
        {sale.name}
      </Text>
    </>
  );
  const facts = (
    <Group>
      <Line
        label={t({ th: "สถานะ", en: "Status" })}
        right={
          <View style={styles.state}>
            <StateDot state={flashState(sale, now)} />
            <Text style={[TYPE.body, styles.value, { color: theme.text }]} numberOfLines={1}>
              {t(pageStatus(sale, now))}
            </Text>
          </View>
        }
      />
      <Line
        label={t({ th: "ช่วงเวลา", en: "When" })}
        right={
          <Text style={[TYPE.body, styles.value, { color: theme.text }]} numberOfLines={1}>
            {t(pageWindow(sale.startsAt, sale.endsAt))}
          </Text>
        }
        last
      />
    </Group>
  );
  const items = t({ th: `สินค้า · ${sale.prices.length}`, en: `Products · ${sale.prices.length}` });
  const remove = (
    <View style={wide ? null : styles.deleteGroup}>
      <Group>
        <Pressable
          onPress={() => setDeleting(true)}
          accessibilityRole="button"
          style={styles.deleteRow}
        >
          <Text style={[TYPE.body, { color: theme.danger }]}>
            {t({ th: "ลบแคมเปญ", en: "Delete sale" })}
          </Text>
        </Pressable>
      </Group>
    </View>
  );
  const sheet = deleting && (
    <DeleteSheet
      sale={sale}
      token={list.token}
      onClose={() => setDeleting(false)}
      onFailed={(why) =>
        list.showToast(
          { th: "ลบไม่สำเร็จ", en: "Not deleted" },
          { th: why || "ลองอีกครั้ง", en: why || "Try again" },
        )
      }
    />
  );

  if (wide) {
    // A computer (DeskFlash board 2): every product in a table on the left; สถานะ, ช่วงเวลา and
    // ลบแคมเปญ on the right.
    return (
      <View>
        {head}
        <View style={styles.wideBody}>
          <Columns
            sideWidth={320}
            side={
              <View style={styles.wideSide}>
                {facts}
                {remove}
              </View>
            }
          >
            <DeskCard title={items} pad={4}>
              <ItemsTable prices={sale.prices} />
            </DeskCard>
          </Columns>
        </View>
        {sheet}
      </View>
    );
  }
  return (
    <View>
      {head}
      <View style={styles.facts}>{facts}</View>
      <Heading text={items} />
      <Group>
        {sale.prices.map((p, i) => (
          <ItemRow
            key={p.id}
            name={p.productName}
            code={sizeCode(p).code}
            tag={sizeCode(p).tag}
            imageKey={p.imageKey}
            off={`${offPercent(p.basePriceSatang, p.campaignPriceSatang)}%`}
            price={formatBaht(p.campaignPriceSatang)}
            base={formatBaht(p.basePriceSatang)}
            sub={t(soldLine(p))}
            last={i === sale.prices.length - 1}
          />
        ))}
      </Group>
      {remove}
      {sheet}
    </View>
  );
}

/**
 * The sale's products on a computer: photo with its -%, the name on two lines and its code, the sale
 * price with the normal one struck through, and how many sold.
 */
function ItemsTable({ prices }: { prices: readonly FlashItem[] }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const columns: TableColumn<FlashItem>[] = [
    {
      key: "product",
      label: "",
      cell: (p) => (
        <View style={styles.product}>
          <OffPhoto
            imageKey={p.imageKey}
            size={52}
            off={`${offPercent(p.basePriceSatang, p.campaignPriceSatang)}%`}
          />
          <View style={styles.grow}>
            <Text style={[TYPE.subhead, { color: theme.text }]} numberOfLines={2}>
              {p.productName}
            </Text>
            <SizedCodeCopy row={p} style={[TYPE.footnote, { color: theme.textMuted }]} />
          </View>
        </View>
      ),
    },
    {
      key: "price",
      label: "",
      width: 170,
      align: "right",
      cell: (p) => (
        <Text style={[TYPE.subhead, styles.nums, { color: theme.text }]} numberOfLines={1}>
          {formatBaht(p.campaignPriceSatang)}{" "}
          <Text style={[styles.struck, { color: theme.textMuted }]}>
            {formatBaht(p.basePriceSatang)}
          </Text>
        </Text>
      ),
    },
    {
      key: "sold",
      label: "",
      width: 140,
      align: "right",
      cell: (p) => (
        <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]} numberOfLines={1}>
          {t(soldLine(p))}
        </Text>
      ),
    },
  ];
  return <Table columns={columns} rows={prices} rowKey={(p) => p.id} minRowHeight={76} noHead />;
}

/** ลบแคมเปญ แฟลชเซลปลายเดือน? — a red ลบ and a grey ยกเลิก, nothing else (as drawn). */
function DeleteSheet(props: {
  sale: FlashSale;
  token: string;
  onClose: () => void;
  onFailed: (why: string) => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await deleteSale(fetch, API_BASE, props.token, props.sale.id);
      props.onClose();
      router.canGoBack() ? router.back() : router.replace(FLASH_BASE as never);
    } catch (e) {
      props.onClose();
      props.onFailed(e instanceof Error ? e.message : "");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={t({ th: `ลบแคมเปญ ${props.sale.name}?`, en: `Delete ${props.sale.name}?` })}
      onClose={props.onClose}
      noPill
    >
      <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={() => void remove()} />
      <BigButton label={t({ th: "ยกเลิก", en: "Cancel" })} kind="grey" onPress={props.onClose} />
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
  name: { marginHorizontal: 2 },
  facts: { marginTop: SPACE.m + 2 },
  state: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  value: { flexShrink: 1, textAlign: "right", fontVariant: ["tabular-nums"] },
  deleteGroup: { marginTop: SPACE.xl + SPACE.xs },
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
  wideBody: { marginTop: SPACE.l },
  wideSide: { gap: SPACE.xl },
  product: { flexDirection: "row", alignItems: "center", gap: SPACE.m, minWidth: 0 },
  grow: { flex: 1, minWidth: 0 },
  nums: { fontVariant: ["tabular-nums"] },
  struck: { textDecorationLine: "line-through" },
});
