import { canShipOrder } from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { formatBaht } from "@/lib/money";
import { stamp } from "@/lib/orderList";
import { canDo } from "@/lib/orderPage";
import {
  decideCod,
  recordDropOff,
  recordRefund,
  reviewPayment,
  type OrderDetail,
} from "@/lib/ordersApi";
import { useLang, useTheme } from "../AppProviders";
import { SPACE, TYPE } from "../theme";
import { CancelRefundDone, cancelLine } from "./Cancel";
import { ICON, STEP_ICON } from "./icons";
import { DropOffSheet, ErrorLine, InsetRow, ReasonSheet, SAVING, insetBox } from "./JobForms";
import { JobBox, JobHead, Say, SectionTitle, SmallButton } from "./parts";
import { usePin } from "./pin";
import { pickImage } from "./pickImage";
import { PrivateImage } from "./PrivateImage";
import { LabelPreview, SaveButtons, useLabelFile } from "./ShippingLabel";

/** What every job box needs from the page: the order, the session, and one way to do things. */
export interface JobContext {
  detail: OrderDetail;
  token: string;
  /** Runs one save; on success the page shows `done` as a message and reloads the order. */
  run: (work: () => Promise<void>, done: { title: string; detail: string }) => void;
  busy: boolean;
}

const PAY_ROLES: Phrase = {
  th: "เฉพาะผู้ดูแลระดับสูงและผู้ดูแล",
  en: "Super admin and admin only",
};

/** ตรวจสอบการชำระเงิน — confirm the transfer, or send it back with a reason. */
export function PayJob({ ctx }: { ctx: JobContext }) {
  const { t } = useLang();
  const [rejecting, setRejecting] = useState(false);
  const { order } = ctx.detail;
  const total = formatBaht(order.grandTotalSatang);
  const allowed = canDo("pay", ctx.detail.viewerRole);
  // Drawing 6, row 3: the slip came after the shop cancelled — confirming it means a full refund.
  const cancelled = order.orderStatus === "cancelled";
  // The decision is pinned at the bottom of the page, red over grey (Shopee; owner, 29 Oct).
  usePin(
    order.slipImageKey && allowed
      ? [
          {
            label: ctx.busy
              ? t(SAVING)
              : t({ th: `ยืนยันการชำระเงิน ${total}`, en: `Confirm payment ${total}` }),
            onPress: () =>
              ctx.run(() => reviewPayment(fetch, API_BASE, ctx.token, order.id, "confirm"), {
                title: t({
                  th: `ยืนยันการชำระเงิน ${total} แล้ว`,
                  en: `Payment ${total} confirmed`,
                }),
                detail: cancelled
                  ? t({ th: "งานคืนเงินขึ้นมาให้ทำต่อ", en: "The refund is next" })
                  : t({ th: "ออเดอร์ไปที่ เตรียมจัดส่ง", en: "The order moved to To ship" }),
              }),
          },
          {
            label: t({ th: "ปฏิเสธ", en: "Reject" }),
            kind: "grey",
            onPress: () => setRejecting(true),
          },
        ]
      : [],
  );
  return (
    <>
      <SectionTitle text={t({ th: "ตรวจสอบการชำระเงิน", en: "Review the payment" })} />
      <JobBox>
        <Say
          text={
            order.slipImageKey
              ? t({
                  th: `ลูกค้าโอนเงิน ${total} และส่งสลิปแล้ว`,
                  en: `The customer paid ${total} and sent a slip`,
                })
              : t({
                  th: "ยังไม่มีสลิป · รอลูกค้าส่งสลิป",
                  en: "No slip yet · waiting for the customer",
                })
          }
        />
        {cancelled && (
          <Say
            quiet
            text={t({
              th: "ออเดอร์นี้ยกเลิกแล้ว · ยืนยันแล้วต้องคืนเงินเต็มจำนวน",
              en: "This order is cancelled · confirming means a full refund",
            })}
          />
        )}
        {order.slipImageKey && ctx.detail.viewerIsSuperAdmin && (
          <View style={{ alignSelf: "center" }}>
            <PrivateImage
              fileKey={order.slipImageKey}
              label={t({ th: "สลิปการชำระเงิน", en: "Payment slip" })}
              style={styles.slip}
            />
          </View>
        )}
        {order.slipImageKey && (
          <Say
            small
            quiet
            center
            text={t({
              th: "เห็นรูปสลิปได้เฉพาะเจ้าของร้าน · พนักงานกดยืนยันได้โดยไม่เห็นรูป",
              en: "Only the owner sees the slip · staff can confirm without it",
            })}
          />
        )}
        {order.slipImageKey && !allowed && <Say quiet text={t(PAY_ROLES)} />}
      </JobBox>
      {rejecting && (
        <ReasonSheet
          title={t({ th: "ปฏิเสธการชำระเงิน", en: "Reject the payment" })}
          label={t({ th: "เหตุผลที่ปฏิเสธ (จำเป็น)", en: "Reason for rejecting (required)" })}
          placeholder={t({
            th: "เช่น ยอดไม่ตรง, สลิปไม่ชัด…",
            en: "e.g. wrong amount, unclear slip…",
          })}
          note={
            cancelled
              ? t({
                  th: "ปฏิเสธแล้วออเดอร์ยังเป็นยกเลิก และยังไม่จ่าย",
                  en: "The order stays cancelled and unpaid.",
                })
              : t({
                  th: "ปฏิเสธแล้วคำสั่งซื้อจะกลับไปที่ “รอชำระเงิน” และให้เวลาลูกค้าใหม่ 48 ชม.",
                  en: "The order goes back to Unpaid and the customer gets a new 48 hours.",
                })
          }
          confirm={t({ th: "ยืนยันการปฏิเสธ", en: "Confirm rejection" })}
          busy={ctx.busy}
          onClose={() => setRejecting(false)}
          onConfirm={(reason) => {
            setRejecting(false);
            ctx.run(() => reviewPayment(fetch, API_BASE, ctx.token, order.id, "reject", reason), {
              title: t({ th: "ปฏิเสธการชำระเงินแล้ว", en: "Payment rejected" }),
              detail: cancelled
                ? t({ th: "ออเดอร์ยังเป็นยกเลิก", en: "The order stays cancelled" })
                : t({ th: "ออเดอร์กลับไปที่ รอชำระเงิน", en: "The order is back to Unpaid" }),
            });
          }}
        />
      )}
    </>
  );
}

/** อนุมัติเก็บเงินปลายทาง — with the customer's record beside the decision. */
export function CodJob({ ctx }: { ctx: JobContext }) {
  const { t } = useLang();
  const { order, customer } = ctx.detail;
  const total = formatBaht(order.grandTotalSatang);
  const allowed = canDo("cod", ctx.detail.viewerRole);
  const decide = (decision: "approve" | "deny") =>
    ctx.run(() => decideCod(fetch, API_BASE, ctx.token, order.id, decision), {
      title:
        decision === "approve"
          ? t({ th: "อนุมัติเก็บปลายทางแล้ว", en: "COD approved" })
          : t({ th: "ปฏิเสธเก็บปลายทางแล้ว", en: "COD refused" }),
      detail:
        decision === "approve"
          ? t({ th: "ออเดอร์ไปที่ เตรียมจัดส่ง", en: "The order moved to To ship" })
          : t({
              th: "ลูกค้าเลือกโอนเงินแทนหรือยกเลิก",
              en: "The customer pays by transfer or cancels",
            }),
    });
  usePin(
    allowed
      ? [
          {
            label: ctx.busy ? t(SAVING) : t({ th: "อนุมัติเก็บปลายทาง", en: "Approve COD" }),
            onPress: () => decide("approve"),
          },
          { label: t({ th: "ปฏิเสธ", en: "Refuse" }), kind: "grey", onPress: () => decide("deny") },
        ]
      : [],
  );
  return (
    <>
      <SectionTitle text={t({ th: "อนุมัติเก็บเงินปลายทาง", en: "Approve cash on delivery" })} />
      <JobBox>
        <Say
          text={t({
            th: `ลูกค้าขอเก็บเงินปลายทาง ${total}`,
            en: `The customer asks to pay ${total} on delivery`,
          })}
        />
        <View style={insetBox}>
          <InsetRow
            label={t({ th: "ระดับลูกค้า", en: "Customer tier" })}
            value={customer?.tier ?? "—"}
          />
          <InsetRow
            label={t({ th: "ออเดอร์ที่ผ่านมา", en: "Past orders" })}
            value={
              customer
                ? t({
                    th: `สำเร็จ ${customer.completeCount} · ไม่สำเร็จ ${customer.incompleteCount}`,
                    en: `${customer.completeCount} done · ${customer.incompleteCount} not`,
                  })
                : "—"
            }
            last
          />
        </View>
        {allowed ? (
          <Say
            small
            quiet
            text={t({
              th: "อนุมัติ → ไปที่ เตรียมจัดส่ง · ปฏิเสธ → ลูกค้าเลือกโอนเงินแทนหรือยกเลิก",
              en: "Approve → To ship · Refuse → the customer pays by transfer or cancels",
            })}
          />
        ) : (
          <Say quiet text={t(PAY_ROLES)} />
        )}
      </JobBox>
    </>
  );
}

/**
 * ส่งของ — the label, then the drop-off (carrier, tracking, what the carrier charged). Not named
 * การจัดส่ง: that is the shipping-details section further down the same page.
 */
export function ShipJob({ ctx }: { ctx: JobContext }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [recording, setRecording] = useState(false);
  const { order, address } = ctx.detail;
  const ready = canShipOrder(order.paymentStatus, order.slipImageKey);
  const file = useLabelFile(order.externalOrderId);
  usePin(
    ready
      ? [
          {
            label: t({ th: "บันทึกการส่งของ", en: "Record drop-off" }),
            onPress: () => setRecording(true),
          },
        ]
      : [],
  );
  return (
    <>
      <SectionTitle text={t({ th: "ส่งของ", en: "Send the parcel" })} />
      <JobBox>
        {/* The label shows here without a tap (owner, 29 Oct); PDF / PNG save it. */}
        <JobHead
          icon={ICON.print}
          color={theme.toShip}
          title={t({ th: "ใบปะหน้าพัสดุ", en: "Shipping label" })}
          right={<SaveButtons file={file} />}
        />
        <LabelPreview detail={ctx.detail} token={ctx.token} file={file} />
        {ready ? (
          <Say
            small
            quiet
            text={t({
              th: "ส่งของได้เมื่อเงินเข้าแล้วเท่านั้น · ออเดอร์โอนเงินต้องมีสลิปที่อนุมัติแล้ว",
              en: "Ship only once paid · a transfer needs an approved slip",
            })}
          />
        ) : (
          <Say
            quiet
            text={t({
              th: "ออเดอร์นี้ชำระด้วยการโอนเงิน แต่ยังไม่มีสลิปที่อนุมัติแล้ว — ส่งของไม่ได้จนกว่าจะมีสลิป",
              en: "Paid by transfer with no approved slip — it cannot ship until there is one",
            })}
          />
        )}
      </JobBox>
      {recording && (
        <DropOffSheet
          title={t({ th: "บันทึกการส่งของ", en: "Record drop-off" })}
          orderNo={order.externalOrderId}
          address={address}
          feeLabel={t({ th: "ค่าส่งจริง", en: "Real cost" })}
          after={t({
            th: "บันทึกแล้วออเดอร์ไปที่ กำลังจัดส่ง",
            en: "The order then moves to In transit",
          })}
          busy={ctx.busy}
          onClose={() => setRecording(false)}
          onSave={(v) => {
            setRecording(false);
            ctx.run(
              () =>
                recordDropOff(fetch, API_BASE, ctx.token, order.id, {
                  carrier: v.carrier,
                  trackingNo: v.trackingNo,
                  shippingRealSatang: v.shippingRealSatang,
                }),
              {
                title: t({ th: "บันทึกการส่งของแล้ว", en: "Drop-off recorded" }),
                detail: t({
                  th: `${v.carrier} · ${v.trackingNo}`,
                  en: `${v.carrier} · ${v.trackingNo}`,
                }),
              },
            );
          }}
        />
      )}
    </>
  );
}

const REFUND_TITLE = {
  bounced: {
    open: { th: "คืนเงิน (พัสดุตีกลับ)", en: "Refund (parcel bounced back)" },
    done: { th: "คืนเงินแล้ว (พัสดุตีกลับ)", en: "Refunded (parcel bounced back)" },
  },
  cancelled: {
    open: { th: "คืนเงิน (ยกเลิกออเดอร์)", en: "Refund (order cancelled)" },
    done: { th: "คืนเงินแล้ว (ยกเลิกออเดอร์)", en: "Refunded (order cancelled)" },
  },
} as const;

/** คืนเงิน (พัสดุตีกลับ / ยกเลิกออเดอร์) — the owner transfers the full amount back and attaches
 *  the slip. The same job for a bounced parcel and a paid order the shop cancelled (board 5). */
export function RefundJob({ ctx }: { ctx: JobContext }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { order } = ctx.detail;
  const total = formatBaht(order.grandTotalSatang);
  const owner = canDo("refund", ctx.detail.viewerRole);
  const done = ctx.detail.refundAction === "refunded";
  const cancelled = order.orderStatus === "cancelled";
  const title = REFUND_TITLE[cancelled ? "cancelled" : "bounced"][done ? "done" : "open"];
  if (cancelled && done) {
    return (
      <>
        <SectionTitle text={t(title)} />
        <JobBox>
          <CancelRefundDone detail={ctx.detail} />
        </JobBox>
      </>
    );
  }
  const why = cancelLine(ctx.detail, t);
  return (
    <>
      <SectionTitle text={t(title)} />
      <JobBox>
        <JobHead
          icon={STEP_ICON.back}
          color={theme.danger}
          title={t({ th: "ยอดคืนเต็มจำนวน", en: "Full amount" })}
          right={<Text style={[TYPE.body, { color: theme.text }]}>{total}</Text>}
        />
        {why && <Say quiet text={why} />}
        {done ? (
          <RefundDone ctx={ctx} />
        ) : (
          <>
            <Text style={[TYPE.subhead, { color: theme.text, fontWeight: "600" }]}>
              {t({ th: "บัญชีรับเงินคืนของลูกค้า", en: "The customer's refund account" })}
            </Text>
            <RefundAccount ctx={ctx} />
            {owner && order.refundAccountNo ? (
              <>
                <Say
                  small
                  quiet
                  text={t({
                    th: "เห็นบัญชีและกดคืนเงินได้เฉพาะเจ้าของร้าน",
                    en: "Only the owner sees the account and refunds",
                  })}
                />
                <Text style={[TYPE.subhead, { color: theme.text, fontWeight: "600" }]}>
                  {t({ th: "สลิปการโอนคืน", en: "Our refund slip" })}
                </Text>
                <SlipConfirm
                  busy={ctx.busy}
                  label={t({ th: `ยืนยันการคืนเงิน ${total}`, en: `Confirm refund ${total}` })}
                  onConfirm={(slip) =>
                    ctx.run(() => recordRefund(fetch, API_BASE, ctx.token, order.id, slip), {
                      title: t({ th: `คืนเงิน ${total} แล้ว`, en: `Refunded ${total}` }),
                      detail: t({
                        th: "แนบสลิปการโอนไว้ในออเดอร์แล้ว",
                        en: "Our transfer slip is on the order",
                      }),
                    })
                  }
                />
              </>
            ) : cancelled && owner ? null : (
              <Say
                quiet
                text={
                  owner
                    ? t({
                        th: "ต้องมีบัญชีของลูกค้าก่อนจึงจะคืนเงินได้",
                        en: "The customer's account is needed first",
                      })
                    : t({
                        th: "รอผู้ดูแลระดับสูงดำเนินการคืนเงิน",
                        en: "Waiting for the super admin to refund",
                      })
                }
              />
            )}
          </>
        )}
      </JobBox>
    </>
  );
}

export function RefundAccount({ ctx }: { ctx: JobContext }) {
  const { t } = useLang();
  const { order } = ctx.detail;
  if (!ctx.detail.viewerIsSuperAdmin) {
    return <Say quiet text={t({ th: "เฉพาะผู้ดูแลระดับสูง", en: "Super admin only" })} />;
  }
  if (!order.refundAccountNo) {
    return (
      <Say
        quiet
        text={
          order.orderStatus === "cancelled"
            ? t({
                th: "รอลูกค้าแจ้งบนหน้าติดตามคำสั่งซื้อ · ได้บัญชีแล้วปุ่มคืนเงินจะขึ้นเอง",
                en: "Waiting for the customer on their order page · the refund button comes with the account",
              })
            : t({
                th: "รอลูกค้าแจ้งบัญชีรับเงินคืนบนหน้าเว็บ AirPlus",
                en: "Waiting for the customer to send a refund account on AirPlus",
              })
        }
      />
    );
  }
  return (
    <View style={insetBox}>
      <InsetRow label={t({ th: "ธนาคาร", en: "Bank" })} value={order.refundBankName ?? "—"} />
      <InsetRow label={t({ th: "เลขบัญชี", en: "Account no." })} value={order.refundAccountNo} />
      <InsetRow
        label={t({ th: "ชื่อบัญชี", en: "Account name" })}
        value={order.refundAccountName ?? "—"}
        last
      />
    </View>
  );
}

function RefundDone({ ctx }: { ctx: JobContext }) {
  const { t } = useLang();
  const { order } = ctx.detail;
  return (
    <>
      {order.refundSlipImageKey && (
        <PrivateImage
          fileKey={order.refundSlipImageKey}
          label={t({ th: "หลักฐานการคืนเงิน", en: "Proof of refund" })}
          style={styles.slip}
        />
      )}
      <View style={insetBox}>
        <InsetRow
          label={t({ th: "คืนเมื่อ", en: "Refunded on" })}
          value={order.refundedAt ? stamp(order.refundedAt) : "—"}
        />
        <InsetRow label={t({ th: "โดย", en: "By" })} value={order.refundActorEmail ?? "—"} last />
      </View>
    </>
  );
}

/** "＋ เลือกสลิป" in the box; the red confirm that names the amount is pinned. The slip is required. */
export function SlipConfirm(props: {
  label: string;
  busy: boolean;
  onConfirm: (slip: Blob) => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const [slip, setSlip] = useState<Blob | null>(null);
  const [missing, setMissing] = useState<string | null>(null);
  const choose = () => {
    void pickImage().then((file) => {
      if (file) {
        setSlip(file);
        setMissing(null);
      } else if (!slip) {
        setMissing(
          t({
            th: "ยังไม่ได้เลือกสลิป · บนแอปมือถือให้ใช้หน้าเว็บก่อน",
            en: "No slip chosen · use the web for now",
          }),
        );
      }
    });
  };
  const name = slip && "name" in slip ? String((slip as File).name) : null;
  usePin([
    {
      label: props.busy ? t(SAVING) : props.label,
      onPress: () => {
        if (props.busy) return;
        if (!slip) {
          setMissing(t({ th: "เลือกสลิปการโอนก่อนยืนยัน", en: "Choose the transfer slip first" }));
          return;
        }
        props.onConfirm(slip);
      },
    },
  ]);
  return (
    <>
      <Say
        quiet
        text={t({
          th: "โอนเงินเต็มจำนวนแล้วแนบสลิปการโอนเพื่อยืนยัน",
          en: "Transfer the full amount, then attach the slip",
        })}
      />
      <View style={styles.tools}>
        <SmallButton label={t({ th: "＋ เลือกสลิป", en: "＋ Choose slip" })} onPress={choose} />
        {name && (
          <Text style={[TYPE.subhead, { color: theme.textMuted, flex: 1 }]} numberOfLines={1}>
            {name}
          </Text>
        )}
      </View>
      {missing && <ErrorLine text={missing} />}
    </>
  );
}

const styles = StyleSheet.create({
  slip: { width: 160, height: 240, borderRadius: 12 },
  tools: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
});
