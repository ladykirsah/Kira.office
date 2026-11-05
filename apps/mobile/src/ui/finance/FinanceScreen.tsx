import { router } from "expo-router";
import { StyleSheet, View } from "react-native";
import { expenseSub, expensesIn, minus, money } from "@/lib/financePage";
import { useLang } from "../AppProviders";
import { DeskCard } from "../desk/DeskCard";
import { useWide } from "../desk/useWide";
import { ICON } from "../orders/icons";
import { Group } from "../orders/parts";
import { Divider } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE } from "../theme";
import { FinanceGraph, graphHasTwoLines } from "./FinanceGraph";
import {
  BASE,
  DeskSummary,
  HeroCards,
  Loading,
  MoneyRow,
  Nothing,
  PeriodMenu,
  SectionTitle,
  usePeriod,
} from "./parts";
import { graphPoints, shopNumbers, useBooks } from "./useFinance";

/**
 * การเงิน (canvas v298, row 1): both shops for the period — รายได้ with its change and กำไร, the
 * graph for the period, one card per shop that opens its own page, and the period's expenses.
 * ＋ adds an expense; only this page has it (owner, 2 Nov: "just the main page is enough").
 */
export function FinanceScreen() {
  const { t } = useLang();
  const period = usePeriod();
  const { books, failed, load } = useBooks(period.range, period.preset);
  const wide = useWide();

  useScreenChrome(
    {
      label: t({ th: "เพิ่มค่าใช้จ่าย", en: "Add an expense" }),
      icon: ICON.plus,
      main: true,
      onPress: () => router.push(`${BASE}/expense/new` as never),
    },
    [],
    // A computer: the numbers beside a wide graph, then the two lists side by side (DeskFinance 1).
    { layout: "full" },
  );

  if (!books) {
    return (
      <View>
        <PeriodMenu period={period} />
        <Loading failed={failed} onRetry={() => void load()} />
      </View>
    );
  }
  const n = shopNumbers(books, period.range, period.preset);
  const graph = graphPoints(books, period.range, null);
  const previous =
    n.den.previous === null || n.air.previous === null ? null : n.den.previous + n.air.previous;
  const expenses = expensesIn(books.expenses, null, period.range);
  const open = (shop: "onsite" | "airplus") =>
    router.push(`${BASE}/${shop}?${period.query}` as never);
  const dots = graphHasTwoLines(period.preset, period.range);
  const den = (
    <MoneyRow
      title="Den Air Service"
      sub={t({ th: `บิล ${n.den.count} ใบ`, en: `${n.den.count} bills` })}
      amount={money(n.den.revenueSatang)}
      under={t({
        th: `กำไร ${money(n.den.netSatang)}`,
        en: `Profit ${money(n.den.netSatang)}`,
      })}
      onPress={() => open("onsite")}
      last
    />
  );
  const air = (
    <MoneyRow
      title="AirPlus"
      sub={t({ th: `ออเดอร์ ${n.air.count} รายการ`, en: `${n.air.count} orders` })}
      amount={money(n.air.revenueSatang)}
      under={t({
        th: `กำไร ${money(n.air.netSatang)}`,
        en: `Profit ${money(n.air.netSatang)}`,
      })}
      onPress={() => open("airplus")}
      last
    />
  );
  const noExpenses = (
    <Nothing text={t({ th: "ไม่มีค่าใช้จ่ายช่วงนี้", en: "No expenses in this period" })} />
  );
  const expenseRows = expenses.map((e, i) => (
    <MoneyRow
      key={e.id}
      title={e.conversion}
      sub={t(expenseSub(e, period.now))}
      amount={minus(e.amountSatang)}
      onPress={() => router.push(`${BASE}/expense/${encodeURIComponent(e.id)}` as never)}
      last={i === expenses.length - 1}
    />
  ));

  if (wide) {
    return (
      <View>
        <PeriodMenu period={period} />
        <DeskSummary
          stats={
            <HeroCards
              revenue={n.den.revenueSatang + n.air.revenueSatang}
              profit={n.den.netSatang + n.air.netSatang}
              previous={previous}
              dots={dots}
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
              height={236}
              bare
            />
          }
        />
        <View style={styles.deskRow}>
          <DeskCard title={t({ th: "แยกตามร้าน", en: "By shop" })} pad={4} flex={1}>
            {den}
            <Divider />
            {air}
          </DeskCard>
          <DeskCard title={t({ th: "ค่าใช้จ่าย", en: "Expenses" })} pad={4} flex={1}>
            {expenses.length === 0 ? <View style={styles.empty}>{noExpenses}</View> : expenseRows}
          </DeskCard>
        </View>
      </View>
    );
  }

  return (
    <View>
      <PeriodMenu period={period} />
      <HeroCards
        revenue={n.den.revenueSatang + n.air.revenueSatang}
        profit={n.den.netSatang + n.air.netSatang}
        previous={previous}
        dots={dots}
      />
      <FinanceGraph
        preset={period.preset}
        range={period.range}
        now={period.now}
        points={graph.points}
        lastMonth={graph.lastMonth}
      />

      <SectionTitle text={t({ th: "แยกตามร้าน", en: "By shop" })} />
      <View style={styles.cards}>
        <Group>{den}</Group>
        <Group>{air}</Group>
      </View>

      <SectionTitle text={t({ th: "ค่าใช้จ่าย", en: "Expenses" })} />
      {expenses.length === 0 ? noExpenses : <Group>{expenseRows}</Group>}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { gap: SPACE.s },
  deskRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.xl, marginTop: SPACE.xl },
  empty: { paddingBottom: SPACE.xl },
});
