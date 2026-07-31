/**
 * Which files a back-office user can pull up for one order, and in what order (owner, 31 Jul 2026).
 *
 * A shipping label always exists — it is generated from the order, not stored. A payment slip only
 * applies to a prepaid order (COD never produces one) and is only viewable once the customer's
 * uploaded slip image has been kept. Claim evidence appears only when a claim carries photos.
 *
 * This is the pure list the Documents card renders; the actual view/save wiring lives in the admin.
 */

export type OrderDocumentKind = "shipping_label" | "payment_slip" | "claim_evidence";

export interface OrderDocument {
  kind: OrderDocumentKind;
  /** Thai label the card shows. */
  label: string;
  /** Is there actually a file to view/save? A slip row can be present-but-empty before upload. */
  available: boolean;
  /** Number of files, for a multi-file row (claim photos). */
  count?: number;
}

export interface OrderDocumentsInput {
  paymentStatus: string | null;
  /** Whether the customer's uploaded bank-slip image has been stored for this order. */
  hasSlipImage: boolean;
  /** How many evidence photos this order's claims carry in total. */
  claimPhotoCount: number;
}

const COD_PAYMENTS = new Set(["cod", "cod_confirmed", "cod_collected"]);

export function orderDocuments(input: OrderDocumentsInput): OrderDocument[] {
  const { paymentStatus, hasSlipImage, claimPhotoCount } = input;
  const docs: OrderDocument[] = [
    { kind: "shipping_label", label: "ใบปะหน้าพัสดุ", available: true },
  ];

  // COD is settled on delivery, so there is never a transfer slip to show.
  if (!COD_PAYMENTS.has(paymentStatus ?? "")) {
    docs.push({ kind: "payment_slip", label: "สลิปการชำระเงิน", available: hasSlipImage });
  }

  if (claimPhotoCount > 0) {
    docs.push({
      kind: "claim_evidence",
      label: "หลักฐานการเคลม",
      available: true,
      count: claimPhotoCount,
    });
  }

  return docs;
}
