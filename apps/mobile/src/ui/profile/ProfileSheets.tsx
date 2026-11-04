import type { Phrase } from "@l-shopee/shared/lang";
import * as Crypto from "expo-crypto";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { dayField, dayPill, startOfDay } from "@/lib/orderList";
import { OwnRefusal, recordOwnDayOff, removeOwnKey, saveOwnCode } from "@/lib/profileApi";
import { ACCESS_LABEL, newCodeProblem, refusedWords, type Access } from "@/lib/profilePage";
import { halvesWord, randomPassword, thisMonth } from "@/lib/staffPage";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { DateBox } from "../orders/DateBox";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { InputRow, Line } from "../products/parts";
import { Segmented } from "../Segmented";
import { spacedPin } from "../staff/CodeSheets";
import { CodeInput, PillButton, ValueRow } from "../staff/parts";
import { SPACE, TYPE } from "../theme";
import { useOwnDaysOff } from "./useOwnProfile";

const SAVED: Phrase = { th: "บันทึกแล้ว", en: "Saved" };
const NOT_SAVED: Phrase = { th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved. Try again" };
const bytes = (n: number) => Crypto.getRandomBytes(n);

/** One save at a time: a ref, because a double tap lands before the page redraws. */
function useOneSave() {
  const busy = useRef(false);
  return async (work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await work();
    } finally {
      busy.current = false;
    }
  };
}

/**
 * รหัสผ่าน · รหัส 6 หลัก · กุญแจฉุกเฉิน for yourself (canvas v335, 1.2 – 1.7 and 2.1 – 2.5): what it is
 * now (when it is set), a new one, and บันทึก. You stay signed in; next time the new one opens. The
 * key's sheet has no readable copy to show — only when it was set — and เอากุญแจออก.
 */
export function OwnCodeSheet(props: {
  kind: Access;
  token: string;
  /** Your password or PIN as it is now; null for the key, or when none is set. */
  now: string | null;
  /** When the emergency key was set; null when there is none. */
  setAt: number | null;
  onClose: () => void;
  onDone: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [next, setNext] = useState("");
  const [problem, setProblem] = useState<Phrase | null>(null);
  const [asking, setAsking] = useState(false);
  const once = useOneSave();
  const { kind } = props;

  const type = (v: string) => {
    setNext(kind === "pin" ? v.replace(/\D/g, "").slice(0, 6) : v);
    setProblem(null);
  };
  const save = () =>
    once(async () => {
      const before = newCodeProblem(kind, next);
      if (before) return setProblem(before);
      try {
        await saveOwnCode(fetch, API_BASE, props.token, kind, kind === "key" ? next.trim() : next);
        props.onDone(SAVED);
      } catch (e) {
        setProblem(e instanceof OwnRefusal ? refusedWords(kind, e.status, e.message) : NOT_SAVED);
      }
    });
  const remove = () =>
    once(async () => {
      try {
        await removeOwnKey(fetch, API_BASE, props.token);
        props.onDone({ th: "เอากุญแจออกแล้ว", en: "Key removed" });
      } catch {
        setAsking(false);
        setProblem(NOT_SAVED);
      }
    });

  if (asking) {
    return (
      <Sheet
        title={t({ th: "เอากุญแจฉุกเฉินออก?", en: "Remove the emergency key?" })}
        onClose={() => setAsking(false)}
        noPill
      >
        <BigButton label={t({ th: "เอาออก", en: "Remove" })} onPress={() => void remove()} />
        <BigButton
          label={t({ th: "ยกเลิก", en: "Cancel" })}
          kind="grey"
          onPress={() => setAsking(false)}
        />
      </Sheet>
    );
  }

  const nowRow =
    kind === "key"
      ? props.setAt == null
        ? null
        : { label: t({ th: "ตั้งเมื่อ", en: "Set on" }), value: t(dayPill(props.setAt)) }
      : props.now == null
        ? null
        : {
            label: t({ th: "ตอนนี้", en: "Now" }),
            value: kind === "pin" ? spacedPin(props.now) : props.now,
          };

  return (
    <Sheet title={t(ACCESS_LABEL[kind])} onClose={props.onClose}>
      {nowRow && (
        <Group>
          <ValueRow
            label={nowRow.label}
            value={nowRow.value}
            // Your password, to paste into another device; never the PIN or the key (as drawn).
            copy={kind === "password" ? { what: { th: "รหัสผ่าน", en: "password" } } : undefined}
            last
          />
        </Group>
      )}
      <View>
        <Group>
          {kind === "password" ? (
            <CodeInput
              label={t({ th: "รหัสใหม่", en: "New" })}
              value={next}
              placeholder={t({ th: "อย่างน้อย 8 ตัว", en: "At least 8 characters" })}
              onChange={type}
              tools={
                <PillButton
                  label={t({ th: "สุ่มให้", en: "Random" })}
                  onPress={() => type(randomPassword(bytes))}
                />
              }
              last
            />
          ) : (
            <InputRow
              label={
                kind === "pin"
                  ? t({ th: "ตั้งรหัสใหม่", en: "New code" })
                  : t({ th: "ตั้งกุญแจใหม่", en: "New key" })
              }
              value={next}
              placeholder={
                kind === "pin"
                  ? t({ th: "ตัวเลข 6 ตัว", en: "6 digits" })
                  : t({ th: "อย่างน้อย 4 ตัว", en: "At least 4 characters" })
              }
              keyboardType={kind === "pin" ? "number-pad" : undefined}
              secure={kind === "key"}
              onChange={type}
              last
            />
          )}
        </Group>
        {problem && <FieldError text={t(problem)} />}
      </View>
      {kind === "key" && props.setAt != null && (
        <Group>
          <Pressable onPress={() => setAsking(true)} accessibilityRole="button" style={styles.red}>
            <Text style={[TYPE.body, { color: theme.danger }]}>
              {t({ th: "เอากุญแจออก", en: "Remove the key" })}
            </Text>
          </Pressable>
        </Group>
      )}
      <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
    </Sheet>
  );
}

/**
 * บันทึกวันหยุด for yourself (canvas v335, row 3): พนักงาน's sheet without the คน row. A day already
 * recorded is refused under the date; there is no delete — the owner deletes at พนักงาน · วันหยุด.
 */
export function OwnDayOffSheet(props: {
  token: string;
  onClose: () => void;
  onDone: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const [day, setDay] = useState<number | null>(startOfDay(Date.now()));
  const [halves, setHalves] = useState(2);
  const [reason, setReason] = useState("");
  const [problem, setProblem] = useState<Phrase | null>(null);
  const once = useOneSave();
  const mine = useOwnDaysOff(thisMonth(day ?? Date.now()));
  const taken = day != null && !!mine.days?.some((d) => d.day === dayField(day));

  const save = () =>
    once(async () => {
      setProblem(null);
      if (day == null) {
        return setProblem({ th: "ยังไม่ได้เลือกวันที่", en: "No date yet" });
      }
      if (taken) return;
      try {
        await recordOwnDayOff(fetch, API_BASE, props.token, {
          day: dayField(day),
          halves,
          reason: reason.trim(),
        });
        props.onDone(SAVED);
      } catch {
        setProblem(NOT_SAVED);
      }
    });

  return (
    <Sheet title={t({ th: "บันทึกวันหยุด", en: "Record a day off" })} onClose={props.onClose}>
      <View>
        <Group>
          <Line
            label={t({ th: "วันที่", en: "Date" })}
            last
            right={
              <DateBox
                value={day}
                onChange={(d) => {
                  setDay(d);
                  setProblem(null);
                }}
                label={t({ th: "วันที่", en: "Date" })}
              />
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
        options={[2, 1].map((h) => ({ value: String(h), label: t(halvesWord(h)) }))}
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
      {problem ? <FieldError text={t(problem)} /> : null}
      <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  red: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
});
