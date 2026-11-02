import type { Phrase } from "@l-shopee/shared/lang";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import {
  advancePick,
  monthLabel,
  roleWord,
  salaryLine,
  shownName,
  teamOrder,
  thisMonth,
  type PayRow,
} from "@/lib/staffPage";
import type { DayOff } from "@/lib/teamApi";
import { useLang } from "../AppProviders";
import { ICON } from "../orders/icons";
import { useScreenChrome, type Anchor } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { SPACE } from "../theme";
import { AdvanceSheet } from "./AdvanceSheet";
import { DayOffSheet } from "./DayOffSheet";
import { PaySheet } from "./PaySheet";
import { PickPersonSheet } from "./PickSheets";
import { PlusMenu, type PlusChoice } from "./PlusMenu";
import { BASE, DaysOffTab, HistoryTab, PeopleTab, SalaryTab } from "./Tabs";
import { useSalary } from "./useStaffData";
import { onPayroll, owners, useTeam, useToast, type TeamMember } from "./useTeam";

type Tab = "people" | "pay" | "off" | "history";
const TABS: readonly { value: Tab; label: Phrase }[] = [
  { value: "people", label: { th: "คน", en: "People" } },
  { value: "pay", label: { th: "เงินเดือน", en: "Salary" } },
  { value: "off", label: { th: "วันหยุด", en: "Days off" } },
  { value: "history", label: { th: "ประวัติ", en: "History" } },
];
const isTab = (v: unknown): v is Tab => TABS.some((x) => x.value === v);

type Flow =
  | { kind: "pickDayOff" }
  | { kind: "dayOff"; start: { person: TeamMember } | { edit: DayOff; person: TeamMember | null } }
  | { kind: "pickPay" }
  | { kind: "pay"; row: PayRow; period: string }
  | { kind: "pickAdvance" }
  | { kind: "advance"; person: { id: string; name: string }; repick: boolean };

/**
 * พนักงาน (canvas v292): คน · เงินเดือน · วันหยุด · ประวัติ, the tab kept in the address. ＋ opens
 * เพิ่มคน and the three records on every tab; each record is a sheet over the page it was opened on.
 */
export function StaffScreen() {
  const { t } = useLang();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ tab?: string; added?: string }>();
  const tab: Tab = isTab(params.tab) ? params.tab : "people";
  const team = useTeam();
  const { toast, showToast } = useToast();
  const [menuAt, setMenuAt] = useState<Anchor | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [month, setMonth] = useState(thisMonth(Date.now()));
  const [person, setPerson] = useState<string | null>(null);
  const [stamp, setStamp] = useState(0);

  useScreenChrome(
    {
      label: t({ th: "เพิ่ม", en: "Add" }),
      icon: ICON.plus,
      onPress: (at) => setMenuAt(at ?? { x: width - 112, y: 48, width: 44, height: 44 }),
    },
    [],
    { toast: toast ? { title: t(toast.title), detail: t(toast.detail) } : null },
  );

  // Back from เพิ่มคน: the list says who was added, once (canvas 1.5).
  useEffect(() => {
    if (!params.added) return;
    showToast({ th: `เพิ่ม ${params.added} แล้ว`, en: `Added ${params.added}` });
    router.setParams({ added: undefined });
  }, [params.added, showToast]);

  const people = teamOrder(team.people ?? []);
  const payroll = onPayroll(people);
  const payers = owners(people).map((p) => ({ id: p.id, name: shownName(p) }));
  const defaultPayer = payers.some((p) => p.id === team.me) ? team.me : (payers[0]?.id ?? "");
  const done = (said: Phrase) => {
    setFlow(null);
    showToast(said);
    setStamp((n) => n + 1);
    void team.load();
  };
  const pick = (choice: PlusChoice) => {
    if (choice === "add") return router.push(`${BASE}/new` as never);
    setFlow({
      kind: choice === "dayOff" ? "pickDayOff" : choice === "salary" ? "pickPay" : "pickAdvance",
    });
  };
  const openDayOff = (d: DayOff) =>
    setFlow({
      kind: "dayOff",
      start: { edit: d, person: people.find((p) => p.id === d.userId) ?? null },
    });

  return (
    <View>
      <View style={styles.tabs}>
        <Segmented
          label={t({ th: "พนักงาน", en: "Staff" })}
          options={TABS.map((x) => ({ value: x.value, label: t(x.label) }))}
          value={tab}
          onChange={(next) => router.setParams({ tab: next })}
        />
      </View>
      {tab === "people" && (
        <PeopleTab people={team.people} failed={team.failed} onRetry={() => void team.load()} />
      )}
      {tab === "pay" && (
        <SalaryTab
          month={month}
          onMonth={setMonth}
          stamp={stamp}
          onPay={(row) => setFlow({ kind: "pay", row, period: month })}
        />
      )}
      {tab === "off" && (
        <DaysOffTab month={month} onMonth={setMonth} stamp={stamp} onOpen={openDayOff} />
      )}
      {tab === "history" && (
        <HistoryTab
          people={team.people}
          person={person}
          onPerson={setPerson}
          month={month}
          onMonth={setMonth}
          stamp={stamp}
        />
      )}

      <PlusMenu at={menuAt} onClose={() => setMenuAt(null)} onPick={pick} />

      {flow?.kind === "pickDayOff" && (
        <PickPersonSheet
          title={t({ th: "บันทึกวันหยุด", en: "Record a day off" })}
          heading={t({ th: "เลือกคน", en: "Choose a person" })}
          rows={payroll.map((p) => ({ id: p.id, name: shownName(p), sub: t(roleWord(p.role)) }))}
          onPick={(id) => {
            const p = payroll.find((x) => x.id === id);
            if (p) setFlow({ kind: "dayOff", start: { person: p } });
          }}
          onClose={() => setFlow(null)}
        />
      )}
      {flow?.kind === "dayOff" && (
        <DayOffSheet
          start={flow.start}
          people={payroll}
          token={team.token}
          onClose={() => setFlow(null)}
          onDone={done}
        />
      )}
      {flow?.kind === "pickPay" && (
        <PayPick
          onPick={(row, period) => setFlow({ kind: "pay", row, period })}
          onClose={() => setFlow(null)}
        />
      )}
      {flow?.kind === "pay" && (
        <PaySheet
          row={flow.row}
          period={flow.period}
          token={team.token}
          payers={payers}
          defaultPayer={defaultPayer}
          onClose={() => setFlow(null)}
          onPaid={done}
        />
      )}
      {flow?.kind === "pickAdvance" && (
        <AdvancePick
          onPick={(p) => setFlow({ kind: "advance", person: p, repick: false })}
          onClose={() => setFlow(null)}
        />
      )}
      {flow?.kind === "advance" && (
        <>
          <AdvanceSheet
            key={flow.person.id}
            person={flow.person}
            token={team.token}
            payers={payers}
            defaultPayer={defaultPayer}
            onPerson={() => setFlow({ ...flow, repick: true })}
            onClose={() => setFlow(null)}
            onDone={done}
          />
          {flow.repick && (
            <AdvancePick
              chosen={flow.person.id}
              onPick={(p) => setFlow({ kind: "advance", person: p, repick: false })}
              onClose={() => setFlow({ ...flow, repick: false })}
            />
          )}
        </>
      )}
    </View>
  );
}

/** จ่ายเงินเดือน › เลือกคน: this month's people with what each is owed; a paid one can't be picked. */
function PayPick(props: { onPick: (row: PayRow, period: string) => void; onClose: () => void }) {
  const { t } = useLang();
  const period = thisMonth(Date.now());
  const salary = useSalary(period);
  const rows = salary.rows ?? [];
  return (
    <PickPersonSheet
      title={t({ th: "จ่ายเงินเดือน", en: "Pay a salary" })}
      heading={t({
        th: `เลือกคน · ${monthLabel(period).th}`,
        en: `Choose · ${monthLabel(period).en}`,
      })}
      rows={rows.map((r) => ({
        id: r.userId,
        name: r.name,
        sub: t(salaryLine(r)),
        open: r.paidAt == null,
      }))}
      onPick={(id) => {
        const row = rows.find((r) => r.userId === id);
        if (row) props.onPick(row, period);
      }}
      onClose={props.onClose}
    />
  );
}

/** บันทึกเงินเบิก › เลือกคน: how much each has taken this month; a month paid in full takes none. */
function AdvancePick(props: {
  chosen?: string;
  onPick: (p: { id: string; name: string }) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const period = thisMonth(Date.now());
  const salary = useSalary(period);
  const rows = salary.rows ?? [];
  return (
    <PickPersonSheet
      title={t({ th: "บันทึกเงินเบิก", en: "Record an advance" })}
      heading={t({
        th: `เลือกคน · ${monthLabel(period).th}`,
        en: `Choose · ${monthLabel(period).en}`,
      })}
      rows={rows.map((r) => {
        const pick = advancePick(r);
        return { id: r.userId, name: r.name, sub: t(pick.text), open: pick.open };
      })}
      chosen={props.chosen}
      onPick={(id) => {
        const row = rows.find((r) => r.userId === id);
        if (row) props.onPick({ id: row.userId, name: row.name });
      }}
      onClose={props.onClose}
    />
  );
}

const styles = StyleSheet.create({
  tabs: { marginTop: SPACE.xs },
});
