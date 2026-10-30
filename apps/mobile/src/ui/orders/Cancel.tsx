import { CANCEL_REASONS, cancelReasonLabel, type CancelReason } from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { stamp } from "@/lib/orderList";
import { cancelInfo, refundOnCancel } from "@/lib/orderPage";
import { cancelOrder, type OrderDetail } from "@/lib/ordersApi";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import type { ChromeToast } from "../ScreenChrome";
import { RADIUS, SPACE, TYPE } from "../theme";
import { ICON, STEP_ICON } from "./icons";
import { ErrorLine, InsetRow, SAVING, insetBox } from "./JobForms";
import { JobBox, JobHead, Say, SectionTitle } from "./parts";
import { PrivateImage } from "./PrivateImage";
import { Sheet } from "./Sheet";

/**
 * The shop cancelling an order (owner approved the drawings, 30 Oct 2026, boards 5–6): the sheet
 * behind ยกเลิกออเดอร์, and what a cancelled order shows at the top afterwards.
 */

const CANCEL: Phrase = { th: "ยกเลิกออเดอร์", en: "Cancel order" };

/** What is in the box, one line per product: "สวิตช์แอร์ Honda City × 1". */
const itemsOf = (detail: OrderDetail) =>
  detail.lines.map((l) => `${l.name ?? l.sku ?? "—"} × ${l.quantity}`).join("\n");

/** ยกเลิกเมื่อ 30/10/26 · 10:12 · สินค้าหมด — whichever parts the order recorded. */
export function cancelLine(detail: OrderDetail, t: (p: Phrase) => string): string | null {
  const info = cancelInfo(detail.order, detail.timeline);
  if (!info) return null;
  return [
    `${t({ th: "ยกเลิกเมื่อ", en: "Cancelled" })} ${info.at != null ? stamp(info.at) : "—"}`,
    info.reason ? cancelReasonLabel(info.reason) : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** ยกเลิกออเดอร์: a required reason, an optional note, what the cancel gives back, then red. */
export function CancelSheet(props: {
  detail: OrderDetail;
  token: string;
  onClose: () => void;
  onDone: (toast: ChromeToast) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { order } = props.detail;
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [note, setNote] = useState("");
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const refund = refundOnCancel(order);
  const noteLabel = t({ th: "หมายเหตุ (ไม่บังคับ)", en: "Note (optional)" });

  const confirm = () => {
    if (busy) return;
    if (!reason) {
      setMissing(true);
      return;
    }
    setBusy(true);
    setFailed(null);
    cancelOrder(fetch, API_BASE, props.token, order.id, reason, note)
      .then(() =>
        props.onDone({
          title: t({ th: "ยกเลิกออเดอร์แล้ว", en: "Order cancelled" }),
          detail:
            refund != null
              ? t({ th: "งานคืนเงินขึ้นมาให้ทำต่อ", en: "The refund is next" })
              : t({ th: "คืนสต็อกและคูปองแล้ว", en: "Stock and coupon are back" }),
        }),
      )
      .catch((e: unknown) => setFailed(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  return (
    <Sheet title={t(CANCEL)} sub={order.externalOrderId} onClose={props.onClose}>
      <Text style={[styles.label, { color: theme.text }]}>
        {t({ th: "เหตุผล (จำเป็น)", en: "Reason (required)" })}
      </Text>
      <View
        style={[styles.card, { backgroundColor: theme.surface }]}
        accessibilityRole="radiogroup"
      >
        {CANCEL_REASONS.map((r, i) => (
          <Pressable
            key={r}
            onPress={() => {
              setReason(r);
              setMissing(false);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: r === reason }}
            style={[
              styles.choice,
              i < CANCEL_REASONS.length - 1 && {
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: theme.border,
              },
            ]}
          >
            <Text style={[TYPE.body, { color: theme.text, flex: 1 }]}>{cancelReasonLabel(r)}</Text>
            {r === reason && (
              <LineIcon d={ICON.check} color={theme.primary} size={18} strokeWidth={2.6} />
            )}
          </Pressable>
        ))}
      </View>
      {missing && <ErrorLine text={t({ th: "เลือกเหตุผลก่อน", en: "Choose a reason first" })} />}

      <Text style={[styles.label, styles.next, { color: theme.text }]}>{noteLabel}</Text>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={t({ th: "เช่น ลูกค้าสั่งซ้ำ", en: "e.g. ordered twice" })}
          placeholderTextColor={theme.textFaint}
          accessibilityLabel={noteLabel}
          style={[styles.input, { color: theme.text }]}
        />
      </View>

      <Text style={[styles.label, styles.next, { color: theme.text }]}>
        {t({ th: "เมื่อยกเลิก", en: "When cancelled" })}
      </Text>
      <View style={insetBox}>
        <InsetRow label={t({ th: "คืนสต็อก", en: "Stock back" })} value={itemsOf(props.detail)} />
        <InsetRow
          label={t({ th: "คูปอง", en: "Coupon" })}
          value={t({ th: "คืนให้ลูกค้า (ถ้าใช้)", en: "Given back (if used)" })}
          last={refund == null}
        />
        {refund != null && (
          <InsetRow
            stacked
            last
            label={t({
              th: `ลูกค้าโอนแล้ว ${formatBaht(refund)}`,
              en: `The customer paid ${formatBaht(refund)}`,
            })}
            value={t({ th: "งานคืนเงินขึ้นมาให้ทำต่อ", en: "The refund comes up next" })}
          />
        )}
      </View>
      <Say
        small
        quiet
        text={t({ th: "ยกเลิกได้ก่อนส่งของเท่านั้น", en: "Only before the parcel is sent" })}
      />
      {failed && <ErrorLine text={failed} />}
      <View style={styles.next}>
        <BigButton label={busy ? t(SAVING) : t(CANCEL)} onPress={confirm} />
      </View>
    </Sheet>
  );
}

/** ยกเลิกแล้ว — a cancelled order nobody owes anything on: when, why, and what came back. */
export function CancelledCard({ detail }: { detail: OrderDetail }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const info = cancelInfo(detail.order, detail.timeline);
  if (!info) return null;
  const rows = [
    info.reason && {
      label: t({ th: "เหตุผล", en: "Reason" }),
      value: cancelReasonLabel(info.reason),
    },
    info.restocked && { label: t({ th: "คืนสต็อก", en: "Stock back" }), value: itemsOf(detail) },
    info.restocked && {
      label: t({ th: "คูปอง", en: "Coupon" }),
      value: info.couponBack
        ? t({ th: "คืนให้ลูกค้าแล้ว", en: "Given back" })
        : t({ th: "ไม่ได้ใช้คูปอง", en: "None used" }),
    },
  ].filter((r): r is { label: string; value: string } => !!r);
  return (
    <>
      <SectionTitle text={t({ th: "ยกเลิกแล้ว", en: "Cancelled" })} />
      <JobBox>
        <JobHead
          icon={STEP_ICON.back}
          color={theme.textMuted}
          title={`${t({ th: "ยกเลิกเมื่อ", en: "Cancelled" })} ${info.at != null ? stamp(info.at) : "—"}`}
        />
        {rows.length > 0 && (
          <View style={insetBox}>
            {rows.map((r, i) => (
              <InsetRow
                key={r.label}
                label={r.label}
                value={r.value}
                last={i === rows.length - 1}
              />
            ))}
          </View>
        )}
        <Say
          quiet
          text={
            detail.order.paymentStatus === "paid"
              ? t({ th: "ไม่มีอะไรต้องทำต่อ", en: "Nothing left to do" })
              : t({
                  th: "ลูกค้ายังไม่ได้โอน · ไม่มีอะไรต้องทำต่อ",
                  en: "The customer has not paid · nothing left to do",
                })
          }
        />
      </JobBox>
    </>
  );
}

/** คืนเงินแล้ว on a cancelled order (board 5, row 4): when we paid back, and our slip behind ดู ›. */
export function CancelRefundDone({ detail }: { detail: OrderDetail }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [viewing, setViewing] = useState(false);
  const { order } = detail;
  const slipLabel = t({ th: "สลิปการโอนคืน", en: "Our refund slip" });
  return (
    <>
      <JobHead
        icon={STEP_ICON.back}
        color={theme.text}
        title={t({ th: "คืนเงินแล้ว", en: "Refunded" })}
        right={
          <Text style={[TYPE.headline, { color: theme.text }]}>
            {formatBaht(order.refundSatang ?? order.grandTotalSatang)}
          </Text>
        }
      />
      <Say
        quiet
        text={[
          `${t({ th: "โอนคืนเมื่อ", en: "Paid back" })} ${order.refundedAt ? stamp(order.refundedAt) : "—"}`,
          t({
            th: "ลูกค้าเห็นสลิปนี้บนหน้าติดตามคำสั่งซื้อ",
            en: "The customer sees this slip on their order page",
          }),
        ].join(" · ")}
      />
      {order.refundSlipImageKey && (
        <Pressable
          onPress={() => setViewing(true)}
          accessibilityRole="button"
          accessibilityLabel={slipLabel}
          style={insetBox}
        >
          <View style={styles.slipRow}>
            <Text style={[TYPE.subhead, { color: theme.text, flex: 1 }]}>{slipLabel}</Text>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
              {t({ th: "ดู ›", en: "View ›" })}
            </Text>
          </View>
        </Pressable>
      )}
      {viewing && order.refundSlipImageKey && (
        <Sheet
          title={slipLabel}
          sub={order.externalOrderId}
          closeLabel={t({ th: "ปิด", en: "Close" })}
          onClose={() => setViewing(false)}
          tall
        >
          <PrivateImage fileKey={order.refundSlipImageKey} label={slipLabel} style={styles.slip} />
        </Sheet>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...TYPE.subhead, fontWeight: "600", marginHorizontal: 4 },
  next: { marginTop: SPACE.l },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  /** The guide's one-line row: 52 high, the divider starting at the text. */
  choice: {
    minHeight: 52,
    marginLeft: SPACE.l,
    paddingRight: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: { ...TYPE.body, minHeight: 52, paddingHorizontal: SPACE.l },
  slipRow: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  slip: { width: "100%", height: 480, borderRadius: RADIUS.card },
});
