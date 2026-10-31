import type { Phrase } from "@l-shopee/shared/lang";

/**
 * The pick sheets behind แก้ไขสินค้า (part brand, car system, part name, car brand, model): what each
 * row is called and whether a typed "new" one is really new. No screen code here.
 */

export interface Named {
  id: string;
  /** The identity other tables join on; never shown when a display name exists. */
  name: string;
  nameTh: string | null;
  nameEn: string | null;
}

export function attrLabel(a: Named): Phrase {
  return { th: a.nameTh?.trim() || a.name, en: a.nameEn?.trim() || a.name };
}

/** A product carries its brand, system and part name by identity; this is what people read for it. */
export function nameLabel(list: readonly Named[], name: string | null): Phrase {
  if (!name) return { th: "—", en: "—" };
  const hit = list.find((a) => a.name === name);
  return hit ? attrLabel(hit) : { th: name, en: name };
}

const norm = (s: string | null) => (s ?? "").trim().toLowerCase();

/**
 * The row a typed new name already belongs to. Adding it again would not make a second one — the
 * server finds the old row and overwrites its names — so the sheet says it exists instead.
 */
export function nameTaken<T extends Named>(
  list: readonly T[],
  nameEn: string,
  nameTh: string,
): T | null {
  const en = norm(nameEn);
  const th = norm(nameTh);
  return (
    list.find(
      (a) =>
        (en !== "" && (norm(a.name) === en || norm(a.nameEn) === en)) ||
        (th !== "" && norm(a.nameTh) === th),
    ) ?? null
  );
}

/** The rows whose Thai or English name holds the search, in the shop's own order. */
export function pickList<T extends Named>(list: readonly T[], q: string): T[] {
  const typed = norm(q);
  return list.filter((a) => {
    const l = attrLabel(a);
    return !typed || norm(l.th).includes(typed) || norm(l.en).includes(typed);
  });
}
