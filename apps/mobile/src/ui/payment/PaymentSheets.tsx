import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { formatBaht } from "@/lib/money";
import { clockTime } from "@/lib/orderList";
import { amountText, clearSummary, maskPromptpay, type PaymentRow } from "@/lib/paymentPage";
import type { ReceiveAccount } from "@/lib/posApi";
import { payQr } from "@/lib/qr";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Group, Row } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { ChoiceRow, FieldError, Note } from "../pos/fields";
import { CameraBox } from "../scan/CameraBox";
import { QrView } from "../scan/QrView";
import { SPACE, TYPE } from "../theme";
import type { PaymentPage } from "./usePaymentPage";

/** The one pop-up that is open, if any. */
export function PaymentSheets({ page }: { page: PaymentPage }) {
  const close = () => page.setSheet(null);
  const s = page.sheet;
  if (s === null) return null;
  if (s === "amount") return <AmountSheet page={page} onClose={close} />;
  if (s === "account") return <AccountSheet page={page} />;
  if (s === "qr") return <QrSheet page={page} onClose={close} />;
  if (s === "done") return <DoneSheet page={page} onClose={close} />;
  if (s === "clear") return <ClearSheet page={page} onClose={close} />;
  return <SlipSheet page={page} row={s.slip} onClose={close} />;
}

const KEY_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];

/** ชำระเงิน 2 · สร้าง QR: the amount on the shop's own keypad, and which account it goes into. */
function AmountSheet({ page, onClose }: { page: PaymentPage; onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const a = page.account;
  return (
    <Sheet
      title={t({ th: "รับเงินผ่านพร้อมเพย์", en: "Take a PromptPay payment" })}
      onClose={onClose}
    >
      <View style={[styles.amountBox, { backgroundColor: theme.surface }]}>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t({ th: "จำนวนเงิน", en: "Amount" })}
        </Text>
        <Text style={[styles.amount, { color: theme.text }]}>{amountText(page.typed)}</Text>
      </View>
      {page.tried && page.satang <= 0 && (
        <FieldError text={t({ th: "ใส่จำนวนเงินก่อน", en: "Enter the amount first" })} />
      )}
      <Group>
        <ChoiceRow
          label={t({ th: "รับเข้าบัญชี", en: "Into" })}
          value={a ? `${a.label} · ${maskPromptpay(a.promptpayId)}` : ""}
          onPress={() => page.setSheet("account")}
          last
        />
      </Group>
      <View style={styles.keypad}>
        {KEY_ROWS.map((keys) => (
          <View key={keys.join("")} style={styles.keyRow}>
            {keys.map((k) => (
              <Pressable
                key={k}
                onPress={() => page.press(k)}
                accessibilityRole="button"
                accessibilityLabel={k === "⌫" ? t({ th: "ลบ", en: "Delete" }) : k}
                style={({ pressed }) => [
                  styles.key,
                  { backgroundColor: k === "." || k === "⌫" ? "transparent" : theme.surface },
                  pressed && { backgroundColor: theme.border },
                ]}
              >
                <Text style={[styles.keyText, { color: theme.text }]}>{k}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <BigButton label={t({ th: "สร้าง QR", en: "Make the QR" })} onPress={page.makeQr} />
    </Sheet>
  );
}

/** แตะบัญชี → เลือกบัญชีที่รับเงิน; ‹ กลับ returns to the amount as it was. */
function AccountSheet({ page }: { page: PaymentPage }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const back = () => page.setSheet("amount");
  const list = page.accounts ?? [];
  return (
    <Sheet
      title={t({ th: "รับเข้าบัญชี", en: "Into" })}
      left={{ label: t({ th: "‹ กลับ", en: "‹ Back" }), onPress: back }}
      onClose={back}
    >
      <Group>
        {list.map((a, i) => (
          <Pressable
            key={a.id}
            onPress={() => {
              page.setAccountId(a.id);
              back();
            }}
            accessibilityRole="button"
          >
            <View style={styles.account}>
              <View style={styles.flex}>
                <Text style={[TYPE.headline, { color: theme.text }]}>
                  {a.isDefault
                    ? t({ th: `${a.label} (ค่าเริ่มต้น)`, en: `${a.label} (default)` })
                    : a.label}
                </Text>
                <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{accountLine(a)}</Text>
              </View>
              {page.account?.id === a.id && (
                <LineIcon d={ICON.check} color={theme.primary} size={20} strokeWidth={2.6} />
              )}
            </View>
            {i < list.length - 1 && (
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            )}
          </Pressable>
        ))}
      </Group>
      <Note>
        {t({ th: "เพิ่มหรือแก้บัญชีได้ที่ ข้อมูลร้าน", en: "Add or change accounts on Shop info" })}
      </Note>
    </Sheet>
  );
}

const accountLine = (a: ReceiveAccount) =>
  a.accountName
    ? `${a.accountName} · ${maskPromptpay(a.promptpayId)}`
    : maskPromptpay(a.promptpayId);

/** The account's readable name right under the QR or the tick (owner rule, 30 Oct 2026). */
function AccountName({ account }: { account: ReceiveAccount }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[TYPE.body, { color: theme.text }]}>
        {account.accountName
          ? t({ th: `ชื่อบัญชี ${account.accountName}`, en: `Account name ${account.accountName}` })
          : t({
              th: "ยังไม่ได้ใส่ชื่อบัญชี · ใส่ได้ที่หน้าข้อมูลร้าน",
              en: "No account name yet · add it on Shop info",
            })}
      </Text>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
        {t({
          th: `พร้อมเพย์ ${maskPromptpay(account.promptpayId)}`,
          en: `PromptPay ${maskPromptpay(account.promptpayId)}`,
        })}
      </Text>
    </View>
  );
}

function Amount({ satang, label }: { satang: number; label: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.sheetAmount, { color: theme.text }]}>{formatBaht(satang)}</Text>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
        {t({ th: `เข้าบัญชี ${label}`, en: `Into ${label}` })}
      </Text>
    </View>
  );
}

/** QR พร้อมชื่อบัญชี → ลูกค้าสแกน → กดเมื่อโอนสำเร็จ. The amount is fixed; a wrong one is cancelled. */
function QrSheet({ page, onClose }: { page: PaymentPage; onClose: () => void }) {
  const { t } = useLang();
  const a = page.account;
  if (!a) return null;
  const grid = payQr(a.promptpayId, page.satang);
  return (
    <Sheet
      title={t({ th: "สแกนจ่ายผ่านพร้อมเพย์", en: "Scan to pay by PromptPay" })}
      onClose={onClose}
    >
      <Amount satang={page.satang} label={a.label} />
      {grid && (
        <View style={styles.qrBox}>
          <QrView
            grid={grid}
            size={200}
            label={t({
              th: `QR พร้อมเพย์ ${formatBaht(page.satang)}`,
              en: `PromptPay QR ${formatBaht(page.satang)}`,
            })}
          />
        </View>
      )}
      <AccountName account={a} />
      <Note>
        {t({
          th: "ให้ลูกค้าสแกนจ่าย แล้วกดเมื่อเห็นในแอปธนาคารว่าโอนสำเร็จ · จำนวนเงินแก้ไม่ได้ ถ้าผิดให้ยกเลิกแล้วสร้างใหม่",
          en: "Let the customer scan and pay; press once the bank app shows it arrived · the amount is fixed: cancel and make a new one if it is wrong",
        })}
      </Note>
      <BigButton
        label={
          page.busy
            ? t({ th: "กำลังบันทึก…", en: "Saving…" })
            : t({ th: "ลูกค้าโอนแล้ว · บันทึก", en: "Paid · save" })
        }
        onPress={() => void page.markPaid()}
      />
    </Sheet>
  );
}

/** รับเงินแล้ว: the QR sheet's own layout with icon O (banknote + tick) where the code was. */
function DoneSheet({ page, onClose }: { page: PaymentPage; onClose: () => void }) {
  const { t } = useLang();
  const a = page.account;
  const row = page.taken;
  if (!a || !row) return null;
  const time = clockTime(row.createdAt);
  return (
    <Sheet title={t({ th: "รับเงินแล้ว", en: "Payment received" })} onClose={onClose} noPill>
      <Amount satang={row.amountSatang} label={row.methodLabel} />
      <MoneyTick />
      <AccountName account={a} />
      <Note>
        {t({
          th: `บันทึกแล้ว ${time} · ขึ้นบนสุดของรายการวันนี้ ให้เจ้าของตรวจกับบัญชีธนาคาร`,
          en: `Saved ${time} · at the top of today's list for the owner to check with the bank`,
        })}
      </Note>
      <BigButton label={t({ th: "เสร็จ", en: "Done" })} onPress={onClose} />
    </Sheet>
  );
}

/** Icon O, picked by the owner (30 Oct 2026): a banknote with a tick, no frame. */
function MoneyTick() {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View
      style={styles.center}
      accessible
      accessibilityLabel={t({ th: "รับเงินแล้ว", en: "Received" })}
    >
      <Svg
        width={120}
        height={120}
        viewBox="0 0 24 24"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Rect
          x={1.8}
          y={5.5}
          width={17}
          height={11}
          rx={2}
          stroke={theme.success}
          strokeWidth={1.4}
        />
        <Circle cx={10.3} cy={11} r={2.4} stroke={theme.success} strokeWidth={1.4} />
        <Circle cx={18} cy={17} r={5} fill={theme.success} stroke={theme.bg} strokeWidth={1.2} />
        <Path d="M15.8 17.1l1.5 1.5 2.9-2.9" stroke={theme.onPrimary} strokeWidth={1.5} />
      </Svg>
    </View>
  );
}

/** ล้าง (owner only): how many and how much come off, by account; the records stay. */
function ClearSheet({ page, onClose }: { page: PaymentPage; onClose: () => void }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const sum = clearSummary(page.rows);
  const split = sum.byAccount.map((x) => `${x.label} ${formatBaht(x.satang)}`).join(" · ");
  return (
    <Sheet
      title={t({ th: "ล้างรายการที่ตรวจแล้ว", en: "Clear the checked list" })}
      onClose={onClose}
    >
      <View style={styles.center}>
        <Text style={[styles.clearBig, { color: theme.text }]}>
          {t({
            th: `${sum.count} รายการ · ${formatBaht(sum.totalSatang)}`,
            en: `${sum.count} payments · ${formatBaht(sum.totalSatang)}`,
          })}
        </Text>
        {split ? (
          <Text style={[TYPE.subhead, styles.centerText, { color: theme.textMuted }]}>{split}</Text>
        ) : null}
      </View>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
        {t({
          th: "ล้างเมื่อตรวจกับบัญชีธนาคารแล้วว่าเงินเข้าครบ · รายการจะหายจากหน้านี้ แต่บันทึกยังเก็บไว้ทั้งหมด ดูย้อนหลังได้",
          en: "Clear once the bank shows every payment arrived · they leave this page, but every record is kept",
        })}
      </Text>
      <BigButton
        label={
          page.busy
            ? t({ th: "กำลังล้าง…", en: "Clearing…" })
            : t({ th: `ล้าง ${sum.count} รายการ`, en: `Clear ${sum.count}` })
        }
        onPress={() => void page.clearAll()}
      />
      <Note>{t({ th: "ทำได้เฉพาะเจ้าของร้าน", en: "The shop owner only" })}</Note>
    </Sheet>
  );
}

/** ตรวจสลิป → สแกน QR บนสลิป: the bank checks amount, account, and that the slip is unused. */
function SlipSheet({
  page,
  row,
  onClose,
}: {
  page: PaymentPage;
  row: PaymentRow;
  onClose: () => void;
}) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <Sheet title={t({ th: "ตรวจสลิป", en: "Check the slip" })} onClose={onClose}>
      <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
        {t({
          th: "ส่องกล้องที่ QR มุมสลิปของลูกค้า · ระบบเช็กกับธนาคารว่ายอดและบัญชีตรง และสลิปใบนี้ยังไม่เคยใช้",
          en: "Aim at the QR in the slip's corner · the bank checks the amount, the account, and that the slip is unused",
        })}
      </Text>
      <CameraBox height={260} showHint onCode={(code) => void page.checkSlip(row, code)} />
      <Group>
        <Row
          label={t({ th: "รายการนี้", en: "This payment" })}
          value={`${formatBaht(row.amountSatang)} · ${clockTime(row.createdAt)}`}
          last
        />
      </Group>
      {page.busy && <Note>{t({ th: "กำลังตรวจกับธนาคาร…", en: "Checking with the bank…" })}</Note>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: "center" },
  centerText: { textAlign: "center" },
  amountBox: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: SPACE.l,
    alignItems: "center",
  },
  amount: { fontSize: 44, lineHeight: 53, fontWeight: "700", fontVariant: ["tabular-nums"] },
  keypad: { gap: 6 },
  keyRow: { flexDirection: "row", gap: 6 },
  key: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  keyText: { fontSize: 24, lineHeight: 30 },
  account: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
    paddingVertical: 10,
    paddingHorizontal: SPACE.l,
    minHeight: 64,
  },
  sheetAmount: { fontSize: 40, lineHeight: 48, fontWeight: "700", fontVariant: ["tabular-nums"] },
  qrBox: { alignSelf: "center", padding: 10, borderRadius: 16, backgroundColor: "#FFFFFF" },
  clearBig: { ...TYPE.largeTitle, lineHeight: 41, textAlign: "center" },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: SPACE.l },
});
