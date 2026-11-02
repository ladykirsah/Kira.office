import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { View } from "react-native";
import { API_BASE } from "@/lib/config";
import { payHead, type PayRow } from "@/lib/staffPage";
import { paySalary } from "@/lib/teamApi";
import { useLang } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { SPACE } from "../theme";
import { AmountHead, MethodSwitch, PayWays, type Method, type Photo } from "./PayWays";

/**
 * จ่ายเงินเดือน (canvas v292, 2.5 – 2.13): what payday hands over — the month's pay less what was
 * advanced — then โอน with the slip, or เงินสด with who paid. ยืนยันว่าจ่าย records it.
 */
export function PaySheet(props: {
  row: PayRow;
  period: string;
  token: string;
  payers: readonly { id: string; name: string }[];
  defaultPayer: string;
  onClose: () => void;
  onPaid: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { row } = props;
  const head = payHead(row, props.period);
  const [method, setMethod] = useState<Method>("transfer");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [payer, setPayer] = useState(props.defaultPayer);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // A slip already attached stays when switching to cash and back: it is the same payment.
  const confirm = async () => {
    setTried(true);
    setRefused(null);
    if (busy) return;
    if (method === "transfer" && (!row.bankAccountNo || !photo)) return;
    setBusy(true);
    try {
      await paySalary(fetch, API_BASE, props.token, row.userId, {
        period: props.period,
        method,
        photo: photo?.blob ?? null,
        paidBy: method === "cash" ? payer : undefined,
      });
      props.onPaid({ th: `จ่ายเงินเดือน ${row.name} แล้ว`, en: `Paid ${row.name}'s salary` });
    } catch (e) {
      setRefused(e instanceof Error ? e.message : t({ th: "ลองอีกครั้ง", en: "Try again" }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet
      title={t({ th: "จ่ายเงินเดือน", en: "Pay salary" })}
      onClose={props.onClose}
      tall={!!photo}
    >
      <AmountHead amount={head.amount} who={t(head.who)} how={t(head.how)} />
      <MethodSwitch value={method} onChange={setMethod} />
      <PayWays
        method={method}
        bank={row}
        photo={photo}
        onPhoto={setPhoto}
        payer={payer}
        payers={props.payers}
        onPayer={setPayer}
        needSlip={tried}
        fileName={`slip-${row.name}-${props.period}.jpg`}
      />
      {refused ? <FieldError text={refused} /> : null}
      <View style={{ marginTop: SPACE.xs }}>
        <BigButton
          label={t({
            th: `ยืนยันว่าจ่าย ${head.amount} แล้ว`,
            en: `Confirm ${head.amount} paid`,
          })}
          onPress={() => void confirm()}
        />
      </View>
    </Sheet>
  );
}
