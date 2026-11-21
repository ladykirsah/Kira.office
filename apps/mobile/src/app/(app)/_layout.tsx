import { pageClosed } from "@l-shopee/shared/nav";
import { Redirect, Slot, useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { addressOf, movedAddress, signInAddress } from "@/lib/oldAddresses";
import { useAuth, useTheme } from "@/ui/AppProviders";
import { PosSessionProvider } from "@/ui/pos/PosSessionProvider";
import { ScanSessionProvider } from "@/ui/scan/ScanSessionProvider";
import { ShopReachProvider, useShopReach } from "@/ui/ShopReach";
import { Shell } from "@/ui/Shell";

/**
 * Every screen behind sign-in. Nobody signed in → the sign-in screen, which remembers the page
 * (plan 8.6); the API still checks each call. An old back-office address first jumps to its new page.
 */
export default function SignedInLayout() {
  const auth = useAuth();
  const { theme } = useTheme();
  const pathname = usePathname();
  const segments = useSegments();
  const params = useGlobalSearchParams();
  const moved = movedAddress(pathname, params);
  if (moved) return <Redirect href={moved as never} />;
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
  if (auth.status === "signed-out") {
    const here = addressOf(pathname, segments, params);
    return <Redirect href={signInAddress(here, auth.byChoice === true) as never} />;
  }
  return (
    <ShopReachProvider>
      <ScanSessionProvider>
        <PosSessionProvider>
          <GuardedShell role={auth.staff.role} path={pathname} />
        </PosSessionProvider>
      </ScanSessionProvider>
    </ShopReachProvider>
  );
}

/**
 * The frame and its page. An address the menu hides from this person, or an AirPlus page at a shop
 * without the website, shows a card saying whose page it is (plan 11.5). The API still checks every call.
 */
function GuardedShell(props: { role: Parameters<typeof pageClosed>[0]; path: string }) {
  const closed = pageClosed(props.role, props.path, useShopReach());
  return (
    <Shell closed={closed}>
      <Slot />
    </Shell>
  );
}
