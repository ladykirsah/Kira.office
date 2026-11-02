import type { Phrase } from "@l-shopee/shared/lang";
import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { randomPassword, refusalWords } from "@/lib/staffPage";
import { StaffRefusal, clearPin, setPassword, setPin } from "@/lib/teamApi";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { InputRow } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { CodeInput, PillButton, ValueRow } from "./parts";

const bytes = (n: number) => Crypto.getRandomBytes(n);

/** "482913" → "482 913", as the drawings show a PIN. */
export const spacedPin = (pin: string) =>
  pin.length === 6 ? `${pin.slice(0, 3)} ${pin.slice(3)}` : pin;

function useSave(onDone: (said: Phrase) => void) {
  const [problem, setProblem] = useState<Phrase | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (work: () => Promise<void>, said: Phrase) => {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    try {
      await work();
      onDone(said);
    } catch (e) {
      setProblem(
        e instanceof StaffRefusal
          ? refusalWords(e.code, e.message)
          : { th: "บันทึกไม่สำเร็จ ลองอีกครั้ง", en: "Not saved. Try again" },
      );
    } finally {
      setBusy(false);
    }
  };
  return { problem, setProblem, run };
}

/**
 * รหัสผ่าน (canvas v292, 3.2): the one they use now, and a new one — typed or สุ่มให้. Saving signs
 * them out everywhere and lifts a lock; only the owner can do it.
 */
export function PasswordSheet(props: {
  id: string;
  token: string;
  now: string | null;
  onClose: () => void;
  onDone: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const [next, setNext] = useState("");
  const save = useSave(props.onDone);
  return (
    <Sheet title={t({ th: "รหัสผ่าน", en: "Password" })} onClose={props.onClose}>
      <View>
        <Group>
          <ValueRow
            label={t({ th: "ตอนนี้", en: "Now" })}
            value={props.now}
            copy={props.now ? { what: { th: "รหัสผ่าน", en: "password" } } : undefined}
          />
          <CodeInput
            label={t({ th: "รหัสใหม่", en: "New" })}
            value={next}
            placeholder={t({ th: "อย่างน้อย 8 ตัว", en: "At least 8 characters" })}
            onChange={(v) => {
              setNext(v);
              save.setProblem(null);
            }}
            tools={
              <PillButton
                label={t({ th: "สุ่มให้", en: "Random" })}
                onPress={() => setNext(randomPassword(bytes))}
              />
            }
            last
          />
        </Group>
        {save.problem && <FieldError text={t(save.problem)} />}
      </View>
      <BigButton
        label={t({ th: "บันทึก", en: "Save" })}
        onPress={() =>
          next.trim()
            ? void save.run(
                () => setPassword(fetch, API_BASE, props.token, props.id, next.trim()),
                { th: "บันทึกแล้ว", en: "Saved" },
              )
            : save.setProblem({ th: "ยังไม่ได้ใส่รหัสใหม่", en: "No new password yet" })
        }
      />
    </Sheet>
  );
}

/** รหัส 6 หลัก (canvas v292, 3.3): see it, set a new one, or ล้างรหัส so they set one next time. */
export function PinSheet(props: {
  id: string;
  token: string;
  now: string | null;
  onClose: () => void;
  onDone: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [next, setNext] = useState("");
  const save = useSave(props.onDone);
  return (
    <Sheet title={t({ th: "รหัส 6 หลัก", en: "6-digit code" })} onClose={props.onClose}>
      <Group>
        <ValueRow
          label={t({ th: "ตอนนี้", en: "Now" })}
          value={props.now ? spacedPin(props.now) : null}
          last
        />
      </Group>
      <View>
        <Group>
          <InputRow
            label={t({ th: "ตั้งรหัสใหม่", en: "New code" })}
            value={next}
            placeholder={t({ th: "ตัวเลข 6 ตัว", en: "6 digits" })}
            keyboardType="number-pad"
            onChange={(v) => {
              setNext(v.replace(/\D/g, "").slice(0, 6));
              save.setProblem(null);
            }}
            last
          />
        </Group>
        {save.problem && <FieldError text={t(save.problem)} />}
      </View>
      {props.now ? (
        <Group>
          <Pressable
            onPress={() =>
              void save.run(() => clearPin(fetch, API_BASE, props.token, props.id), {
                th: "ล้างรหัสแล้ว",
                en: "Code cleared",
              })
            }
            accessibilityRole="button"
            style={styles.red}
          >
            <Text style={[TYPE.body, { color: theme.danger }]}>
              {t({ th: "ล้างรหัส", en: "Clear code" })}
            </Text>
          </Pressable>
        </Group>
      ) : null}
      <BigButton
        label={t({ th: "บันทึก", en: "Save" })}
        onPress={() =>
          next.length === 6
            ? void save.run(() => setPin(fetch, API_BASE, props.token, props.id, next), {
                th: "บันทึกแล้ว",
                en: "Saved",
              })
            : save.setProblem({ th: "ตัวเลข 6 ตัว", en: "6 digits" })
        }
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  red: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
});
