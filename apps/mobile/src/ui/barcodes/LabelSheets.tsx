import { useEffect, useRef, useState, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LABEL_WIDTH_MM, type LabelSize } from "@/lib/barcodeLabel";
import { pageSize } from "@/lib/labelSheet";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Sheet } from "../orders/Sheet";
import { Line } from "../products/parts";
import { RADIUS, SPACE, TYPE } from "../theme";
import { LabelArt } from "./LabelArt";
import { PaperPage } from "./PaperPage";
import type { Barcodes } from "./useBarcodes";

/** A label's preview in a sheet: one scale for both sizes, so S shows narrower than L. */
export const SHEET_PX_PER_MM = 4;
/** Pages and labels are drawn at this size when they become a file. */
const FILE_PX_PER_MM = 4;

export const DOWNLOAD_ICON = "M12 4v11M7 10l5 5 5-5M5 20h14";
const PREV = "M15 5l-7 7 7 7";
const NEXT = "M9 6l6 6-6 6";

/** "L · กว้าง 46 มม." — the size is chosen by its width; the height follows the car lines. */
export function sizeWords(size: LabelSize) {
  return {
    th: `${size} · กว้าง ${LABEL_WIDTH_MM[size]} มม.`,
    en: `${size} · ${LABEL_WIDTH_MM[size]} mm wide`,
  };
}

/** Tapping a card: the label large, its size, save it as a picture, or take it off the sheet. */
export function LabelSheet({ list, itemKey }: { list: Barcodes; itemKey: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const item = list.items.find((i) => i.key === itemKey);
  const row = item && list.byId.get(item.productId);
  const text = item && list.texts.get(item.productId);
  if (!item || !row || !text) return null;
  return (
    <Sheet
      title={row.name}
      closeLabel={t({ th: "ปิด", en: "Close" })}
      onClose={() => list.setSheet(null)}
    >
      <View style={[styles.preview, { backgroundColor: theme.surface }]}>
        <LabelArt text={text} size={item.size} shop={list.shop} pxPerMm={SHEET_PX_PER_MM} />
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <Line
          label={t({ th: "ขนาด", en: "Size" })}
          last
          right={<Text style={[TYPE.body, { color: theme.text }]}>{t(sizeWords(item.size))}</Text>}
        />
      </View>
      <BigButton
        kind="grey"
        icon={DOWNLOAD_ICON}
        label={t({ th: "บันทึกป้ายนี้เป็นรูป (PNG)", en: "Save this label as a picture (PNG)" })}
        onPress={() => {
          // As drawn: the sheet closes and the page says where the picture went.
          list.setSheet(null);
          list.setPrinting({ kind: "label", key: item.key });
        }}
      />
      <Pressable
        onPress={() => list.remove(item.key)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.remove,
          { backgroundColor: pressed ? theme.border : theme.hover },
        ]}
      >
        <Text style={[TYPE.headline, { color: theme.danger }]}>
          {t({ th: "ลบออกจากแผ่น", en: "Take off the sheet" })}
        </Text>
      </Pressable>
    </Sheet>
  );
}

/** ดูตัวอย่าง: the paper as it will print, filling the grey area, with the page arrows under it. */
export function PreviewSheet({ list }: { list: Barcodes }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const [at, setAt] = useState(0);
  const [area, setArea] = useState(0);
  const pages = list.pages;
  const page = Math.min(at, Math.max(0, pages.length - 1));
  const { width } = pageSize(list.paper, list.way);
  const pxPerMm = area > 0 ? (area - 2 * PREVIEW_PAD) / width : 0;
  const arrow = (d: string, said: string, to: number, can: boolean) => (
    <Pressable
      onPress={() => can && setAt(to)}
      disabled={!can}
      accessibilityRole="button"
      accessibilityLabel={said}
      accessibilityState={{ disabled: !can }}
      style={[styles.arrow, { backgroundColor: theme.hover }]}
    >
      <LineIcon d={d} color={can ? theme.text : theme.textFaint} size={16} strokeWidth={2.4} />
    </Pressable>
  );
  return (
    <Sheet
      title={t({ th: "ดูตัวอย่าง", en: "Preview" })}
      closeLabel={t({ th: "ปิด", en: "Close" })}
      onClose={() => list.setSheet(null)}
    >
      <Text style={[TYPE.subhead, styles.center, { color: theme.textMuted }]}>
        {t(list.summary)}
      </Text>
      <View
        style={[styles.grey, { backgroundColor: theme.hover }]}
        onLayout={(e) => setArea(e.nativeEvent.layout.width)}
      >
        {pxPerMm > 0 && pages[page] && (
          <PaperPage
            list={list}
            page={pages[page]!}
            paper={list.paper}
            way={list.way}
            pxPerMm={pxPerMm}
            shadow
          />
        )}
        <View style={styles.pager}>
          {arrow(PREV, t({ th: "หน้าก่อน", en: "Previous page" }), page - 1, page > 0)}
          <Text style={[TYPE.subhead, styles.pageNo, { color: theme.text }]}>
            {t({
              th: `หน้า ${page + 1} จาก ${Math.max(1, pages.length)}`,
              en: `Page ${page + 1} of ${Math.max(1, pages.length)}`,
            })}
          </Text>
          {arrow(NEXT, t({ th: "หน้าถัดไป", en: "Next page" }), page + 1, page < pages.length - 1)}
        </View>
      </View>
    </Sheet>
  );
}

/** The gap round the preview paper; the page number sits the same distance below it (owner, 31 Oct). */
const PREVIEW_PAD = 20;
const ARROW = 34;

type Node = ComponentRef<typeof View>;

/**
 * Makes a file: draws the pages (or one label) off screen at a print size, waits a frame for the
 * browser to lay them out, hands them to `onReady`, and is removed by the page when that is done.
 */
export function Printer({ list, onReady }: { list: Barcodes; onReady: (nodes: Node[]) => void }) {
  const refs = useRef<(Node | null)[]>([]);
  const job = list.printing;
  useEffect(() => {
    const id = requestAnimationFrame(() =>
      onReady(refs.current.filter((n): n is Node => n != null)),
    );
    return () => cancelAnimationFrame(id);
    // One file per job: the job object is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job]);
  if (!job) return null;
  if (job.kind === "label") {
    const item = list.items.find((i) => i.key === job.key);
    const text = item && list.texts.get(item.productId);
    if (!item || !text) return null;
    return (
      <View style={styles.offscreen} pointerEvents="none" aria-hidden>
        <LabelArt
          ref={(n) => void (refs.current[0] = n)}
          text={text}
          size={item.size}
          shop={list.shop}
          pxPerMm={FILE_PX_PER_MM * 2}
        />
      </View>
    );
  }
  return (
    <View style={styles.offscreen} pointerEvents="none" aria-hidden>
      <View style={styles.pages}>
        {list.pages.map((page, i) => (
          <PaperPage
            key={i}
            ref={(n) => void (refs.current[i] = n)}
            list={list}
            page={page}
            paper={list.paper}
            way={list.way}
            pxPerMm={FILE_PX_PER_MM}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  preview: {
    borderRadius: RADIUS.card,
    paddingVertical: SPACE.xl,
    paddingHorizontal: SPACE.l,
    alignItems: "center",
  },
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  remove: { height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  center: { textAlign: "center" },
  grey: {
    borderRadius: RADIUS.card,
    paddingTop: PREVIEW_PAD,
    paddingHorizontal: PREVIEW_PAD,
    paddingBottom: PREVIEW_PAD - (ARROW - 18) / 2,
    alignItems: "center",
    gap: PREVIEW_PAD - (ARROW - 18) / 2,
  },
  pager: { flexDirection: "row", alignItems: "center", gap: 14 },
  arrow: {
    width: ARROW,
    height: ARROW,
    borderRadius: ARROW / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pageNo: { fontVariant: ["tabular-nums"] },
  /** A 0 × 0 window: the drawing keeps its full size for the file but never shows on the page. */
  offscreen: { position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "hidden" },
  pages: { gap: 40, alignItems: "flex-start" },
});
