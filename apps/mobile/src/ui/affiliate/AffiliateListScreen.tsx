import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { filedGroups, pinLine, unfiled, type AffiliateItem } from "@/lib/affiliatePage";
import { useLang, useTheme } from "../AppProviders";
import { Dot, Empty } from "../customers/parts";
import { DeskCard } from "../desk/DeskCard";
import { Table, type TableColumn } from "../desk/Table";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { Group, SmallButton } from "../orders/parts";
import { Line } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { ItemCell, ItemRow, ItemState, Retry } from "./parts";
import { useAffiliateList } from "./useAffiliateList";

const BASE = "/settings/affiliate-items";

/**
 * สินค้านายหน้า (canvas v238, นายหน้า 1): how many are pinned to the AirPlus home page, the ones not
 * filed yet behind จัดหมวด, then a group per category. ＋ adds; a card opens its own page.
 */
export function AffiliateListScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const list = useAffiliateList();
  const wide = useWide();

  useScreenChrome(
    {
      label: t({ th: "เพิ่มรายการ", en: "Add a card" }),
      icon: ICON.plus,
      main: true,
      onPress: () => router.push(`${BASE}/new` as never),
    },
    [],
    {
      toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null,
      // A computer shows the categories side by side across the full width (DeskAffiliate board).
      layout: "full",
    },
  );

  if (!list.items) {
    return list.failed ? (
      <Retry onPress={() => void list.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  if (list.items.length === 0) {
    return (
      <Empty
        icon={ICON.plus}
        title={t({ th: "ยังไม่มีสินค้านายหน้า", en: "No cards yet" })}
        detail={t({ th: "แตะ ＋ เพื่อเพิ่มรายการแรก", en: "Tap ＋ to add the first one" })}
      />
    );
  }
  const loose = unfiled(list.items).length;
  if (wide) return <WideList items={list.items} failed={list.failed} onRetry={list.load} />;
  return (
    <View>
      {list.failed && <Retry onPress={() => void list.load()} />}
      <View style={styles.first}>
        <Group>
          <Line
            label={t({ th: "ปักหมุดหน้าแรก", en: "Pinned to the home page" })}
            right={
              <Text style={[TYPE.body, styles.nums, { color: theme.textMuted }]}>
                {t(pinLine(list.items))}
              </Text>
            }
            last
          />
        </Group>
      </View>
      {loose > 0 && (
        <View
          style={[
            styles.loose,
            {
              backgroundColor: theme.surface,
              borderWidth: theme.cardLine,
              borderColor: theme.border,
            },
          ]}
        >
          <Dot color={theme.waiting} />
          <Text style={[TYPE.headline, styles.grow, { color: theme.text }]}>
            {t({ th: `${loose} รายการยังไม่จัดหมวด`, en: `${loose} not filed yet` })}
          </Text>
          <SmallButton
            label={t({ th: "จัดหมวด", en: "File them" })}
            onPress={() => router.push(`${BASE}/unfiled` as never)}
          />
        </View>
      )}
      {filedGroups(list.items).map((group) => (
        <View key={group.id}>
          <View style={styles.head}>
            <Text
              style={[TYPE.title2, styles.grow, { color: theme.text }]}
              accessibilityRole="header"
            >
              {group.name}
            </Text>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
              {t({ th: `${group.items.length} รายการ`, en: `${group.items.length} cards` })}
            </Text>
          </View>
          <Group>
            {group.items.map((item, i) => (
              <ItemRow
                key={item.id}
                item={item}
                last={i === group.items.length - 1}
                onPress={() => open(item)}
              />
            ))}
          </Group>
        </View>
      ))}
    </View>
  );
}

const open = (item: AffiliateItem) =>
  router.push(`${BASE}/${encodeURIComponent(item.id)}` as never);

/**
 * สินค้านายหน้า on a computer (DeskAffiliate board, 4 Nov 2026): ปักหมุดหน้าแรก and the not-filed
 * warning side by side, then the categories two to a row, each a table; a row opens its card.
 */
function WideList(props: { items: AffiliateItem[]; failed: boolean; onRetry: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const loose = unfiled(props.items).length;
  const groups = filedGroups(props.items);
  const pairs = groups.filter((_, i) => i % 2 === 0).map((g, i) => [g, groups[i * 2 + 1]] as const);
  const columns: TableColumn<AffiliateItem>[] = [
    { key: "card", label: "", cell: (item) => <ItemCell item={item} /> },
    {
      key: "state",
      label: "",
      width: 170,
      align: "right",
      cell: (item) => <ItemState item={item} end />,
    },
  ];
  return (
    <View style={styles.wide}>
      {props.failed && <Retry onPress={props.onRetry} />}
      <View style={styles.wideRow}>
        <DeskCard pad={16} flex={1}>
          <View style={styles.wideLine}>
            <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]}>
              {t({ th: "ปักหมุดหน้าแรก", en: "Pinned to the home page" })}
            </Text>
            <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]}>
              {t(pinLine(props.items))}
            </Text>
          </View>
        </DeskCard>
        {loose > 0 ? (
          <DeskCard pad={16} flex={1}>
            <View style={styles.wideLine}>
              <Dot color={theme.waiting} />
              <Text style={[TYPE.headline, styles.grow, { color: theme.text }]}>
                {t({ th: `${loose} รายการยังไม่จัดหมวด`, en: `${loose} not filed yet` })}
              </Text>
              <SmallButton
                label={t({ th: "จัดหมวด", en: "File them" })}
                onPress={() => router.push(`${BASE}/unfiled` as never)}
              />
            </View>
          </DeskCard>
        ) : (
          <View style={styles.grow} />
        )}
      </View>
      {pairs.map((pair) => (
        <View key={pair[0].id} style={styles.wideRow}>
          {pair.map((group) =>
            group ? (
              <View key={group.id} style={styles.grow}>
                <View style={styles.head}>
                  <Text
                    style={[TYPE.title2, styles.grow, { color: theme.text }]}
                    accessibilityRole="header"
                  >
                    {group.name}
                  </Text>
                  <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                    {t({ th: `${group.items.length} รายการ`, en: `${group.items.length} cards` })}
                  </Text>
                </View>
                <DeskCard pad={4}>
                  <Table
                    columns={columns}
                    rows={group.items}
                    rowKey={(item) => item.id}
                    onPress={open}
                    rowLabel={(item) => item.title}
                    minRowHeight={76}
                    noHead
                  />
                </DeskCard>
              </View>
            ) : (
              <View key="empty" style={styles.grow} />
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wide: { gap: SPACE.xl },
  wideRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.xl },
  wideLine: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 10 },
  first: { marginTop: SPACE.l },
  loose: {
    marginTop: SPACE.l,
    borderRadius: 16,
    paddingVertical: SPACE.m,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  head: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: SPACE.xxl,
    marginBottom: SPACE.m,
    marginHorizontal: 2,
  },
  grow: { flex: 1, minWidth: 0 },
  nums: { fontVariant: ["tabular-nums"] },
});
