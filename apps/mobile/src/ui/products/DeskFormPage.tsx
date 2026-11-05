import { useEffect, useRef, type ComponentRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLang, useTheme } from "../AppProviders";
import { useScreenChrome } from "../ScreenChrome";
import { SPACE, TYPE } from "../theme";
import type { FormPageProps } from "./FormPage";

/**
 * A whole-page form on a computer (DeskAddProduct board, 4 Nov 2026): inside the frame, ‹ back
 * above the title, the form in the page, and the pinned bar with the grey ยกเลิก / ปิด and the red
 * บันทึก on the right. Its toast shows on that bar, its note at the top of the page.
 */
export function DeskFormPage(props: FormPageProps & { back: string }) {
  const { t } = useLang();
  const { theme } = useTheme();
  const top = useRef<ComponentRef<typeof View>>(null);
  const cancel = props.cancelLabel ?? t({ th: "ยกเลิก", en: "Cancel" });
  useScreenChrome(
    null,
    props.save
      ? [
          { label: props.save.label, onPress: props.save.onPress },
          { label: cancel, kind: "grey", onPress: props.onCancel },
        ]
      : [],
    {
      title: props.title,
      back: { label: props.back, onPress: props.onCancel },
      toast: props.toast ?? null,
      layout: props.deskLayout ?? "full",
    },
  );
  // The next product starts at the top of the page (เพิ่มสินค้า), as the phone's form does.
  useEffect(() => {
    if (props.scrollKey) scrollPageToTop(top.current);
  }, [props.scrollKey]);
  return (
    <View>
      <View ref={top} collapsable={false} />
      {props.note ? (
        <View
          style={[styles.note, { backgroundColor: theme.surface, borderColor: theme.border }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={[TYPE.subhead, { color: theme.text }]}>{props.note}</Text>
        </View>
      ) : null}
      {props.children}
    </View>
  );
}

/** The bits of a web page element used here (react-native-web draws a View as one). */
interface WebNode {
  parentElement: WebNode | null;
  scrollHeight: number;
  clientHeight: number;
  scrollTo?: (o: { top: number; behavior: string }) => void;
}

/**
 * The frame's page scrolls in its own box, which this page cannot reach: on the web, walk up from
 * the form to the first box that scrolls and take it to the top. Elsewhere the page stays put.
 */
function scrollPageToTop(start: unknown) {
  const web = globalThis as { getComputedStyle?: (n: unknown) => { overflowY: string } };
  const style = web.getComputedStyle?.bind(globalThis);
  let node = (start as WebNode | null)?.parentElement ?? null;
  while (node && style) {
    if (/auto|scroll/.test(style(node).overflowY) && node.scrollHeight > node.clientHeight) {
      node.scrollTo?.({ top: 0, behavior: "smooth" });
      return;
    }
    node = node.parentElement;
  }
}

const styles = StyleSheet.create({
  note: {
    alignSelf: "flex-start",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: SPACE.m,
    paddingVertical: 6,
    marginBottom: SPACE.l,
  },
});
