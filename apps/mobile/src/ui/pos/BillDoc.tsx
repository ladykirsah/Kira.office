import type { ComponentRef, Ref } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import { discountOf, lineTotal, subtotal, type BillState } from "@/lib/posBill";
import { billDate } from "@/lib/scanSale";
import type { PrintSettings } from "./usePosSession";

export interface DocView {
  kind: "bill" | "quote";
  /** The bill or QT number; null before it is issued. */
  number: string | null;
  at: number;
  bill: BillState;
  print: PrintSettings;
  shopName: string;
  paymentMethod: "cash" | "promptpay" | null;
  receivedBy: string;
}

const WORDS = {
  th: {
    bill: "บิลเงินสด",
    invoice: "ใบแจ้งหนี้",
    quote: "ใบเสนอราคา",
    number: "เลขที่",
    noNumber: "ยังไม่ออกเลข",
    subtotal: "รวมย่อย",
    discount: "ส่วนลด",
    total: "รวมทั้งสิ้น",
    estimate: "รวมโดยประมาณ",
    cash: "ชำระเงินสด",
    by: "รับโดย",
    promptpay: "ชำระพร้อมเพย์",
    note: "หมายเหตุ",
  },
  en: {
    bill: "Cash bill",
    invoice: "Invoice",
    quote: "Quotation",
    number: "No.",
    noNumber: "Not numbered yet",
    subtotal: "Subtotal",
    discount: "Discount",
    total: "Total",
    estimate: "Estimated total",
    cash: "Paid in cash",
    by: "received by",
    promptpay: "Paid by PromptPay",
    note: "Note",
  },
} as const;

const plain = (satang: number) => formatBaht(satang).replace("฿", "");

/**
 * The bill or quotation as the customer gets it — always white paper, in the bill's own language,
 * whatever the app's theme. This view is what saving and sending turn into a file.
 */
export function BillDoc({ doc, ref }: { doc: DocView; ref?: Ref<ComponentRef<typeof View>> }) {
  const w = WORDS[doc.print.lang];
  const b = doc.bill;
  const at = billDate(doc.print.date ?? doc.at);
  const sub = subtotal(b.lines);
  const off = discountOf(sub, b.discount);
  const title = doc.kind === "quote" ? w.quote : doc.print.style === "invoice" ? w.invoice : w.bill;
  const customer = b.buyer === "customer";
  const car = [b.plate.trim(), b.province.trim()].filter(Boolean).join(" ");
  const carLine = [car, b.car.trim()].filter(Boolean).join(" · ");
  const who = customer
    ? [
        b.customerName.trim(),
        b.phones
          .map((p) => p.trim())
          .filter(Boolean)
          .join(", "),
      ]
        .filter(Boolean)
        .join(" · ")
    : b.mechanicName.trim();
  const paid =
    doc.kind === "bill" && doc.paymentMethod
      ? doc.paymentMethod === "cash"
        ? [w.cash, doc.receivedBy ? `${w.by} ${doc.receivedBy}` : ""].filter(Boolean).join(" · ")
        : w.promptpay
      : "";
  return (
    <View ref={ref} style={styles.paper} collapsable={false}>
      <View style={styles.head}>
        <Text style={styles.shop}>{doc.shopName || "Den Air Service"}</Text>
        <Text style={styles.grey13}>{title}</Text>
      </View>
      <Text style={styles.grey13}>
        {`${w.number} ${doc.number ?? w.noNumber} · ${at.date} · ${at.time}`}
      </Text>
      {customer && carLine ? <Text style={styles.text15}>{carLine}</Text> : null}
      {who ? <Text style={styles.grey15}>{who}</Text> : null}
      <View style={styles.rule} />
      {b.lines.map((l) => (
        <View key={l.key} style={styles.line}>
          <Text style={[styles.text15, styles.grow]}>{l.name}</Text>
          <Text style={styles.grey15}>×{l.quantity}</Text>
          <Text style={[styles.text15, styles.amount]}>{plain(lineTotal(l))}</Text>
        </View>
      ))}
      <View style={styles.rule} />
      <View style={styles.line}>
        <Text style={[styles.text15, styles.grow]}>{w.subtotal}</Text>
        <Text style={[styles.text15, styles.amount]}>{plain(sub)}</Text>
      </View>
      {off > 0 && (
        <View style={styles.line}>
          <Text style={[styles.text15, styles.grow]}>{w.discount}</Text>
          <Text style={[styles.text15, styles.amount]}>−{plain(off)}</Text>
        </View>
      )}
      <View style={styles.total}>
        <Text style={styles.totalText}>{doc.kind === "quote" ? w.estimate : w.total}</Text>
        <Text style={styles.totalText}>{formatBaht(sub - off)}</Text>
      </View>
      {paid ? <Text style={styles.grey13}>{paid}</Text> : null}
      {b.note.trim() ? <Text style={styles.grey13}>{`${w.note} — ${b.note.trim()}`}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  paper: {
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 6,
  },
  head: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  shop: { fontSize: 17, lineHeight: 24, fontWeight: "700", color: "#000000" },
  grey13: { fontSize: 13, lineHeight: 19, color: "#8A8A8E" },
  text15: { fontSize: 15, lineHeight: 22, color: "#000000" },
  grey15: { fontSize: 15, lineHeight: 22, color: "#8A8A8E" },
  rule: { height: 1, backgroundColor: "#E5E5EA", marginVertical: 6 },
  line: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  amount: { width: 72, textAlign: "right", fontVariant: ["tabular-nums"] },
  total: { flexDirection: "row", justifyContent: "space-between" },
  totalText: { fontSize: 17, lineHeight: 24, fontWeight: "700", color: "#000000" },
});
