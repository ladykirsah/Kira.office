import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatBaht } from "@/lib/money";
import { discountOf, subtotal } from "@/lib/posBill";
import { useLang, useTheme } from "../AppProviders";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import { BillDoc } from "./BillDoc";
import { usePos } from "./PosSessionProvider";
import { saveDoc, shareDoc } from "./saveDoc";

/**
 * ออกบิลแล้ว (ทำบิล 5) and a saved ใบเสนอราคา (ทำบิล 4) end the same way (owner, 30 Oct 2026: "see
 * the final file"): the file itself, ส่งให้ลูกค้า and บันทึก PDF, บิลใหม่ at the top. A bill made
 * with no internet says it is waiting on this phone.
 */
export function DoneScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const pos = usePos();
  const doc = pos.issued;
  const node = useRef<ComponentRef<typeof View>>(null);
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!doc) return;
    setToast(
      doc.kind === "quote"
        ? {
            title: t({ th: `บันทึก ${doc.number} แล้ว`, en: `${doc.number} saved` }),
            detail: t({
              th: "เก็บในฉบับร่าง · มาทำบิลต่อได้",
              en: "In the drafts tray · make it a bill later",
            }),
          }
        : {
            title: t({ th: `ออกบิล ${doc.number} แล้ว`, en: `Bill ${doc.number} issued` }),
            detail: doc.offline
              ? t({
                  th: "เก็บในเครื่องแล้ว · ส่งเข้าระบบเองเมื่อเน็ตกลับมา",
                  en: "Kept on this phone · it goes in when the internet is back",
                })
              : t({
                  th: "ตัดสต็อกและบันทึกเข้าประวัติลูกค้าแล้ว",
                  en: "Stock taken off and saved to the customer's history",
                }),
          },
    );
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [doc, t]);

  const fileName = (ext: string) => `${doc?.number ?? "bill"}.${ext}`;
  const run = (task: () => Promise<unknown>) => {
    if (busy || !node.current) return;
    setBusy(true);
    task()
      .catch((e: Error) =>
        setToast({ title: t({ th: "ทำไม่ได้", en: "Could not do it" }), detail: e.message }),
      )
      .finally(() => setBusy(false));
  };

  useScreenChrome(
    { label: t({ th: "บิลใหม่", en: "New bill" }), icon: "", onPress: pos.newBill },
    doc
      ? [
          {
            label:
              doc.kind === "quote"
                ? t({ th: "ส่งให้ลูกค้า", en: "Send to the customer" })
                : t({ th: "ส่งบิลให้ลูกค้า", en: "Send the bill" }),
            onPress: () => run(() => shareDoc(node.current, fileName("png"))),
          },
          {
            label: t({ th: "บันทึก PDF", en: "Save PDF" }),
            kind: "grey",
            onPress: () => run(() => saveDoc("pdf", node.current, fileName("pdf"))),
          },
        ]
      : [],
    {
      title: doc
        ? doc.kind === "quote"
          ? t({ th: "ใบเสนอราคา", en: "Quotation" })
          : t({ th: "ออกบิลแล้ว", en: "Bill issued" })
        : null,
      back: {
        label: t({ th: "ทำบิล", en: "Point of Sale" }),
        onPress: () => router.replace("/pos"),
      },
      toast,
    },
  );

  if (!doc) return <Redirect href="/pos" />;
  const sub = subtotal(doc.bill.lines);
  const total = sub - discountOf(sub, doc.bill.discount);
  return (
    <View>
      {doc.kind === "quote" ? (
        <Status
          color={theme.textMuted}
          text={t({ th: "บันทึกแล้ว · ยังไม่ตัดสต็อก", en: "Saved · no stock taken" })}
        />
      ) : (
        <>
          <Status
            color={theme.success}
            text={t({ th: `รับเงินแล้ว ${formatBaht(total)}`, en: `Paid ${formatBaht(total)}` })}
          />
          {doc.offline && (
            <Status
              color={theme.textMuted}
              text={t({ th: "รอส่งเข้าระบบ · ไม่มีเน็ต", en: "Waiting to send · no internet" })}
            />
          )}
        </>
      )}
      <View style={styles.doc}>
        <BillDoc doc={doc} ref={node} />
      </View>
    </View>
  );
}

function Status({ color, text }: { color: string; text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.status}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[TYPE.subhead, { color: theme.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  doc: { marginTop: SPACE.l },
});
