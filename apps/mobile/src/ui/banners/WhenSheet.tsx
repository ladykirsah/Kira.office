import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { timeField, whenRows, windowFromRows, type WhenRow } from "@/lib/bannerPage";
import { useLang, useTheme } from "../AppProviders";
import { DateBox } from "../orders/DateBox";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { SwitchRow } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { TimeBox } from "./TimeBox";

interface End extends WhenRow {
  /** What the time box shows (kept while it is half typed). */
  text: string;
}

const endOf = (row: WhenRow): End => ({ ...row, text: timeField(row.minutes) });

/**
 * ช่วงเวลา (canvas v245): กำหนดช่วงเวลา on → a start and an end, each a day and a time; off → ตลอดเวลา
 * (no dates, so the banner never runs out by itself). A side the web back office left empty stays
 * empty (and open) unless it is filled in. The red ✓ puts it on the form.
 */
export function WhenSheet(props: {
  startsAt: number | null;
  endsAt: number | null;
  onApply: (window: { startsAt: number | null; endsAt: number | null }) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [rows] = useState(() => whenRows(props.startsAt, props.endsAt, Date.now()));
  const [dated, setDated] = useState(props.startsAt != null || props.endsAt != null);
  const [start, setStart] = useState<End>(endOf(rows.start));
  const [end, setEnd] = useState<End>(endOf(rows.end));
  const [problem, setProblem] = useState<Phrase | null>(null);

  const apply = () => {
    if (!dated) return props.onApply({ startsAt: null, endsAt: null });
    const window = windowFromRows(start, end);
    if ("problem" in window) return setProblem(window.problem);
    props.onApply(window);
  };

  const row = (label: string, value: End, set: (v: End) => void, last?: boolean) => (
    <View style={[styles.row, !last && { borderBottomColor: theme.border }, !last && styles.line]}>
      <Text style={[TYPE.body, styles.label, { color: theme.text }]}>{label}</Text>
      <DateBox
        value={value.day}
        onChange={(day) => {
          set({ ...value, day });
          setProblem(null);
        }}
        label={t({ th: `วันที่${label}`, en: `${label} day` })}
      />
      <TimeBox
        value={value.text}
        onChange={(minutes, text) => {
          set({ ...value, minutes, text });
          setProblem(null);
        }}
        label={t({ th: `เวลา${label}`, en: `${label} time` })}
      />
    </View>
  );

  return (
    <Sheet title={t({ th: "ช่วงเวลา", en: "When" })} onClose={props.onClose} onDone={apply}>
      <Group>
        <SwitchRow
          label={t({ th: "กำหนดช่วงเวลา", en: "Set dates" })}
          value={dated}
          onChange={(on) => {
            setDated(on);
            setProblem(null);
          }}
          last={!dated}
        />
        {dated && row(t({ th: "เริ่ม", en: "Start" }), start, setStart)}
        {dated && row(t({ th: "สิ้นสุด", en: "End" }), end, setEnd, true)}
      </Group>
      {problem && <FieldError text={t(problem)} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    marginLeft: SPACE.l,
    paddingRight: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.s,
  },
  line: { borderBottomWidth: StyleSheet.hairlineWidth },
  label: { width: 52 },
});
