import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import type { ClosedFor } from "@l-shopee/shared/nav";
import { closedWords } from "@/lib/closedPage";
import { HOME_ROUTE, NOT_FOUND_WORDS, notFoundBody } from "@/lib/notFoundPage";
import { useLang, useTheme } from "./AppProviders";
import { BigButton } from "./BigButton";
import { useWide } from "./desk/useWide";
import { RADIUS, SPACE, TYPE } from "./theme";

/**
 * An address with no page: an old or mistyped link (plan step 1.2, as drawn on 15 Nov 2026). The
 * frame already shows "ไม่พบหน้านี้" (or the menu name the link sits under) as the large title.
 */
export function PageNotFound() {
  const { t } = useLang();
  const wide = useWide();
  return <NoticePage title={t(NOT_FOUND_WORDS.title)} body={t(notFoundBody(wide))} />;
}

/**
 * A page this person can't open — the menu hides it from their role, or it is for shops with the
 * AirPlus website (plan 11.5, 20 Nov 2026) — says whose page it is, instead of an empty frame.
 */
export function PageClosed({ why }: { why: ClosedFor }) {
  const { t } = useLang();
  const words = closedWords(why);
  return <NoticePage title={t(words.title)} body={t(words.body)} />;
}

/** One card: what happened, one grey line, and หน้าหลัก. */
function NoticePage(props: { title: string; body: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderWidth: theme.cardLine, borderColor: theme.border },
      ]}
    >
      <View style={styles.words}>
        <Text style={[styles.title, { color: theme.text }]}>{props.title}</Text>
        <Text style={[styles.body, { color: theme.textMuted }]}>{props.body}</Text>
      </View>
      <BigButton label={t(NOT_FOUND_WORDS.button)} onPress={() => router.replace(HOME_ROUTE)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.card, padding: SPACE.l, gap: SPACE.l },
  words: { gap: SPACE.xs },
  title: { ...TYPE.headline },
  body: { ...TYPE.subhead },
});
