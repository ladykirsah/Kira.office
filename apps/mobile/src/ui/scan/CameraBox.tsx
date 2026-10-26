import { CameraView, useCameraPermissions, type BarcodeType } from "expo-camera";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { sightCode, type Sighting } from "@/lib/wedge";
import { useLang } from "../AppProviders";
import { LineIcon } from "../LineIcon";
import { RADIUS, SPACE, TYPE } from "../theme";

/** Every symbology a part box or a shelf label in the shop is likely to carry. */
const BARCODE_TYPES: BarcodeType[] = [
  "ean13",
  "ean8",
  "upc_a",
  "upc_e",
  "code128",
  "code39",
  "code93",
  "itf14",
  "qr",
];
const TORCH_ICON = "M13 2L4 14h7l-1 8 9-12h-7z";
const FRAME_WIDTH = 236;

interface CameraBoxProps {
  height: number;
  /** "Aim inside the frame" — on the big camera only. */
  showHint: boolean;
  onCode: (code: string) => void;
}

/**
 * The camera, inside the guide's four white corners. It asks for the camera on first open; where
 * there is none, or it is refused, it says so and points at the other two ways in — the handheld
 * scanner, which always works, and typing the code.
 */
export function CameraBox({ height, showHint, onCode }: CameraBoxProps) {
  const { t } = useLang();
  const [permission, requestPermission] = useCameraPermissions();
  const [failed, setFailed] = useState(false);
  const [torch, setTorch] = useState(false);
  const last = useRef<Sighting | null>(null);
  // The web camera keeps the first handler it is given, so it calls through to the newest one.
  const latest = useRef(onCode);
  useEffect(() => {
    latest.current = onCode;
  });

  useEffect(() => {
    if (permission?.status === "undetermined" && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  const onScanned = useCallback(({ data }: { data: string }) => {
    const seen = sightCode(last.current, data, Date.now());
    last.current = seen.last;
    if (seen.isNew) latest.current(data);
  }, []);

  const live = permission?.granted === true && !failed;
  const frameHeight = Math.min(124, height - 56);
  return (
    <View style={[styles.box, { height }]}>
      {live ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
          onBarcodeScanned={onScanned}
          onMountError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.off}>
          <Text style={styles.offText}>
            {!permission
              ? t({ th: "กำลังเปิดกล้อง…", en: "Opening the camera…" })
              : permission.canAskAgain && !failed
                ? t({
                    th: "แตะเพื่อให้แอปใช้กล้องสแกนบาร์โค้ด",
                    en: "Tap to let the app use the camera for barcodes",
                  })
                : t({
                    th: "ใช้กล้องไม่ได้บนเครื่องนี้ · ใช้เครื่องสแกนมือ หรือแตะปุ่มแป้นพิมพ์ด้านบนเพื่อพิมพ์รหัส",
                    en: "No camera here · use the handheld scanner, or the keyboard button above to type a code",
                  })}
          </Text>
          {permission && permission.canAskAgain && !failed && (
            <Pressable
              onPress={() => void requestPermission()}
              accessibilityRole="button"
              style={styles.allow}
            >
              <Text style={styles.allowText}>{t({ th: "เปิดกล้อง", en: "Turn on camera" })}</Text>
            </Pressable>
          )}
        </View>
      )}
      {live && (
        <View
          pointerEvents="none"
          style={[
            styles.frame,
            {
              width: FRAME_WIDTH,
              height: frameHeight,
              top: (height - frameHeight) / 2 - (showHint ? 16 : 0),
            },
          ]}
        >
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
      )}
      {live && showHint && (
        <Text style={styles.hint} pointerEvents="none">
          {t({ th: "เล็งบาร์โค้ดให้อยู่ในกรอบ", en: "Aim the barcode inside the frame" })}
        </Text>
      )}
      {live && (
        <Pressable
          onPress={() => setTorch((on) => !on)}
          accessibilityRole="switch"
          accessibilityState={{ checked: torch }}
          accessibilityLabel={t({ th: "ไฟฉาย", en: "Torch" })}
          style={[styles.torch, torch && styles.torchOn]}
        >
          <LineIcon
            d={TORCH_ICON}
            color={torch ? "#000000" : "#FFFFFF"}
            size={16}
            strokeWidth={2}
          />
        </Pressable>
      )}
    </View>
  );
}

const CORNER = 26;
const styles = StyleSheet.create({
  box: {
    borderRadius: RADIUS.card,
    overflow: "hidden",
    backgroundColor: "#1C1E21",
    marginTop: SPACE.m,
  },
  off: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACE.m,
    paddingHorizontal: SPACE.xl,
  },
  offText: { ...TYPE.subhead, color: "rgba(255,255,255,0.85)", textAlign: "center" },
  allow: {
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
  },
  allowText: { ...TYPE.subhead, color: "#FFFFFF", fontWeight: "600" },
  frame: { position: "absolute", alignSelf: "center" },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: "#FFFFFF" },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 6 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 6 },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6,
  },
  hint: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 18,
    textAlign: "center",
    ...TYPE.subhead,
    color: "rgba(255,255,255,0.9)",
  },
  torch: {
    position: "absolute",
    top: SPACE.m,
    right: SPACE.m,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  torchOn: { backgroundColor: "#FFFFFF" },
});
