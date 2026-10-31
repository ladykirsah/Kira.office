import type { ComponentRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LABEL_WIDTH_MM } from "@/lib/barcodeLabel";
import type { SheetItem } from "@/lib/labelList";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { Empty } from "../customers/parts";
import { ICON } from "../orders/icons";
import { SmallButton } from "../orders/parts";
import { Heading, Line, Stepper } from "../products/parts";
import { ScanCodeSheet } from "../products/ScanCodeSheet";
import { useScreenChrome } from "../ScreenChrome";
import { Segmented } from "../Segmented";
import { RADIUS, SPACE, TYPE } from "../theme";
import { AddLabelSheet } from "./AddLabelSheet";
import { LabelArt } from "./LabelArt";
import { DOWNLOAD_ICON, LabelSheet, PreviewSheet, Printer } from "./LabelSheets";
import { saveOneLabel, savePages } from "./saveSheet";
import { useBarcodes, type Barcodes } from "./useBarcodes";

/** A card's label picture: one scale for all, so L shows wider than S as on paper (style B). */
const CARD_PX_PER_MM = 2.6;
const TAG_ICON = "M3 12V4h8l9 9-8 8-9-9zM7.5 7.5h.01";
const WHERE = { th: "อยู่ในแอปไฟล์ › ดาวน์โหลด", en: "In Files › Downloads" };

/**
 * ออกบาร์โค้ด (owner approved the drawing, canvas v219, 31 Oct 2026): the paper and file choices,
 * the labels waiting on the sheet (บนแผ่น) as cards with the label on the left, and the pinned
 * บันทึก with ดูตัวอย่าง under it. Labels are added by search or by scanning the box (＋ or the
 * empty page's red button). The sheet stays on the phone until the page is left.
 */
export function BarcodesScreen() {
  const { t } = useLang();
  const { theme } = useTheme();
  const list = useBarcodes();
  const has = list.items.length > 0;

  useScreenChrome(
    {
      label: t({ th: "เพิ่มป้าย", en: "Add labels" }),
      icon: ICON.plus,
      onPress: () => list.setSheet({ kind: "add" }),
    },
    has
      ? [
          {
            label: t({ th: "บันทึก", en: "Save" }),
            icon: DOWNLOAD_ICON,
            // One file at a time: a second tap while one is being made does nothing.
            onPress: () => {
              if (!list.printing) list.setPrinting({ kind: "sheet", file: list.file });
            },
          },
          {
            label: t({ th: "ดูตัวอย่าง", en: "Preview" }),
            kind: "grey",
            onPress: () => list.setSheet({ kind: "preview" }),
          },
        ]
      : [],
    { toast: list.toast ? { title: t(list.toast.title), detail: t(list.toast.detail) } : null },
  );

  const printed = async (nodes: ComponentRef<typeof View>[]) => {
    const job = list.printing;
    if (!job) return;
    // The phone's own day, not world time: before 7 am in Thailand that is still yesterday.
    const now = new Date();
    const day = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
      .map((n) => String(n).padStart(2, "0"))
      .join("-");
    try {
      if (job.kind === "label") {
        const item = list.items.find((i) => i.key === job.key);
        const code = item ? list.texts.get(item.productId)?.code : "label";
        await saveOneLabel(nodes[0], `label-${code}-${item?.size ?? ""}.png`);
        list.showToast({ th: "บันทึกรูปแล้ว", en: "Picture saved" }, WHERE);
        return;
      }
      await savePages(job.file, nodes, list.paper, list.way, `labels-${day}`);
      list.showToast(
        job.file === "pdf"
          ? { th: "บันทึก PDF แล้ว", en: "PDF saved" }
          : {
              th: `บันทึก PNG แล้ว · ${nodes.length} รูป`,
              en: `PNG saved · ${nodes.length} picture${nodes.length === 1 ? "" : "s"}`,
            },
        WHERE,
      );
    } catch (e) {
      list.showToast(
        { th: "บันทึกไม่สำเร็จ", en: "Not saved" },
        { th: "ลองอีกครั้ง", en: e instanceof Error ? e.message : "Try again" },
      );
    } finally {
      // The hidden drawings stay on the page until the file is made: the picture is taken from them.
      list.setPrinting(null);
    }
  };

  return (
    <View>
      {has && (
        <Text style={[TYPE.subhead, styles.subtitle, { color: theme.textMuted }]}>
          {t(list.summary)}
        </Text>
      )}
      {list.failed ? (
        <View style={styles.retry}>
          <Text style={[TYPE.subhead, styles.grow, { color: theme.text }]}>
            {t({ th: "โหลดสินค้าไม่ได้", en: "The products did not load" })}
          </Text>
          <SmallButton
            label={t({ th: "ลองอีกครั้ง", en: "Try again" })}
            onPress={() => void list.load()}
          />
        </View>
      ) : has ? (
        <SheetBody list={list} />
      ) : (
        <Empty
          icon={TAG_ICON}
          title={t({ th: "ยังไม่มีป้ายบนแผ่น", en: "No labels on the sheet yet" })}
          detail=""
          action={
            <View style={styles.scanButton}>
              <BigButton
                icon={ICON.scan}
                label={t({ th: "สแกนบาร์โค้ดบนกล่อง", en: "Scan the barcode on the box" })}
                onPress={() => list.setSheet({ kind: "scan" })}
              />
            </View>
          }
        />
      )}
      <Sheets list={list} />
      {list.printing && <Printer list={list} onReady={(nodes) => void printed(nodes)} />}
    </View>
  );
}

/** The paper card, then บนแผ่น. */
function SheetBody({ list }: { list: Barcodes }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const choice = <T extends string>(
    label: string,
    width: number,
    options: { value: T; label: string }[],
    value: T,
    onChange: (v: T) => void,
    last?: boolean,
  ) => (
    <Line
      label={label}
      last={last}
      right={
        <View style={{ width }}>
          <Segmented label={label} options={options} value={value} onChange={onChange} />
        </View>
      }
    />
  );
  return (
    <>
      <View style={[styles.card, styles.paperCard, { backgroundColor: theme.surface }]}>
        {choice(
          t({ th: "ขนาดกระดาษ", en: "Paper size" }),
          120,
          [
            { value: "A4", label: "A4" },
            { value: "A5", label: "A5" },
          ],
          list.paper,
          list.setPaper,
        )}
        {choice(
          t({ th: "แนวกระดาษ", en: "Paper direction" }),
          170,
          [
            { value: "portrait", label: t({ th: "แนวตั้ง", en: "Upright" }) },
            { value: "landscape", label: t({ th: "แนวนอน", en: "Sideways" }) },
          ],
          list.way,
          list.setWay,
        )}
        {choice(
          t({ th: "ไฟล์", en: "File" }),
          120,
          [
            { value: "pdf", label: "PDF" },
            { value: "png", label: "PNG" },
          ],
          list.file,
          list.setFile,
          true,
        )}
      </View>
      <Heading text={t({ th: "บนแผ่น", en: "On the sheet" })} />
      <View style={styles.cards}>
        {list.items.map((item) => (
          <LabelCard key={item.key} list={list} item={item} />
        ))}
      </View>
    </>
  );
}

/** Style B (owner's pick): the label on the left, name / size / amount on the right. */
function LabelCard({ list, item }: { list: Barcodes; item: SheetItem }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const row = list.byId.get(item.productId);
  const text = list.texts.get(item.productId);
  if (!row || !text) return null;
  const open = () => list.setSheet({ kind: "label", key: item.key });
  const said = `${row.name} · ${t({ th: "ป้าย", en: "label" })} ${item.size}`;
  // The label and the words open the label's sheet; the − n + beside them is its own control
  // (a button may not hold other buttons).
  return (
    <View style={[styles.card, styles.labelCard, { backgroundColor: theme.surface }]}>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={said}
        style={styles.thumb}
      >
        <LabelArt text={text} size={item.size} shop={list.shop} pxPerMm={CARD_PX_PER_MM} />
      </Pressable>
      <View style={styles.cardText}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={said}
          style={styles.words}
        >
          <Text style={[TYPE.headline, { color: theme.text }]}>{row.name}</Text>
          <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
            {t({ th: `ป้าย ${item.size}`, en: `Label ${item.size}` })}
          </Text>
        </Pressable>
        <View style={styles.stepper}>
          <Stepper
            value={item.qty}
            label={t({ th: "จำนวนป้าย", en: "labels" })}
            onChange={(n) => list.setQty(item.key, n)}
          />
        </View>
      </View>
    </View>
  );
}

function Sheets({ list }: { list: Barcodes }) {
  const s = list.sheet;
  if (!s) return null;
  if (s.kind === "scan") {
    return (
      <ScanCodeSheet
        onClose={() => list.setSheet(null)}
        onCode={(code) => void list.scanned(code)}
      />
    );
  }
  if (s.kind === "add") return <AddLabelSheet key={JSON.stringify(s)} list={list} start={s} />;
  if (s.kind === "label") return <LabelSheet list={list} itemKey={s.key} />;
  return <PreviewSheet list={list} />;
}

const styles = StyleSheet.create({
  subtitle: { marginTop: -SPACE.xs, marginHorizontal: 2 },
  retry: { flexDirection: "row", alignItems: "center", gap: SPACE.s, marginTop: SPACE.m },
  grow: { flex: 1 },
  scanButton: { alignSelf: "stretch", marginTop: SPACE.l },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  paperCard: { marginTop: SPACE.l },
  cards: { gap: SPACE.m },
  labelCard: { flexDirection: "row", gap: 14, padding: SPACE.l },
  thumb: { width: LABEL_WIDTH_MM.L * CARD_PX_PER_MM, alignItems: "center" },
  cardText: { flex: 1, minWidth: 0 },
  words: { gap: SPACE.xs },
  stepper: { marginTop: "auto", paddingTop: 6, alignSelf: "flex-end" },
});
