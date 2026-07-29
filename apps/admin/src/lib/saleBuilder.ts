import { distributeDiscount } from "./posCart";
import type { QueuedSale } from "./outbox";

/**
 * The one definition of what a POS sale is, shared by the counter and the payment step, so the
 * money path can't fork: whoever completes the sale — POS offline, or /payment after a PromptPay
 * or cash confirmation — builds the identical payload.
 */

export interface BillLineForSale {
  kind: "part" | "service";
  name: string;
  productVariantId?: string | null;
  barcodeValue?: string;
  quantity: number;
  unitPriceSatang: number;
  unitCostSatang?: number;
}

export interface BillForSale {
  saleNumber: string;
  plate: string;
  vehicle: string;
  note: string;
  discountSatang: number;
  lines: BillLineForSale[];
}

export interface PaymentTaken {
  paymentMethod: "cash" | "promptpay";
  /** Who took the cash. Recorded on the bill's note until there is a real staff module. */
  receivedBy?: string;
}

export function buildQueuedSale(
  bill: BillForSale,
  payment: PaymentTaken,
  newUuid: () => string,
  now: number,
): QueuedSale {
  // A sale counts as a repair when it has a vehicle/plate or any service line; else it's parts.
  const isRepair = !!(
    bill.vehicle.trim() ||
    bill.plate.trim() ||
    bill.lines.some((l) => l.kind === "service")
  );

  // Spread the bill discount across the lines so the server's per-line discount + profit is exact.
  const perLineDiscount = distributeDiscount(
    bill.lines.map((l) => l.unitPriceSatang * l.quantity),
    bill.discountSatang,
  );

  const receiver = payment.paymentMethod === "cash" ? (payment.receivedBy ?? "").trim() : "";
  const notes = [bill.note.trim(), receiver ? `รับเงินโดย ${receiver}` : ""]
    .filter(Boolean)
    .join(" · ");

  return {
    clientUuid: newUuid(),
    saleNumber: bill.saleNumber || undefined,
    paymentMethod: payment.paymentMethod,
    saleType: isRepair ? "repair" : "parts",
    licensePlate: bill.plate.trim() || undefined,
    vehicle: bill.vehicle.trim() || undefined,
    notes: notes || undefined,
    lines: bill.lines.map((l, i) => ({
      productVariantId: l.kind === "part" ? (l.productVariantId ?? null) : null,
      lineType: l.kind,
      description: l.name,
      barcodeValue: l.barcodeValue,
      quantity: l.quantity,
      unitPriceSatang: l.unitPriceSatang,
      unitCostSatang: l.unitCostSatang ?? 0,
      discountSatang: perLineDiscount[i] || undefined,
    })),
    queuedAt: now,
  };
}
