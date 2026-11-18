/**
 * The names the app keeps things under on a phone (secure store) or in a browser (localStorage).
 *
 * Plan 9.2 leftovers (owner, 18 Nov 2026: "Go"): they were kira_…, now teampit_…. `movePrefs` runs
 * once when the app opens, before any screen reads one, and moves each value across. It never loses
 * what it moves: the old value is removed only after the new name holds it, and a list of bills
 * waiting to be sent that exists under both names (an old tab still open) is merged, bill by bill.
 */
export const PREF = {
  lang: "teampit_lang",
  theme: "teampit_theme",
  staff: "teampit_staff",
  shopeeTicked: "teampit_shopee_ticked",
  scanTab: "teampit_scan_tab",
  posQueue: "teampit_pos_queue",
  posReceiver: "teampit_pos_receiver",
  posLastBill: "teampit_pos_last_bill",
  posLastQuote: "teampit_pos_last_quote",
  lastSaleNumber: "teampit_last_sale_number",
} as const;

const OLD_PREFIX = "kira_";
const NEW_PREFIX = "teampit_";

/** [old name, new name] for every saved value. */
export const PREF_RENAMES: ReadonlyArray<readonly [string, string]> = Object.values(PREF).map(
  (next) => [OLD_PREFIX + next.slice(NEW_PREFIX.length), next] as const,
);

export interface PrefStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** The waiting bills under both names, each bill once (by its clientUuid); the newer copy wins. */
function mergeQueues(older: string, newer: string): string {
  const parse = (raw: string): { sale?: { clientUuid?: unknown } }[] => {
    try {
      const data: unknown = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };
  const fresh = parse(newer);
  const seen = new Set(fresh.map((b) => b?.sale?.clientUuid));
  const onlyOld = parse(older).filter((b) => !seen.has(b?.sale?.clientUuid));
  return JSON.stringify([...onlyOld, ...fresh]);
}

async function moveOne(store: PrefStore, from: string, to: string): Promise<boolean> {
  const was = await store.get(from);
  if (was === null) return false;
  const now = await store.get(to);
  const want = now === null ? was : to === PREF.posQueue ? mergeQueues(was, now) : now;
  if (want !== now) await store.set(to, want);
  if ((await store.get(to)) !== want) return false; // not safely saved: keep the old value
  await store.remove(from);
  return true;
}

/** Moves every old-name value to its new name; returns the old names moved. Never throws. */
export async function movePrefs(store: PrefStore): Promise<string[]> {
  const moved: string[] = [];
  for (const [from, to] of PREF_RENAMES) {
    try {
      if (await moveOne(store, from, to)) moved.push(from);
    } catch {
      // A store that refuses (private mode, full disk): the old value stays and the move is retried
      // on the next open.
    }
  }
  return moved;
}
