import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../AppProviders";
import { CodeCopy } from "../CodeCopy";
import { Photo } from "../products/parts";
import { SPACE } from "../theme";

interface NameCellProps {
  name: string;
  /** The grey line under it: the order number, a bill's number. */
  sub?: string;
  /** A product code instead: the grey line with its copy mark (owner, 5 Nov 2026). */
  code?: string;
  /** A product photo before it; undefined for none, null for the grey empty square. */
  imageKey?: string | null;
  photoSize?: number;
}

/**
 * A table's name cell: photo, the name on up to two lines, the grey code line under it (list rows
 * wrap — the phone rule, owner 4 Nov 2026).
 */
export function NameCell({ name, sub, code, imageKey, photoSize = 40 }: NameCellProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      {imageKey !== undefined && <Photo imageKey={imageKey} size={photoSize} radius={10} />}
      <View style={styles.text}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={2}>
          {name}
        </Text>
        {code ? (
          <CodeCopy code={code} style={[styles.sub, { color: theme.textMuted }]} />
        ) : sub ? (
          <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.m, minWidth: 0 },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 14, lineHeight: 20 },
  sub: { fontSize: 13, lineHeight: 18 },
});
