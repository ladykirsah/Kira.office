import type { DocView } from "@/ui/pos/BillDoc";
import { phonesOf } from "./customerPage";
import type { CarDetail, CarSale } from "./customersApi";
import type { PosLine } from "./posBill";

/**
 * พิมพ์ซ้ำ / ส่ง on a saved bill: the same paper ทำบิล printed, rebuilt from what the bill stored.
 * A bill with a buyer name was made for a mechanic (ทำบิล saves the name only then).
 */
export function reprintBill(
  sale: CarSale,
  customer: CarDetail["customer"],
  shop: { shopName: string; lang: "th" | "en" },
): DocView {
  // A line's discount is its share of the bill's discount (ทำบิล spreads it), so the paper shows
  // list prices and takes the bill's discount off once.
  const lines: PosLine[] = sale.lines.map((l, i) => ({
    key: `line-${i}`,
    kind: l.lineType === "service" ? "service" : "part",
    variantId: null,
    productId: null,
    productRef: l.productRef,
    name: l.description,
    photoKey: null,
    barcode: null,
    quantity: l.quantity,
    walkInSatang: l.unitPriceSatang,
    mechanicSatang: 0,
    priceSatang: l.unitPriceSatang,
    useMechanic: false,
    costSatang: 0,
    onHand: null,
  }));
  const mechanic = sale.buyerName?.trim() || null;
  return {
    kind: "bill",
    number: sale.saleNumber,
    at: sale.createdAt,
    print: { style: "receipt", lang: shop.lang, date: null },
    shopName: shop.shopName,
    paymentMethod:
      sale.paymentMethod === "cash" || sale.paymentMethod === "promptpay"
        ? sale.paymentMethod
        : null,
    receivedBy: "",
    bill: {
      doc: "bill",
      buyer: mechanic ? "mechanic" : "customer",
      plate: customer?.licensePlate ?? "",
      province: customer?.plateProvince ?? "",
      customerName: customer?.customerName ?? "",
      phones: phonesOf(customer?.phone ?? null),
      car: sale.vehicle?.trim() || customer?.carModel?.trim() || "",
      mileage: sale.mileageKm === null ? "" : sale.mileageKm.toLocaleString("en-US"),
      mechanicName: mechanic ?? "",
      lines,
      discount: { kind: "thb", value: String(sale.discountTotalSatang / 100) },
      note: sale.notes ?? "",
    },
  };
}
