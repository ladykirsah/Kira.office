import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { stockLine, type ProductRow } from "@/lib/productList";
import { useLang, useTheme } from "../AppProviders";
import { Dot } from "../customers/parts";
import { LineIcon } from "../LineIcon";
import { ICON } from "../orders/icons";
import { RADIUS, SPACE, TYPE } from "../theme";
import { Photo } from "./parts";

/** One product in the list (canvas v194): photo, name, code to copy, what is left, two buttons. */
export function ProductCard(props: {
  row: ProductRow;
  canEdit: boolean;
  onCopy: (code: string) => void;
  onStock: () => void;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const { row } = props;
  const line = stockLine(row);
  const open = (path: string) =>
    router.push(`/products/${encodeURIComponent(row.id)}${path}` as never);
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Pressable onPress={() => open("")} accessibilityRole="link" style={styles.top}>
        <Photo imageKey={row.imageKey} size={74} />
        <View style={styles.text}>
          <Text style={[TYPE.headline, { color: theme.text }]} numberOfLines={2}>
            {row.name}
          </Text>
          <View style={styles.code}>
            <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{row.productRef}</Text>
            <Pressable
              onPress={() => props.onCopy(row.productRef)}
              accessibilityRole="button"
              accessibilityLabel={t({
                th: `คัดลอก ${row.productRef}`,
                en: `Copy ${row.productRef}`,
              })}
              hitSlop={10}
            >
              <LineIcon d={ICON.copy} color={theme.textMuted} size={14} strokeWidth={2} />
            </Pressable>
          </View>
        </View>
      </Pressable>
      <View style={styles.status}>
        {line.level === "low" && <Dot color={theme.waiting} />}
        {line.level === "out" && <Dot color={theme.textFaint} />}
        <Text style={[TYPE.subhead, { color: theme.textMuted }]}>{t(line.text)}</Text>
      </View>
      <View style={styles.buttons}>
        <CardButton
          label={t({ th: "สต็อกและราคา", en: "Stock & prices" })}
          onPress={props.onStock}
        />
        {props.canEdit && (
          <CardButton label={t({ th: "แก้ไข", en: "Edit" })} onPress={() => open("/edit")} />
        )}
      </View>
    </View>
  );
}

function CardButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: pressed ? theme.border : theme.hover },
      ]}
    >
      <Text style={[TYPE.subhead, styles.buttonText, { color: theme.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.m },
  top: { flexDirection: "row", gap: SPACE.m },
  text: { flex: 1, minWidth: 0, gap: SPACE.xs },
  code: { flexDirection: "row", alignItems: "center", gap: SPACE.s },
  status: { flexDirection: "row", alignItems: "center", gap: 6 },
  buttons: { flexDirection: "row", gap: SPACE.s },
  button: { flex: 1, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  buttonText: { fontWeight: "600" },
});
