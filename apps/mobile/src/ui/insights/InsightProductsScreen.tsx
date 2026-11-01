import { isInsightPeriod } from "@l-shopee/core";
import { router, useLocalSearchParams } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useLang } from "../AppProviders";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE } from "../theme";
import { PeriodButton, Waiting } from "./InsightScreen";
import { SellerList } from "./Sellers";
import { useInsights } from "./useInsights";

/**
 * แตะ ดูทั้งหมด → สินค้าขายดีทุกตัว (canvas v233): every product sold or looked at in the period,
 * most sales first, the same rows as the five on ภาพรวม. It opens on the period ภาพรวม showed.
 */
export function InsightProductsScreen() {
  const { t } = useLang();
  const { period = "" } = useLocalSearchParams<{ period: string }>();
  const h = useInsights(isInsightPeriod(period) ? period : "realtime");
  useScreenChrome(null, [], {
    title: t({ th: "สินค้าขายดี", en: "Best sellers" }),
    back: {
      label: t({ th: "ภาพรวม AirPlus", en: "Insight" }),
      onPress: () => (router.canGoBack() ? router.back() : router.replace("/insights" as never)),
    },
  });
  return (
    <View>
      <PeriodButton h={h} />
      <View style={styles.list}>
        <Waiting h={h}>
          {(data) =>
            data.products.length > 0 ? (
              <SellerList rows={data.products} />
            ) : (
              <Empty
                icon={ICON.box}
                title={t({ th: "ยังไม่มีสินค้าในช่วงนี้", en: "No products in this period" })}
              />
            )
          }
        </Waiting>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: SPACE.l },
});
