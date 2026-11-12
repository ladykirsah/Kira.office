import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProviders, useTheme } from "@/ui/AppProviders";
import { usePageColour } from "@/ui/pageScroll";
import { ScreenSafeArea } from "@/ui/ScreenSafeArea";

function ThemedStatusBar() {
  const { isDark, theme } = useTheme();
  usePageColour(theme.bg);
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <ScreenSafeArea>
      <AppProviders>
        <ThemedStatusBar />
        <Slot />
      </AppProviders>
    </ScreenSafeArea>
  );
}
