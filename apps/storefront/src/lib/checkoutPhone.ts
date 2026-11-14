import type { CartLine } from "./cart";
import type { CheckoutAddress, CheckoutPaymentMethod, CheckoutRequest } from "./checkoutApi";
import { baht } from "./format";

/**
 * Phone checkout words and the order it sends (board 4 · 4.4–4.11, owner: "Yes, build board 4",
 * 14 Nov 2026). The request is the same CheckoutRequest the computer checkout sends; the server
 * re-prices everything, so the numbers here are what the customer saw.
 */
export const PHONE_PAY_OPTIONS: { id: CheckoutPaymentMethod; title: string; detail: string }[] = [
  { id: "promptpay", title: "PromptPay", detail: "สแกน QR จ่ายได้ทันที" },
  { id: "transfer", title: "โอนเข้าบัญชีร้าน", detail: "บัญชีนิติบุคคล Den Air Service" },
  { id: "cod", title: "เก็บเงินปลายทาง", detail: "จ่ายกับพนักงานส่ง ไม่มีค่าธรรมเนียมเพิ่ม" },
];

type Who = { recipientName: string; phone: string };
type Where = Pick<
  CheckoutAddress,
  "addressLine1" | "subdistrict" | "district" | "province" | "postalCode"
>;

/** "สมชาย ใจดี · 081-234-4821" — a 10-digit Thai phone in 3-3-4, anything else as saved. */
export function addressWho(a: Who): string {
  const digits = a.phone.replace(/\D/g, "");
  const phone =
    /^0\d{9}$/.test(digits) && digits === a.phone.replace(/[\s-]/g, "")
      ? `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
      : a.phone;
  return `${a.recipientName} · ${phone}`;
}

/** The word before a name, unless the name was saved with it. */
function withWord(word: string, name: string, alreadyWords: string[]): string {
  return alreadyWords.some((w) => name.startsWith(w)) ? name : `${word}${name}`;
}

/** One address line: Bangkok says แขวง / เขต, every other province ต. / อ. */
export function addressWhere(a: Where): string {
  const bangkok = a.province === "กรุงเทพมหานคร";
  const sub = withWord(bangkok ? "แขวง" : "ต.", a.subdistrict, ["แขวง", "ต.", "ตำบล"]);
  const dist = withWord(bangkok ? "เขต" : "อ.", a.district, ["เขต", "อ.", "อำเภอ"]);
  return [a.addressLine1, sub, dist, a.province, a.postalCode].filter((p) => p !== "").join(" ");
}

/** ค่าจัดส่ง: "กรอกที่อยู่เพื่อคำนวณ" until there is a postcode, then the Flash Express fee. */
export function shippingRow(s: { satang: number; isRemote: boolean } | null): {
  label: string;
  value: string;
} {
  if (s == null) return { label: "ค่าจัดส่ง", value: "กรอกที่อยู่เพื่อคำนวณ" };
  return {
    label: "ค่าจัดส่ง · Flash Express",
    value: s.isRemote ? `${baht(s.satang)} (พื้นที่ห่างไกล)` : baht(s.satang),
  };
}

/** The value on the คูปอง row. */
export function couponValue(code: string | null): string {
  return code ?? "ใส่โค้ด";
}

/** The discount line in the summary (4.10). */
export function discountRow(code: string, satang: number): { label: string; value: string } {
  return { label: `คูปอง ${code}`, value: `−${baht(satang)}` };
}

/** Not enough stock (4.11): the shop's words, then what to do — a red line under the items. */
export function stockLine(error: string | null): string | null {
  return error?.startsWith("สินค้าไม่พอ") ? `${error} · ลบออกจากตะกร้าแล้วสั่งใหม่` : null;
}

/** The order the phone checkout sends to POST /api/checkout. */
export function buildCheckoutRequest(o: {
  ref: string;
  payment: CheckoutPaymentMethod;
  lines: CartLine[];
  coupon: string | null;
  /** Only when the account has no name yet (asked once). */
  name: string | null;
  address: { kind: "saved"; id: string } | { kind: "new"; address: CheckoutAddress };
}): CheckoutRequest {
  const body: CheckoutRequest = {
    idempotencyRef: o.ref,
    paymentMethod: o.payment,
    lines: o.lines.map((l) => ({
      variantId: l.variantId,
      qty: l.qty,
      expectedPriceSatang: l.priceSatang,
    })),
  };
  if (o.name) body.name = o.name;
  if (o.coupon) body.couponCode = o.coupon;
  if (o.address.kind === "saved") body.addressId = o.address.id;
  else body.address = o.address.address;
  return body;
}

/**
 * What a typed postcode fills in (4.7): จังหวัด and อำเภอ from the shop's postcode data, and ตำบล when the
 * postcode has only one. Fills each time the postcode changes (`filledFor` = the postcode last filled), and
 * not when the sheet opens again on the same postcode, so a picked ตำบล stays.
 */
export function postcodeFill(
  draft: CheckoutAddress,
  found: { province: string; amphoe: string; tambons: { tambon: string; amphoe: string }[] } | null,
  filledFor: string,
): Partial<CheckoutAddress> | null {
  if (!found || filledFor === draft.postalCode) return null;
  const only = found.tambons.length === 1 ? found.tambons[0]! : null;
  return {
    province: found.province,
    district: only ? only.amphoe : found.amphoe,
    subdistrict: only ? only.tambon : "",
  };
}
