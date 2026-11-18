import * as SecureStore from "expo-secure-store";
import { PREF, movePrefs } from "@/lib/prefNames";

/** Small preferences (language, theme) and, on a phone, the session token — in the Keychain/Keystore. */
export async function readPref(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writePref(key: string, value: string | null): Promise<void> {
  try {
    if (value === null) await SecureStore.deleteItemAsync(key);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    // A preference that cannot be saved is only forgotten next launch; never block the screen on it.
  }
}

export const readToken = () => readPref(PREF.staff);
export const writeToken = (token: string | null) => writePref(PREF.staff, token);

/** Moves values saved under the old kira_ names to their teampit_ names; run once, before any read. */
export const migratePrefs = () =>
  movePrefs({
    get: (k) => SecureStore.getItemAsync(k),
    set: (k, v) => SecureStore.setItemAsync(k, v),
    remove: (k) => SecureStore.deleteItemAsync(k),
  });
