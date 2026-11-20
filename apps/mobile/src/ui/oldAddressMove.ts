import { Platform } from "react-native";
import { OLD_HOST, newAddressFor } from "@/lib/oldAddress";

/**
 * On the website at the old address (admin.airplusauto.com), opens the same page on
 * teampit.formulal.cc when no bill waits in this browser (lib/oldAddress). Runs only when the app
 * opens, never mid-work, so a bill half made on screen is never lost; a phone still holding bills
 * sends them (after its PIN) and moves at its next open. True when the page is moving.
 */
export async function moveFromOldAddress(): Promise<boolean> {
  if (Platform.OS !== "web" || window.location.hostname !== OLD_HOST) return false;
  const to = await newAddressFor(window.location.href, async (key) =>
    window.localStorage.getItem(key),
  );
  if (to) window.location.replace(to);
  return to !== null;
}
