import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { SPACE } from "../theme";
import { useWide } from "./useWide";

interface ColumnsProps {
  /** The page's main column: the form's boxes, an order's job and its lines. */
  children: ReactNode;
  /** The narrower column on the right: photos, status, a summary. Under the main one on a phone. */
  side: ReactNode;
  /** The side column's width on a computer (guide: 340–380). */
  sideWidth?: number;
}

/**
 * Two columns on a computer (computer guide #8: fields left, photo/status/summary right); on a phone
 * the side column simply follows the main one, so the phone page is unchanged.
 */
export function Columns({ children, side, sideWidth = 360 }: ColumnsProps) {
  const wide = useWide();
  if (!wide) {
    return (
      <>
        {children}
        {side}
      </>
    );
  }
  return (
    <View style={styles.row}>
      <View style={styles.main}>{children}</View>
      <View style={[styles.side, { width: sideWidth }]}>{side}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: SPACE.xxl },
  main: { flex: 1, minWidth: 0 },
  side: { flexShrink: 0 },
});
