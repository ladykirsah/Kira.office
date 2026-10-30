import { Platform, StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import { discountOf, shortLines, subtotal } from "@/lib/posBill";
import { payQr } from "@/lib/qr";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Group } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { QrView } from "../scan/QrView";
import { Segmented } from "../Segmented";
import { SPACE, TYPE } from "../theme";
import { ChoiceRow, FieldRow, Note } from "./fields";
import { usePos } from "./PosSessionProvider";

const online = () => Platform.OS !== "web" || navigator.onLine;

/**
 * รับเงิน (ทำบิล 3): cash with who took it (remembered on this phone), or a PromptPay QR for the
 * exact total with the account's name under it (owner rule, 30 Oct 2026). ออกบิล / ตรวจสอบการชำระเงิน
 * issue the bill and go straight to its file.
 */
export function PosPaySheet({ onClose }: { onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const b = pos.bill;
  const sub = subtotal(b.lines);
  const off = discountOf(sub, b.discount);
  const total = sub - off;
  const who =
    b.buyer === "customer"
      ? b.plate.trim()
      : b.mechanicName.trim() || t({ th: "ช่าง", en: "Mechanic" });
  const facts = [
    who,
    t({ th: `${b.lines.length} รายการ`, en: `${b.lines.length} items` }),
    off > 0 ? t({ th: `ลด ${formatBaht(off)}`, en: `${formatBaht(off)} off` }) : "",
  ].filter(Boolean);
  const account = pos.account;
  const grid = account ? payQr(account.promptpayId, total) : null;
  const cash = pos.payMethod === "cash";
  const stockLine = !online()
    ? t({
        th: "ไม่มีเน็ต · ออกบิลได้ตามปกติ · ตรวจสต็อกตอนส่งเข้าระบบ",
        en: "No internet · the bill still comes out · stock is checked when it sends",
      })
    : shortLines(b.lines).length === 0
      ? t({ th: "สต็อกตรวจแล้ว ครบทุกรายการ", en: "Stock checked · everything is there" })
      : t({
          th: "บางรายการของไม่พอ ระบบจะบอกตอนออกบิล",
          en: "Some items may be short · the system says when issuing",
        });

  return (
    <Sheet
      title={t({ th: "รับเงิน", en: "Take payment" })}
      sub={t({ th: "บิลเงินสด", en: "Cash bill" })}
      onClose={onClose}
      tall
    >
      <View style={styles.amount}>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t({ th: "ยอดที่ต้องชำระ", en: "To pay" })}
        </Text>
        <Text style={[styles.big, { color: theme.text }]}>{formatBaht(total)}</Text>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{facts.join(" · ")}</Text>
      </View>
      <Segmented
        label={t({ th: "จ่ายด้วย", en: "Pay by" })}
        options={[
          { value: "cash", label: t({ th: "เงินสด", en: "Cash" }) },
          { value: "promptpay", label: t({ th: "พร้อมเพย์ (QR)", en: "PromptPay (QR)" }) },
        ]}
        value={pos.payMethod}
        onChange={(v) => pos.setPayMethod(v as "cash" | "promptpay")}
      />
      {cash ? (
        <>
          <Group>
            <FieldRow
              label={t({ th: "ผู้รับเงิน", en: "Received by" })}
              value={pos.receiver}
              placeholder={t({ th: "จำไว้ในเครื่องนี้", en: "Remembered on this phone" })}
              onChange={pos.setReceiver}
              last
            />
          </Group>
          <Note>{stockLine}</Note>
          <BigButton
            label={
              pos.busy
                ? t({ th: "กำลังออกบิล…", en: "Issuing…" })
                : t({ th: "ออกบิล", en: "Issue the bill" })
            }
            onPress={() => void pos.issue()}
          />
        </>
      ) : account ? (
        <>
          <Group>
            <ChoiceRow
              label={t({ th: "รับเข้าบัญชี", en: "Into" })}
              value={`${account.label} · ${account.promptpayId}`}
              onPress={() => {
                const list = pos.data.accounts;
                const next = list[(list.indexOf(account) + 1) % list.length];
                if (next) pos.setAccountId(next.id);
              }}
              last
            />
          </Group>
          {grid && (
            <View style={styles.qr}>
              <QrView
                grid={grid}
                size={180}
                label={t({
                  th: `QR พร้อมเพย์ ${formatBaht(total)}`,
                  en: `PromptPay QR ${formatBaht(total)}`,
                })}
              />
            </View>
          )}
          <View style={styles.owner}>
            <Text style={[TYPE.body, { color: theme.text }]}>
              {account.accountName
                ? t({
                    th: `ชื่อบัญชี ${account.accountName}`,
                    en: `Account name ${account.accountName}`,
                  })
                : t({
                    th: "ยังไม่ได้ใส่ชื่อบัญชี · ใส่ได้ที่หน้าข้อมูลร้าน",
                    en: "No account name yet · add it on the Shop info page",
                  })}
            </Text>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
              {t({
                th: `พร้อมเพย์ ${account.promptpayId}`,
                en: `PromptPay ${account.promptpayId}`,
              })}
            </Text>
          </View>
          <Note>
            {t({
              th: "ให้ลูกค้าสแกนจ่าย แล้วกดเมื่อเห็นในแอปธนาคารว่าโอนสำเร็จ",
              en: "Let the customer scan and pay; press once the bank app shows it arrived",
            })}
          </Note>
          <BigButton
            label={
              pos.busy
                ? t({ th: "กำลังออกบิล…", en: "Issuing…" })
                : t({ th: "ตรวจสอบการชำระเงิน", en: "Payment checked" })
            }
            onPress={() => void pos.issue()}
          />
        </>
      ) : (
        <Note>
          {t({
            th: "ยังไม่ได้ตั้งบัญชีพร้อมเพย์ · ตั้งได้ที่หน้าข้อมูลร้าน",
            en: "No PromptPay account yet · set one on the Shop info page",
          })}
        </Note>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  amount: { alignItems: "center", gap: 2, paddingVertical: SPACE.s },
  big: { fontSize: 44, lineHeight: 52, fontWeight: "700" },
  qr: { alignSelf: "center", padding: 10, borderRadius: 12, backgroundColor: "#FFFFFF" },
  owner: { alignItems: "center" },
});
