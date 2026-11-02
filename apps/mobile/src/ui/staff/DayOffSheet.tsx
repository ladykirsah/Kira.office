import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { dayField, parseDayField, shortDate, startOfDay } from "@/lib/orderList";
import { halvesWord, roleWord, thisMonth } from "@/lib/staffPage";
import { deleteDayOff, recordDayOff, updateDayOff, type DayOff } from "@/lib/teamApi";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { DateBox } from "../orders/DateBox";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { InputRow, Line } from "../products/parts";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { Chevron } from "./parts";
import { PickPersonSheet } from "./PickSheets";
import { useDaysOff } from "./useStaffData";
import type { TeamMember } from "./useTeam";

/**
 * บันทึกวันหยุด (canvas v292, 2.3 · 6.3 – 6.8): who, the day, full or half, and why if anyone wants to
 * say. A day already recorded for that person is refused under the date. Opened from a row it is
 * วันหยุด, with ลบวันหยุด — asked first, then that day's wage counts again.
 */
export function DayOffSheet(props: {
  start: { person: TeamMember } | { edit: DayOff; person: TeamMember | null };
  people: readonly TeamMember[];
  token: string;
  onClose: () => void;
  onDone: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const editing = "edit" in props.start ? props.start.edit : null;
  const [person, setPerson] = useState<TeamMember | null>(props.start.person);
  const [day, setDay] = useState<number | null>(
    editing ? parseDayField(editing.day) : startOfDay(Date.now()),
  );
  const [halves, setHalves] = useState(editing?.halves ?? 2);
  const [reason, setReason] = useState(editing?.reason ?? "");
  const [picking, setPicking] = useState(false);
  const [asking, setAsking] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const personId = person?.id ?? editing?.userId ?? "";
  const theirs = useDaysOff(thisMonth(day ?? Date.now()), 0, personId || undefined);
  const taken =
    day != null && !!theirs.days?.some((d) => d.day === dayField(day) && d.id !== editing?.id);
  const name = person?.nameTh || person?.name || editing?.name || "";

  const save = async () => {
    setRefused(null);
    if (busy || taken || day == null || !personId) return;
    setBusy(true);
    const input = { day: dayField(day), halves, reason: reason.trim() };
    try {
      if (editing) await updateDayOff(fetch, API_BASE, props.token, editing.id, input);
      else await recordDayOff(fetch, API_BASE, props.token, personId, input);
      props.onDone({ th: "บันทึกแล้ว", en: "Saved" });
    } catch (e) {
      setRefused(e instanceof Error ? e.message : t({ th: "ลองอีกครั้ง", en: "Try again" }));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!editing || busy) return;
    setBusy(true);
    try {
      await deleteDayOff(fetch, API_BASE, props.token, editing.id);
      props.onDone({ th: "ลบวันหยุดแล้ว", en: "Day off deleted" });
    } catch (e) {
      setAsking(false);
      setRefused(e instanceof Error ? e.message : t({ th: "ลองอีกครั้ง", en: "Try again" }));
    } finally {
      setBusy(false);
    }
  };

  if (asking && editing) {
    const when = shortDate(parseDayField(editing.day) ?? 0);
    return (
      <Sheet
        title={t({ th: `ลบวันหยุด ${when.th}?`, en: `Delete the day off on ${when.en}?` })}
        onClose={() => setAsking(false)}
        noPill
      >
        <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={() => void remove()} />
        <BigButton
          label={t({ th: "ยกเลิก", en: "Cancel" })}
          kind="grey"
          onPress={() => setAsking(false)}
        />
      </Sheet>
    );
  }

  // A late record from the old back office keeps its own choice, so opening it changes nothing.
  const modes = [2, 1, ...(halves === 0 ? [0] : [])];
  return (
    <>
      <Sheet
        title={
          editing
            ? t({ th: "วันหยุด", en: "Day off" })
            : t({ th: "บันทึกวันหยุด", en: "Record a day off" })
        }
        onClose={props.onClose}
      >
        <View>
          <Group>
            <Line
              label={t({ th: "คน", en: "Person" })}
              onPress={editing ? undefined : () => setPicking(true)}
              right={
                <View style={styles.right}>
                  <Text style={[TYPE.body, { color: theme.text }]}>{name}</Text>
                  {!editing && <Chevron />}
                </View>
              }
            />
            <Line
              label={t({ th: "วันที่", en: "Date" })}
              last
              right={
                <DateBox value={day} onChange={setDay} label={t({ th: "วันที่", en: "Date" })} />
              }
            />
          </Group>
          {taken && (
            <FieldError
              text={t({ th: "วันที่นี้มีบันทึกอยู่แล้ว", en: "This day is already recorded" })}
            />
          )}
        </View>
        <Segmented
          label={t({ th: "หยุดแค่ไหน", en: "How long" })}
          options={modes.map((h) => ({ value: String(h), label: t(halvesWord(h)) }))}
          value={String(halves)}
          onChange={(v) => setHalves(Number(v))}
        />
        <Group>
          <InputRow
            label={t({ th: "เหตุผล", en: "Reason" })}
            value={reason}
            placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
            onChange={setReason}
            last
          />
        </Group>
        {editing && (
          <Group>
            <Pressable
              onPress={() => setAsking(true)}
              accessibilityRole="button"
              style={styles.red}
            >
              <Text style={[TYPE.body, { color: theme.danger }]}>
                {t({ th: "ลบวันหยุด", en: "Delete day off" })}
              </Text>
            </Pressable>
          </Group>
        )}
        {refused ? <FieldError text={refused} /> : null}
        <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
      </Sheet>
      {picking && (
        <PickPersonSheet
          title={t({ th: "เลือกคน", en: "Choose a person" })}
          rows={props.people.map((p) => ({
            id: p.id,
            name: p.nameTh || p.name,
            sub: t(roleWord(p.role)),
          }))}
          chosen={personId}
          onPick={(id) => {
            setPerson(props.people.find((p) => p.id === id) ?? null);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  red: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
});
