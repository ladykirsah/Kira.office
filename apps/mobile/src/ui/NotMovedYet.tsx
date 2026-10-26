import { StyleSheet, Text, View } from "react-native";
import { useLang, useTheme } from "./AppProviders";
import { RADIUS, SPACE, TYPE } from "./theme";

/**
 * What a menu page shows until it has been redesigned and rebuilt here. Honest about it, rather than
 * an empty screen that looks broken: the page still works in the current back office. The frame
 * already shows the page's name as the large title.
 */
export function NotMovedYet() {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <Text style={[styles.title, { color: theme.text }]}>
        {t({ th: "ยังไม่ได้ย้ายมาแอปใหม่", en: "Not in the new app yet" })}
      </Text>
      <Text style={[styles.body, { color: theme.textMuted }]}>
        {t({
          th: "หน้านี้ยังใช้ในระบบหลังร้านเดิมได้ตามปกติ จะย้ายมาที่นี่ทีละหน้า หลังจากคุณอนุมัติแบบแล้ว",
          en: "This page still works in the current back office. Pages move here one at a time, once you approve each design.",
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.xs },
  title: { ...TYPE.headline },
  body: { ...TYPE.subhead },
});
