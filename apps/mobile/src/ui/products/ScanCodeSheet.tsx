import { StyleSheet, View } from "react-native";
import { useLang } from "../AppProviders";
import { Sheet } from "../orders/Sheet";
import { CameraBox } from "../scan/CameraBox";

/** สแกน at รหัสสินค้า: the shop's code camera; what it reads goes into the field. */
export function ScanCodeSheet({
  onClose,
  onCode,
}: {
  onClose: () => void;
  onCode: (code: string) => void;
}) {
  const { t } = useLang();
  return (
    <Sheet title={t({ th: "สแกนรหัสสินค้า", en: "Scan a product code" })} onClose={onClose}>
      <View style={styles.camera}>
        <CameraBox height={300} showHint={false} onCode={onCode} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  camera: { borderRadius: 16, overflow: "hidden" },
});
