import type { Phrase } from "@l-shopee/shared/lang";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import {
  DATE_PRESETS,
  DEFAULT_VIEW,
  PAY_FILTERS,
  SORTS,
  clockTime,
  listSections,
  placedAt,
  rangeLabel,
  searchOrders,
  shortDate,
  tabCounts,
  viewOrders,
  type OrderListRow,
  type OrderView,
} from "@/lib/orderList";
import { fetchOrders } from "@/lib/ordersApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { useScreenChrome } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE, type Theme } from "../theme";
import { ICON } from "./icons";
import { MenuButton } from "./MenuButton";
import { OrderRowItem } from "./OrderRowItem";
import { RangeSheet } from "./RangeSheet";
import { StatusTabs } from "./StatusTabs";

type Load =
  | { status: "loading" }
  | { status: "failed"; message: string }
  | { status: "ready"; orders: OrderListRow[]; at: number };

/**
 * AirPlus orders on a phone (owner picked choice B, 2026-10-29): status tabs with their counts, then
 * date, payment and sort buttons, each opening a short menu, and search that takes the tab bar's
 * place. Opens on every date, so an open job from last week stays in sight.
 */
export function OrdersScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLang();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [view, setView] = useState<OrderView>(DEFAULT_VIEW);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const token = auth.status === "signed-in" ? auth.token : null;
  const s = styles(theme);

  const reload = useCallback(() => {
    if (!token) return;
    fetchOrders(fetch, API_BASE, token)
      .then((orders) => setLoad({ status: "ready", orders, at: Date.now() }))
      .catch((e: unknown) =>
        setLoad({ status: "failed", message: e instanceof Error ? e.message : String(e) }),
      );
  }, [token]);

  // Coming back from an order's page shows what was just done there.
  useFocusEffect(reload);

  const stopSearch = () => {
    setSearching(false);
    setQuery("");
  };

  useScreenChrome(
    searching
      ? null
      : [
          {
            label: t({ th: "ทำบิลใหม่", en: "New bill" }),
            icon: ICON.plus,
            onPress: () => router.push("/pos" as never),
          },
          {
            label: t({ th: "ค้นหา", en: "Search" }),
            icon: ICON.search,
            onPress: () => setSearching(true),
          },
        ],
    [],
    {
      title: t({ th: "ออเดอร์", en: "Orders" }),
      search: searching
        ? {
            value: query,
            placeholder: t({ th: "เลขออเดอร์ หรือชื่อลูกค้า", en: "Order number or name" }),
            onChange: setQuery,
            onClose: stopSearch,
          }
        : null,
    },
  );

  const open = (o: OrderListRow) => router.push(`/orders/${encodeURIComponent(o.id)}` as never);

  if (load.status === "loading") {
    return <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />;
  }
  if (load.status === "failed") {
    return (
      <View style={[s.card, s.padded]}>
        <Text style={[s.body, { color: theme.text }]}>
          {t({ th: "โหลดออเดอร์ไม่สำเร็จ", en: "Could not load orders" })}
        </Text>
        <Text style={[s.sub, { color: theme.textMuted }]}>{load.message}</Text>
        <Pressable onPress={reload} accessibilityRole="button">
          <Text style={[s.body, { color: theme.primary }]}>
            {t({ th: "ลองอีกครั้ง", en: "Try again" })}
          </Text>
        </Pressable>
      </View>
    );
  }

  const { orders, at: now } = load;
  if (searching) {
    return <SearchResults orders={orders} query={query} now={now} onOpen={open} />;
  }

  const counts = tabCounts(orders, view, now);
  const shown = viewOrders(orders, view, now);
  const total = orders.filter((o) => o.channel === "airplus").length;
  const today = new Date(now).toDateString();
  // Grouped by day, a row shows its time; grouped by status or payment, its date unless it is today.
  const when = (o: OrderListRow) => {
    const ms = placedAt(o);
    const byDay = view.sort === "newest" || view.sort === "oldest";
    return byDay || new Date(ms).toDateString() === today ? clockTime(ms) : t(shortDate(ms));
  };
  const dateLabel =
    view.date === "custom" && view.custom
      ? t(rangeLabel(view.custom))
      : t(DATE_PRESETS.find((d) => d.key === view.date)?.label ?? DATE_PRESETS[0]!.label);
  const payLabel =
    view.pay === "all"
      ? t({ th: "ชำระเงิน", en: "Payment" })
      : t(PAY_FILTERS.find((p) => p.key === view.pay)?.label ?? PAY_FILTERS[0]!.label);
  const sortLabel = t(SORTS.find((x) => x.key === view.sort)?.label ?? SORTS[0]!.label);
  const narrowed = view.tab !== "all" || view.date !== "all" || view.pay !== "all";

  return (
    <View>
      <Text style={[s.sub, { color: theme.textMuted, marginTop: -SPACE.s, paddingHorizontal: 2 }]}>
        {t({ th: `ออเดอร์ AirPlus ทั้งหมด ${total} รายการ`, en: `${total} AirPlus orders in all` })}
      </Text>

      <StatusTabs
        value={view.tab}
        counts={counts}
        onPick={(tab) => setView((v) => ({ ...v, tab }))}
      />

      <View style={s.menus}>
        <MenuButton
          name={t({ th: "ช่วงวันที่", en: "Dates" })}
          label={dateLabel}
          on={view.date !== "all"}
          options={DATE_PRESETS}
          value={view.date}
          onPick={(date) =>
            date === "custom" ? setRangeOpen(true) : setView((v) => ({ ...v, date, custom: null }))
          }
        />
        <MenuButton
          name={t({ th: "การชำระเงิน", en: "Payment" })}
          label={payLabel}
          on={view.pay !== "all"}
          options={PAY_FILTERS}
          value={view.pay}
          onPick={(pay) => setView((v) => ({ ...v, pay }))}
        />
        <MenuButton
          name={t({ th: "เรียงตาม", en: "Sort by" })}
          label={sortLabel}
          on={false}
          options={SORTS}
          value={view.sort}
          onPick={(sort) => setView((v) => ({ ...v, sort }))}
        />
      </View>

      {shown.length === 0 ? (
        <Empty
          title={
            total === 0
              ? { th: "ยังไม่มีออเดอร์ AirPlus", en: "No AirPlus orders yet" }
              : { th: "ไม่มีออเดอร์ที่ตรงกับที่เลือก", en: "No orders match" }
          }
          detail={null}
          action={
            narrowed && total > 0
              ? {
                  label: { th: "ดูออเดอร์ทั้งหมด", en: "Show all orders" },
                  onPress: () => setView((v) => ({ ...DEFAULT_VIEW, sort: v.sort })),
                }
              : null
          }
        />
      ) : (
        listSections(shown, view.sort, now).map((section) => (
          <View key={section.title.en}>
            <Text style={[s.heading, { color: theme.text }]} accessibilityRole="header">
              {t(section.title)}
            </Text>
            {section.rows.map((o, i) => (
              <OrderRowItem
                key={o.id}
                order={o}
                when={when(o)}
                first={i === 0}
                last={i === section.rows.length - 1}
                onPress={() => open(o)}
              />
            ))}
          </View>
        ))
      )}

      {rangeOpen && (
        <RangeSheet
          range={view.custom}
          now={now}
          onApply={(custom) => {
            setView((v) => ({ ...v, date: "custom", custom }));
            setRangeOpen(false);
          }}
          onClose={() => setRangeOpen(false)}
        />
      )}
    </View>
  );
}

function Empty(props: {
  title: Phrase;
  detail: Phrase | null;
  action: { label: Phrase; onPress: () => void } | null;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const s = styles(theme);
  return (
    <View style={s.empty}>
      <LineIcon d={ICON.receipt} color={theme.textMuted} size={48} strokeWidth={1.6} />
      <Text style={[s.emptyTitle, { color: theme.text }]}>{t(props.title)}</Text>
      {props.detail && (
        <Text style={[s.sub, { color: theme.textMuted, textAlign: "center" }]}>
          {t(props.detail)}
        </Text>
      )}
      {props.action && (
        <Pressable onPress={props.action.onPress} accessibilityRole="button" hitSlop={8}>
          <Text style={[s.body, { color: theme.primary }]}>{t(props.action.label)}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Search answers over every date: every order that matches, in one list, or why none (owner, 29 Oct). */
function SearchResults(props: {
  orders: OrderListRow[];
  query: string;
  now: number;
  onOpen: (o: OrderListRow) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const s = styles(theme);
  const q = props.query.trim();
  if (!q) {
    return (
      <Text style={[s.sub, { color: theme.textMuted, marginTop: SPACE.s }]}>
        {t({
          th: "พิมพ์เลขออเดอร์ หรือชื่อลูกค้า ค้นได้ทุกช่วงวันที่",
          en: "Type an order number or a name — every date is searched",
        })}
      </Text>
    );
  }
  const found = searchOrders(props.orders, q);
  if (found.length === 0) {
    return (
      <View style={[s.empty, { marginTop: 120 }]}>
        <LineIcon d={ICON.search} color={theme.textMuted} size={52} strokeWidth={1.6} />
        <Text style={[s.emptyTitle, { color: theme.text }]}>
          {t({ th: `ไม่พบผลลัพธ์สำหรับ "${q}"`, en: `No results for "${q}"` })}
        </Text>
        <Text style={[s.sub, { color: theme.textMuted }]}>
          {t({ th: "ลองค้นด้วยเลขออเดอร์ หรือชื่อลูกค้า", en: "Try an order number or a name" })}
        </Text>
      </View>
    );
  }
  const when = (o: OrderListRow) => {
    const ms = placedAt(o);
    return props.now - ms < 24 * 60 * 60 * 1000 ? clockTime(ms) : t(shortDate(ms));
  };
  return (
    <View>
      <Text style={[s.heading, { color: theme.text, marginTop: 0 }]} accessibilityRole="header">
        {t({ th: `พบ ${found.length} ออเดอร์`, en: `${found.length} orders found` })}
      </Text>
      {found.map((o, i) => (
        <OrderRowItem
          key={o.id}
          order={o}
          when={when(o)}
          first={i === 0}
          last={i === found.length - 1}
          onPress={() => props.onOpen(o)}
        />
      ))}
    </View>
  );
}

const styles = (c: Theme) =>
  StyleSheet.create({
    card: { borderRadius: RADIUS.card, backgroundColor: c.surface },
    padded: { padding: SPACE.l, gap: SPACE.xs },
    body: { ...TYPE.body },
    sub: { ...TYPE.subhead },
    menus: { marginTop: SPACE.m, flexDirection: "row", flexWrap: "wrap", gap: SPACE.s },
    heading: { ...TYPE.title2, marginTop: 26, marginBottom: SPACE.m },
    empty: { marginTop: 72, alignItems: "center", gap: SPACE.s, paddingHorizontal: SPACE.xl },
    emptyTitle: { ...TYPE.title2, fontSize: 20, textAlign: "center", marginTop: SPACE.xs },
  });
