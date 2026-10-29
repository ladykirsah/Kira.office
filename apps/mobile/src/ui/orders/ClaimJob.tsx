import type { Phrase } from "@l-shopee/shared/lang";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { stamp } from "@/lib/orderList";
import { activeClaim, addressLine, canDo, claimStep } from "@/lib/orderPage";
import {
  moveClaim,
  recordClaimRefund,
  recordClaimReturn,
  type OrderAddress,
} from "@/lib/ordersApi";
import { useLang, useTheme } from "../AppProviders";
import { SPACE, TYPE } from "../theme";
import { STEP_ICON } from "./icons";
import { DropOffSheet, InsetRow, ReasonSheet, SAVING, insetBox } from "./JobForms";
import { RefundAccount, SlipConfirm, type JobContext } from "./Jobs";
import { JobBox, JobHead, Say, SectionTitle } from "./parts";
import { usePin } from "./pin";
import { PrivateImage } from "./PrivateImage";

/** จัดการเคลมสินค้า — the claim's details, then the one step it is waiting for. */
export function ClaimJob({ ctx }: { ctx: JobContext }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const claim = activeClaim(ctx.detail.claims);
  const [assignee, setAssignee] = useState<string>(claim?.assigneeName ?? "");
  const [rejecting, setRejecting] = useState(false);
  const [shipping, setShipping] = useState(false);
  const step = claim ? claimStep(claim) : null;
  const allowed = canDo("claim", ctx.detail.viewerRole);
  const move = (state: string, title: Phrase, reason?: string) => {
    if (!claim) return;
    ctx.run(
      () =>
        moveClaim(fetch, API_BASE, ctx.token, claim.id, state, {
          assignee: assignee.trim() || undefined,
          reason,
        }),
      { title: t(title), detail: ctx.detail.order.externalOrderId },
    );
  };
  // The step's action is pinned at the bottom of the page (owner, 29 Oct); a refund pins its own
  // confirm from SlipConfirm, beside the slip it needs.
  usePin(
    !allowed || !step
      ? []
      : step === "receive"
        ? [
            {
              label: ctx.busy ? t(SAVING) : t({ th: "ได้รับสินค้าแล้ว", en: "Item received" }),
              onPress: () =>
                move("received", { th: "รับสินค้าเคลมแล้ว", en: "Claim item received" }),
            },
          ]
        : step === "review"
          ? [
              {
                label: ctx.busy ? t(SAVING) : t({ th: "อนุมัติเคลม", en: "Approve claim" }),
                onPress: () =>
                  move("mechanic_approved", { th: "อนุมัติเคลมแล้ว", en: "Claim approved" }),
              },
              {
                label: t({ th: "ปฏิเสธ", en: "Reject" }),
                kind: "grey",
                onPress: () => setRejecting(true),
              },
            ]
          : step === "refund"
            ? []
            : [
                {
                  label:
                    step === "replace"
                      ? t({ th: "จัดส่งสินค้าเคลม", en: "Send the replacement" })
                      : t({ th: "จัดส่งสินค้าคืน", en: "Send the part back" }),
                  onPress: () => setShipping(true),
                },
              ],
  );
  if (!claim || !step) return null;
  const { lines, address } = ctx.detail;
  const products =
    claim.lines.length > 0
      ? claim.lines
          .map((cl) => lines.find((l) => l.id === cl.salesOrderLineId)?.name ?? "—")
          .join(", ")
      : lines
          .map((l) => l.name)
          .filter(Boolean)
          .join(", ");
  const exchange = claim.resolution !== "refund";
  const stepTitle: Record<typeof step, Phrase> = {
    receive: { th: "รอรับสินค้าคืนจากลูกค้า", en: "Waiting for the part to arrive" },
    review: { th: "ได้รับสินค้าแล้ว · รอช่างตรวจ", en: "Received · waiting for the mechanic" },
    refund: { th: "อนุมัติเคลมแล้ว · คืนเงินให้ลูกค้า", en: "Approved · refund the customer" },
    replace: { th: "อนุมัติเคลมแล้ว · จัดส่งสินค้าเคลม", en: "Approved · send the replacement" },
    sendBack: {
      th: "เคลมไม่ผ่านเงื่อนไข · ส่งสินค้าคืนให้ลูกค้า",
      en: "Rejected · send the part back",
    },
  };
  return (
    <>
      <SectionTitle text={t({ th: "จัดการเคลมสินค้า", en: "Handle the claim" })} />
      <JobBox>
        <JobHead icon={STEP_ICON.claim} color={theme.waiting} title={t(stepTitle[step])} />
        <View style={insetBox}>
          <InsetRow label={t({ th: "สินค้า", en: "Item" })} value={products || "—"} />
          <InsetRow label={t({ th: "แจ้งเมื่อ", en: "Raised" })} value={stamp(claim.createdAt)} />
          <InsetRow
            label={t({ th: "ลูกค้าเลือก", en: "Customer chose" })}
            value={
              exchange
                ? t({ th: "เปลี่ยนสินค้าใหม่", en: "Replacement" })
                : t({ th: "รับเงินคืน", en: "Refund" })
            }
            last={!claim.reasonNote}
          />
          {claim.reasonNote ? (
            <InsetRow
              label={t({ th: "เหตุผลลูกค้า", en: "Customer's reason" })}
              value={claim.reasonNote}
              stacked
              last
            />
          ) : null}
        </View>
        {claim.photoKeys.length > 0 && (
          <View style={styles.thumbs}>
            {claim.photoKeys.map((key, i) => (
              <PrivateImage
                key={key}
                fileKey={key}
                label={t({ th: `รูปจากลูกค้า ${i + 1}`, en: `Customer photo ${i + 1}` })}
                style={styles.thumb}
              />
            ))}
          </View>
        )}
        {!allowed ? (
          <Say
            quiet
            text={t({ th: "เฉพาะช่างและผู้ดูแลระดับสูง", en: "Mechanics and super admin only" })}
          />
        ) : step === "receive" ? null : step === "review" ? (
          <>
            {ctx.detail.mechanics.length > 0 && (
              <View style={{ gap: SPACE.s }}>
                <Say quiet small text={t({ th: "ผู้รับผิดชอบ", en: "In charge" })} />
                <View style={styles.chips}>
                  {ctx.detail.mechanics.map((m) => (
                    <Pressable
                      key={m}
                      onPress={() => setAssignee(assignee === m ? "" : m)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: assignee === m }}
                      style={[
                        styles.chip,
                        {
                          borderColor: assignee === m ? theme.primary : theme.border,
                          backgroundColor: theme.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          TYPE.subhead,
                          { color: assignee === m ? theme.primary : theme.text },
                        ]}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <Say
              small
              quiet
              text={t({
                th: "ปฏิเสธต้องใส่เหตุผล ลูกค้าจะเห็นบนหน้าติดตามคำสั่งซื้อ",
                en: "A rejection needs a reason; the customer sees it on their order page",
              })}
            />
          </>
        ) : step === "refund" ? (
          canDo("refund", ctx.detail.viewerRole) ? (
            <>
              <RefundAccount ctx={ctx} />
              <SlipConfirm
                busy={ctx.busy}
                label={t({ th: "ยืนยันการคืนเงิน", en: "Confirm refund" })}
                onConfirm={(slip) =>
                  ctx.run(() => recordClaimRefund(fetch, API_BASE, ctx.token, claim.id, slip), {
                    title: t({ th: "คืนเงินเคลมแล้ว", en: "Claim refunded" }),
                    detail: ctx.detail.order.externalOrderId,
                  })
                }
              />
            </>
          ) : (
            <Say
              quiet
              text={t({
                th: "รอผู้ดูแลระดับสูงคืนเงินให้ลูกค้า",
                en: "Waiting for the super admin to refund",
              })}
            />
          )
        ) : (
          <>
            {step === "replace" && (
              <View style={insetBox}>
                <InsetRow
                  label={t({ th: "ส่งไปที่", en: "Send to" })}
                  value={formatAddress(claim.replacementAddress ?? address)}
                  stacked
                  last
                />
              </View>
            )}
            <Say
              small
              quiet
              text={t({
                th: "กรอก ขนส่ง · เลขพัสดุ · ค่าจัดส่ง แบบเดียวกับบันทึกการส่งของ",
                en: "Carrier, tracking number and cost, as for a drop-off",
              })}
            />
          </>
        )}
      </JobBox>
      {rejecting && (
        <ReasonSheet
          title={t({ th: "ปฏิเสธการเคลม", en: "Reject the claim" })}
          label={t({ th: "เหตุผล (แจ้งลูกค้า)", en: "Reason (shown to the customer)" })}
          placeholder={t({
            th: "เช่น ใช้งานผิดวิธี, เกินระยะประกัน…",
            en: "e.g. misuse, out of warranty…",
          })}
          note={t({
            th: "ลูกค้าจะเห็นเหตุผลบนหน้าติดตามคำสั่งซื้อ",
            en: "The customer sees this on their order page",
          })}
          confirm={t({ th: "ยืนยันการปฏิเสธ", en: "Confirm rejection" })}
          busy={ctx.busy}
          onClose={() => setRejecting(false)}
          onConfirm={(reason) => {
            setRejecting(false);
            move("mechanic_rejected", { th: "ปฏิเสธการเคลมแล้ว", en: "Claim rejected" }, reason);
          }}
        />
      )}
      {shipping && (
        <DropOffSheet
          title={
            step === "replace"
              ? t({ th: "จัดส่งสินค้าเคลม", en: "Send the replacement" })
              : t({ th: "จัดส่งสินค้าคืน", en: "Send the part back" })
          }
          orderNo={ctx.detail.order.externalOrderId}
          address={claim.replacementAddress ?? address}
          feeLabel={t({ th: "ค่าจัดส่ง", en: "Shipping" })}
          after={null}
          busy={ctx.busy}
          onClose={() => setShipping(false)}
          onSave={(v) => {
            setShipping(false);
            const input = {
              carrier: v.carrier,
              trackingNo: v.trackingNo,
              shippingFeeSatang: v.shippingRealSatang,
            };
            ctx.run(
              () =>
                step === "replace"
                  ? moveClaim(fetch, API_BASE, ctx.token, claim.id, "shipped", {
                      ...input,
                      assignee: assignee.trim() || undefined,
                    })
                  : recordClaimReturn(fetch, API_BASE, ctx.token, claim.id, input),
              {
                title:
                  step === "replace"
                    ? t({ th: "จัดส่งสินค้าเคลมแล้ว", en: "Replacement sent" })
                    : t({ th: "ส่งสินค้าคืนลูกค้าแล้ว", en: "Part sent back" }),
                detail: `${v.carrier} · ${v.trackingNo}`,
              },
            );
          }}
        />
      )}
    </>
  );
}

function formatAddress(a: OrderAddress | null): string {
  if (!a) return "—";
  const who = [a.recipientName, a.phone].filter(Boolean).join(" · ");
  return [who, addressLine(a)].filter(Boolean).join(" · ");
}

const styles = StyleSheet.create({
  thumbs: { flexDirection: "row", gap: SPACE.s, flexWrap: "wrap" },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.s },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    justifyContent: "center",
  },
});
