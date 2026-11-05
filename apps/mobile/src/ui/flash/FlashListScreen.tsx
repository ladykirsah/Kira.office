import { router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { sections } from "@/lib/flashPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { DeskCard } from "../desk/DeskCard";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Heading } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { FLASH_BASE, SaleCard, SaleRow, useNow } from "./parts";
import { useFlashList } from "./useFlashList";

/**
 * แฟลชเซล (canvas v259, แฟลชเซล 1): ตอนนี้ · กำลังจะมา · จบแล้ว, each sale with its countdown and the
 * photos of what it cuts. ＋ starts แคมเปญใหม่; a sale opens its own page.
 */
export function FlashListScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const list = useFlashList();
  const now = useNow();
  const wide = useWide();

  useScreenChrome(
    {
      label: t({ th: "เพิ่มแคมเปญ", en: "Add a sale" }),
      icon: ICON.plus,
      main: true,
      onPress: () => router.push(`${FLASH_BASE}/new` as never),
    },
    [],
    {
      toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null,
      // A computer shows each sale on one line across the full width (DeskFlash board).
      layout: "full",
    },
  );

  if (!list.sales) {
    return list.failed ? (
      <Retry onPress={() => void list.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  if (list.sales.length === 0) {
    return (
      <Text style={[TYPE.title2, styles.empty, { color: theme.text }]}>
        {t({ th: "ยังไม่มีแฟลชเซล", en: "No flash sales yet" })}
      </Text>
    );
  }
  return (
    <View style={wide && styles.wideList}>
      {list.failed && <Retry onPress={() => void list.load()} />}
      {sections(list.sales, now).map((section) =>
        wide ? (
          <View key={section.key}>
            <Text style={[TYPE.headline, styles.wideHead, { color: theme.text }]}>
              {t(section.label)}
            </Text>
            <DeskCard pad={4}>
              {section.sales.map((sale, i) => (
                <SaleRow
                  key={sale.id}
                  sale={sale}
                  now={now}
                  last={i === section.sales.length - 1}
                  onPress={() => open(sale.id)}
                />
              ))}
            </DeskCard>
          </View>
        ) : (
          <View key={section.key}>
            <Heading text={t(section.label)} />
            <Group>
              {section.sales.map((sale, i) => (
                <SaleCard
                  key={sale.id}
                  sale={sale}
                  now={now}
                  last={i === section.sales.length - 1}
                  onPress={() => open(sale.id)}
                />
              ))}
            </Group>
          </View>
        ),
      )}
    </View>
  );
}

const open = (id: string) => router.push(`${FLASH_BASE}/${encodeURIComponent(id)}` as never);

const styles = StyleSheet.create({
  wideList: { gap: SPACE.xl },
  wideHead: { marginBottom: SPACE.s, marginHorizontal: 2 },
  empty: { textAlign: "center", paddingVertical: 96, paddingHorizontal: SPACE.m },
});
