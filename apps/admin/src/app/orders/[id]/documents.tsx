"use client";

import { useState } from "react";
import { orderDocuments } from "@l-shopee/core";
import { privateFileUrl, type OrderDetail, type ShopInfo } from "@/lib/api";
import { card, sectionTitle } from "./cardStyles";
import { DocRow, Modal } from "./docKit";
import { ShippingLabelDoc } from "./ShipmentActions";
import { Icon } from "../../Icon";
import { useT } from "../../LangProvider";

/**
 * The order's files, one card in the right rail under Note. Which rows appear is decided by the pure
 * `orderDocuments` helper in core (COD has no slip, claim evidence only when photos exist), so the
 * card stays a thin renderer. View opens a modal; Save downloads.
 */
export function DocumentsCard({
  order,
  address,
  lines,
  shop,
  claims,
  viewerIsSuperAdmin,
  onError,
}: {
  order: OrderDetail["order"];
  address: OrderDetail["address"];
  lines: OrderDetail["lines"];
  shop: ShopInfo;
  claims: OrderDetail["claims"];
  /** Slip images are super-admin-only; a regular admin sees the row but not View/Save. */
  viewerIsSuperAdmin: boolean;
  onError: (message: string) => void;
}) {
  const t = useT();
  // Every claim's photos, flattened — the View gallery shows them all, the count drives the row.
  const claimPhotos = claims.flatMap((c) => c.photoKeys);
  const docs = orderDocuments({
    paymentStatus: order.paymentStatus,
    hasSlipImage: !!order.slipImageKey,
    claimPhotoCount: claimPhotos.length,
  });

  return (
    <div style={card}>
      <div style={sectionTitle}>{t({ th: "เอกสาร", en: "Documents" })}</div>
      {docs.map((d, i) => {
        const first = i === 0;
        if (d.kind === "shipping_label") {
          return (
            <ShippingLabelDoc
              key={d.kind}
              first={first}
              label={d.label}
              order={order}
              address={address}
              lines={lines}
              shop={shop}
              onError={onError}
            />
          );
        }
        if (d.kind === "payment_slip") {
          return (
            <SlipDoc
              key={d.kind}
              first={first}
              label={d.label}
              slipKey={d.available ? order.slipImageKey : null}
              canView={viewerIsSuperAdmin}
            />
          );
        }
        return (
          <ClaimEvidenceDoc key={d.kind} first={first} label={d.label} photoKeys={claimPhotos} />
        );
      })}
    </div>
  );
}

/**
 * Claim evidence. View opens a gallery of the photos; each can be saved. Images load through the
 * private /file route (super-admin gate does not apply to claim photos, only to slips).
 */
function ClaimEvidenceDoc({
  label,
  photoKeys,
  first,
}: {
  label: string;
  photoKeys: string[];
  first?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <DocRow
        first={first}
        label={`${label} (${photoKeys.length})`}
        actions={
          <button
            type="button"
            className="icon-btn"
            onClick={() => setOpen(true)}
            aria-label={t({ th: "ดู", en: "View" })}
            title={t({ th: "ดู", en: "View" })}
          >
            <Icon name="view" />
          </button>
        }
      />
      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            {photoKeys.map((k, i) => (
              <div
                key={k}
                style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "center" }}
              >
                <img
                  src={privateFileUrl(k)}
                  alt={t({ th: `หลักฐาน ${i + 1}`, en: `Evidence ${i + 1}` })}
                  style={{ width: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
                />
                <a
                  className="icon-btn"
                  href={privateFileUrl(k)}
                  download
                  aria-label={t({ th: `บันทึกรูปที่ ${i + 1}`, en: `Save photo ${i + 1}` })}
                  title={t({ th: "บันทึก", en: "Save" })}
                >
                  <Icon name="save" />
                </a>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * Payment slip — the customer's uploaded bank slip, kept as evidence. Served super-admin-only through
 * the private /file route; a non-super admin gets a 403 and the image simply fails to load. Empty
 * ("ยังไม่มีสลิป") until a slip has been uploaded for the order.
 */
function SlipDoc({
  label,
  slipKey,
  canView,
  first,
}: {
  label: string;
  slipKey: string | null;
  canView: boolean;
  first?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!slipKey)
    return (
      <DocRow first={first} label={label} sub={t({ th: "ยังไม่มีสลิป", en: "No slip yet" })} />
    );
  // A bank slip is super-admin-only; a regular admin sees that one exists but not the image.
  if (!canView)
    return (
      <DocRow
        first={first}
        label={label}
        sub={t({ th: "เฉพาะผู้ดูแลระดับสูง", en: "Super admin only" })}
      />
    );
  return (
    <>
      <DocRow
        first={first}
        label={label}
        actions={
          <>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setOpen(true)}
              aria-label={t({ th: "ดู", en: "View" })}
              title={t({ th: "ดู", en: "View" })}
            >
              <Icon name="view" />
            </button>
            <a
              className="icon-btn"
              href={privateFileUrl(slipKey)}
              download
              aria-label={t({ th: "บันทึก", en: "Save" })}
              title={t({ th: "บันทึก", en: "Save" })}
            >
              <Icon name="save" />
            </a>
          </>
        }
      />
      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          <img
            src={privateFileUrl(slipKey)}
            alt={t({ th: "สลิปการชำระเงิน", en: "Payment slip" })}
            style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)" }}
          />
        </Modal>
      )}
    </>
  );
}
