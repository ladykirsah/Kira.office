/**
 * Offline-sync idempotency core (used by the stock-ledger Durable Object and the /sync endpoint).
 *
 * A sale created offline carries a client-generated `clientUuid`. On sync, a sale must be applied
 * at most once — even if the device retries, or the same batch contains a duplicate. This splits an
 * incoming batch into the ones to apply versus the ones to skip, given what has already been applied.
 */
export interface HasClientUuid {
  clientUuid: string;
}

/** A batch split into first-seen items vs. ones to skip (already-applied or in-batch repeats). */
export interface Partition<T> {
  /** First-seen items, safe to apply/import. */
  fresh: T[];
  /** Already applied (server-side) or repeated within this batch — must be skipped. */
  duplicates: T[];
}

/** @deprecated alias of {@link Partition}. */
export type SalePartition<T> = Partition<T>;

/**
 * Partition `incoming` into fresh vs duplicate by `clientUuid`, treating both server-side
 * already-applied ids and earlier occurrences in the same batch as duplicates. Order is preserved.
 */
export function partitionByClientUuid<T extends HasClientUuid>(
  alreadyApplied: Iterable<string>,
  incoming: T[],
): Partition<T> {
  const seen = new Set(alreadyApplied);
  const fresh: T[] = [];
  const duplicates: T[] = [];
  for (const item of incoming) {
    if (seen.has(item.clientUuid)) {
      duplicates.push(item);
    } else {
      seen.add(item.clientUuid);
      fresh.push(item);
    }
  }
  return { fresh, duplicates };
}
