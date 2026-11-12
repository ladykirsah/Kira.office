import { useEffect, useRef, type ComponentRef, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WEB_EDGE_FADE } from "@/lib/frame";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { useWide } from "../desk/useWide";
import { PHONE_PAGE_SCROLLS, PINNED_TO_SCREEN } from "../pageScroll";
import { useScreenChrome } from "../ScreenChrome";
import { PHONE_MAX_WIDTH, SPACE, TYPE } from "../theme";
import { DeskFormPage } from "./DeskFormPage";

const HOME = 34;
const FADE = 28;
/** The head row: ยกเลิก and the title. */
const HEAD = 44;

/**
 * A whole-screen form, as แก้ไขสินค้า is drawn (canvas v194): the ยกเลิก pill and the centred title on
 * top — the built sheet's head — the form scrolling under, and the red บันทึก pinned at the bottom
 * on a band that fades upward, with any message just above it. เพิ่มสินค้า's pill says ปิด, and a
 * background save that failed says so in a small note under the head (canvas v196).
 */
export interface FormPageProps {
  title: string;
  onCancel: () => void;
  /** The top-left pill; ยกเลิก unless the page says otherwise. */
  cancelLabel?: string;
  /**
   * On a computer, the page this form sits under ("สินค้า"): the form then opens inside the frame,
   * with ‹ back above its title and ยกเลิก / บันทึก on the pinned bar (DeskAddProduct board). Left
   * out, a computer shows the phone's whole-screen form, as before.
   */
  back?: string;
  /** On a computer: "full" for a two-column form (สินค้า), "column" for a short one (แบนเนอร์). */
  deskLayout?: "column" | "full";
  /** A short line under the head, e.g. a draft that did not save. */
  note?: string | null;
  /** When this changes the form scrolls back to the top (เพิ่มสินค้า's next product). */
  scrollKey?: number;
  save?: { label: string; onPress: () => void };
  toast?: { title: string; detail: string } | null;
  children: ReactNode;
}

export function FormPage(props: FormPageProps) {
  const wide = useWide();
  if (wide && props.back) return <DeskFormPage {...props} back={props.back} />;
  return <PhoneFormPage {...props} />;
}

function PhoneFormPage(props: FormPageProps) {
  const wide = useWide();
  // The phone website scrolls whole, so its form is a page, not a layer over one (owner, 7 Nov 2026).
  if (PHONE_PAGE_SCROLLS && !wide) return <PageFormPage {...props} />;
  return <LayerFormPage {...props} />;
}

/** The app's form: a whole-screen layer that slides up, the form scrolling inside it. */
function LayerFormPage(props: FormPageProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(HOME, insets.bottom);
  const pinned = props.save ? 50 : 0;
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    if (props.scrollKey) scroller.current?.scrollTo({ y: 0, animated: true });
  }, [props.scrollKey]);
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={props.onCancel}>
      <View style={[styles.fill, { backgroundColor: theme.bg }]}>
        <View style={[styles.column, styles.top, { paddingTop: insets.top + SPACE.m }]}>
          <FormHead {...props} />
        </View>
        <ScrollView
          ref={scroller}
          style={styles.fill}
          contentContainerStyle={[
            styles.column,
            styles.body,
            { paddingBottom: bottom + pinned + SPACE.xxxl },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {props.children}
        </ScrollView>
        {(props.save || props.toast) && (
          <View style={styles.footer} pointerEvents="box-none">
            <FormFooter {...props} bottom={bottom} edgeFade={0} />
          </View>
        )}
      </View>
    </Modal>
  );
}

/**
 * The website's form on a phone: the page itself scrolls, under iPhone Safari's clock and bottom
 * bar, while ยกเลิก and the title stay pinned on top and บันทึก at the bottom, as drawn.
 */
function PageFormPage(props: FormPageProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(HOME, insets.bottom);
  const pinned = props.save ? 50 : 0;
  const headTop = insets.top + SPACE.m;
  useScreenChrome(null, [], { bare: true });
  useEffect(() => {
    if (props.scrollKey) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [props.scrollKey]);
  return (
    <View style={[styles.fill, { backgroundColor: theme.bg }]}>
      <View
        style={[
          styles.column,
          styles.body,
          { paddingTop: headTop + HEAD + SPACE.s, paddingBottom: bottom + pinned + SPACE.xxxl },
        ]}
      >
        {props.children}
      </View>
      <View style={[styles.pageHead, PINNED_TO_SCREEN]} pointerEvents="box-none">
        <View style={[styles.column, { paddingTop: headTop, backgroundColor: theme.bg }]}>
          <FormHead {...props} />
        </View>
        {/* The form fades in under the head instead of meeting it in a hard line. */}
        <Svg width="100%" height={FADE} pointerEvents="none">
          <Defs>
            <LinearGradient id="formHeadFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.bg} stopOpacity={1} />
              <Stop offset="1" stopColor={theme.bg} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={FADE} fill="url(#formHeadFade)" />
        </Svg>
      </View>
      {(props.save || props.toast) && (
        <View style={[styles.footer, PINNED_TO_SCREEN]} pointerEvents="box-none">
          <FormFooter {...props} bottom={bottom} edgeFade={WEB_EDGE_FADE} />
        </View>
      )}
    </View>
  );
}

/** ยกเลิก on the left, the title in the middle, and any short note floating under them. */
function FormHead(props: FormPageProps) {
  const { theme } = useTheme();
  const { t } = useLang();
  return (
    <>
      <View style={styles.head}>
        <Pressable
          onPress={props.onCancel}
          accessibilityRole="button"
          style={[styles.pill, { backgroundColor: theme.surface, borderColor: theme.glassLine }]}
        >
          <Text style={[TYPE.body, { color: theme.text }]}>
            {props.cancelLabel ?? t({ th: "ยกเลิก", en: "Cancel" })}
          </Text>
        </Pressable>
        <View style={styles.titles} pointerEvents="none">
          <Text style={[TYPE.headline, { color: theme.text }]} accessibilityRole="header">
            {props.title}
          </Text>
        </View>
      </View>
      {props.note ? (
        <View style={styles.noteRow} pointerEvents="none">
          <View
            style={[
              styles.note,
              {
                backgroundColor: theme.surface,
                borderWidth: theme.cardLine,
                borderColor: theme.border,
              },
            ]}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={[TYPE.subhead, { color: theme.text }]}>{props.note}</Text>
          </View>
        </View>
      ) : null}
    </>
  );
}

/**
 * The red บันทึก and any message above it, on a band of the page colour that fades in upward. On
 * the website (`edgeFade`) the band also melts away at the bottom, where the page shows on under
 * Safari's bar.
 */
function FormFooter(props: FormPageProps & { bottom: number; edgeFade: number }) {
  const { theme } = useTheme();
  return (
    <>
      {/* A short fade, then the page colour solid to the bottom edge, so cards scroll under. */}
      <Svg width="100%" height={FADE} pointerEvents="none">
        <Defs>
          <LinearGradient id="formFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.bg} stopOpacity={0} />
            <Stop offset="1" stopColor={theme.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={FADE} fill="url(#formFade)" />
      </Svg>
      <View
        style={{
          backgroundColor: theme.bg,
          paddingTop: SPACE.s,
          paddingBottom: props.bottom - props.edgeFade,
        }}
      >
        <View style={[styles.column, styles.footerInner]}>
          {props.toast && (
            <View style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Text style={styles.toastTitle}>{props.toast.title}</Text>
              {props.toast.detail ? (
                <Text style={styles.toastDetail}>{props.toast.detail}</Text>
              ) : null}
            </View>
          )}
          {props.save && <BigButton label={props.save.label} onPress={props.save.onPress} />}
        </View>
      </View>
      {props.edgeFade > 0 && (
        <Svg width="100%" height={props.edgeFade} pointerEvents="none">
          <Defs>
            <LinearGradient id="formEdgeFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.bg} stopOpacity={1} />
              <Stop offset="1" stopColor={theme.bg} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height={props.edgeFade} fill="url(#formEdgeFade)" />
        </Svg>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  column: {
    width: "100%",
    maxWidth: PHONE_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: SPACE.l,
  },
  top: { zIndex: 2 },
  head: { height: HEAD, flexDirection: "row", alignItems: "center" },
  pill: {
    height: 44,
    paddingHorizontal: SPACE.l,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    zIndex: 1,
  },
  titles: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  // Floats over the top of the form so the page does not jump when it comes and goes.
  noteRow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -40,
    alignItems: "center",
  },
  note: {
    borderRadius: 16,
    paddingHorizontal: SPACE.m,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  body: { paddingTop: SPACE.s },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0 },
  pageHead: { position: "absolute", left: 0, right: 0, top: 0, zIndex: 2 },
  footerInner: { gap: SPACE.s },
  toast: {
    alignSelf: "center",
    maxWidth: "100%",
    borderRadius: 14,
    paddingHorizontal: SPACE.l,
    paddingVertical: SPACE.s,
    backgroundColor: "rgba(28,28,30,0.92)",
  },
  toastTitle: { ...TYPE.subhead, color: "#FFFFFF", textAlign: "center" },
  toastDetail: { ...TYPE.subhead, color: "rgba(255,255,255,0.72)", textAlign: "center" },
});
