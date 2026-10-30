import { parseCsv, xlsxToRows } from "@l-shopee/core";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { API_BASE } from "@/lib/config";
import { readImport, runImport, type ImportKind, type ImportPlan } from "@/lib/customerImport";
import { importCalls } from "@/lib/customersApi";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { openPage } from "../openPage";
import { Group, Row } from "../orders/parts";
import { Sheet } from "../orders/Sheet";
import { SPACE, TYPE } from "../theme";
import { pickSheet } from "./pickSheet";
import type { CustomerList } from "./useCustomerList";

/** A tray with an arrow going in (owner picked icon A, canvas v146: the old ↓ read as "Save"). */
export const IMPORT_ICON =
  "M3 13h5l1.5 2.5h5L16 13h5M3 13v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6M12 3v8M8.5 7.5 12 11l3.5-3.5";

/** The owner's transcription form (fill it → download → นำเข้า). Set 2026-07-09. */
const FORM_URL =
  "https://docs.google.com/spreadsheets/d/1lAfLz8B6Y6pFtH9gbRT7YzTy_cj3dZB5bp32kWmDz6A/edit";

const KIND_WORDS: Record<ImportKind, { th: string; en: string }> = {
  rich: { th: "ฟอร์มลูกค้า (ข้อมูล + ประวัติการเข้ามา)", en: "Customer form (details + visits)" },
  combined: { th: "ลูกค้า + ประวัติ", en: "Customers + history" },
  history: { th: "ประวัติการซ่อม", en: "Service history" },
  customers: { th: "รายชื่อลูกค้า", en: "Customer list" },
};

/** นำเข้า: choose the file in the tap, read it, then the sheet says what it holds before sending. */
export function useImport(list: CustomerList) {
  const [file, setFile] = useState<{ name: string; rows: string[][] } | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [busy, setBusy] = useState(false);

  const start = async () => {
    if (Platform.OS !== "web") {
      list.showToast(
        { th: "นำเข้าได้บนเว็บ", en: "Import works on the web" },
        { th: "เปิดหน้านี้ในเบราว์เซอร์", en: "Open this page in a browser" },
      );
      return;
    }
    const picked = await pickSheet();
    if (!picked) return;
    try {
      const rows = /\.xlsx$/i.test(picked.name)
        ? await xlsxToRows(new Uint8Array(await picked.arrayBuffer()))
        : parseCsv(await picked.text());
      setFile({ name: picked.name, rows });
      setPlan(readImport(rows));
    } catch {
      list.showToast(
        { th: "อ่านไฟล์ไม่ได้", en: "The file could not be read" },
        { th: "ใช้ไฟล์ .xlsx หรือ .csv", en: "Use an .xlsx or .csv file" },
      );
    }
  };

  const close = () => {
    setPlan(null);
    setFile(null);
  };

  const send = async () => {
    if (!file || busy || !list.token) return;
    setBusy(true);
    try {
      const out = await runImport(importCalls(fetch, API_BASE, list.token), file.rows);
      close();
      const failed = out.failedRows > 0 ? ` · ${out.failedRows}` : "";
      list.showToast(
        { th: "นำเข้าแล้ว", en: "Imported" },
        {
          th: `รถ ${out.cars} คัน · ประวัติ ${out.visits} ครั้ง${failed ? `${failed} แถวนำเข้าไม่ได้` : ""}`,
          en: `${out.cars} cars · ${out.visits} visits${failed ? `${failed} rows failed` : ""}`,
        },
      );
      await list.reload();
    } catch {
      list.showToast(
        { th: "นำเข้าไม่สำเร็จ", en: "Import failed" },
        { th: "ยังไม่มีอะไรเปลี่ยน ลองอีกครั้ง", en: "Nothing changed; try again" },
      );
    } finally {
      setBusy(false);
    }
  };

  return { start, plan, fileName: file?.name ?? "", close, send };
}

type Import = ReturnType<typeof useImport>;

function countLine(p: ImportPlan): { th: string; en: string } {
  const cars = p.cars > 0 ? { th: `พบรถ ${p.cars} คัน`, en: `${p.cars} cars` } : null;
  const visits =
    p.visits > 0 ? { th: `${p.visits} ครั้งที่เข้ามา`, en: `${p.visits} visits` } : null;
  if (cars && visits) return { th: `${cars.th} · ${visits.th}`, en: `${cars.en} · ${visits.en}` };
  if (visits) return { th: `พบ ${visits.th}`, en: visits.en };
  return cars ?? { th: "", en: "" };
}

export function ImportSheet({ imp }: { imp: Import }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const p = imp.plan!;
  const go =
    p.cars > 0
      ? { th: `นำเข้า ${p.cars} คัน`, en: `Import ${p.cars} cars` }
      : { th: `นำเข้า ${p.visits} ครั้ง`, en: `Import ${p.visits} visits` };
  return (
    <Sheet title={t({ th: "นำเข้าจาก Excel", en: "Import from Excel" })} onClose={imp.close}>
      <Group>
        <Row label={t({ th: "ไฟล์", en: "File" })} value={imp.fileName} last />
      </Group>
      {p.problem ? (
        <Text style={[TYPE.subhead, styles.note, { color: theme.danger }]}>{t(p.problem)}</Text>
      ) : (
        <>
          <Text style={[TYPE.subhead, styles.note, { color: theme.textMuted }]}>
            {`${t({ th: "ตรวจไฟล์แล้ว", en: "File checked" })} · ${t(KIND_WORDS[p.kind])}`}
          </Text>
          <Text style={[TYPE.headline, styles.count, { color: theme.text }]}>
            {t(countLine(p))}
          </Text>
          <Group spaced>
            <Row
              label={t({ th: "รถที่มีอยู่แล้ว", en: "Cars already here" })}
              value={t({
                th: "อัปเดต · ช่องว่างไม่ลบของเดิม",
                en: "Updated · blanks keep old data",
              })}
            />
            <Row
              label={t({ th: "ประวัติที่เคยนำเข้า", en: "History imported before" })}
              value={t({ th: "ข้าม", en: "Skipped" })}
            />
            <Row
              label={t({ th: "สต็อกและยอดขาย", en: "Stock and sales" })}
              value={t({ th: "ไม่แตะ", en: "Untouched" })}
              last
            />
          </Group>
          <View style={styles.go}>
            <BigButton label={t(go)} onPress={() => void imp.send()} />
          </View>
        </>
      )}
      <Pressable
        onPress={() => openPage(FORM_URL)}
        accessibilityRole="link"
        hitSlop={8}
        style={styles.form}
      >
        <Text style={[TYPE.body, { color: theme.primary }]}>
          {t({ th: "เปิด Google Sheet แบบฟอร์ม", en: "Open the Google Sheet form" })}
        </Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: SPACE.s, marginHorizontal: SPACE.l },
  count: { marginTop: SPACE.l, marginHorizontal: 2 },
  go: { marginTop: SPACE.xxl },
  form: { alignSelf: "center", marginTop: SPACE.l, marginBottom: SPACE.s },
});
