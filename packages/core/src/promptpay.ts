/**
 * Thai PromptPay merchant-presented QR payload (EMVCo TLV). Field order follows the de-facto
 * reference implementation (promptpay-qr): 00 payload-format, 01 method (11 static / 12 dynamic),
 * 29 merchant info (AID A000000677010111 + target), 58 country, 53 currency (764 THB),
 * 54 amount (dynamic only), 63 CRC-16/CCITT-FALSE. ASCII-only payloads by construction.
 */

const PROMPTPAY_AID = "A000000677010111";

/** One TLV field: 2-digit id + 2-digit length + value. */
const tlv = (id: string, value: string): string =>
  id + String(value.length).padStart(2, "0") + value;

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) as 4 uppercase hex chars. */
export function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8; // payload is ASCII by construction
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Normalize a PromptPay ID: phone → tag 01 (0066+9 digits), 13-digit ID → 02, 15-digit e-wallet → 03. */
export function formatPromptPayTarget(id: string): { tag: "01" | "02" | "03"; value: string } {
  const digits = id.replace(/[^0-9]/g, "");
  if (digits.length === 10 && digits.startsWith("0")) {
    return { tag: "01", value: `0066${digits.slice(1)}` }; // phone: drop leading 0, 66 country code
  }
  if (digits.length === 13) return { tag: "02", value: digits }; // national ID / tax ID
  if (digits.length === 15) return { tag: "03", value: digits }; // e-wallet
  throw new Error(
    "not a valid PromptPay ID — expected a 10-digit phone, 13-digit national/tax ID, or 15-digit e-wallet",
  );
}

/** Build the full scannable payload; amountSatang present → dynamic QR with the amount baked in. */
export function buildPromptPayPayload(input: {
  target: string;
  amountSatang?: number | null;
}): string {
  const hasAmount = input.amountSatang != null;
  if (hasAmount && (!Number.isInteger(input.amountSatang) || input.amountSatang! <= 0)) {
    throw new Error("amountSatang must be a positive integer (satang)");
  }
  const target = formatPromptPayTarget(input.target);
  const base =
    tlv("00", "01") +
    tlv("01", hasAmount ? "12" : "11") + // dynamic when an amount is baked in
    tlv("29", tlv("00", PROMPTPAY_AID) + tlv(target.tag, target.value)) +
    tlv("58", "TH") +
    tlv("53", "764") + // THB
    (hasAmount ? tlv("54", (input.amountSatang! / 100).toFixed(2)) : "") +
    "6304"; // CRC id+length — checksummed including these 4 chars, per EMVCo
  return base + crc16ccitt(base);
}
