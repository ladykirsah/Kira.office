import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { percentText, totalBp } from "@/lib/shopeeFees";
import { titleIn, type ShopProfile } from "@/lib/shopInfoPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { useWide } from "../desk/useWide";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Line } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { Block, ShopLogo } from "./parts";
import { ShopeeFeesSheet } from "./ShopeeFeesSheet";
import { useShopeeFees, type ShopeeFeesState } from "./useShopeeFees";
import { SHOP_ORDER, useShopInfo } from "./useShopInfo";

/**
 * ข้อมูลร้าน (canvas v275): no tabs on top — one card per shop, its logo, name and address in the
 * app's language; a card opens that shop's own page. Under them ขายบน Shopee: ค่าคอม Shopee, the
 * total of Shopee's fees, which opens every fee (canvas v369, owner 5 Nov 2026).
 */
export function ShopListScreen() {
  const { t, lang } = useLang();
  const { theme } = useTheme();
  const shops = useShopInfo(SHOP_ORDER);
  // On a computer the two shops sit side by side, one card each (DeskShop 1).
  const wide = useWide();
  const shopee = useShopeeFees();
  useScreenChrome(null, []);

  if (!shops.shops) {
    // One ลองอีกครั้ง brings back the whole page: the shops and ค่าคอม Shopee under them.
    const retryAll = () => {
      void shops.load();
      void shopee.load();
    };
    return shops.failed ? (
      <Retry onPress={retryAll} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  return (
    <View>
      <View style={wide ? styles.listWide : styles.list}>
        {SHOP_ORDER.map((profile: ShopProfile) => {
          const info = shops.shops?.[profile];
          if (!info) return null;
          const name =
            titleIn(info, "name", lang) || (profile === "denair" ? "Den Air Service" : "AirPlus");
          const address = titleIn(info, "address", lang);
          return (
            <Pressable
              key={profile}
              onPress={() => router.push(`/settings/shop/${profile}` as never)}
              accessibilityRole="button"
              accessibilityLabel={name}
              style={[
                styles.card,
                wide && styles.cardWide,
                {
                  backgroundColor: theme.surface,
                  borderWidth: theme.cardLine,
                  borderColor: theme.border,
                },
              ]}
            >
              <ShopLogo profile={profile} logoKey={info.logoKey} size={64} />
              <View style={styles.words}>
                <Text style={[TYPE.title2, { color: theme.text }]}>{name}</Text>
                {address ? (
                  <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{address}</Text>
                ) : (
                  <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                    {t({ th: "ยังไม่ได้ใส่ที่อยู่", en: "No address yet" })}
                  </Text>
                )}
              </View>
              <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
            </Pressable>
          );
        })}
      </View>
      <ShopeeBlock shopee={shopee} />
    </View>
  );
}

/** ขายบน Shopee · ค่าคอม Shopee: the total of Shopee's fees; a tap shows every fee. */
function ShopeeBlock({ shopee }: { shopee: ShopeeFeesState }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  if (!shopee.fees) {
    return shopee.failed ? <Retry onPress={() => void shopee.load()} /> : null;
  }
  return (
    <View style={styles.shopee}>
      <Block title={t({ th: "ขายบน Shopee", en: "Selling on Shopee" })}>
        <Line
          label={t({ th: "ค่าคอม Shopee", en: "Shopee fees" })}
          onPress={() => setOpen(true)}
          right={
            <View style={styles.right}>
              <Text style={[TYPE.body, styles.nums, { color: theme.textMuted }]}>
                {percentText(totalBp(shopee.fees))}
              </Text>
              <LineIcon d={ICON.chevron} color={theme.textFaint} size={15} strokeWidth={2.4} />
            </View>
          }
          last
        />
      </Block>
      {open && (
        <ShopeeFeesSheet
          fees={shopee.fees}
          owner={shopee.owner}
          onSave={shopee.save}
          onClose={() => setOpen(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: SPACE.xl, gap: SPACE.l },
  listWide: { flexDirection: "row", alignItems: "stretch", gap: SPACE.xl },
  cardWide: {
    flex: 1,
    minWidth: 0,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.xl,
    gap: SPACE.l,
  },
  card: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  words: { flex: 1, minWidth: 0, gap: 2 },
  shopee: { marginTop: SPACE.s },
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  nums: { fontVariant: ["tabular-nums"] },
});
