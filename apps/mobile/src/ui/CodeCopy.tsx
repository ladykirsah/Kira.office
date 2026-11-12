import type { Phrase } from "@l-shopee/shared/lang";
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import { sizeCode } from "@/lib/sizeLine";
import { useTheme } from "./AppProviders";
import { CopyIcon } from "./staff/parts";

interface CodeCopyProps {
  /** The product's code (รหัสสินค้า) — always with its copy mark (owner, 5 Nov 2026). */
  code: string;
  /** The code's own text style: grey on a row's second line, black where it is the headline. */
  style?: StyleProp<TextStyle>;
  /** A size's value, as a grey tag in front of its code ("[1/2 กลาง] TG949142-00204D"; owner's
   * pick A, 11 Nov 2026). Left out for a product without sizes. */
  tag?: string | null;
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
export function CodeCopy({ code, style, tag, before, after, onCopied }: CodeCopyProps) {
  const { theme } = useTheme();
  return (
    // With a size tag the code never gets cut short: it moves under the tag when both don't fit.
    <View style={[styles.row, tag ? styles.wrap : null]}>
      {before ? (
        <Text style={[style, styles.shrink]} numberOfLines={1}>
          {before}
        </Text>
      ) : null}
      {tag ? (
        <View style={[styles.tag, { backgroundColor: theme.segBg }]}>
          <Text style={[styles.tagText, { color: theme.text }]} numberOfLines={1}>
            {tag}
          </Text>
        </View>
      ) : null}
      {/* The code, its mark and the words after it move together; only the words get cut short. */}
      <View style={[styles.row, styles.shrink]}>
        <Text style={[style, tag ? styles.keep : styles.shrink]} numberOfLines={1}>
          {code}
        </Text>
        <CopyIcon value={code} what={{ th: ` ${code} `, en: code }} onCopied={onCopied} inLine />
        {after ? (
          <Text style={[style, styles.shrink]} numberOfLines={1}>
            {after}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** A row's code with its size tag in front (`sizeCode`); nothing when the row has no code. */
export function SizedCodeCopy({
  row,
  ...rest
}: Omit<CodeCopyProps, "code" | "tag"> & { row: Parameters<typeof sizeCode>[0] }) {
  const { code, tag } = sizeCode(row);
  return code ? <CodeCopy {...rest} code={code} tag={tag} /> : null;
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
  shrink: { flexShrink: 1 },
  wrap: { flexWrap: "wrap", rowGap: 2 },
  keep: { flexShrink: 0 },
  tag: {
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 6,
    justifyContent: "center",
    flexShrink: 0,
    marginRight: 2,
  },
  tagText: { fontSize: 13, lineHeight: 16, fontWeight: "600" },
});
