import { useWindowDimensions } from "react-native";
import { deskColumns } from "@/lib/frame";
import { PHONE_MAX_WIDTH } from "../theme";

/** True on a computer-size window: the sidebar layout (computer guide C · Mercury, 4 Nov 2026). */
export function useWide(): boolean {
  return useWindowDimensions().width > PHONE_MAX_WIDTH;
}

/** Two cards side by side, or one under the other on a mid-size window (lib/frame.ts deskColumns). */
export function useDeskColumns(): "one" | "two" {
  return deskColumns(useWindowDimensions().width);
}
