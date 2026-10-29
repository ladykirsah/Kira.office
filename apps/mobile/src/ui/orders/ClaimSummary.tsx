import { claimStateLabel, claimStateLabelTh, isClaimState, trackingUrl } from "@l-shopee/core";
import type { Phrase } from "@l-shopee/shared/lang";
import { formatBaht } from "@/lib/money";
import { stamp } from "@/lib/orderList";
import { claimOutcome, finishedClaims, type ClaimOutcome } from "@/lib/orderPage";
import type { OrderClaim, OrderDetail } from "@/lib/ordersApi";
import { useLang } from "../AppProviders";
import { openPage } from "../openPage";
import { ICON } from "./icons";
import { Group, Row, SectionTitle, type RowProps } from "./parts";

const OUTCOME: Record<ClaimOutcome, Phrase> = {
  replaced: { th: "จัดส่งสินค้าใหม่แล้ว", en: "Replacement sent" },
  returned: { th: "ส่งสินค้าคืนลูกค้าแล้ว", en: "Returned to the customer" },
  refunded: { th: "คืนเงินแล้ว", en: "Refunded" },
  closed: { th: "ปิดการเคลมแล้ว", en: "Claim closed" },
};

/**
 * สรุปการเคลม — the record of each finished claim (the web's claim summary): what was claimed, what
 * the customer asked for and why, who checked it, and how it ended. Claim photos are under เอกสาร.
 */
export function ClaimSummary(props: { detail: OrderDetail; onCopy: (trackingNo: string) => void }) {
  const { t } = useLang();
  const claims = finishedClaims(props.detail.claims);
  if (claims.length === 0) return null;
  return (
    <>
      <SectionTitle text={t({ th: "สรุปการเคลม", en: "Claim summary" })} />
      {claims.map((claim, i) => {
        const rows = claimRows(claim, props.detail, t, props.onCopy);
        return (
          <Group key={claim.id} spaced={i > 0}>
            {rows.map((row, j) => (
              <Row key={j} {...row} last={j === rows.length - 1} />
            ))}
          </Group>
        );
      })}
    </>
  );
}

function claimRows(
  claim: OrderClaim,
  detail: OrderDetail,
  t: (p: Phrase) => string,
  onCopy: (trackingNo: string) => void,
): RowProps[] {
  const { order, lines } = detail;
  const products =
    claim.lines.length > 0
      ? claim.lines.map((cl) => lines.find((l) => l.id === cl.salesOrderLineId)?.name ?? "—")
      : lines.map((l) => l.name).filter((n): n is string => !!n);
  const outcome = claimOutcome(claim);
  const mechanic = claim.assigneeName || claim.mechanicName;
  const track = trackingUrl(claim.carrier, claim.trackingNo);
  const rows: RowProps[] = [
    {
      label: isClaimState(claim.state)
        ? t({ th: claimStateLabelTh(claim.state), en: claimStateLabel(claim.state) })
        : claim.state,
      sub: `${t({ th: "แจ้งเมื่อ", en: "Raised" })} ${stamp(claim.createdAt)}`,
      bold: true,
    },
    { label: t({ th: "สินค้า", en: "Item" }), value: products.join(", ") || "—" },
  ];
  if (claim.resolution) {
    rows.push({
      label: t({ th: "ลูกค้าเลือก", en: "Customer chose" }),
      value:
        claim.resolution === "refund"
          ? t({ th: "รับเงินคืน", en: "A refund" })
          : t({ th: "เปลี่ยนสินค้าใหม่", en: "A replacement" }),
    });
  }
  if (claim.reasonNote) {
    rows.push({ label: t({ th: "เหตุผลลูกค้า", en: "Customer's reason" }), sub: claim.reasonNote });
  }
  if (mechanic)
    rows.push({ label: t({ th: "ช่างผู้รับผิดชอบ", en: "Mechanic" }), value: mechanic });
  if (claim.state === "mechanic_rejected" && claim.adminNote) {
    rows.push({
      label: t({ th: "เหตุผลปฏิเสธ", en: "Why it was rejected" }),
      sub: claim.adminNote,
    });
  }

  if (outcome === "refunded") {
    rows.push({
      label: t(OUTCOME.refunded),
      value: order.refundSatang != null ? formatBaht(order.refundSatang) : undefined,
      sub: [order.refundedAt ? stamp(order.refundedAt) : null, order.refundActorEmail]
        .filter(Boolean)
        .join(" · "),
      bold: true,
    });
    return rows;
  }
  if (outcome === "closed") {
    rows.push({ label: t(OUTCOME.closed), bold: true });
    return rows;
  }
  rows.push({
    label: t(OUTCOME[outcome]),
    sub: [
      claim.carrier,
      claim.shippingFeeSatang != null
        ? `${t({ th: "ค่าจัดส่ง", en: "Shipping" })} ${formatBaht(claim.shippingFeeSatang)}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
    bold: true,
  });
  const trackingNo = claim.trackingNo!;
  rows.push({
    label: t({ th: "เลขพัสดุ", en: "Tracking no." }),
    value: trackingNo,
    tool: {
      label: t({ th: "คัดลอกเลขพัสดุ", en: "Copy tracking number" }),
      icon: ICON.copy,
      onPress: () => onCopy(trackingNo),
    },
  });
  if (track) {
    rows.push({
      label: t({ th: `ติดตามพัสดุที่ ${claim.carrier}`, en: `Track at ${claim.carrier}` }),
      onPress: () => openPage(track),
    });
  }
  return rows;
}
