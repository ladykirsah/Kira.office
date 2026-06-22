import { round2 } from "./money";

export type CostMethod = "moving_average" | "latest" | "manual" | "fifo";

export interface CostLayer {
  remainingQty: number;
  unitCost: number;
  /** Sort key; higher = more recent. */
  receivedAt: number;
}

export interface FifoResult {
  totalCost: number;
  unitCost: number;
  /** Layers after consumption (zero-quantity layers removed). Input is not mutated. */
  remaining: CostLayer[];
}

export interface ResolveCostInput {
  method: CostMethod;
  layers?: CostLayer[];
  manualCost?: number;
  /** Units being sold (FIFO); defaults to 1. */
  qty?: number;
}

export function movingAverageUnitCost(layers: CostLayer[]): number {
  const totalQty = layers.reduce((sum, layer) => sum + layer.remainingQty, 0);
  if (totalQty <= 0) return 0;
  const totalCost = layers.reduce((sum, layer) => sum + layer.remainingQty * layer.unitCost, 0);
  return round2(totalCost / totalQty);
}

export function latestUnitCost(layers: CostLayer[]): number {
  if (layers.length === 0) return 0;
  const latest = layers.reduce((a, b) => (b.receivedAt >= a.receivedAt ? b : a));
  return latest.unitCost;
}

export function fifoConsume(layers: CostLayer[], qty: number): FifoResult {
  if (qty < 0) throw new Error("fifo qty must be non-negative");
  const working = layers.map((layer) => ({ ...layer })).sort((a, b) => a.receivedAt - b.receivedAt);

  if (qty === 0) {
    return {
      totalCost: 0,
      unitCost: 0,
      remaining: working.filter((layer) => layer.remainingQty > 0),
    };
  }

  let toConsume = qty;
  let totalCost = 0;
  for (const layer of working) {
    if (toConsume <= 0) break;
    const take = Math.min(layer.remainingQty, toConsume);
    totalCost += take * layer.unitCost;
    layer.remainingQty -= take;
    toConsume -= take;
  }

  if (toConsume > 0) {
    throw new Error("insufficient cost layers for fifo consumption");
  }

  return {
    totalCost: round2(totalCost),
    unitCost: round2(totalCost / qty),
    remaining: working.filter((layer) => layer.remainingQty > 0),
  };
}

/** Append a received cost layer (purchase receipt). Pure — returns a new array, input untouched. */
export function receiveStock(layers: CostLayer[], received: CostLayer): CostLayer[] {
  return [...layers, received];
}

/** Resolve a representative unit cost for the shop's chosen cost method. */
export function resolveUnitCost(input: ResolveCostInput): number {
  const { method, layers = [], manualCost, qty = 1 } = input;
  switch (method) {
    case "manual":
      if (manualCost === undefined) {
        throw new Error("manualCost is required for the manual cost method");
      }
      return manualCost;
    case "latest":
      return latestUnitCost(layers);
    case "moving_average":
      return movingAverageUnitCost(layers);
    case "fifo":
      return fifoConsume(layers, qty).unitCost;
  }
  throw new Error(`unknown cost method: ${String(method)}`);
}
