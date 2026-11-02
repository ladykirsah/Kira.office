import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { dayField, startOfDay } from "@/lib/orderList";
import { parseBaht } from "@/lib/productEdit";
import { monthLabel, recentMonths } from "@/lib/staffPage";
import { recordAdvance, uploadAdvanceSlip } from "@/lib/teamApi";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { DateBox } from "../orders/DateBox";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { FieldError } from "../pos/fields";
import { InputRow, Line } from "../products/parts";
import { SPACE, TYPE } from "../theme";
import { DropRow } from "./DropRow";
import { Chevron } from "./parts";
import { MethodSwitch, PayWays, type Bank, type Method, type Photo } from "./PayWays";
import { useSalary } from "./useStaffData";

const MONTHS_SHOWN = 6;

/**
 * บันทึกเงินเบิก (canvas v292, 2.15 – 2.24): whose, which month it comes off, the day it was handed
 * over and how much, then โอน with its slip or เงินสด with who paid. A month already paid in full
 * takes no advance — the sheet says so as soon as that month is picked.
 */
export function AdvanceSheet(props: {
  person: { id: string; name: string };
  token: string;
  payers: readonly { id: string; name: string }[];
  defaultPayer: string;
  onPerson: () => void;
  onClose: () => void;
  onDone: (said: Phrase) => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  const now = Date.now();
  const months = recentMonths(now, MONTHS_SHOWN);
  const [period, setPeriod] = useState(months[0]!);
  const [day, setDay] = useState<number | null>(startOfDay(now));
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<Method>("transfer");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [payer, setPayer] = useState(props.defaultPayer);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const salary = useSalary(period);
  const row = salary.rows?.find((r) => r.userId === props.person.id) ?? null;
  const bank: Bank = row ?? { bankName: null, bankAccountNo: null, bankAccountName: null };
  const paid = row?.paidAt != null;
  const satang = parseBaht(amount);
  const month = monthLabel(period);

  const save = async () => {
    setTried(true);
    setRefused(null);
    if (busy || paid || !satang || day == null) return;
    if (method === "transfer" && (!bank.bankAccountNo || !photo)) return;
    setBusy(true);
    try {
      const slipKey = photo
        ? await uploadAdvanceSlip(fetch, API_BASE, props.token, props.person.id, period, photo.blob)
        : null;
      await recordAdvance(fetch, API_BASE, props.token, props.person.id, {
        period,
        givenOn: dayField(day),
        amountSatang: satang,
        method,
        slipKey,
        note: note.trim() || null,
        paidBy: method === "cash" ? payer : undefined,
      });
      const money = formatBaht(satang);
      props.onDone({
        th: `บันทึกเงินเบิก ${props.person.name} ${money} แล้ว`,
        en: `Recorded ${props.person.name}'s ${money} advance`,
      });
    } catch (e) {
      setRefused(e instanceof Error ? e.message : t({ th: "ลองอีกครั้ง", en: "Try again" }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={t({ th: "บันทึกเงินเบิก", en: "Record an advance" })}
      onClose={props.onClose}
      tall={!!photo}
    >
      <View>
        <Group>
          <Line
            label={t({ th: "คน", en: "Person" })}
            onPress={props.onPerson}
            right={
              <View style={{ flexDirection: "row", alignItems: "center", gap: SPACE.s }}>
                <Text style={[TYPE.body, { color: theme.text }]}>{props.person.name}</Text>
                <Chevron />
              </View>
            }
          />
          <DropRow
            label={t({ th: "เดือน", en: "Month" })}
            value={t(month)}
            options={months.map((m) => ({ key: m, label: t(monthLabel(m)) }))}
            chosen={period}
            onPick={setPeriod}
          />
          <Line
            label={t({ th: "วันที่ให้", en: "Given on" })}
            right={
              <DateBox
                value={day}
                onChange={setDay}
                label={t({ th: "วันที่ให้", en: "Given on" })}
              />
            }
          />
          <InputRow
            label={t({ th: "จำนวน", en: "Amount" })}
            value={amount}
            lead="฿"
            placeholder="฿0"
            keyboardType="decimal-pad"
            onChange={setAmount}
            last
          />
        </Group>
        {paid && (
          <FieldError
            text={t({
              th: `${month.th} จ่าย${props.person.name}ครบแล้ว บันทึกเบิกไม่ได้`,
              en: `${props.person.name} is paid in full for ${month.en}; no advance`,
            })}
          />
        )}
        {tried && !paid && !satang && (
          <FieldError text={t({ th: "ยังไม่ได้ใส่จำนวน", en: "No amount yet" })} />
        )}
      </View>
      <MethodSwitch value={method} onChange={setMethod} />
      <PayWays
        method={method}
        bank={bank}
        photo={photo}
        onPhoto={setPhoto}
        payer={payer}
        payers={props.payers}
        onPayer={setPayer}
        needSlip={tried}
        fileName={`advance-${props.person.name}-${period}.jpg`}
      />
      <Group>
        <InputRow
          label={t({ th: "หมายเหตุ", en: "Note" })}
          value={note}
          placeholder={t({ th: "ไม่บังคับ", en: "Optional" })}
          onChange={setNote}
          last
        />
      </Group>
      {refused ? <FieldError text={refused} /> : null}
      <BigButton label={t({ th: "บันทึก", en: "Save" })} onPress={() => void save()} />
    </Sheet>
  );
}
