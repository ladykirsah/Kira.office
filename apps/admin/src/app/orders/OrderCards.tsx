"use client";

import type { OrderRow } from "@/lib/api";
import { imageUrl } from "@/lib/api";
import { formatBahtTrim } from "@/lib/format";
import { operationalStatusBadge } from "@/lib/badges";
import { orderCardAction } from "@/lib/orderCardAction";
import { useT } from "../LangProvider";

/**
 * The orders list ON A PHONE (owner's design D, 27 Aug 2026).
 *
 * WHY IT IS ITS OWN COMPONENT AND NOT THE TABLE RESTYLED. Every other list on this admin turns into
 * a card by CSS alone: `.list-cards` makes each `tr` a box and each cell prints its column name.
 * That works because those cards are still a column of label/value pairs — the same information,
 * stacked. This card is NOT: it has a picture, a product line, a totals row and a button, in a
 * nesting no arrangement of table cells can produce. So the phone gets its own markup, and the
 * table stays exactly what it was on a wide screen — which is also the guarantee that this pass
 * cannot move the desktop.
 *
 * The two are swapped by `.phone-only` / `.wide-only` at the 741px the whole admin uses.
 *
 * WHAT IT SHOWS AND WHY. The wide row is five labelled columns; the phone card answers the three
 * questions someone actually opens this list with — who is it, what is in it, and what do I do
 * next. The product line is the change that needed the API: the list used to fetch order headers
 * only, so the screen could not have said what was bought however it was laid out.
 */
export function OrderCards({ orders }: { orders: OrderRow[] }) {
  const t = useT();
  return (
    <div className="ocards">
      {orders.map((o) => {
        const badge = operationalStatusBadge(o.orderStatus, o.paymentStatus);
        const act = orderCardAction(o.orderStatus, o.paymentStatus);
        const extra = (o.lineCount ?? 0) - 1;
        return (
          <a
            key={o.id}
            className="ocard"
            href={`/orders/${o.id}`}
            /* One link, one destination. The button inside is the same tap — labelled by what is
               waiting on the order's page — so the whole card is the target and there is no small
               control to aim at. The label spells that out for a screen reader, which would
               otherwise read the entire card as the link's name. */
            aria-label={`${o.externalOrderId} — ${t(act.label)}`}
          >
            <div className="ocard-head">
              <div className="ocard-idrow">
                <span className="ocard-who">
                  {o.buyerUsername || <span className="muted">—</span>}
                </span>
                <span className={`pill ${badge.pill} ocard-status`}>{t(badge.label)}</span>
              </div>
              <div className="ocard-ref">
                {t({ th: "หมายเลขออเดอร์", en: "Order no." })} {o.externalOrderId}
              </div>
            </div>

            {/* Dropped entirely rather than drawn empty when the order has no lines — a header-only
                order (every imported Shopee one) would otherwise show a picture frame and a blank
                name, which reads as a broken card rather than an order we never had lines for. */}
            {o.firstItemName && (
              <div className="ocard-body">
                <div className="ocard-thumb">
                  {o.firstItemImageKey ? (
                    <img src={imageUrl(o.firstItemImageKey)} alt="" />
                  ) : (
                    /* The same ✦ the storefront shows for a product with no photo. */
                    <span aria-hidden="true">✦</span>
                  )}
                </div>
                <div className="ocard-lines">
                  <div className="ocard-line1">
                    <span className="ocard-name">{o.firstItemName}</span>
                    {o.firstItemPriceSatang != null && (
                      <span className="ocard-price">{formatBahtTrim(o.firstItemPriceSatang)}</span>
                    )}
                  </div>
                  <div className="ocard-line2">
                    {o.firstItemVariant && (
                      <span className="ocard-variant">{o.firstItemVariant}</span>
                    )}
                    {o.firstItemQty != null && (
                      <span className="ocard-qty">× {o.firstItemQty}</span>
                    )}
                  </div>
                  {extra > 0 && (
                    <div className="ocard-more">
                      {t({ th: "+ อีก", en: "+" })} {extra} {t({ th: "รายการ", en: "more" })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="ocard-sum">
              {/* Left is what is in the box, right is what it came to. The label on the total is
                  the reference's one honest habit: a number on its own invites the question
                  "before or after shipping?" every single time. */}
              <span className="ocard-count">
                {(o.itemQty ?? 0) > 0
                  ? `${o.itemQty} ${t({ th: "ชิ้น", en: "pcs" })}`
                  : t({ th: "ไม่มีรายการสินค้า", en: "No item lines" })}
              </span>
              <span>
                {/* "What the customer paid", not "total" (owner, 27 Aug 2026). The number is
                    products − discount + ค่าจัดส่ง — the owner's own definition — so a bare
                    "ยอดรวม" invited exactly the question the labelled total was invented to kill:
                    does this include delivery? Naming whose money it is answers it, and the owner
                    chose that over printing the delivery charge as a second number.

                    "Customer paid" in both languages at the owner's word, over "pays". It reads as
                    past tense of an order still waiting for the money, which is the one case it
                    does not describe; they know, and the alternative — a label that changes with
                    the status — is worse. */}
                <span className="ocard-sum-label">
                  {t({ th: "ยอดที่ลูกค้าจ่าย", en: "Customer paid" })}{" "}
                </span>
                <span className="ocard-total">{formatBahtTrim(o.grandTotalSatang)}</span>
              </span>
            </div>

            <div className="ocard-act">
              <span className="ocard-hint">{t(act.hint)}</span>
              {/* A span, not a button: it sits inside the card's link and shares its tap. */}
              <span className={act.primary ? "ocard-btn pri" : "ocard-btn"}>{t(act.label)}</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}
