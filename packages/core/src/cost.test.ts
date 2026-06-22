import { describe, it, expect } from "vitest";
import {
  movingAverageUnitCost,
  latestUnitCost,
  fifoConsume,
  resolveUnitCost,
  type CostLayer,
} from "./cost";

const layers: CostLayer[] = [
  { remainingQty: 10, unitCost: 50, receivedAt: 1 },
  { remainingQty: 10, unitCost: 60, receivedAt: 2 },
];

describe("cost methods", () => {
  it("moving average > weighted mean 55", () => {
    expect(movingAverageUnitCost(layers)).toBe(55);
  });

  it("latest > most recent layer cost 60", () => {
    expect(latestUnitCost(layers)).toBe(60);
  });

  it("fifo consume 15 > total 800, unit 53.33, remaining 5@60", () => {
    const r = fifoConsume(layers, 15);
    expect(r.totalCost).toBe(800);
    expect(r.unitCost).toBe(53.33);
    expect(r.remaining).toEqual([{ remainingQty: 5, unitCost: 60, receivedAt: 2 }]);
  });

  it("fifo does not mutate the input layers", () => {
    fifoConsume(layers, 15);
    expect(layers[0]?.remainingQty).toBe(10);
  });

  it("resolve manual > returns the given cost", () => {
    expect(resolveUnitCost({ method: "manual", manualCost: 42 })).toBe(42);
  });

  it("resolve fifo qty 1 > oldest layer cost 50", () => {
    expect(resolveUnitCost({ method: "fifo", layers, qty: 1 })).toBe(50);
  });
});
