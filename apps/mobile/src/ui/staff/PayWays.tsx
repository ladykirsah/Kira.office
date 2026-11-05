import type { Phrase } from "@l-shopee/shared/lang";
import { StyleSheet, Text, View } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { Group } from "../orders/parts";
import { FieldError } from "../pos/fields";
import { pickPhoto, photoPreview } from "../products/pickPhoto";
import { Line } from "../products/parts";
import { Segmented } from "../Segmented";
import { PhotoChoice } from "../shop/parts";
import { SPACE, TYPE } from "../theme";
import { DropRow } from "./DropRow";
import { Hint, IconButton, PillButton, STAFF_ICON, SlipCard, ValueRow } from "./parts";

export type Method = "transfer" | "cash";

export interface Photo {
  blob: Blob;
  uri: string;
}

export interface Bank {
  bankName: string | null;
  bankAccountNo: string | null;
  bankAccountName: string | null;
}

/** โอน | เงินสด, under the amount in both pay sheets. */
export function MethodSwitch(props: { value: Method; onChange: (m: Method) => void }) {
  const { t } = useLang();
  return (
    <Segmented
      label={t({ th: "จ่ายแบบ", en: "Paid by" })}
      options={[
        { value: "transfer", label: t({ th: "โอน", en: "Transfer" }) },
        { value: "cash", label: t({ th: "เงินสด", en: "Cash" }) },
      ]}
      value={props.value}
      onChange={props.onChange}
    />
  );
}

/** ถ่ายรูป / เลือกจากคลังภาพ, then the picture as a Photo. */
function usePicker(onPhoto: (p: Photo) => void) {
  return async (source: "camera" | "library") => {
    const blob = await pickPhoto(source);
    if (blob) onPhoto({ blob, uri: photoPreview(blob) });
  };
}

/**
 * How the money goes (canvas v292, 2.5 – 2.13 and 2.15 – 2.23). โอน: their bank account, the copy
 * mark on the number, and the slip — required, shown big in its own card once attached. เงินสด: who
 * handed it over (an owner) and a photo if anyone took one.
 */
export function PayWays(props: {
  method: Method;
  bank: Bank;
  photo: Photo | null;
  onPhoto: (p: Photo | null) => void;
  payer: string;
  payers: readonly { id: string; name: string }[];
  onPayer: (id: string) => void;
  /** Shown after the main button was pressed without a slip. */
  needSlip: boolean;
  fileName: string;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pick = usePicker((p) => props.onPhoto(p));
  const attach = (label: Phrase) => (
    <PhotoChoice onChoose={(s) => void pick(s)}>
      {(open) => <PillButton label={t(label)} onPress={open} />}
    </PhotoChoice>
  );
  const change = (
    <PhotoChoice onChoose={(s) => void pick(s)}>
      {(open) => (
        <IconButton
          icon={STAFF_ICON.attach}
          label={t({ th: "เปลี่ยนรูป", en: "Change picture" })}
          onPress={open}
        />
      )}
    </PhotoChoice>
  );
  const slipCard = (title: Phrase) =>
    props.photo ? (
      <SlipCard uri={props.photo.uri} title={t(title)} fileName={props.fileName} change={change} />
    ) : null;

  if (props.method === "transfer") {
    if (!props.bank.bankAccountNo) {
      return (
        <View>
          <Group>
            <Line
              label={t({ th: "บัญชีธนาคาร", en: "Bank account" })}
              last
              right={
                <Text style={[TYPE.body, { color: theme.danger }]}>
                  {t({ th: "ยังไม่มีบัญชี", en: "No account yet" })}
                </Text>
              }
            />
          </Group>
          <FieldError
            text={t({
              th: "เพิ่มบัญชีที่หน้าของเขาก่อน หรือจ่ายเงินสด",
              en: "Add it on their page first, or pay cash",
            })}
          />
        </View>
      );
    }
    return (
      <View style={styles.stack}>
        <View>
          <Group>
            <ValueRow label={t({ th: "ธนาคาร", en: "Bank" })} value={props.bank.bankName} />
            <ValueRow
              label={t({ th: "เลขบัญชี", en: "Account no." })}
              value={props.bank.bankAccountNo}
              copy={{ what: { th: "เลขบัญชี", en: "account number" } }}
            />
            <ValueRow
              label={t({ th: "ชื่อบัญชี", en: "Account name" })}
              value={props.bank.bankAccountName}
              last={!!props.photo}
            />
            {!props.photo && (
              <Line
                label={t({ th: "สลิป", en: "Slip" })}
                last
                right={attach({ th: "แนบสลิป", en: "Attach slip" })}
              />
            )}
          </Group>
          {props.needSlip && !props.photo && (
            <FieldError text={t({ th: "แนบสลิปก่อน", en: "Attach the slip first" })} />
          )}
        </View>
        {slipCard({ th: "สลิป", en: "Slip" })}
      </View>
    );
  }

  const payer = props.payers.find((p) => p.id === props.payer);
  return (
    <View style={styles.stack}>
      <View>
        <Group>
          <DropRow
            label={t({ th: "คนจ่าย", en: "Paid by" })}
            value={payer?.name ?? "—"}
            options={props.payers.map((p) => ({
              key: p.id,
              label: p.name,
              note: t({ th: "เจ้าของร้าน", en: "Owner" }),
            }))}
            chosen={props.payer}
            onPick={props.onPayer}
            last={!!props.photo}
          />
          {!props.photo && (
            <Line
              label={t({ th: "รูป", en: "Photo" })}
              last
              right={
                <View style={styles.right}>
                  <Text style={[TYPE.body, { color: theme.textFaint }]}>
                    {t({ th: "ไม่บังคับ", en: "Optional" })}
                  </Text>
                  {attach({ th: "แนบรูป", en: "Attach" })}
                </View>
              }
            />
          )}
        </Group>
        <Hint
          text={t({
            th: "คนจ่ายเลือกได้เฉพาะเจ้าของร้าน · เงินสดไม่ต้องมีรูป ถ่ายไว้ก็ได้",
            en: "Only an owner can be the payer · Cash needs no photo, but one can be kept",
          })}
        />
      </View>
      {slipCard({ th: "รูป", en: "Photo" })}
    </View>
  );
}

/** The white card at the top of a pay sheet: the amount big, whose month, how it came to that. */
export function AmountHead(props: { amount: string; who: string; how: string }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.head,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.amount, { color: theme.text }]}>{props.amount}</Text>
      <Text style={[TYPE.subhead, { color: theme.text }]}>{props.who}</Text>
      <Text style={[TYPE.footnote, { color: theme.textMuted }]}>{props.how}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: SPACE.m },
  right: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  head: { borderRadius: 14, padding: SPACE.l, gap: 2 },
  amount: { fontSize: 34, lineHeight: 42, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
