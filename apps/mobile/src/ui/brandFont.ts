import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { useFonts } from "expo-font";
import type { TextStyle } from "react-native";

/**
 * The app's name is lettered in Space Grotesk, the font of the turbo logo the owner picked
 * (2026-10-29). Only the name: every other word keeps the app's own font.
 *
 * Until the font has loaded the name shows in the normal font rather than not at all; and on a
 * phone, naming a font that has not loaded yet is an error, so the style is handed out only after.
 */
export function useBrandFont(): TextStyle | undefined {
  const [loaded] = useFonts({ SpaceGrotesk_600SemiBold });
  // "normal", not the 700 the name's style asks for: this file IS the 600 weight, and asking a
  // one-weight font for bold makes the browser smear a fake bold over it.
  return loaded ? { fontFamily: "SpaceGrotesk_600SemiBold", fontWeight: "normal" } : undefined;
}
