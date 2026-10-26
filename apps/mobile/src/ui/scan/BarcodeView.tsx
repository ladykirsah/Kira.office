import { StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { barRuns, barcodeBars } from "@/lib/barcodeBars";

/** A scannable barcode for a code — the same preview the web back office shows before adding. */
export function BarcodeView({ value, width = 326 }: { value: string; width?: number }) {
  const bars = barcodeBars(value);
  if (!bars) return null;
  const module = width / bars.bits.length;
  return (
    <View style={styles.wrap} accessibilityLabel={`บาร์โค้ด ${value}`}>
      <Svg width={width} height={52} viewBox={`0 0 ${width} 52`} aria-hidden>
        {barRuns(bars.bits).map((r) => (
          <Rect
            key={r.start}
            x={r.start * module}
            y={0}
            width={r.length * module}
            height={52}
            fill="#111111"
          />
        ))}
      </Svg>
      <Text style={styles.digits}>{value.trim()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#FFFFFF", alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  digits: { fontSize: 13, letterSpacing: 3, color: "#111111", marginTop: 4 },
});
