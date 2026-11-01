import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { filedGroups, pinLine, unfiled } from "@/lib/affiliatePage";
import { useLang, useTheme } from "../AppProviders";
import { Dot, Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { Group, SmallButton } from "../orders/parts";
import { Line } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { ItemRow, Retry } from "./parts";
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

  useScreenChrome(
    {
      label: t({ th: "เพิ่มรายการ", en: "Add a card" }),
      icon: ICON.plus,
      onPress: () => router.push(`${BASE}/new` as never),
    },
    [],
    { toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null },
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
        <View style={[styles.loose, { backgroundColor: theme.surface }]}>
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
                onPress={() => router.push(`${BASE}/${encodeURIComponent(item.id)}` as never)}
              />
            ))}
          </Group>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
