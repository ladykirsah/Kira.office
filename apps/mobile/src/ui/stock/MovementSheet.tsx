import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";
import { copyText } from "@/lib/copyText";
import { formatBaht } from "@/lib/money";
import { changeText, movementLabel, whenText, type Movement } from "@/lib/stockHistory";
import { useLang, useTheme } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { Sheet } from "../orders/Sheet";
import { Divider, Line } from "../products/parts";
import { RADIUS, SPACE, TYPE } from "../theme";

const COPIED_MS = 1500;

/**
 * แตะรายการ → which product, what it sold for, what is left (owner, 1 Nov 2026). A sale shows its price
 * per piece; any other change has no ราคาขาย row. The code copies with the built copy icon; a toast
 * would sit under this sheet, so the icon turns into a ✓ for a moment instead.
 */
export function MovementSheet(props: { m: Movement; onClose: () => void }) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { m } = props;
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  const code = m.productRef ?? m.sku;
  const copy = async () => {
    if (!code) return;
    // A refused copy shows no ✓ (and never the error screen).
    if (!(await copyText(code))) {
      AccessibilityInfo.announceForAccessibility(t({ th: "คัดลอกไม่ได้", en: "Could not copy" }));
      return;
    }
    AccessibilityInfo.announceForAccessibility(
      t({ th: `คัดลอก ${code} แล้ว`, en: `${code} copied` }),
    );
    setCopied(true);
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };
  const grey = [TYPE.body, styles.nums, { color: theme.textMuted }];

  return (
    <Sheet
      title={t({ th: "รายละเอียด", en: "Details" })}
      closeLabel={t({ th: "ปิด", en: "Close" })}
      onClose={props.onClose}
    >
      <View style={[styles.card, styles.head, { backgroundColor: theme.surface }]}>
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>
          {t(movementLabel(m.movementType))}
        </Text>
        <Text style={[styles.big, { color: theme.text }]}>{changeText(m.quantityDelta)}</Text>
        <Text style={[TYPE.subhead, styles.nums, { color: theme.textMuted }]}>
          {t({ th: `เหลือ ${m.quantityAfter}`, en: `${m.quantityAfter} left` })}
        </Text>
      </View>
      <View style={[styles.card, { backgroundColor: theme.surface }]}>
        <View style={styles.line}>
          <Text style={[TYPE.body, { color: theme.text }]}>
            {t({ th: "สินค้า", en: "Product" })}
          </Text>
          <Text style={[TYPE.body, styles.name, { color: theme.textMuted }]} numberOfLines={1}>
            {m.productName}
          </Text>
        </View>
        <Divider />
        <Line
          label={t({ th: "รหัสสินค้า", en: "Product code" })}
          right={
            <View style={styles.code}>
              <Text style={grey}>{code ?? "—"}</Text>
              {code ? (
                <Pressable
                  onPress={() => void copy()}
                  accessibilityRole="button"
                  accessibilityLabel={t({ th: `คัดลอก ${code}`, en: `Copy ${code}` })}
                  hitSlop={10}
                >
                  <LineIcon
                    d={copied ? ICON.check : ICON.copy}
                    color={theme.textMuted}
                    size={14}
                    strokeWidth={copied ? 2.6 : 2}
                  />
                </Pressable>
              ) : null}
            </View>
          }
        />
        {m.salePriceSatang != null && (
          <Line
            label={t({ th: "ราคาขาย", en: "Sold for" })}
            right={<Text style={grey}>{formatBaht(m.salePriceSatang)}</Text>}
          />
        )}
        <Line
          label={t({ th: "เมื่อ", en: "When" })}
          right={<Text style={grey}>{t(whenText(m.createdAt, Date.now()))}</Text>}
          last
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, overflow: "hidden" },
  head: { padding: SPACE.l, alignItems: "center", gap: 2 },
  big: { fontSize: 34, lineHeight: 41, fontWeight: "700", fontVariant: ["tabular-nums"] },
  nums: { fontVariant: ["tabular-nums"] },
  line: {
    minHeight: 52,
    paddingHorizontal: SPACE.l,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.m,
  },
  name: { flex: 1, minWidth: 0, textAlign: "right" },
  code: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
});
