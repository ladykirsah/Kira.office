import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CustomRange } from "@/lib/orderList";
import { useLang, useTheme } from "../AppProviders";
import { RADIUS, SPACE, TYPE } from "../theme";
import { DateBox } from "./DateBox";
import { Sheet } from "./Sheet";

interface RangeSheetProps {
  range: CustomRange | null;
  now: number;
  onApply: (range: CustomRange) => void;
  onClose: () => void;
}

/** "กำหนดเอง…": two days, both included. The red ✓ applies them; it waits until both are real days. */
export function RangeSheet({ range, now, onApply, onClose }: RangeSheetProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [from, setFrom] = useState<number | null>(range?.from ?? now);
  const [to, setTo] = useState<number | null>(range?.to ?? now);
  const picked = from != null && to != null ? { from, to } : null;
  const fromLabel = t({ th: "ตั้งแต่", en: "From" });
  const toLabel = t({ th: "ถึง", en: "To" });
  return (
    <Sheet
      title={t({ th: "เลือกช่วงวันที่", en: "Pick dates" })}
      onClose={onClose}
      onDone={picked ? () => onApply(picked) : undefined}
    >
      <View style={[styles.group, { backgroundColor: theme.surface }]}>
        <View style={[styles.row, { borderBottomColor: theme.border }, styles.divider]}>
          <Text style={[styles.label, { color: theme.text }]}>{fromLabel}</Text>
          <DateBox value={from} onChange={setFrom} label={fromLabel} />
        </View>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.text }]}>{toLabel}</Text>
          <DateBox value={to} onChange={setTo} label={toLabel} />
        </View>
      </View>
      <Text style={[styles.note, { color: theme.textMuted }]}>
        {t({ th: "รวมทั้งวันแรกและวันสุดท้าย", en: "Both days are included" })}
      </Text>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: RADIUS.card, overflow: "hidden" },
  row: {
    minHeight: 52,
    marginLeft: SPACE.l,
    paddingRight: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
  label: { ...TYPE.body, width: 72 },
  note: { ...TYPE.footnote, marginHorizontal: SPACE.xs },
});
