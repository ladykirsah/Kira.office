import { describe, expect, it } from "vitest";
import {
  amountSatang,
  amountText,
  clearSummary,
  keypadPress,
  maskPromptpay,
  payState,
  paymentTrouble,
  paymentDays,
  rowSub,
  summaryLine,
  todaySummary,
  type PaymentRow,
} from "./paymentPage";

const NOW = new Date(2026, 9, 30, 15, 0).getTime();
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).getTime();

const row = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: "p1",
  methodLabel: "ร้าน",
  promptpayId: "0812344421",
  amountSatang: 125_000,
  saleNumber: null,
  status: "approved",
  createdAt: at(30, 13, 5),
  approvedAt: at(30, 13, 5),
  slipRef: null,
  confirmedAt: null,
  ...over,
});

// The drawing's list: five today, two yesterday.
const LIST: PaymentRow[] = [
  row({ id: "a", amountSatang: 406_000, createdAt: at(30, 14, 32), saleNumber: "DAS202610-29004" }),
  row({ id: "b", amountSatang: 125_000, createdAt: at(30, 13, 5) }),
  row({
    id: "c",
    methodLabel: "แม่",
    promptpayId: "0898887710",
    amountSatang: 259_000,
    createdAt: at(30, 11, 40),
  }),
  row({ id: "d", amountSatang: 345_000, createdAt: at(30, 10, 12), saleNumber: "DAS202610-29001" }),
  row({ id: "e", amountSatang: 110_000, createdAt: at(30, 9, 20) }),
  row({ id: "f", amountSatang: 89_000, createdAt: at(29, 17, 55) }),
  row({
    id: "g",
    methodLabel: "แม่",
    promptpayId: "0898887710",
    amountSatang: 620_000,
    createdAt: at(29, 15, 10),
  }),
];

describe("paymentPage", () => {
  it("maskPromptpay > given a phone number > then only its last four show", () => {
    expect(maskPromptpay("081-234-4421")).toBe("08x-xxx-4421");
  });

  it("maskPromptpay > given a 13-digit ID > then only its last four show", () => {
    expect(maskPromptpay("1234567890123")).toBe("xxx-0123");
  });

  it("rowSub > given a bill > then the time and the bill number", () => {
    expect(rowSub(LIST[0]!)).toEqual({
      th: "14:32 · บิล DAS202610-29004",
      en: "14:32 · Bill DAS202610-29004",
    });
    expect(rowSub(LIST[1]!)).toEqual({ th: "13:05", en: "13:05" });
  });

  it("payState > given slip checking off > then every row is approved", () => {
    expect(payState(row(), false)).toBe("approved");
  });

  it("payState > given slip checking on > then an unchecked row waits and a checked one is confirmed", () => {
    expect(payState(row(), true)).toBe("awaitingSlip");
    expect(payState(row({ status: "confirmed", slipRef: "0129-8841" }), true)).toBe(
      "slipConfirmed",
    );
  });

  it("paymentDays > given the list > then today, yesterday, newest first inside each", () => {
    const days = paymentDays(LIST, NOW);
    expect(days.map((d) => d.title.th)).toEqual(["วันนี้", "เมื่อวาน"]);
    expect(days[0]!.rows.map((r) => r.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("todaySummary > given the drawing's list > then ฿12,450 from five, split by account, biggest first", () => {
    const s = todaySummary(LIST, NOW, false);
    expect(s).toEqual({
      totalSatang: 1_245_000,
      count: 5,
      checked: null,
      byAccount: [
        { label: "ร้าน", satang: 986_000 },
        { label: "แม่", satang: 259_000 },
      ],
    });
    expect(summaryLine(s)).toEqual({
      th: "5 รายการ · ร้าน ฿9,860 · แม่ ฿2,590",
      en: "5 payments · ร้าน ฿9,860 · แม่ ฿2,590",
    });
  });

  it("todaySummary > given slip checking on > then the line says how many are checked", () => {
    const list = [row({ status: "confirmed", slipRef: "x" }), row({ id: "2" })];
    expect(summaryLine(todaySummary(list, NOW, true)).th).toBe(
      "2 รายการ · ตรวจแล้ว 1 · ร้าน ฿2,500",
    );
  });

  it("clearSummary > given the drawing's list > then all seven, ฿19,540, by account", () => {
    expect(clearSummary(LIST)).toEqual({
      count: 7,
      totalSatang: 1_954_000,
      byAccount: [
        { label: "ร้าน", satang: 1_075_000 },
        { label: "แม่", satang: 879_000 },
      ],
    });
  });

  it("keypadPress > given digits, a point and back > then the amount as typed", () => {
    const typed = ["1", "2", "5", "0"].reduce(keypadPress, "");
    expect(typed).toBe("1250");
    expect(keypadPress("12", ".")).toBe("12.");
    expect(keypadPress("", ".")).toBe("0.");
    expect(keypadPress("12.5", "⌫")).toBe("12.");
    expect(keypadPress("0", "7")).toBe("7");
  });

  it("keypadPress > given a second point, a third decimal or an eighth digit > then nothing changes", () => {
    expect(keypadPress("12.5", ".")).toBe("12.5");
    expect(keypadPress("12.50", "1")).toBe("12.50");
    expect(keypadPress("9999999", "9")).toBe("9999999");
  });

  it("amountSatang + amountText > given what was typed > then satang and the big number", () => {
    expect(amountSatang("1250")).toBe(125_000);
    expect(amountSatang("12.5")).toBe(1_250);
    expect(amountSatang("")).toBe(0);
    expect(amountText("")).toBe("฿0");
    expect(amountText("1250")).toBe("฿1,250");
    expect(amountText("1250.5")).toBe("฿1,250.5");
  });

  it("paymentTrouble > given no internet, not the owner, or the server's reason > then plain words", () => {
    expect(paymentTrouble(new TypeError("Failed to fetch")).th).toBe("ไม่มีเน็ต ลองอีกครั้ง");
    expect(paymentTrouble(new Error("forbidden")).th).toBe("ทำได้เฉพาะเจ้าของร้าน");
    expect(paymentTrouble(new Error("this slip was already used")).th).toBe(
      "this slip was already used",
    );
  });
});
