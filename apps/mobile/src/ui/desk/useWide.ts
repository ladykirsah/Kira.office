import { useWindowDimensions } from "react-native";
import { PHONE_MAX_WIDTH } from "../theme";

/** True on a computer-size window: the sidebar layout (computer guide C · Mercury, 4 Nov 2026). */
export function useWide(): boolean {
  return useWindowDimensions().width > PHONE_MAX_WIDTH;
}
