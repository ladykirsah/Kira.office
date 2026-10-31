import { forwardRef, type ComponentRef } from "react";
import { StyleSheet, View } from "react-native";
import { pageSize, type Paper, type PaperWay, type PlacedLabel } from "@/lib/labelSheet";
import { LabelArt } from "./LabelArt";
import type { Barcodes } from "./useBarcodes";

interface PaperPageProps {
  list: Barcodes;
  page: PlacedLabel[];
  paper: Paper;
  way: PaperWay;
  /** Screen px per mm: the preview fits the sheet's width; a saved file is drawn bigger. */
  pxPerMm: number;
  /** The page's own shadow on screen; none on a saved file. */
  shadow?: boolean;
}

/** One sheet of paper with its labels where the planner put them (the approved A4 page). */
export const PaperPage = forwardRef<ComponentRef<typeof View>, PaperPageProps>(function PaperPage(
  { list, page, paper, way, pxPerMm, shadow },
  ref,
) {
  const { width, height } = pageSize(paper, way);
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[
        styles.paper,
        shadow && styles.shadow,
        { width: width * pxPerMm, height: height * pxPerMm },
      ]}
    >
      {page.map((p) => {
        const copy = list.copies[p.index];
        const item = copy && list.items.find((i) => i.key === copy.item);
        const text = item && list.texts.get(item.productId);
        if (!item || !text) return null;
        return (
          <View key={p.index} style={[styles.at, { left: p.x * pxPerMm, top: p.y * pxPerMm }]}>
            <LabelArt text={text} size={item.size} shop={list.shop} pxPerMm={pxPerMm} />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  paper: { position: "relative", overflow: "hidden", backgroundColor: "#FFFFFF" },
  shadow: {
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5EA",
  },
  at: { position: "absolute" },
});
