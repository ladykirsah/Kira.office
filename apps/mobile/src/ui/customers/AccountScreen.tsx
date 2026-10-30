import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { accountName, longDate, rowDate, shortOrderStatus } from "@/lib/customerPage";
import type { AccountOrder } from "@/lib/customersApi";
import { useLang, useTheme } from "../AppProviders";
import { Group, Row, SectionTitle, SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { ConsentSheet, EraseSheet } from "./AccountSheets";
import { Dot, ItemCard, toneOf } from "./parts";
import { useAccountPage, type AccountPage } from "./useAccountPage";

/** AirPlus บัญชีหนึ่งคน (canvas v151): name and code beside the level, the account, consent, orders. */
export function AccountScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const page = useAccountPage(id);

  useScreenChrome(null, [], {
    back: {
      label: t({ th: "ลูกค้า", en: "Customers" }),
      onPress: () => (router.canGoBack() ? router.back() : router.replace("/customers" as never)),
    },
    ownTitle: true,
    toast: page.toast ? { title: t(page.toast.title), detail: t(page.toast.detail) } : null,
  });

  const c = page.detail?.customer;
  if (!c) {
    return page.failed || page.detail ? (
      <View style={styles.retry}>
        <Text style={[TYPE.subhead, { flex: 1, color: theme.text }]}>
          {t({ th: "โหลดบัญชีนี้ไม่ได้", en: "This account did not load" })}
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
  const now = Date.now();
  const erased = c.anonymizedAt !== null;
  return (
    <View>
      <View style={styles.header}>
        <View style={styles.grow}>
          <Text style={[TYPE.largeTitle, { color: theme.text }]} accessibilityRole="header">
            {t(accountName(c))}
          </Text>
          {c.customerCode && (
            <Text style={[styles.code, { color: theme.text }]}>{c.customerCode}</Text>
          )}
        </View>
        {c.tier && (
          <Text style={[TYPE.body, { color: theme.text }]}>
            {t({ th: `ระดับ ${c.tier}`, en: `Level ${c.tier}` })}
          </Text>
        )}
      </View>
      <SectionTitle text={t({ th: "บัญชี", en: "Account" })} />
      <Group>
        <Row
          label={t({ th: "เบอร์โทร", en: "Phone" })}
          value={
            c.phone
              ? `${c.phone}${c.phoneVerifiedAt ? t({ th: " · ยืนยันแล้ว", en: " · verified" }) : ""}`
              : "—"
          }
        />
        <Row label={t({ th: "อีเมล", en: "Email" })} value={c.email ?? "—"} />
        <Row
          label="LINE"
          value={
            c.lineLinked
              ? t({ th: "เชื่อมแล้ว", en: "Linked" })
              : t({ th: "ยังไม่เชื่อม", en: "Not linked" })
          }
        />
        <Row label={t({ th: "เปิดบัญชี", en: "Opened" })} value={t(longDate(c.createdAt))} last />
      </Group>
      <SectionTitle text={t({ th: "การยินยอม", en: "Consent" })} />
      <Group>
        <Row
          label={t({ th: "ความเป็นส่วนตัว + เงื่อนไข", en: "Privacy + terms" })}
          value={
            c.pdpaConsentAt
              ? t({
                  th: `ยอมรับ ${t(rowDate(c.pdpaConsentAt, now))}`,
                  en: `Accepted ${t(rowDate(c.pdpaConsentAt, now))}`,
                })
              : "—"
          }
        />
        <Row
          label={t({ th: "รับข่าวสาร", en: "Marketing" })}
          value={
            c.marketingConsentAt
              ? t({ th: "ยินยอมแล้ว", en: "Agreed" })
              : t({ th: "ยังไม่ยินยอม", en: "Not agreed" })
          }
          onPress={erased ? undefined : () => page.setSheet("consent")}
          opens
          last
        />
      </Group>
      <Orders orders={page.detail!.orders} />
      {!erased && (
        <Group spaced>
          <Row
            label={t({ th: "ลบข้อมูลตาม PDPA", en: "Erase data (PDPA)" })}
            onPress={() => page.setSheet("erase")}
            last
          />
        </Group>
      )}
      {page.sheet === "consent" && <ConsentSheet page={page} />}
      {page.sheet === "erase" && <EraseSheet page={page} />}
    </View>
  );
}

/** คำสั่งซื้อ: "[order ID] ● [short status]" on the left, the date on the right (owner, canvas v150). */
function Orders({ orders }: { orders: AccountOrder[] }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <>
      <SectionTitle text={t({ th: "คำสั่งซื้อ", en: "Orders" })} />
      {orders.length === 0 ? (
        <Text style={[TYPE.subhead, styles.none, { color: theme.textMuted }]}>
          {t({ th: "ยังไม่มีคำสั่งซื้อ", en: "No orders yet" })}
        </Text>
      ) : (
        orders.map((o) => {
          const s = shortOrderStatus(o.orderStatus);
          return (
            <View key={o.id} style={styles.order}>
              <ItemCard
                items={o.items}
                onPress={() => router.push(`/orders/${encodeURIComponent(o.id)}` as never)}
                head={
                  <>
                    <View style={[styles.status, styles.grow]}>
                      <Text style={[TYPE.headline, { color: theme.text }]}>
                        {o.externalOrderId ?? "—"}
                      </Text>
                      <Dot color={toneOf(s.tone, theme)} />
                      <Text style={[TYPE.subhead, { color: theme.text }]}>{t(s.word)}</Text>
                    </View>
                    {o.orderCreatedAt !== null && (
                      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
                        {t(longDate(o.orderCreatedAt))}
                      </Text>
                    )}
                  </>
                }
              />
            </View>
          );
        })
      )}
    </>
  );
}

const styles = StyleSheet.create({
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.l },
  header: {
    marginTop: SPACE.s,
    marginHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.l,
  },
  grow: { flex: 1, minWidth: 0 },
  code: { fontSize: 22, lineHeight: 29, fontWeight: "600" },
  none: { marginHorizontal: 2 },
  order: { marginBottom: SPACE.s },
  status: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
});
