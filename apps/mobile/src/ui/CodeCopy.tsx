import type { Phrase } from "@l-shopee/shared/lang";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { CopyIcon } from "./staff/parts";

interface CodeCopyProps {
  /** The product's code (รหัสสินค้า) — always with its copy mark (owner, 5 Nov 2026). */
  code: string;
  /** The code's own text style: grey on a row's second line, black where it is the headline. */
  style?: StyleProp<TextStyle>;
  /** Words before the code on the same line ("× 1 · รหัสสินค้า "). */
  before?: string;
  /** Words that follow on the same line, after the mark (" · ป้าย L"). */
  after?: string;
  /** A page that has a toast says "คัดลอก … แล้ว" there; left out, the mark turns into a ✓. */
  onCopied?: (said: Phrase) => void;
}

/**
 * A product code with its plain copy mark right after it (owner, 5 Nov 2026: *"always add copy icon
 * button to ID everywhere"*). The mark says copied only when the copy really happened.
 */
export function CodeCopy({ code, style, before, after, onCopied }: CodeCopyProps) {
  return (
    <View style={styles.row}>
      {before ? (
        <Text style={[style, styles.shrink]} numberOfLines={1}>
          {before}
        </Text>
      ) : null}
      <Text style={[style, styles.shrink]} numberOfLines={1}>
        {code}
      </Text>
      <CopyIcon value={code} what={{ th: ` ${code} `, en: code }} onCopied={onCopied} inLine />
      {after ? (
        <Text style={[style, styles.shrink]} numberOfLines={1}>
          {after}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  shrink: { flexShrink: 1 },
});
