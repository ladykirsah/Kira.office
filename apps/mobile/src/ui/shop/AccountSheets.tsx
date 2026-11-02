import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { accountProblems, type AccountDraft } from "@/lib/shopInfoPage";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { InputRow, SwitchRow } from "../products/parts";
import { SPACE, TYPE } from "../theme";

/**
 * บัญชีรับเงิน (an account tapped) or เพิ่มบัญชี (＋): ชื่อ, ตำแหน่ง, ชื่อบัญชีธนาคาร, พร้อมเพย์ and ค่าเริ่มต้น,
 * with ลบบัญชี on a saved one. บันทึก with an empty name or PromptPay says so under that box.
 */
export function AccountSheet(props: {
  start: AccountDraft;
  onSave: (draft: AccountDraft) => void;
  onDelete: (draft: AccountDraft) => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [d, setD] = useState(props.start);
  const [tried, setTried] = useState(false);
  const problems = tried ? accountProblems(d) : {};
  const set = (patch: Partial<AccountDraft>) => setD((now) => ({ ...now, ...patch }));
  const save = () => {
    setTried(true);
    if (Object.keys(accountProblems(d)).length === 0) props.onSave(d);
  };
  return (
    <Sheet
      title={
        d.id
          ? t({ th: "บัญชีรับเงิน", en: "Payment account" })
          : t({ th: "เพิ่มบัญชี", en: "Add account" })
      }
      onClose={props.onClose}
    >
      <Group>
        <InputRow
          label={t({ th: "ชื่อ", en: "Name" })}
          value={d.label}
          placeholder={t({ th: "เช่น แม่", en: "e.g. Mom" })}
          onChange={(label) => set({ label })}
        />
        {problems.label && <FieldError text={t(problems.label)} />}
        <InputRow
          label={t({ th: "ตำแหน่ง", en: "Role" })}
          value={d.position}
          placeholder={t({ th: "เช่น เจ้าของ", en: "e.g. Owner" })}
          onChange={(position) => set({ position })}
        />
        <InputRow
          label={t({ th: "ชื่อบัญชีธนาคาร", en: "Account name" })}
          value={d.accountName}
          placeholder={t({ th: "เช่น นายเด่น สุขใจ", en: "e.g. Den Sukjai" })}
          onChange={(accountName) => set({ accountName })}
        />
        <InputRow
          label={t({ th: "พร้อมเพย์", en: "PromptPay" })}
          value={d.promptpayId}
          placeholder={t({ th: "เบอร์โทร หรือเลขบัตร", en: "Phone or ID number" })}
          keyboardType="phone-pad"
          onChange={(promptpayId) => set({ promptpayId })}
          last
        />
        {problems.promptpayId && <FieldError text={t(problems.promptpayId)} />}
      </Group>
      <Group>
        <SwitchRow
          label={t({ th: "ค่าเริ่มต้น", en: "Default" })}
          value={d.isDefault}
          onChange={(isDefault) => set({ isDefault })}
          last
        />
      </Group>
      {d.id && (
        <Group>
          <Pressable
            onPress={() => props.onDelete(d)}
            accessibilityRole="button"
            style={styles.deleteRow}
          >
            <Text style={[TYPE.body, { color: theme.danger }]}>
              {t({ th: "ลบบัญชี", en: "Delete account" })}
            </Text>
          </Pressable>
        </Group>
      )}
      <View style={styles.button}>
        <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={save} />
      </View>
    </Sheet>
  );
}

/** ลบบัญชี แม่? — a red ลบ and a grey ยกเลิก, nothing else (as คูปอง's). */
export function DeleteAccountSheet(props: {
  name: string;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  return (
    <Sheet
      title={t({ th: `ลบบัญชี ${props.name}?`, en: `Delete ${props.name}?` })}
      onClose={props.onClose}
      noPill
    >
      <BigButton label={t({ th: "ลบ", en: "Delete" })} onPress={props.onDelete} />
      <BigButton label={t({ th: "ยกเลิก", en: "Cancel" })} kind="grey" onPress={props.onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  deleteRow: { minHeight: 52, justifyContent: "center", paddingHorizontal: SPACE.l },
  button: { marginTop: SPACE.xs },
});
