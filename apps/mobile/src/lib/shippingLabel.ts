import { addressLine } from "./orderPage";
import type { OrderDetail } from "./ordersApi";

/**
 * What goes on an AirPlus parcel label (owner approved the drawing, 2026-10-29): who it is from, who
 * it is for, what is in the box, any cash to collect, and the shop's LINE QR. The same facts as the
 * web back office's label, so a label saved here and one saved there say the same thing. There is no
 * tracking number: the carrier gives one at the counter, after the label is printed.
 */

/** The shop's saved details the label needs (Shop info, AirPlus profile). */
export interface LabelShop {
  name: string;
  phone: string;
  address: string;
  postcode: string;
  lineUrl: string;
  headline: string;
  subtitle: string;
}

export interface ShippingLabel {
  orderRef: string;
  from: { title: string; address: string };
  to: { title: string; address: string };
  /** A missing brand is a dash, so the gap shows and gets fixed (owner, 31 Jul 2026). */
  items: { id: string; name: string; brand: string; quantity: number }[];
  /** Cash the carrier collects; null when the order is already paid. */
  codSatang: number | null;
  qr: { url: string; isLine: boolean };
  thanks: { headline: string; subtitle: string };
}

const SITE = "https://airplusauto.com";
const DASH = "—";
const COLLECT_ON_DELIVERY = new Set(["cod", "cod_confirmed"]);

const withPhone = (name: string, phone: string | null | undefined) =>
  phone ? `${name} • ${phone}` : name;

export function shippingLabel(
  page: Pick<OrderDetail, "order" | "address" | "lines">,
  shop: LabelShop,
): ShippingLabel {
  const { order, address, lines } = page;
  const lineUrl = shop.lineUrl.trim();
  return {
    orderRef: order.externalOrderId,
    from: {
      title: withPhone(shop.name || "AirPlus Auto", shop.phone),
      address: [shop.address, shop.postcode].filter(Boolean).join(" "),
    },
    to: address
      ? {
          title: withPhone(address.recipientName ?? DASH, address.phone),
          address: addressLine(address),
        }
      : { title: DASH, address: "ไม่มีที่อยู่ในออเดอร์นี้" },
    items: lines.map((l) => ({
      id: l.id,
      name: l.name ?? l.sku ?? DASH,
      brand: l.brand ?? DASH,
      quantity: l.quantity,
    })),
    codSatang: COLLECT_ON_DELIVERY.has(order.paymentStatus ?? "") ? order.grandTotalSatang : null,
    qr: { url: lineUrl || SITE, isLine: !!lineUrl },
    thanks: {
      headline: shop.headline || "ขอบคุณที่อุดหนุนสินค้าของเรา",
      subtitle: shop.subtitle || "สแกนเพื่อปรึกษาช่าง หรือ สั่งอะไหล่เพิ่มเติม",
    },
  };
}

/** `label-AP-1042.pdf` — the order number, because that is what the worker looks for. */
export function shippingLabelFileName(kind: "pdf" | "png", orderRef: string): string {
  const stem = orderRef
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return ["label", stem].filter(Boolean).join("-") + `.${kind}`;
}

/** Always 100 × 150 mm, the standard parcel label: every box gets the same size sticker. */
export const LABEL_PAGE = { w: 100, h: 150 } as const;

export interface LabelPageLayout {
  page: { w: number; h: number };
  /** Where the captured label sits on the page, in mm. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A label too long for the page shrinks to fit — never cropped, or the postcode is what goes. */
export function labelPageLayout(capture: { width: number; height: number }): LabelPageLayout {
  const page = { w: LABEL_PAGE.w, h: LABEL_PAGE.h };
  // 0 × 0 means the label was never laid out; filling the page beats jsPDF's silent blank sheet.
  if (!(capture.width > 0) || !(capture.height > 0)) {
    return { page, x: 0, y: 0, w: page.w, h: page.h };
  }
  const ratio = capture.height / capture.width;
  if (page.w * ratio <= page.h) return { page, x: 0, y: 0, w: page.w, h: page.w * ratio };
  const w = page.h / ratio;
  return { page, x: (page.w - w) / 2, y: 0, w, h: page.h };
}
