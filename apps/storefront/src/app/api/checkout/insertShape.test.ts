import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Structural guard on the one statement that creates every AirPlus order.
 *
 * The checkout route has no behavioural test in this repo — it needs D1, KV, a session and a live
 * rate card — so this does not pretend to exercise it. What it does cover is the failure mode that
 * statement actually has: it is a POSITIONAL insert of twenty-odd columns whose binds are a flat
 * argument list, and every money field is an integer. Swap two of them and nothing type-checks
 * differently, nothing throws, and orders quietly persist the shipping fee as the grand total.
 *
 * Same technique as the BACKUP_TABLES drift guard in apps/api: read the source, assert its shape.
 */

const routeSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "route.ts"), "utf8");

/** Split a comma-separated SQL list, ignoring commas nested inside parens. */
function splitTopLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function orderInsert(): { columns: string[]; values: string[]; binds: string[] } {
  const start = routeSrc.indexOf("INSERT INTO sales_orders");
  expect(start).toBeGreaterThan(-1);

  const colOpen = routeSrc.indexOf("(", start);
  const colClose = routeSrc.indexOf(")", colOpen);
  const columns = splitTopLevel(routeSrc.slice(colOpen + 1, colClose)).map((c) =>
    c.replace(/`/g, ""),
  );

  const valuesAt = routeSrc.indexOf("VALUES", colClose);
  const valOpen = routeSrc.indexOf("(", valuesAt);
  // The VALUES tuple contains no nested parens today; find its matching close.
  let depth = 0;
  let valClose = valOpen;
  for (let i = valOpen; i < routeSrc.length; i++) {
    if (routeSrc[i] === "(") depth++;
    if (routeSrc[i] === ")") {
      depth--;
      if (depth === 0) {
        valClose = i;
        break;
      }
    }
  }
  const values = splitTopLevel(routeSrc.slice(valOpen + 1, valClose));

  // The .bind(...) that immediately follows this prepare().
  const bindAt = routeSrc.indexOf(".bind(", valClose);
  let bDepth = 0;
  let bindClose = bindAt + 5;
  for (let i = bindAt + 5; i < routeSrc.length; i++) {
    if (routeSrc[i] === "(") bDepth++;
    if (routeSrc[i] === ")") {
      bDepth--;
      if (bDepth === 0) {
        bindClose = i;
        break;
      }
    }
  }
  const binds = splitTopLevel(routeSrc.slice(bindAt + 6, bindClose));

  return { columns, values, binds };
}

describe("checkout > the sales_orders INSERT", () => {
  it("names one value for every column", () => {
    const { columns, values } = orderInsert();
    expect(values).toHaveLength(columns.length);
  });

  it("binds one argument for every placeholder", () => {
    // Hardcoded literals in the VALUES tuple ('airplus', 'new', 0) take no bind, so the bind count
    // must match the QUESTION MARKS, not the column count.
    const { values, binds } = orderInsert();
    const placeholders = values.filter((v) => v === "?").length;
    expect(binds).toHaveLength(placeholders);
  });

  it("persists the auto-calculated shipping fee", () => {
    // It cannot be recovered later: sales_order_lines stores no weight and no dimensions, so the
    // Flash quote is unrecomputable once the request ends. If it is not written here it is lost.
    expect(orderInsert().columns).toContain("shipping_auto_satang");
  });

  it("still persists the fee actually charged, separately from the quote", () => {
    // The two are equal on a normal order and differ on a shared-fee one. Collapsing them would
    // destroy the quote-vs-real comparison the whole breakdown exists for.
    const { columns } = orderInsert();
    expect(columns).toContain("shipping_fee_satang");
    expect(columns).toContain("grand_total_satang");
  });

  it("binds each money column to the variable it is meant to hold", () => {
    // Counts alone would sail straight past a SWAP — `shipping` and `grand` are both integers, so
    // exchanging them type-checks, throws nothing, and silently bills every customer the wrong
    // total. The Nth placeholder takes the Nth bind argument, so the whole mapping is checkable.
    const { columns, values, binds } = orderInsert();
    const bound = new Map<string, string>();
    let n = 0;
    columns.forEach((col, i) => {
      if (values[i] === "?") bound.set(col, binds[n++]!);
    });

    expect(Object.fromEntries(bound)).toMatchObject({
      subtotal_satang: "subtotal",
      discount_total_satang: "discount",
      shipping_fee_satang: "shipping",
      shipping_auto_satang: "shipping",
      grand_total_satang: "grand",
      sales_satang: "subtotal",
      profit_satang: "profit",
    });
  });

  it("does not invent a real carrier charge at checkout", () => {
    // Nobody has been to the Flash counter yet. Writing 0 here would claim the parcel cost us
    // nothing and would show a fictional shipping gain on every new order.
    expect(orderInsert().columns).not.toContain("shipping_real_satang");
  });
});
