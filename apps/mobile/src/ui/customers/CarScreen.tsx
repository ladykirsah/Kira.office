import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  longDate,
  openQuote,
  phonesOf,
  splitCar,
  visitCards,
  type QuoteCard,
} from "@/lib/customerPage";
import { formatBaht } from "@/lib/money";
import { posDraftRoute } from "@/lib/posDraft";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group, SmallButton } from "../orders/parts";
import { useScreenChrome } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { EditSheet } from "./EditSheet";
import { ItemCard } from "./parts";
import { useCarPage, type CarPage } from "./useCarPage";

/** รถหนึ่งคัน (canvas v151): the plate beside the car, the customer, ทำใบเสนอราคา, the open quote, every visit. */
export function CarScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const { plate = "" } = useLocalSearchParams<{ plate: string }>();
  const page = useCarPage(plate);

  useScreenChrome(null, [], {
    back: {
      label: t({ th: "ลูกค้า", en: "Customers" }),
      onPress: () => (router.canGoBack() ? router.back() : router.replace("/customers" as never)),
    },
    ownTitle: true,
    toast: page.toast ? { title: t(page.toast.title), detail: t(page.toast.detail) } : null,
  });

  if (!page.detail) {
    return page.failed ? (
      <View style={styles.retry}>
        <Text style={[TYPE.subhead, { flex: 1, color: theme.text }]}>
          {t({ th: "โหลดหน้านี้ไม่ได้", en: "This page did not load" })}
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
  const d = page.detail;
  const shownPlate = d.customer?.licensePlate ?? plate;
  const quote = openQuote(d.quotations);
  return (
    <View>
      <Header page={page} plate={shownPlate} />
      <Customer page={page} />
      <View style={styles.quoteButton}>
        <BigButton
          label={t({ th: "ทำใบเสนอราคา", en: "Make a quotation" })}
          onPress={() =>
            router.push(`/pos?plate=${encodeURIComponent(shownPlate)}&doc=quote` as never)
          }
        />
      </View>
      {quote && <Quote quote={quote} />}
      <History page={page} plate={shownPlate} />
      {page.edit && <EditSheet page={page} />}
    </View>
  );
}

/** Two columns: plate over province | brand over model and year (owner, canvas v146). */
function Header({ page, plate }: { page: CarPage; plate: string }) {
  const { theme } = useTheme();
  const c = page.detail!.customer;
  const car = splitCar(c?.carModel?.trim() || page.detail!.vehicle, page.brands);
  return (
    <View style={styles.header}>
      <View style={styles.grow}>
        <Text style={[TYPE.largeTitle, { color: theme.text }]} accessibilityRole="header">
          {plate}
        </Text>
        {c?.plateProvince ? (
          <Text style={[styles.province, { color: theme.text }]}>{c.plateProvince}</Text>
        ) : null}
      </View>
      <View style={styles.carCol}>
        {car.brand && <Text style={[TYPE.body, { color: theme.text }]}>{car.brand}</Text>}
        {car.model !== "" && (
          <Text style={[TYPE.subhead, styles.right, { color: theme.textMuted }]}>{car.model}</Text>
        )}
      </View>
    </View>
  );
}

function Customer({ page }: { page: CarPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const c = page.detail!.customer;
  const phones = phonesOf(c?.phone ?? null);
  const name = c?.customerName?.trim();
  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={[TYPE.title2, { color: theme.text }]} accessibilityRole="header">
          {t({ th: "ลูกค้า", en: "Customer" })}
        </Text>
        <Pressable onPress={page.startEdit} accessibilityRole="button" hitSlop={8}>
          <Text style={[TYPE.body, { color: theme.primary }]}>
            {t({ th: "แก้ไข", en: "Edit" })}
          </Text>
        </Pressable>
      </View>
      <Group>
        <View style={[styles.kv, styles.divider, { borderBottomColor: theme.border }]}>
          <Text style={[TYPE.body, { color: name ? theme.text : theme.textMuted }]}>
            {name || t({ th: "ยังไม่มีชื่อ", en: "No name yet" })}
          </Text>
        </View>
        {phones.map((p) => (
          <Pressable
            key={p}
            onPress={() => void Linking.openURL(`tel:${p.replace(/[^\d+]/g, "")}`)}
            accessibilityRole="link"
            accessibilityLabel={t({ th: `โทร ${p}`, en: `Call ${p}` })}
            style={[styles.kv, styles.divider, { borderBottomColor: theme.border }]}
          >
            <Text style={[TYPE.body, styles.grow, { color: theme.text }]}>{p}</Text>
            <LineIcon d={ICON.phone} color={theme.primary} size={18} strokeWidth={2} />
          </Pressable>
        ))}
        <View style={styles.noteBox}>
          <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
            {t({ th: "หมายเหตุ", en: "Note" })}
          </Text>
          <Text style={[TYPE.subhead, { color: c?.notes ? theme.text : theme.textMuted }]}>
            {c?.notes?.trim() || "—"}
          </Text>
        </View>
      </Group>
    </>
  );
}

function Quote({ quote }: { quote: QuoteCard }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const items =
    quote.more > 0
      ? t({
          th: `${quote.first} และอีก ${quote.more} รายการ`,
          en: `${quote.first} and ${quote.more} more`,
        })
      : quote.first;
  return (
    <>
      <Text style={[TYPE.title2, styles.head, { color: theme.text }]} accessibilityRole="header">
        {t({ th: "ใบเสนอราคาที่ยังค้าง", en: "Open quotation" })}
      </Text>
      <View style={[styles.quote, { backgroundColor: theme.surface }]}>
        <View style={styles.line}>
          <Text style={[TYPE.subhead, styles.grow, { color: theme.textMuted }]}>
            {quote.number ?? ""}
          </Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{t(longDate(quote.at))}</Text>
        </View>
        <Text style={[TYPE.title1, styles.money, { color: theme.text }]}>
          {formatBaht(quote.totalSatang)}
        </Text>
        <View style={styles.line}>
          <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]} numberOfLines={1}>
            {items}
          </Text>
          <SmallButton
            label={t({ th: "ทำบิลต่อ", en: "Continue" })}
            onPress={() => router.push(`${posDraftRoute(quote.id)}&from=customer` as never)}
          />
        </View>
      </View>
    </>
  );
}

function History({ page, plate }: { page: CarPage; plate: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const d = page.detail!;
  const cards = visitCards(d.history, d.legacy);
  return (
    <>
      <Text style={[TYPE.title2, styles.head, { color: theme.text }]} accessibilityRole="header">
        {t({ th: "ประวัติการใช้บริการ", en: "Service history" })}
      </Text>
      {cards.length === 0 ? (
        <Text style={[TYPE.subhead, styles.none, { color: theme.textMuted }]}>
          {t({ th: "รถคันนี้ยังไม่มีบิล", en: "No bills for this car yet" })}
        </Text>
      ) : (
        cards.map((c) => (
          <View key={c.key} style={styles.visit}>
            <ItemCard
              items={c.items}
              onPress={
                c.billId
                  ? () =>
                      router.push(
                        `/customers/${encodeURIComponent(plate)}/${encodeURIComponent(c.billId!)}` as never,
                      )
                  : undefined
              }
              head={
                <>
                  <Text style={[TYPE.headline, styles.grow, { color: theme.text }]}>
                    {t(longDate(c.at))}
                  </Text>
                  <Text style={[TYPE.footnote, { color: theme.textMuted }]}>
                    {c.number ?? t({ th: "ประวัติเก่า", en: "Old record" })}
                  </Text>
                </>
              }
            />
          </View>
        ))
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
  province: { fontSize: 22, lineHeight: 29, fontWeight: "600" },
  carCol: { alignItems: "flex-end" },
  right: { textAlign: "right" },
  sectionHead: {
    marginTop: SPACE.xxl,
    marginBottom: SPACE.m,
    marginHorizontal: 2,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  kv: {
    minHeight: 50,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  divider: { borderBottomWidth: 1 },
  noteBox: { paddingHorizontal: SPACE.l, paddingVertical: SPACE.m, gap: 2 },
  quoteButton: { marginTop: SPACE.xxl },
  head: { marginTop: SPACE.xxl, marginBottom: SPACE.m, marginHorizontal: 2 },
  quote: { borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.xs },
  line: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  money: { fontVariant: ["tabular-nums"] },
  none: { marginHorizontal: 2 },
  visit: { marginBottom: SPACE.s },
});
