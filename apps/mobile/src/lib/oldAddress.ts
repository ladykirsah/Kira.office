import { PREF, PREF_RENAMES } from "./prefNames";

/**
 * Den Air's back office moved to teampit.formulal.cc (owner, 19 Nov 2026: pick B; 20 Nov: "no more
 * admin.airplusauto.com, only teampit.formulal.cc").
 *
 * A browser keeps saved data per address, so bills a phone made offline and has not sent yet sit
 * under the old address. The old address therefore still loads the app, but only until nothing waits:
 * then it opens the same page on the new address. A phone holding a bill sends it first (the app
 * resends waiting bills from any page once someone signs in), then moves.
 */
export const OLD_HOST = "admin.airplusauto.com";
const NEW_ADDRESS = "https://teampit.formulal.cc";

/** The waiting-bills list under its current name and its old kira_ name (not moved yet). */
const QUEUE_NAMES = PREF_RENAMES.filter(([, to]) => to === PREF.posQueue).flat();

/** Bills waiting under one name. Text that can't be read counts as waiting: never move when unsure. */
function waitingIn(raw: string | null): number {
  if (raw === null || raw === "") return 0;
  try {
    const data: unknown = JSON.parse(raw);
    return Array.isArray(data) ? data.length : 1;
  } catch {
    return 1;
  }
}

/**
 * The same page on the new address, when this page is on the old one and no bill waits on this
 * phone. Null otherwise — also when the saved bills can't be read: staying is safe, moving could
 * strand a bill.
 */
export async function newAddressFor(
  href: string,
  get: (key: string) => Promise<string | null>,
): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.hostname !== OLD_HOST) return null;
  try {
    for (const name of QUEUE_NAMES) {
      if (waitingIn(await get(name)) > 0) return null;
    }
  } catch {
    return null;
  }
  return NEW_ADDRESS + url.pathname + url.search + url.hash;
}
