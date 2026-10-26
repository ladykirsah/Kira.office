import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders, useTheme } from "@/ui/AppProviders";

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppProviders>
        <ThemedStatusBar />
        <Slot />
      </AppProviders>
    </SafeAreaProvider>
  );
}
