import type { Phrase } from "@l-shopee/shared/lang";
import * as Crypto from "expo-crypto";
import { StyleSheet, View, type KeyboardTypeOptions } from "react-native";
import type { PersonDraft } from "@/lib/staffForm";
import { OWNER_LOCK_LINE, ROLE_KEYS, randomPassword, randomPin, roleWord } from "@/lib/staffPage";
import { useLang } from "../AppProviders";
import { DateBox } from "../orders/DateBox";
import { Group } from "../orders/parts";
import { FieldError } from "../pos/fields";
import { Heading, InputRow, Line, SwitchRow } from "../products/parts";
import { Segmented } from "../Segmented";
import { SPACE } from "../theme";
import { CodeInput, CopyIcon, Hint, PillButton, ValueRow } from "./parts";

type DraftKey = keyof PersonDraft;
export type Problems = Partial<Record<string, Phrase>>;

const bytes = (n: number) => Crypto.getRandomBytes(n);

/**
 * The boxes of เพิ่มคน and แก้ไข (canvas v292, 1.2 · 3.6), in the order the person's page reads:
 * ชื่อ, ติดต่อ, ผู้ติดต่อฉุกเฉิน, งาน, บัญชีธนาคาร — then the codes on เพิ่มคน, or เปิดใช้ on แก้ไข. Each
 * problem shows under the group its box is in.
 */
export function PersonFields(props: {
  draft: PersonDraft;
  onChange: (patch: Partial<PersonDraft>) => void;
  problems: Problems;
  /** เพิ่มคน sets the two codes; แก้ไข has เปิดใช้ instead (the codes have their own sheets). */
  codes: boolean;
  /**
   * The owner's locked account (พนักงาน 8.1): ตำแหน่ง is a plain row, the email can't change, and
   * there is no เปิดใช้ — the server refuses all three.
   */
  locked?: boolean;
  active?: boolean;
  onActive?: (on: boolean) => void;
  onCopied: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { draft, problems } = props;
  const notNeeded = t({ th: "ไม่ใส่ก็ได้", en: "Optional" });
  const box = (
    key: DraftKey,
    label: Phrase,
    opts: {
      placeholder?: string;
      keyboard?: KeyboardTypeOptions;
      copy?: Phrase;
      last?: boolean;
      lead?: string;
      fixed?: boolean;
    } = {},
  ) => (
    <InputRow
      editable={!opts.fixed}
      label={t(label)}
      value={String(draft[key] ?? "")}
      placeholder={opts.placeholder ?? notNeeded}
      keyboardType={opts.keyboard}
      lead={opts.lead}
      onChange={(v) => props.onChange({ [key]: v })}
      tool={
        opts.copy && draft[key] ? (
          <CopyIcon value={String(draft[key])} what={opts.copy} onCopied={props.onCopied} />
        ) : undefined
      }
      last={opts.last}
    />
  );
  const errors = (...keys: string[]) =>
    keys.map((k) => (problems[k] ? <FieldError key={k} text={t(problems[k]!)} /> : null));

  return (
    <View>
      <Heading text={t({ th: "ชื่อ", en: "Name" })} />
      <Group>
        {box(
          "nameTh",
          { th: "ชื่อเล่น ไทย", en: "Nickname (Thai)" },
          { placeholder: t({ th: "เช่น บอย", en: "e.g. บอย" }) },
        )}
        {box("nameEn", { th: "ชื่อเล่น อังกฤษ", en: "Nickname (English)" })}
        {box("fullNameTh", { th: "ชื่อจริง ไทย", en: "Full name (Thai)" })}
        {box("fullNameEn", { th: "ชื่อจริง อังกฤษ", en: "Full name (English)" }, { last: true })}
      </Group>
      {errors("nameTh")}

      <Heading text={t({ th: "ติดต่อ", en: "Contact" })} />
      <Group>
        {box(
          "phone",
          { th: "เบอร์โทร", en: "Phone" },
          {
            placeholder: t({ th: "ตัวเลข 10 หลัก", en: "10 digits" }),
            keyboard: "phone-pad",
            copy: { th: "เบอร์โทร", en: "phone number" },
          },
        )}
        {box(
          "email",
          { th: "อีเมล", en: "Email" },
          { keyboard: "email-address", last: true, fixed: props.locked },
        )}
      </Group>
      {errors("phone", "email")}

      <Heading text={t({ th: "ผู้ติดต่อฉุกเฉิน", en: "Emergency contact" })} />
      <Group>
        {box("emergencyName", { th: "ชื่อ", en: "Name" })}
        {box(
          "emergencyRelation",
          { th: "เกี่ยวข้องเป็น", en: "Relation" },
          { placeholder: t({ th: "เช่น แม่", en: "e.g. mother" }) },
        )}
        {box(
          "emergencyPhone",
          { th: "เบอร์โทร", en: "Phone" },
          { keyboard: "phone-pad", copy: { th: "เบอร์โทร", en: "phone number" }, last: true },
        )}
      </Group>

      <Heading text={t({ th: "งาน", en: "Work" })} />
      {!props.locked && (
        <Segmented
          label={t({ th: "ตำแหน่ง", en: "Position" })}
          options={ROLE_KEYS.map((r) => ({ value: r, label: t(roleWord(r)) }))}
          value={draft.role}
          onChange={(role) => props.onChange({ role })}
        />
      )}
      <View style={props.locked ? undefined : styles.after}>
        <Group>
          {props.locked && (
            <ValueRow
              label={t({ th: "ตำแหน่ง", en: "Position" })}
              value={t(roleWord(draft.role))}
            />
          )}
          {box(
            "dayRate",
            { th: "ค่าแรงต่อวัน", en: "Day rate" },
            {
              placeholder: t({ th: "เช่น 450", en: "e.g. 450" }),
              keyboard: "decimal-pad",
              lead: "฿",
            },
          )}
          <Line
            label={t({ th: "เริ่มงาน", en: "Started" })}
            last
            right={
              <DateBox
                value={draft.startedOn}
                onChange={(startedOn) => props.onChange({ startedOn })}
                label={t({ th: "เริ่มงาน", en: "Started" })}
              />
            }
          />
        </Group>
      </View>
      {props.locked && <Hint text={t(OWNER_LOCK_LINE)} />}
      {errors("dayRateSatang", "role", "startedOn")}

      <Heading text={t({ th: "บัญชีธนาคาร", en: "Bank account" })} />
      <Group>
        {box(
          "bankName",
          { th: "ธนาคาร", en: "Bank" },
          { placeholder: t({ th: "เช่น กสิกร", en: "e.g. KBank" }) },
        )}
        {box(
          "bankAccountNo",
          { th: "เลขบัญชี", en: "Account no." },
          {
            placeholder: t({ th: "ตัวเลข", en: "Digits" }),
            keyboard: "number-pad",
            copy: { th: "เลขบัญชี", en: "account number" },
          },
        )}
        {box(
          "bankAccountName",
          { th: "ชื่อบัญชี", en: "Account name" },
          { placeholder: t({ th: "เช่น นายบอย ใจดี", en: "e.g. Mr Boy Jaidee" }), last: true },
        )}
      </Group>

      {props.codes ? (
        <>
          <Heading text={t({ th: "การเข้าใช้งาน", en: "Sign-in" })} />
          <Group>
            <CodeInput
              label={t({ th: "รหัสผ่าน", en: "Password" })}
              value={draft.password}
              placeholder={notNeeded}
              onChange={(password) => props.onChange({ password })}
              tools={
                <View style={styles.tools}>
                  {draft.password ? (
                    <CopyIcon
                      value={draft.password}
                      what={{ th: "รหัสผ่าน", en: "password" }}
                      onCopied={props.onCopied}
                    />
                  ) : null}
                  <PillButton
                    label={t({ th: "สุ่มให้", en: "Random" })}
                    onPress={() => props.onChange({ password: randomPassword(bytes) })}
                  />
                </View>
              }
            />
            <CodeInput
              label={t({ th: "รหัส 6 หลัก", en: "6-digit code" })}
              value={draft.pin}
              placeholder={t({ th: "ตัวเลข 6 ตัว", en: "6 digits" })}
              keyboardType="number-pad"
              onChange={(pin) => props.onChange({ pin: pin.replace(/\D/g, "").slice(0, 6) })}
              tools={
                <View style={styles.tools}>
                  {draft.pin ? (
                    <CopyIcon
                      value={draft.pin}
                      what={{ th: "รหัส 6 หลัก", en: "code" }}
                      onCopied={props.onCopied}
                    />
                  ) : null}
                  <PillButton
                    label={t({ th: "สุ่มให้", en: "Random" })}
                    onPress={() => props.onChange({ pin: randomPin(bytes) })}
                  />
                </View>
              }
              last
            />
          </Group>
          {errors("password", "pin")}
          <Hint
            text={t({
              th: "เจ้าของร้านเท่านั้นที่ตั้งและเปลี่ยนรหัสได้ · ไม่มีอีเมล เข้าได้ด้วยรหัส 6 หลักเท่านั้น",
              en: "Only an owner sets and changes codes · Without an email, the 6-digit code is the only way in",
            })}
          />
        </>
      ) : props.locked ? null : (
        <View style={styles.switch}>
          <Group>
            <SwitchRow
              label={t({ th: "เปิดใช้", en: "Active" })}
              value={props.active ?? true}
              onChange={props.onActive}
              last
            />
          </Group>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  after: { marginTop: SPACE.s },
  tools: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  switch: { marginTop: SPACE.xxl },
});
