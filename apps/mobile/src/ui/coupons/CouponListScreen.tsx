import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { FILTERS, filterCounts, inFilter, type Coupon, type CouponFilter } from "@/lib/couponPage";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { CountTabs } from "../orders/StatusTabs";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { CouponCard } from "./parts";
import { useCouponList } from "./useCouponList";

const BASE = "/settings/coupons";

const isFilter = (v: unknown): v is CouponFilter => FILTERS.some((f) => f.key === v);

/**
 * คูปอง (canvas v252, คูปอง 1): ทั้งหมด · เปิดอยู่ · ปิดอยู่ · หมดอายุ with their counts, then each
 * coupon as a ticket — its value, name, code and condition, and how it stands. ＋ adds; a coupon opens
 * its own page.
 */
export function CouponListScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const params = useLocalSearchParams<{ show?: string }>();
  // The chosen filter lives in the address, so coming back from a coupon keeps it.
  const filter: CouponFilter = isFilter(params.show) ? params.show : "all";
  const list = useCouponList();
  const wide = useWide();

  useScreenChrome(
    {
      label: t({ th: "เพิ่มคูปอง", en: "Add a coupon" }),
      icon: ICON.plus,
      main: true,
      onPress: () => router.push(`${BASE}/new` as never),
    },
    [],
    {
      toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null,
      // A computer lays the tickets three to a row across the full width (DeskCoupons board).
      layout: "full",
    },
  );

  if (!list.coupons) {
    return list.failed ? (
      <Retry onPress={() => void list.load()} />
    ) : (
      <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
    );
  }
  if (list.coupons.length === 0) {
    return (
      <Text style={[TYPE.title2, styles.empty, { color: theme.text }]}>
        {t({ th: "ยังไม่มีคูปอง", en: "No coupons yet" })}
      </Text>
    );
  }
  const now = Date.now();
  const shown = list.coupons.filter((c) => inFilter(c, filter, now));
  const label = FILTERS.find((f) => f.key === filter)!.label;
  return (
    <View>
      {list.failed && <Retry onPress={() => void list.load()} />}
      <CountTabs
        tabs={FILTERS}
        value={filter}
        counts={filterCounts(list.coupons, now)}
        onPick={(show) => router.setParams({ show })}
      />
      {shown.length === 0 ? (
        <Text style={[TYPE.subhead, styles.none, { color: theme.textMuted }]}>
          {t({ th: `ไม่มีคูปอง${label.th}`, en: `No ${label.en.toLowerCase()} coupons` })}
        </Text>
      ) : wide ? (
        <WideGrid coupons={shown} />
      ) : (
        <View style={styles.list}>
          {shown.map((c) => (
            <CouponCard key={c.id} coupon={c} onPress={() => open(c)} />
          ))}
        </View>
      )}
    </View>
  );
}

const open = (c: Coupon) => router.push(`${BASE}/${encodeURIComponent(c.id)}` as never);

/** Tickets per row on a computer (DeskCoupons board). */
const PER_ROW = 3;

/** The same tickets, three to a row; a short last row keeps each ticket a third wide. */
function WideGrid({ coupons }: { coupons: readonly Coupon[] }) {
  const rows = coupons
    .filter((_, i) => i % PER_ROW === 0)
    .map((_, r) => coupons.slice(r * PER_ROW, r * PER_ROW + PER_ROW));
  return (
    <View style={[styles.list, styles.grid]}>
      {rows.map((row) => (
        <View key={row[0]!.id} style={styles.gridRow}>
          {Array.from({ length: PER_ROW }, (_, i) => row[i]).map((c, i) => (
            <View key={c?.id ?? `gap${i}`} style={styles.cell}>
              {c && <CouponCard coupon={c} onPress={() => open(c)} fill />}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: SPACE.l },
  gridRow: { flexDirection: "row", alignItems: "stretch", gap: SPACE.l },
  cell: { flex: 1, minWidth: 0 },
  empty: { textAlign: "center", paddingVertical: 96, paddingHorizontal: SPACE.m },
  list: { marginTop: SPACE.l, gap: SPACE.m },
  none: { textAlign: "center", marginTop: SPACE.xxxl },
});
