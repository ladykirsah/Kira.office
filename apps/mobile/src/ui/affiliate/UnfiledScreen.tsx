import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { unfiled, type AffiliateItem } from "@/lib/affiliatePage";
import { useLang, useTheme } from "../AppProviders";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { Group, SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { CategorySheet } from "./CategorySheet";
import { ItemRow, Retry } from "./parts";
import { useAffiliateList } from "./useAffiliateList";

/**
 * ยังไม่จัดหมวด (canvas v238): only the cards with no category, one เลือกหมวด each. A filed card
 * leaves this list and the toast says where it went.
 */
export function UnfiledScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const list = useAffiliateList();
  const [filing, setFiling] = useState<AffiliateItem | null>(null);

  useScreenChrome(null, [], {
    back: {
      label: t({ th: "สินค้านายหน้า", en: "Affiliate" }),
      onPress: () =>
        router.canGoBack() ? router.back() : router.replace("/settings/affiliate-items" as never),
    },
    title: t({ th: "ยังไม่จัดหมวด", en: "Not filed yet" }),
    toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null,
  });

  if (!list.items) {
    return list.failed ? (
      <Retry onPress={() => void list.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  const loose = unfiled(list.items);
  return (
    <View>
      <Text style={[TYPE.subhead, styles.count, { color: theme.textMuted }]}>
        {t({ th: `${loose.length} รายการ`, en: `${loose.length} cards` })}
      </Text>
      {loose.length === 0 ? (
        <Empty
          icon={ICON.check}
          title={t({ th: "จัดหมวดครบแล้ว", en: "Everything is filed" })}
          detail={t({ th: "ทุกรายการอยู่ในหมวดแล้ว", en: "Every card has a category" })}
        />
      ) : (
        <View style={styles.list}>
          <Group>
            {loose.map((item, i) => (
              <ItemRow
                key={item.id}
                item={item}
                last={i === loose.length - 1}
                action={
                  <SmallButton
                    label={t({ th: "เลือกหมวด", en: "Choose" })}
                    onPress={() => setFiling(item)}
                  />
                }
              />
            ))}
          </Group>
        </View>
      )}
      {filing && (
        <CategorySheet
          categories={list.categories}
          current={null}
          token={list.token}
          onMade={list.addCategory}
          onClose={() => setFiling(null)}
          onPick={(category) => {
            const item = filing;
            setFiling(null);
            if (category) void list.fileUnder(item, category);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  count: { marginTop: -SPACE.xs, marginHorizontal: 2 },
  list: { marginTop: SPACE.l },
});
