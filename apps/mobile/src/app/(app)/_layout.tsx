import { Redirect, Slot } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth, useTheme } from "@/ui/AppProviders";
import { PosSessionProvider } from "@/ui/pos/PosSessionProvider";
import { ScanSessionProvider } from "@/ui/scan/ScanSessionProvider";
import { Shell } from "@/ui/Shell";

/** Every screen behind sign-in. Nobody signed in → the sign-in screen; the API still checks each call. */
export default function SignedInLayout() {
  const auth = useAuth();
  const { theme } = useTheme();
  if (auth.status === "loading") {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.bg,
        }}
      >
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }
  if (auth.status === "signed-out") return <Redirect href="/sign-in" />;
  return (
    <ScanSessionProvider>
      <PosSessionProvider>
        <Shell>
          <Slot />
        </Shell>
      </PosSessionProvider>
    </ScanSessionProvider>
  );
}
