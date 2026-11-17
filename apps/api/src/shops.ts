import type { ShopProfile } from "@l-shopee/core";

/**
 * Each shop's own space (plan 10.3, owner 17 Nov 2026, pick A).
 *
 * TeamPit is sold to other car A/C shops, so every shop keeps its records apart. The way Cloudflare
 * builds this for its own database: one database per shop — separate boxes, not a label on every
 * row, so a forgotten label can never leak one shop's bills into another. The app's web address
 * says which shop a request is for (the browser's `Origin`); a sign-in only exists in its own
 * shop's database, so naming another shop's address gains nothing.
 *
 * Den Air is the shop that was always here: its database (`DB`), its settings keys, its stock
 * writer ("default" — the AirPlus website calls it by that name) and its two ข้อมูลร้าน cards stay
 * exactly where they are. Any other shop is listed in the `SHOPS` setting with its own database
 * binding, its settings under its own prefix, and one card: its counter. The card keeps the id
 * "denair" — that id means "the counter" in the code, every shop has one, and under its own prefix
 * it can't touch Den Air's.
 */
export interface Shop {
  id: string;
  name: string;
  /** The D1 binding that holds this shop's records. */
  db: string;
  /** The StockLedger object's name. */
  ledger: string;
  /** Settings keys and backups sit under this; Den Air's is empty. */
  prefix: string;
  /** The ข้อมูลร้าน cards: Den Air its counter + the AirPlus website; any other shop its counter. */
  profiles: readonly ShopProfile[];
  /** The app addresses that open this shop. */
  origins: readonly string[];
  /** This shop's owner(s) — the owner lock. Den Air's come from SUPER_ADMIN_EMAILS. */
  ownerEmails: string;
}

export const DEN_AIR: Shop = {
  id: "denair",
  name: "Den Air Service",
  db: "DB",
  ledger: "default",
  prefix: "",
  profiles: ["denair", "airplus"],
  origins: [],
  ownerEmails: "",
};

const SHOP_ID = /^[a-z0-9][a-z0-9-]{1,30}$/;
const DB_BINDING = /^DB_[A-Z0-9_]+$/;
const ORIGIN = /^(https:\/\/[a-z0-9.-]+|http:\/\/localhost:\d+)$/;

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Den Air, then every other shop in the `SHOPS` setting (a JSON list). A broken entry is left out
 * and logged — never guessed at — so a typo in the setting can't open one shop onto another, and
 * Den Air keeps working whatever the setting says.
 */
export function readShops(raw: string | undefined): Shop[] {
  const shops: Shop[] = [DEN_AIR];
  if (!raw?.trim()) return shops;
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    console.error("[shops] SHOPS is not JSON; only Den Air is open");
    return shops;
  }
  if (!Array.isArray(list)) return shops;
  for (const entry of list as Record<string, unknown>[]) {
    const id = text(entry?.id);
    const db = text(entry?.db);
    const origins = Array.isArray(entry?.origins) ? entry.origins.map(text) : [];
    const taken = shops.some(
      (s) => s.id === id || s.db === db || s.origins.some((o) => origins.includes(o)),
    );
    if (
      !SHOP_ID.test(id) ||
      !DB_BINDING.test(db) ||
      origins.length === 0 ||
      !origins.every((o) => ORIGIN.test(o)) ||
      taken
    ) {
      console.error(`[shops] left out a broken or clashing shop entry: ${id || "(no id)"}`);
      continue;
    }
    shops.push({
      id,
      name: text(entry.name) || id,
      db,
      ledger: `shop:${id}`,
      prefix: `shops/${id}/`,
      profiles: ["denair"],
      origins,
      ownerEmails: text(entry.ownerEmails),
    });
  }
  return shops;
}

/** The shop whose address the app is on; any other address, or none, is Den Air, as before. */
export function shopForOrigin(shops: readonly Shop[], origin: string | null): Shop {
  return (origin && shops.find((s) => s.origins.includes(origin))) || DEN_AIR;
}

/** The shop a StockLedger object works for, from the name it was opened with. */
export function shopForLedger(shops: readonly Shop[], name: string | undefined): Shop | null {
  return shops.find((s) => s.ledger === (name ?? DEN_AIR.ledger)) ?? null;
}

/** A settings store that only sees the keys under one shop's prefix. Den Air's is the store itself. */
export function prefixKv(kv: KVNamespace, prefix: string): KVNamespace {
  if (!prefix) return kv;
  const wrapped = {
    get: (key: string, opts?: unknown) => kv.get(prefix + key, opts as never),
    getWithMetadata: (key: string, opts?: unknown) =>
      kv.getWithMetadata(prefix + key, opts as never),
    put: (key: string, value: never, opts?: KVNamespacePutOptions) =>
      kv.put(prefix + key, value, opts),
    delete: (key: string) => kv.delete(prefix + key),
    list: async (opts: KVNamespaceListOptions = {}) => {
      const out = await kv.list({ ...opts, prefix: prefix + (opts.prefix ?? "") });
      return { ...out, keys: out.keys.map((k) => ({ ...k, name: k.name.slice(prefix.length) })) };
    },
  };
  return wrapped as unknown as KVNamespace;
}

interface ShopBindings {
  DB?: unknown;
  KV?: unknown;
  SUPER_ADMIN_EMAILS?: string;
}

/**
 * Everything a request touches, for one shop: its database in place of `DB`, its settings, its
 * owner. Null when the shop's database isn't connected to this Worker.
 */
export function shopEnv<E extends ShopBindings>(env: E, shop: Shop): (E & { SHOP: Shop }) | null {
  if (shop === DEN_AIR) return { ...env, SHOP: shop };
  const db = (env as Record<string, unknown>)[shop.db];
  if (!db) return null;
  return {
    ...env,
    DB: db,
    KV: env.KV ? prefixKv(env.KV as KVNamespace, shop.prefix) : env.KV,
    SUPER_ADMIN_EMAILS: shop.ownerEmails,
    SHOP: shop,
  };
}
