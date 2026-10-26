import { StyleSheet, Text, View } from "react-native";
import { useAuth, useLang, useTheme } from "@/ui/AppProviders";
import { NotMovedYet } from "@/ui/NotMovedYet";
import { SPACE, TYPE } from "@/ui/theme";

export default function Home() {
  const auth = useAuth();
  const { t } = useLang();
  const { theme } = useTheme();
  const name = auth.status === "signed-in" ? auth.staff.name : "";
  return (
    <View style={styles.wrap}>
      <Text style={[styles.hello, { color: theme.textMuted }]}>
        {t({ th: `สวัสดี ${name}`, en: `Hello, ${name}` })}
      </Text>
      <NotMovedYet />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.xl },
  hello: { ...TYPE.subhead },
});
