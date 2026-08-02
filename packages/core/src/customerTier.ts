export type CustomerTier = "best" | "good" | "watch" | "bad" | "block";

export type CodApproval = "auto" | "staff" | "blocked";

export interface CreditEvent {
  type: "complete" | "incomplete" | "product_return";
}

export interface LoyaltyStats {
  completedOrdersInWindow: number;
  totalSpentSatangInWindow: number;
}

export interface EffectiveTierInput {
  /** TOTAL credit — the order credit plus loyalty, already combined by the caller. */
  credit: number;
  /** Manual block set by an admin (tier_override = 'block'), overrides everything. */
  adminBlocked: boolean;
}

const BEST_EARN_ORDERS = 10;
const BEST_EARN_SATANG = 15_000_00;
const BEST_HOLD_ORDERS = 3;
const BEST_HOLD_SATANG = 5_000_00;

/** Completed orders needed to repay one −1 mistake (the owner's "one mistake requests 2 completes"). */
const COMPLETES_PER_REPAY = 2;

/**
 * The order half of a customer's credit — a DEMERIT counter, capped at 0.
 *
 * Walk the customer's orders OLDEST FIRST (the array MUST be chronological). Each incomplete is a −1
 * debt. While in debt, every 2 completed orders repay +1. A completed order is worth nothing on its
 * own — it never pushes credit above 0, and it never pre-absorbs a LATER mistake (recovery is earned
 * forward, not banked from past history). product_return never moves credit.
 *
 * Returns a value ≤ 0. Loyalty (the only way above 0) is added by the caller.
 */
export function creditScoreFromEvents(events: CreditEvent[]): number {
  let credit = 0;
  let repayProgress = 0; // completed orders banked toward the next +1, ONLY while in debt
  for (const e of events) {
    if (e.type === "incomplete") {
      credit -= 1;
    } else if (e.type === "complete" && credit < 0) {
      repayProgress += 1;
      if (repayProgress >= COMPLETES_PER_REPAY) {
        credit += 1;
        repayProgress -= COMPLETES_PER_REPAY;
      }
    }
    // No debt means no repayment in progress: a complete at 0 is capped away and banks nothing,
    // so past completes can never soften a future mistake.
    if (credit >= 0) repayProgress = 0;
  }
  return credit;
}

export function meetsBestEarn(stats: LoyaltyStats): boolean {
  return (
    stats.completedOrdersInWindow >= BEST_EARN_ORDERS ||
    stats.totalSpentSatangInWindow >= BEST_EARN_SATANG
  );
}

export function meetsBestHold(stats: LoyaltyStats): boolean {
  return (
    stats.completedOrdersInWindow >= BEST_HOLD_ORDERS ||
    stats.totalSpentSatangInWindow >= BEST_HOLD_SATANG
  );
}

/**
 * Loyalty credit: +1 for each of the two criteria met (earn, hold), so a customer who reaches both
 * earns +2. This is the ONLY way credit goes above 0, and it buffers mistakes — a loyal customer at
 * +2 who then has one incomplete nets +1.
 */
export function loyaltyCredit(earn: LoyaltyStats | null, hold: LoyaltyStats | null): number {
  let n = 0;
  if (earn && meetsBestEarn(earn)) n += 1;
  if (hold && meetsBestHold(hold)) n += 1;
  return n;
}

/**
 * The tier is a pure function of total credit, so the number always matches the badge:
 *   ≥ 1 best · 0 good · −1..−2 watch · −3..−5 bad · ≤ −6 block.
 */
export function tierFromCredit(credit: number): CustomerTier {
  if (credit >= 1) return "best";
  if (credit === 0) return "good";
  if (credit >= -2) return "watch";
  if (credit >= -5) return "bad";
  return "block";
}

export function codApproval(tier: CustomerTier): CodApproval {
  if (tier === "best" || tier === "good") return "auto";
  if (tier === "watch") return "staff";
  return "blocked";
}

/** Tier from the combined credit, with a manual admin block as the only override. */
export function computeEffectiveTier(input: EffectiveTierInput): CustomerTier {
  if (input.adminBlocked) return "block";
  return tierFromCredit(input.credit);
}
