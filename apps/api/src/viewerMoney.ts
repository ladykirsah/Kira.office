/**
 * What a viewer who may not see margin is sent instead of cost and profit (core `canSeeProfit`: a
 * ช่าง, owner 24 Aug 2026). Margin is price minus cost, so the COST is what gets withheld — the same
 * rule GET /products has applied since then, now on every read that carried it (owner, 12 Nov 2026:
 * "follow the old version function"). Cost goes to 0, as the product list sends it; a profit that
 * would give the answer away goes to null, which every screen already shows as "—".
 */

interface Costed {
  itemCostSatang: number;
}

const zeroCost = <P extends Costed>(p: P | null): P | null => (p ? { ...p, itemCostSatang: 0 } : p);

/** GET /products/:id — the product's own pricing and each size's. */
export function withoutProductCost<
  T extends { pricing?: Costed | null; choices?: { pricing: Costed | null }[] },
>(detail: T): T {
  return {
    ...detail,
    ...(detail.pricing !== undefined ? { pricing: zeroCost(detail.pricing) } : {}),
    ...(detail.choices
      ? { choices: detail.choices.map((c) => ({ ...c, pricing: zeroCost(c.pricing) })) }
      : {}),
  };
}

/** A bill or a draft from ทำบิล: every line's cost. */
export function withoutLineCost<T extends { lines: { unitCostSatang?: number | null }[] }>(
  bill: T,
): T {
  return { ...bill, lines: bill.lines.map((l) => ({ ...l, unitCostSatang: 0 })) };
}

/** GET /orders: each order's profit. */
export function withoutOrderProfit<T extends { profitSatang: number | null }>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r, profitSatang: null }));
}

/** GET /orders/:id: the order's profit, its money summary and every line's cost. */
export function withoutOrderDetailCost<
  T extends {
    order: { profitSatang: number | null };
    money: { itemCostSatang: number; profitSatang: number | null };
    lines: { unitCostSatang: number }[];
  },
>(detail: T): T {
  return {
    ...detail,
    order: { ...detail.order, profitSatang: null },
    money: { ...detail.money, itemCostSatang: 0, profitSatang: null },
    lines: detail.lines.map((l) => ({ ...l, unitCostSatang: 0 })),
  };
}

/** GET /sales for anyone but the owner: only the bill numbers Scan needs to number the next bill. */
export function saleNumbersOnly(sales: { saleNumber?: string | null }[]): {
  saleNumber: string | null;
}[] {
  return sales.map(({ saleNumber }) => ({ saleNumber: saleNumber ?? null }));
}
