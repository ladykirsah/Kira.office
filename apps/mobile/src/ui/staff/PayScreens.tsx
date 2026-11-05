import type { Phrase } from "@l-shopee/shared/lang";
import { daysInMonth } from "@l-shopee/core";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import {
  daysWord,
  historyLine,
  monthLabel,
  paymentLines,
  recordHead,
  roleWord,
  shownName,
  slipGoneNote,
  slipNote,
  slipState,
  yearSummary,
} from "@/lib/staffPage";
import { slipPath } from "@/lib/teamApi";
import { useLang, useTheme } from "../AppProviders";
import { Retry } from "../affiliate/parts";
import { MenuButton } from "../orders/MenuButton";
import { Group } from "../orders/parts";
import { Divider, Heading } from "../products/parts";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { Chevron, GoneCard, Hint, SlipCard, ValueRow } from "./parts";
import { PaySheet } from "./PaySheet";
import { BASE } from "./Tabs";
import { usePayments, useSalary } from "./useStaffData";
import { owners, useTeam, useToast, type TeamMember } from "./useTeam";

function Loading({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  const { theme } = useTheme();
  return failed ? (
    <Retry onPress={onRetry} />
  ) : (
    <ActivityIndicator color={theme.textMuted} style={{ marginTop: SPACE.xxxl }} />
  );
}

function Title(props: { title: string; sub: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.titles}>
      <Text style={[TYPE.title1, { color: theme.text }]} accessibilityRole="header">
        {props.title}
      </Text>
      {props.sub ? (
        <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{props.sub}</Text>
      ) : null}
    </View>
  );
}

const back = (to: string) => () =>
  router.canGoBack() ? router.back() : router.replace(to as never);

/**
 * One person's เงินเดือน (canvas v292, 5.1 – 5.3): the year's total, what was paid and what is left,
 * then every month — the day it was paid, or ที่ต้องจ่าย, which opens the same pay sheet as 2.5.
 */
export function PayHistoryScreen() {
  const { id = "" } = useLocalSearchParams<{ id: string }>();
  const team = useTeam();
  const person = team.people?.find((p) => p.id === id) ?? null;
  const home = `${BASE}/${encodeURIComponent(id)}`;
  return (
    <PayHistory
      id={id}
      person={person}
      back={{ label: person ? shownName(person) : "", to: home }}
      monthRoute={(period) => `${home}/pay/${period}`}
      payWith={team}
    />
  );
}

/** Who may pay from the history page — พนักงาน; your own (โปรไฟล์ของฉัน) has no pay button. */
interface Payer {
  people: readonly TeamMember[] | null;
  me: string;
  token: string;
}

/** A person's pay history: พนักงาน's, or your own read only from โปรไฟล์ของฉัน (payWith left out). */
export function PayHistory(props: {
  id: string;
  person: TeamMember | null;
  back: { label: string; to: string };
  monthRoute: (period: string) => string;
  payWith?: Payer;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id, person, payWith } = props;
  const { toast, showToast } = useToast();
  const [stamp, setStamp] = useState(0);
  const pay = usePayments(id, stamp);
  const [year, setYear] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const name = person ? shownName(person) : "";

  useScreenChrome(null, [], {
    back: { label: props.back.label, onPress: back(props.back.to) },
    ownTitle: true,
    toast: toast ? { title: t(toast.title), detail: t(toast.detail) } : null,
  });

  const sub = person
    ? `${name} · ${t(roleWord(person.role))}${
        person.dayRateSatang == null
          ? ""
          : ` · ${formatBaht(person.dayRateSatang)} ${t({ th: "ต่อวัน", en: "a day" })}`
      }`
    : "";
  const months = pay.months;
  const years = [...new Set((months ?? []).map((m) => m.period.slice(0, 4)))];
  const shownYear = year ?? years[0] ?? null;
  const inYear = (months ?? []).filter((m) => m.period.startsWith(shownYear ?? ""));
  const sum = yearSummary(inYear);
  const yearWord = (y: string): Phrase => ({ th: `ปี ${Number(y) + 543}`, en: y });

  return (
    <View>
      <Title title={t({ th: "เงินเดือน", en: "Salary" })} sub={sub} />
      {!months ? (
        <Loading failed={pay.failed} onRetry={() => void pay.load()} />
      ) : (
        <>
          {shownYear && (
            <View style={styles.menu}>
              <MenuButton
                name={t({ th: "ปี", en: "Year" })}
                label={t(yearWord(shownYear))}
                on={false}
                options={years.map((y) => ({ key: y, label: yearWord(y) }))}
                value={shownYear}
                onPick={setYear}
              />
            </View>
          )}
          <View style={styles.after}>
            <Group>
              <ValueRow label={t({ th: "รวมทั้งปี", en: "Year total" })} value={sum.total} />
              <ValueRow label={t({ th: "จ่ายแล้ว", en: "Paid" })} value={sum.paid} />
              <ValueRow label={t({ th: "ที่ต้องจ่าย", en: "To pay" })} value={sum.due} last />
            </Group>
          </View>
          <View style={styles.after}>
            <Group>
              {inYear.map((m, i) => {
                const line = historyLine(m);
                const paid = m.paidAt != null;
                const opens = paid || payWith != null;
                const body = (
                  <>
                    <View style={styles.grow}>
                      <Text style={[TYPE.body, { color: theme.text }]}>
                        {t(monthLabel(m.period))}
                      </Text>
                      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(line.sub)}</Text>
                    </View>
                    <Text style={[TYPE.body, styles.amount, { color: theme.text }]}>
                      {line.amount}
                    </Text>
                    {opens && <Chevron />}
                  </>
                );
                return (
                  <View key={m.period}>
                    {opens ? (
                      <Pressable
                        onPress={() =>
                          paid
                            ? router.push(props.monthRoute(m.period) as never)
                            : setPaying(m.period)
                        }
                        accessibilityRole="button"
                        style={styles.month}
                      >
                        {body}
                      </Pressable>
                    ) : (
                      <View style={styles.month}>{body}</View>
                    )}
                    {i < inYear.length - 1 && <Divider />}
                  </View>
                );
              })}
            </Group>
          </View>
        </>
      )}
      {paying && person && payWith && (
        <PayFromHistory
          person={person}
          people={payWith.people ?? []}
          me={payWith.me}
          token={payWith.token}
          period={paying}
          onClose={() => setPaying(null)}
          onPaid={(said) => {
            setPaying(null);
            showToast(said);
            setStamp((n) => n + 1);
          }}
        />
      )}
    </View>
  );
}

/** The pay sheet for a month picked on the history page: its salary row first, then the sheet. */
function PayFromHistory(props: {
  person: TeamMember;
  people: readonly TeamMember[];
  me: string;
  token: string;
  period: string;
  onClose: () => void;
  onPaid: (said: Phrase) => void;
}) {
  const salary = useSalary(props.period);
  const row = salary.rows?.find((r) => r.userId === props.person.id);
  if (!row) return null;
  const payers = owners(props.people).map((p) => ({ id: p.id, name: shownName(p) }));
  return (
    <PaySheet
      row={row}
      period={props.period}
      token={props.token}
      payers={payers}
      defaultPayer={payers.some((p) => p.id === props.me) ? props.me : (payers[0]?.id ?? "")}
      onClose={props.onClose}
      onPaid={props.onPaid}
    />
  );
}

/**
 * One month's payslip (canvas v292, 5.4 – 5.7): what it came to and how — the day rate, the days —
 * then each payment and its slip. A wage slip is kept three months and then deleted; the payslip
 * stays and the card says so.
 */
export function PayRecordScreen() {
  const { id = "", period = "" } = useLocalSearchParams<{ id: string; period: string }>();
  const team = useTeam();
  const person = team.people?.find((p) => p.id === id) ?? null;
  return (
    <PayRecord
      id={id}
      period={period}
      person={person}
      backTo={`${BASE}/${encodeURIComponent(id)}/pay`}
    />
  );
}

/** One month's payslip: พนักงาน's, or your own from โปรไฟล์ของฉัน — read only either way. */
export function PayRecord(props: {
  id: string;
  period: string;
  person: TeamMember | null;
  backTo: string;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const { id, period, person } = props;
  const pay = usePayments(id);
  const name = person ? shownName(person) : "";
  const m = pay.months?.find((x) => x.period === period) ?? null;

  useScreenChrome(null, [], {
    back: { label: t({ th: "เงินเดือน", en: "Salary" }), onPress: back(props.backTo) },
    ownTitle: true,
  });

  const now = Date.now();
  const lines = m ? paymentLines(m) : [];
  const slipLines = lines.filter((l) => l.slip);
  const wage = m ? slipState(m, now) : "none";
  return (
    <View>
      <Title
        title={t(monthLabel(period))}
        sub={person ? `${name} · ${t(roleWord(person.role))}` : ""}
      />
      {!m ? (
        <Loading failed={pay.failed} onRetry={() => void pay.load()} />
      ) : (
        <>
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.surface,
                borderWidth: theme.cardLine,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.big, { color: theme.text }]}>{formatBaht(m.earnedSatang)}</Text>
            <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(recordHead(m))}</Text>
          </View>

          <Heading text={t({ th: "คิดจาก", en: "Worked out from" })} />
          <Group>
            <ValueRow
              label={t({ th: "ค่าแรงต่อวัน", en: "Day rate" })}
              value={formatBaht(m.dayRateSatang)}
            />
            <ValueRow
              label={t({ th: "วันในเดือน", en: "Days in month" })}
              value={t(daysWord(daysInMonth(period) * 2))}
            />
            <ValueRow
              label={t({ th: "วันหยุด", en: "Days off" })}
              value={t(daysWord(m.offHalves))}
            />
            <ValueRow
              label={t({ th: "ทำงาน", en: "Worked" })}
              value={t(daysWord(m.workingHalves))}
              last
            />
          </Group>

          {lines.length > 0 && (
            <>
              <Heading text={t({ th: "การจ่าย", en: "Payments" })} />
              <Group>
                {lines.map((l, i) => (
                  <View key={l.key}>
                    <View style={styles.month}>
                      <View style={styles.grow}>
                        <Text style={[TYPE.body, { color: theme.text }]}>{t(l.when)}</Text>
                        <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{t(l.how)}</Text>
                      </View>
                      <Text style={[TYPE.body, styles.amount, { color: theme.text }]}>
                        {l.amount}
                      </Text>
                    </View>
                    {i < lines.length - 1 && <Divider />}
                  </View>
                ))}
              </Group>
            </>
          )}

          {slipLines.map((l) => (
            <View key={`slip-${l.key}`} style={styles.after}>
              <SlipCard
                path={slipPath(l.slip!, id)}
                title={slipLines.length > 1 ? t(l.how) : undefined}
                fileName={`slip-${name}-${period}-${l.key}.jpg`}
              />
              {l.slip!.kind === "salary" && <Hint text={t(slipNote(m))} />}
            </View>
          ))}
          {wage === "gone" && (
            <View style={styles.after}>
              <GoneCard note={slipGoneNote(m)} />
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  titles: { marginTop: SPACE.xs, gap: 2 },
  menu: { marginTop: SPACE.l, flexDirection: "row" },
  after: { marginTop: SPACE.m },
  grow: { flex: 1, minWidth: 0 },
  month: {
    minHeight: 56,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.s,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  amount: { fontVariant: ["tabular-nums"] },
  card: { marginTop: SPACE.l, borderRadius: 14, padding: SPACE.l, gap: 2 },
  big: { fontSize: 34, lineHeight: 42, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
