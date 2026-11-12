/**
 * The safe-area provider (clock, notch, home bar). The app uses the library's own; the website reads
 * the edges from the screen instead (ScreenSafeArea.web.tsx), because its phone page scrolls whole.
 */
export { SafeAreaProvider as ScreenSafeArea } from "react-native-safe-area-context";
