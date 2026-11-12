import { forwardRef, useMemo, type ComponentRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { barRuns } from "@/lib/barcodeBars";
import {
  cutFor,
  labelLines,
  labelBars,
  labelQr,
  LABEL_WIDTH_MM,
  PICTURE,
  type LabelSize,
  type LabelText,
} from "@/lib/barcodeLabel";

/** The label's own colours (the owner's picture, a little darker so laser prints stay crisp). */
const INK = "#000000";
const GREY = "#8E8E93";
const HAIR = "#D1D1D6";
/** The grey edge is the cut line on paper. */
const EDGE = "#A6A6A6";

export interface LabelShop {
  name: string;
  phone: string;
}

interface LabelArtProps {
  text: LabelText;
  size: LabelSize;
  shop: LabelShop;
  /** Screen px per mm: 2.6 on a card, 4 in a sheet, more when saving a file. */
  pxPerMm: number;
}

/**
 * One barcode label, drawn exactly as approved: every position is the owner's picture's, scaled to
 * the label's width (S 35 / L 46 mm), and the label is cut shorter for fewer car lines. The bars
 * run the hairline's width with the shop's line centred under them (owner's picture, 7 Nov 2026).
 */
export const LabelArt = forwardRef<ComponentRef<typeof View>, LabelArtProps>(function LabelArt(
  { text, size, shop, pxPerMm },
  ref,
) {
  const k = (pxPerMm * LABEL_WIDTH_MM[size]) / PICTURE.width;
  const cut = cutFor(labelLines(text));
  // A size takes the first line under the hairline; its cars follow (owner's pick B, 11 Nov 2026).
  const carStart = text.size ? 1 : 0;
  const bits = useMemo(() => labelBars(text.code), [text.code]);
  const f = PICTURE.font;
  const line = (size_: number, top: number, left: number) => ({
    position: "absolute" as const,
    left: left * k,
    top: top * k,
    fontSize: size_ * k,
    lineHeight: size_ * k,
  });

  return (
    <View
      ref={ref}
      collapsable={false}
      accessibilityRole="image"
      accessibilityLabel={[text.kind, text.brand, text.size, text.code].filter(Boolean).join(" ")}
      style={[styles.paper, { width: PICTURE.width * k, height: (PICTURE.height - cut) * k }]}
    >
      {/* Drawn over the inside, as in the picture, so it never moves the words. */}
      <View pointerEvents="none" style={[styles.edge, { borderWidth: PICTURE.edge * k }]} />
      <Text style={[styles.bold, line(f.name, PICTURE.nameTop, PICTURE.x)]} numberOfLines={1}>
        {text.kind}
      </Text>
      <Text style={[styles.bold, line(f.name, PICTURE.brandTop, PICTURE.x)]} numberOfLines={1}>
        {text.brand}
      </Text>
      <Text style={[styles.grey, line(f.code, PICTURE.codeTop, PICTURE.x)]} numberOfLines={1}>
        {text.code}
      </Text>
      <View
        style={[
          styles.hair,
          {
            left: PICTURE.x * k,
            top: PICTURE.hairY * k,
            width: (PICTURE.hairRight - PICTURE.x + 1) * k,
            height: Math.max(2 * k, 1),
          },
        ]}
      />
      {text.size ? (
        <Text
          style={[
            styles.bold,
            line(f.size, PICTURE.rowBase[0]! - PICTURE.rowAscent * f.size, PICTURE.x),
          ]}
          numberOfLines={1}
        >
          {`ขนาด ${text.size}`}
        </Text>
      ) : null}
      {text.cars.map((car, i) => {
        const base = PICTURE.rowBase[i + carStart]!;
        const dot = PICTURE.bullet * k;
        return (
          <View key={i}>
            <View
              style={[
                styles.dot,
                {
                  left: PICTURE.x * k,
                  top: (base - PICTURE.bulletRaise) * k - dot / 2,
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                },
              ]}
            />
            <View
              style={[
                styles.row,
                {
                  left: PICTURE.modelX * k,
                  top: (base - PICTURE.rowAscent * f.model) * k,
                  gap: PICTURE.yearGap * k,
                },
              ]}
            >
              <Text
                style={[styles.bold, { fontSize: f.model * k, lineHeight: f.model * k }]}
                numberOfLines={1}
              >
                {car.model}
              </Text>
              {car.years ? (
                <Text style={[styles.ink, { fontSize: f.years * k, lineHeight: f.years * k }]}>
                  {car.years}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
      <View
        style={[
          styles.code,
          {
            left: PICTURE.barX * k,
            top: (PICTURE.barTop - cut) * k,
            width: (PICTURE.barRight - PICTURE.barX) * k,
            height: PICTURE.barHeight * k,
          },
        ]}
      >
        {bits ? (
          <Bars
            bits={bits}
            width={(PICTURE.barRight - PICTURE.barX) * k}
            height={PICTURE.barHeight * k}
          />
        ) : (
          <Qr code={text.code} side={PICTURE.barHeight * k} />
        )}
      </View>
      <Text
        style={[
          styles.grey,
          styles.shopLine,
          {
            left: PICTURE.x * k,
            width: (PICTURE.hairRight - PICTURE.x + 1) * k,
            top: (PICTURE.shopBase - PICTURE.rowAscent * f.phone - cut) * k,
            fontSize: f.phone * k,
            lineHeight: f.phone * k,
          },
        ]}
        numberOfLines={1}
      >
        <Text style={{ fontSize: f.shop * k }}>{shop.name.trim()}</Text>
        {shop.phone.trim() ? ` ${shop.phone.trim()}` : ""}
      </Text>
    </View>
  );
});

/** Code 128 across the label: touching black modules drawn as one bar, stretched to the width. */
function Bars({ bits, width, height }: { bits: string; width: number; height: number }) {
  const runs = useMemo(() => barRuns(bits), [bits]);
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${bits.length} 1`} preserveAspectRatio="none">
      {runs.map((r) => (
        <Rect key={r.start} x={r.start} y={0} width={r.length} height={1} fill={INK} />
      ))}
    </Svg>
  );
}

/** A code Code 128 cannot carry (Thai letters) keeps its QR, so the label still scans. */
function Qr({ code, side }: { code: string; side: number }) {
  const grid = useMemo(() => labelQr(code), [code]);
  const d = useMemo(
    () =>
      grid.flatMap((row, r) => row.map((dark, c) => (dark ? `M${c} ${r}h1v1h-1z` : ""))).join(""),
    [grid],
  );
  return (
    <Svg width={side} height={side} viewBox={`0 0 ${grid.length} ${grid.length}`}>
      <Path d={d} fill={INK} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  paper: { position: "relative", overflow: "hidden", backgroundColor: "#FFFFFF" },
  edge: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderColor: EDGE },
  // Each line stays on one line but is never cut at its own box: Thai marks and a "g" reach past a
  // line height equal to the font size, and the saved picture draws letters a touch wider than the
  // screen does. Only the label's own edge trims.
  bold: { color: INK, fontWeight: "700", overflow: "visible" },
  ink: { color: INK, overflow: "visible" },
  grey: { color: GREY, overflow: "visible" },
  hair: { position: "absolute", backgroundColor: HAIR },
  dot: { position: "absolute", backgroundColor: INK },
  row: { position: "absolute", flexDirection: "row", alignItems: "baseline" },
  code: { position: "absolute" },
  shopLine: { position: "absolute", textAlign: "center", fontVariant: ["tabular-nums"] },
});
