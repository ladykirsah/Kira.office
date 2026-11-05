import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  SHOP_NAME,
  billRows,
  billState,
  billSub,
  billTitle,
  byDay,
  expensesIn,
  minus,
  money,
  orderRows,
  orderState,
  orderSub,
  type Bill,
  type LedgerRow,
  type Shop,
} from "@/lib/financePage";
import { useLang, useTheme } from "../AppProviders";
import { useWide } from "../desk/useWide";
import { Group } from "../orders/parts";
import { Line, SearchBox } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { useToast } from "../staff/useTeam";
import { SPACE, TYPE } from "../theme";
import { BillSheets } from "./BillSheets";
import { FinanceGraph, graphHasTwoLines } from "./FinanceGraph";
import { LedgerTable } from "./LedgerTable";
import {
  BASE,
  DayTitle,
  DeskSummary,
  HeroCards,
  Loading,
  MoneyRow,
  Nothing,
  PeriodMenu,
  usePeriod,
} from "./parts";
import { graphPoints, shopNumbers, useBooks } from "./useFinance";

/**
 * One shop's money (canvas v298, rows 2 and 3): the period, รายได้ and กำไร, the graph, ค่าใช้จ่าย,
 * then one list of its money in and money out by day — Den Air Service's bills, or AirPlus's orders
 * where money moved, with that shop's expenses among them. Both shops read the same way.
 */
export function ShopScreen({ shop }: { shop: Shop }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const period = usePeriod();
  const { books, failed, load } = useBooks(period.range, period.preset);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Bill | null>(null);
  const { toast, showToast } = useToast();
  const wide = useWide();

  useScreenChrome(null, [], {
    back: {
      label: t({ th: "การเงิน", en: "Finance" }),
      onPress: () =>
        router.canGoBack() ? router.back() : router.replace(`${BASE}?${period.query}` as never),
    },
    ownTitle: true,
    toast: toast ? { title: t(toast.title), detail: t(toast.detail) } : null,
    // A computer: the numbers and graph in one card, then the list as a table (DeskFinance 3).
    layout: "full",
  });

  const title = (
    <Text style={[TYPE.title1, styles.title, { color: theme.text }]} accessibilityRole="header">
      {SHOP_NAME[shop]}
    </Text>
  );
  if (!books) {
    return (
      <View>
        {wide ? (
          <View style={styles.deskHead}>
            <View style={styles.grow}>{title}</View>
            <PeriodMenu period={period} inline />
          </View>
        ) : (
          <>
            {title}
            <PeriodMenu period={period} />
          </>
        )}
        <Loading failed={failed} onRetry={() => void load()} />
      </View>
    );
  }
  const n = shopNumbers(books, period.range, period.preset);
  const mine = shop === "onsite" ? n.den : n.air;
  const graph = graphPoints(books, period.range, shop);
  const expenses = expensesIn(books.expenses, shop, period.range);
  const rows =
    shop === "onsite"
      ? billRows(books.bills, expenses, query)
      : orderRows(n.air.orders, expenses, query);

  const row = (r: LedgerRow, last: boolean) => {
    if (r.kind === "expense") {
      return (
        <MoneyRow
          key={`e-${r.expense.id}`}
          title={r.expense.conversion}
          sub={t({ th: "ค่าใช้จ่าย", en: "Expense" })}
          amount={minus(r.expense.amountSatang)}
          onPress={() =>
            router.push(`${BASE}/expense/${encodeURIComponent(r.expense.id)}` as never)
          }
          last={last}
        />
      );
    }
    if (r.kind === "bill") {
      const state = billState(r.bill);
      const profit = money(r.bill.grossProfitSatang);
      return (
        <MoneyRow
          key={r.bill.id}
          title={t(billTitle(r.bill))}
          sub={billSub(r.bill)}
          amount={money(r.bill.grandTotalSatang)}
          under={state ? t(state) : t({ th: `กำไร ${profit}`, en: `Profit ${profit}` })}
          dot={state !== null}
          onPress={() => setOpen(r.bill)}
          last={last}
        />
      );
    }
    const o = r.order;
    const state = orderState(o);
    const profit = money(o.profitSatang ?? 0);
    return (
      <MoneyRow
        key={o.id}
        title={o.buyerUsername ?? o.externalOrderId}
        sub={orderSub(o)}
        amount={money(o.salesSatang ?? o.grandTotalSatang)}
        under={state ? t(state) : t({ th: `กำไร ${profit}`, en: `Profit ${profit}` })}
        dot={state !== null}
        onPress={() => router.push(`/orders/${encodeURIComponent(o.id)}` as never)}
        last={last}
      />
    );
  };

  const searchBox = (
    <SearchBox
      value={query}
      onChange={setQuery}
      placeholder={
        shop === "onsite"
          ? t({
              th: "ทะเบียน เลขบิล รายการ หรือยอดเงิน",
              en: "Plate, bill no., item or amount",
            })
          : t({
              th: "เลขคำสั่งซื้อ ลูกค้า รายการ หรือยอดเงิน",
              en: "Order no., customer, item or amount",
            })
      }
    />
  );
  const nothing = (
    <Nothing
      text={
        query.trim()
          ? t({ th: `ไม่พบ “${query.trim()}”`, en: `No match for “${query.trim()}”` })
          : shop === "onsite"
            ? t({
                th: "ไม่มีบิลหรือค่าใช้จ่ายช่วงนี้",
                en: "No bills or expenses in this period",
              })
            : t({
                th: "ไม่มีออเดอร์หรือค่าใช้จ่ายช่วงนี้",
                en: "No orders or expenses in this period",
              })
      }
    />
  );
  const sheets = open && (
    <BillSheets
      bill={open}
      onClose={() => setOpen(null)}
      onRefunded={() => {
        setOpen(null);
        void load();
      }}
      onFailed={(reason) => {
        setOpen(null);
        showToast(
          { th: "คืนเงินไม่สำเร็จ", en: "Refund failed" },
          reason ? { th: reason, en: reason } : { th: "ลองอีกครั้ง", en: "Try again" },
        );
      }}
    />
  );
  // What a row opens, the same as the phone's rows: an expense's page, the bill, the order.
  const openRow = (r: LedgerRow) => {
    if (r.kind === "expense") {
      return router.push(`${BASE}/expense/${encodeURIComponent(r.expense.id)}` as never);
    }
    if (r.kind === "bill") return setOpen(r.bill);
    return router.push(`/orders/${encodeURIComponent(r.order.id)}` as never);
  };

  if (wide) {
    return (
      <View>
        <View style={styles.deskHead}>
          <View style={styles.grow}>{title}</View>
          <PeriodMenu period={period} inline />
        </View>
        <DeskSummary
          stats={
            <HeroCards
              revenue={mine.revenueSatang}
              profit={mine.netSatang}
              previous={mine.previous}
              dots={graphHasTwoLines(period.preset, period.range)}
              expense={mine.expenseSatang}
              stacked
            />
          }
          graph={
            <FinanceGraph
              preset={period.preset}
              range={period.range}
              now={period.now}
              points={graph.points}
              lastMonth={graph.lastMonth}
              bare
            />
          }
        />
        <View style={[styles.after, styles.deskSearch]}>{searchBox}</View>
        {rows.length === 0 ? (
          nothing
        ) : (
          <View style={styles.after}>
            <LedgerTable days={byDay(rows, (r) => r.at, period.now)} onOpen={openRow} />
          </View>
        )}
        {sheets}
      </View>
    );
  }

  return (
    <View>
      {title}
      <PeriodMenu period={period} />
      <HeroCards
        revenue={mine.revenueSatang}
        profit={mine.netSatang}
        previous={mine.previous}
        dots={graphHasTwoLines(period.preset, period.range)}
      />
      <FinanceGraph
        preset={period.preset}
        range={period.range}
        now={period.now}
        points={graph.points}
        lastMonth={graph.lastMonth}
      />

      <View style={styles.after}>
        <Group>
          <Line
            label={t({ th: "ค่าใช้จ่าย", en: "Expenses" })}
            right={
              <Text style={[TYPE.body, styles.amount, { color: theme.text }]}>
                {minus(mine.expenseSatang)}
              </Text>
            }
            last
          />
        </Group>
      </View>

      <View style={styles.after}>{searchBox}</View>

      {rows.length === 0
        ? nothing
        : byDay(rows, (r) => r.at, period.now).map((day) => (
            <View key={day.day}>
              <DayTitle text={t(day.title)} />
              <Group>{day.rows.map((r, i) => row(r, i === day.rows.length - 1))}</Group>
            </View>
          ))}

      {sheets}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: SPACE.xs, marginHorizontal: 2 },
  deskHead: { flexDirection: "row", alignItems: "center", gap: SPACE.m },
  grow: { flex: 1, minWidth: 0 },
  deskSearch: { maxWidth: 380 },
  after: { marginTop: SPACE.m },
  amount: { fontVariant: ["tabular-nums"] },
});
