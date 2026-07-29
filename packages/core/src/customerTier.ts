export type CustomerTier = "best" | "good" | "watch" | "bad" | "block";

export type CodApproval = "auto" | "staff" | "blocked";

export interface CreditEvent {
  type: "complete" | "incomplete" | "product_return";
}

export interface LoyaltyStats {
  completedOrdersInWindow: number;
  totalSpentSatangInWindow: number;
}

export interface BadRecoveryInput {
  badLockedUntil: number;
  prepaidCompletionsSinceLock: number;
  now: number;
}

export interface EffectiveTierInput {
  credit: number;
  earn: LoyaltyStats | null;
  hold: LoyaltyStats | null;
  incompletesThisMonth: number;
  adminBlocked: boolean;
  badRecovery?: BadRecoveryInput;
}

const GOOD_THRESHOLD = -2;
const WATCH_THRESHOLD = -4;
const VELOCITY_BLOCK_THRESHOLD = 5;
const BEST_EARN_ORDERS = 10;
const BEST_EARN_SATANG = 15_000_00;
const BEST_HOLD_ORDERS = 3;
const BEST_HOLD_SATANG = 5_000_00;
const BAD_RECOVERY_PREPAID_REQUIRED = 2;

export function creditScoreFromEvents(events: CreditEvent[]): number {
  let score = 0;
  for (const e of events) {
    if (e.type === "complete") score += 1;
    else if (e.type === "incomplete") score -= 1;
  }
  return score;
}

export function tierFromCredit(credit: number): "good" | "watch" | "bad" {
  if (credit >= GOOD_THRESHOLD) return "good";
  if (credit >= WATCH_THRESHOLD) return "watch";
  return "bad";
}

export function isVelocityBlock(incompletesInMonth: number): boolean {
  return incompletesInMonth >= VELOCITY_BLOCK_THRESHOLD;
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

export function codApproval(tier: CustomerTier): CodApproval {
  if (tier === "best" || tier === "good") return "auto";
  if (tier === "watch") return "staff";
  return "blocked";
}

export function isBadRecovered(input: BadRecoveryInput): boolean {
  if (input.now < input.badLockedUntil) return false;
  return input.prepaidCompletionsSinceLock >= BAD_RECOVERY_PREPAID_REQUIRED;
}

export function computeEffectiveTier(input: EffectiveTierInput): CustomerTier {
  if (input.adminBlocked) return "block";
  if (isVelocityBlock(input.incompletesThisMonth)) return "block";

  const creditTier = tierFromCredit(input.credit);

  if (creditTier === "bad") {
    if (input.badRecovery && isBadRecovered(input.badRecovery)) return "good";
    return "bad";
  }

  if (creditTier === "good") {
    const earned = input.earn !== null && meetsBestEarn(input.earn);
    const held = input.hold !== null && meetsBestHold(input.hold);
    if (earned && held) return "best";
  }

  return creditTier;
}
