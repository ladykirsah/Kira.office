import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useLang, useTheme } from "../AppProviders";
import { BigButton } from "../BigButton";
import { PHONE_MAX_WIDTH, SPACE, TYPE } from "../theme";

const HOME = 34;
const FADE = 28;

/**
 * A whole-screen form, as แก้ไขสินค้า is drawn (canvas v194): the ยกเลิก pill and the centred title on
 * top — the built sheet's head — the form scrolling under, and the red บันทึก pinned at the bottom
 * on a band that fades upward, with any message just above it.
 */
export function FormPage(props: {
  title: string;
  onCancel: () => void;
  save?: { label: string; onPress: () => void };
  toast?: { title: string; detail: string } | null;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const bottom = Math.max(HOME, insets.bottom);
  const pinned = props.save ? 50 : 0;
  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={props.onCancel}>
      <View style={[styles.fill, { backgroundColor: theme.bg }]}>
        <View style={[styles.column, { paddingTop: insets.top + SPACE.m }]}>
          <View style={styles.head}>
            <Pressable
              onPress={props.onCancel}
              accessibilityRole="button"
              style={[
                styles.pill,
                { backgroundColor: theme.surface, borderColor: theme.glassLine },
              ]}
            >
              <Text style={[TYPE.body, { color: theme.text }]}>
                {t({ th: "ยกเลิก", en: "Cancel" })}
              </Text>
            </Pressable>
            <View style={styles.titles} pointerEvents="none">
              <Text style={[TYPE.headline, { color: theme.text }]} accessibilityRole="header">
                {props.title}
              </Text>
            </View>
          </View>
        </View>
        <ScrollView
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
            <View style={{ backgroundColor: theme.bg, paddingTop: SPACE.s, paddingBottom: bottom }}>
              <View style={[styles.column, styles.footerInner]}>
                {props.toast && (
                  <View
                    style={styles.toast}
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                  >
                    <Text style={styles.toastTitle}>{props.toast.title}</Text>
                    {props.toast.detail ? (
                      <Text style={styles.toastDetail}>{props.toast.detail}</Text>
                    ) : null}
                  </View>
                )}
                {props.save && <BigButton label={props.save.label} onPress={props.save.onPress} />}
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
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
  head: { height: 44, flexDirection: "row", alignItems: "center" },
  pill: {
    height: 44,
    paddingHorizontal: SPACE.l,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    zIndex: 1,
  },
  titles: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  body: { paddingTop: SPACE.s },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0 },
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
