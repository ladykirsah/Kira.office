/**
 * The claim workflow, per the owner (30 Jul 2026):
 *
 *   customer clicks claim → admin contacts them → admin approves to continue
 *   → customer sends the product back → mechanic investigates → mechanic approves
 *   → create the claim product delivery
 *
 * TWO gates, and they are different kinds of decision. The admin gate is approve/**cancel** — some
 * cases simply close after a conversation and nothing is ever shipped. The mechanic gate is a
 * technical verdict on goods we are physically holding, so a rejection there leaves us owing the
 * customer their product back.
 *
 * The transitions are data rather than scattered `if`s so the gates cannot be jumped: nothing can
 * reach a replacement delivery without a mechanic having passed it, and nothing can be quietly
 * cancelled once the customer's product is in our hands.
 */
export type ClaimState =
  /** Customer pressed claim on AirPlus. Waiting on the admin to make contact. */
  | "requested"
  /** Admin approved continuing. Waiting on the customer's parcel to arrive. */
  | "approved"
  /** Their product is here. Waiting on the mechanic. */
  | "received"
  /** Mechanic passed it. Owed a replacement or a refund. */
  | "mechanic_approved"
  /** Replacement handed to the carrier. */
  | "shipped"
  /** Finished. */
  | "done"
  /** Closed by the admin after a conversation — nothing was shipped either way. */
  | "cancelled"
  /** Mechanic found no fault. We are holding their goods and must send them back. */
  | "mechanic_rejected";

export const CLAIM_STATES: readonly ClaimState[] = [
  "requested",
  "approved",
  "received",
  "mechanic_approved",
  "shipped",
  "done",
  "cancelled",
  "mechanic_rejected",
];

/** Who is permitted to move a claim. `mechanic` is deliberately not `admin`. */
export type ClaimActor = "admin" | "mechanic";
export const CLAIM_ACTORS: readonly ClaimActor[] = ["admin", "mechanic"];

const EN: Record<ClaimState, string> = {
  requested: "Requested",
  approved: "Approved — awaiting return",
  received: "Received — awaiting mechanic",
  mechanic_approved: "Approved by mechanic",
  shipped: "Replacement shipped",
  done: "Done",
  cancelled: "Cancelled",
  mechanic_rejected: "Rejected by mechanic",
};

const TH: Record<ClaimState, string> = {
  requested: "แจ้งเคลม",
  approved: "อนุมัติให้ส่งคืน",
  received: "ได้รับสินค้าคืน",
  mechanic_approved: "ช่างอนุมัติ",
  shipped: "จัดส่งสินค้าเคลม",
  done: "เสร็จสิ้น",
  cancelled: "ยกเลิกการเคลม",
  mechanic_rejected: "ช่างปฏิเสธการเคลม",
};

export function claimStateLabel(s: ClaimState): string {
  return EN[s];
}

export function claimStateLabelTh(s: ClaimState): string {
  return TH[s];
}

const STATE_SET = new Set<string>(CLAIM_STATES);

export function isClaimState(v: string): v is ClaimState {
  return STATE_SET.has(v);
}

/**
 * Every legal move, and whose job it is.
 *
 * Note what is absent: no path from `requested` or `approved` to any mechanic verdict (they cannot
 * rule on goods that have not arrived), no path to `shipped` that bypasses `mechanic_approved`, and
 * no `cancelled` once the state is `received` — at that point we hold the customer's product and owe
 * them either a resolution or their goods back.
 */
const TRANSITIONS: Record<ClaimState, Partial<Record<ClaimState, ClaimActor>>> = {
  // No pre-approve/close gate: the customer ships the item back the moment they file, and the admin's
  // first action is confirming it arrived (→ received). There is no admin-cancel of a fresh claim —
  // the only rejection is the mechanic's verdict, at received. `approved` is kept in the machine only
  // so any legacy claim already sitting in it can still move forward; new claims never enter it.
  requested: { received: "admin" },
  approved: { received: "admin", cancelled: "admin" },
  received: { mechanic_approved: "mechanic", mechanic_rejected: "mechanic" },
  // Two resolutions, chosen by the customer at claim time: a refund closes the claim directly (money
  // back, nothing shipped), a replacement ships first (→ shipped → done).
  mechanic_approved: { done: "admin", shipped: "admin" },
  shipped: { done: "admin" },
  done: {},
  cancelled: {},
  mechanic_rejected: {},
};

export function isTerminalClaimState(s: ClaimState): boolean {
  return Object.keys(TRANSITIONS[s]).length === 0;
}

export function nextClaimStates(s: ClaimState): ClaimState[] {
  return Object.keys(TRANSITIONS[s]) as ClaimState[];
}

export function canTransition(from: ClaimState, to: ClaimState): boolean {
  return TRANSITIONS[from][to] !== undefined;
}

/** Who may make this move, or null when the move is not allowed at all. */
export function actorFor(from: ClaimState, to: ClaimState): ClaimActor | null {
  return TRANSITIONS[from][to] ?? null;
}

/** How a claim resolves once the mechanic has passed it. */
export type ClaimResolution = "exchange" | "refund";

/**
 * What the ORDER's status column should read while this claim is live, or null when the claim should
 * leave no mark on the order at all.
 *
 * The order stays coarse on purpose — `claim_pending` covers every stage before a verdict, and the
 * fine-grained stage lives on the claim record. An admin-cancelled claim returns null: nothing was
 * shipped and no verdict was reached, so the order is still simply delivered and should not wear a
 * scar for a conversation. The refund-vs-exchange distinction is carried by payment_status, which
 * operationalStatus already turns into Refund, so it is not duplicated here.
 */
export function orderStatusForClaim(
  s: ClaimState,
  _resolution: ClaimResolution | null,
): "claim_pending" | "claimed" | "claim_rejected" | null {
  switch (s) {
    case "requested":
    case "approved":
    case "received":
      return "claim_pending";
    case "mechanic_approved":
    case "shipped":
    case "done":
      return "claimed";
    case "mechanic_rejected":
      return "claim_rejected";
    case "cancelled":
      return null;
  }
}
