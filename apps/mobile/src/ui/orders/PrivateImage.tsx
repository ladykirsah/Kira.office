import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, Text, View, type ImageStyle } from "react-native";
import { API_BASE } from "@/lib/config";
import { privateFile } from "@/lib/ordersApi";
import { useAuth, useLang, useTheme } from "../AppProviders";
import { TYPE } from "../theme";

/** A blob as a data URI — FileReader works on the web and in the app alike. */
function asDataUri(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

interface PrivateImageProps {
  fileKey: string;
  label: string;
  style: ImageStyle;
  onPress?: () => void;
  /** "contain" shows the whole picture (a slip on its own page); thumbnails fill their box. */
  fit?: "cover" | "contain";
}

/**
 * A slip or claim photo. These sit behind the session (an image tag cannot send it), so the file is
 * fetched with it first. A refusal shows as words, never as an empty frame that looks broken.
 */
export function PrivateImage({ fileKey, label, style, onPress, fit = "cover" }: PrivateImageProps) {
  const auth = useAuth();
  const { theme } = useTheme();
  const { t } = useLang();
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const token = auth.status === "signed-in" ? auth.token : null;

  useEffect(() => {
    if (!token) return;
    let live = true;
    setUri(null);
    setFailed(false);
    privateFile(fetch, API_BASE, token, fileKey)
      .then(asDataUri)
      .then((u) => live && setUri(u))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [fileKey, token]);

  const box = [
    style,
    { backgroundColor: theme.hover, alignItems: "center", justifyContent: "center" },
  ] as never;
  if (failed) {
    return (
      <View style={box}>
        <Text style={{ ...TYPE.footnote, color: theme.textMuted, textAlign: "center" }}>
          {t({ th: "เปิดรูปไม่ได้", en: "Could not open" })}
        </Text>
      </View>
    );
  }
  if (!uri) {
    return (
      <View style={box}>
        <ActivityIndicator color={theme.textMuted} />
      </View>
    );
  }
  const image = (
    <Image source={{ uri }} style={style} accessibilityLabel={label} resizeMode={fit} />
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="imagebutton" accessibilityLabel={label}>
      {image}
    </Pressable>
  ) : (
    image
  );
}
