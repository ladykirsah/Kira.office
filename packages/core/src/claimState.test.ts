import { describe, it, expect } from "vitest";
import {
  CLAIM_STATES,
  CLAIM_ACTORS,
  claimStateLabel,
  claimStateLabelTh,
  isClaimState,
  isTerminalClaimState,
  canTransition,
  nextClaimStates,
  actorFor,
  orderStatusForClaim,
  type ClaimState,
} from "./claimState";

/**
 * The owner's claim flow (30 Jul 2026):
 *
 *   customer clicks claim → admin contacts them → admin approves to continue
 *   → customer sends the product back → mechanic investigates → mechanic approves
 *   → create the claim product delivery
 *
 * TWO gates, and they are not the same kind of decision. The admin gate is approve/cancel — some
 * cases simply close after a conversation, and nothing was ever shipped. The mechanic gate is a
 * technical verdict on goods we are physically holding, so a rejection there leaves us owing the
 * customer their product back. Encoding the transitions stops a claim jumping a gate: nothing should
 * be able to reach a replacement delivery without a mechanic having passed it.
 */
describe("CLAIM_STATES", () => {
  it("covers the owner's flow in order, with both terminal negatives", () => {
    expect([...CLAIM_STATES]).toEqual([
      "requested",
      "approved",
      "received",
      "mechanic_approved",
      "shipped",
      "done",
      "cancelled",
      "mechanic_rejected",
    ]);
  });

  it("labels every state in English and Thai", () => {
    for (const s of CLAIM_STATES) {
      expect(claimStateLabel(s).length).toBeGreaterThan(0);
      expect(claimStateLabelTh(s).length).toBeGreaterThan(0);
    }
  });

  it("names the admin gate cancel, not reject — it closes after a conversation", () => {
    expect(claimStateLabel("cancelled")).toBe("Cancelled");
    expect(claimStateLabel("mechanic_rejected")).toBe("Rejected by mechanic");
  });
});

describe("isClaimState", () => {
  it("accepts every listed state", () => {
    for (const s of CLAIM_STATES) expect(isClaimState(s)).toBe(true);
  });

  it("rejects an invented state", () => {
    expect(isClaimState("approved_maybe")).toBe(false);
    expect(isClaimState("")).toBe(false);
  });
});

describe("canTransition > the happy path", () => {
  it("walks the owner's flow end to end", () => {
    const path: ClaimState[] = [
      "requested",
      "approved",
      "received",
      "mechanic_approved",
      "shipped",
      "done",
    ];
    for (let i = 0; i < path.length - 1; i++) {
      expect(canTransition(path[i]!, path[i + 1]!)).toBe(true);
    }
  });
});

describe("canTransition > the gates hold", () => {
  it("a fresh claim cannot skip the admin gate to await inspection", () => {
    expect(canTransition("requested", "received")).toBe(false);
  });

  it("a claim cannot reach a replacement delivery without the mechanic passing it", () => {
    expect(canTransition("received", "shipped")).toBe(false);
    expect(canTransition("approved", "shipped")).toBe(false);
    expect(canTransition("requested", "shipped")).toBe(false);
  });

  it("the mechanic cannot rule on goods that never arrived", () => {
    expect(canTransition("requested", "mechanic_approved")).toBe(false);
    expect(canTransition("approved", "mechanic_approved")).toBe(false);
    expect(canTransition("requested", "mechanic_rejected")).toBe(false);
    expect(canTransition("approved", "mechanic_rejected")).toBe(false);
  });

  it("only an inspected claim can be rejected by the mechanic", () => {
    expect(canTransition("received", "mechanic_rejected")).toBe(true);
  });
});

describe("canTransition > cancelling", () => {
  it("the admin can cancel a claim before anything is shipped", () => {
    expect(canTransition("requested", "cancelled")).toBe(true);
    expect(canTransition("approved", "cancelled")).toBe(true);
  });

  it("cannot cancel once we are holding the customer's goods", () => {
    // The product is in our hands: it has to be inspected and then resolved or returned. Silently
    // cancelling would leave the customer with neither their product nor their money.
    expect(canTransition("received", "cancelled")).toBe(false);
    expect(canTransition("mechanic_approved", "cancelled")).toBe(false);
  });
});

describe("canTransition > terminal states are final", () => {
  it("nothing leaves a terminal state", () => {
    for (const t of ["done", "cancelled", "mechanic_rejected"] as ClaimState[]) {
      expect(isTerminalClaimState(t)).toBe(true);
      expect(nextClaimStates(t)).toEqual([]);
      for (const s of CLAIM_STATES) expect(canTransition(t, s)).toBe(false);
    }
  });

  it("mid-flight states are not terminal", () => {
    for (const s of [
      "requested",
      "approved",
      "received",
      "mechanic_approved",
      "shipped",
    ] as ClaimState[]) {
      expect(isTerminalClaimState(s)).toBe(false);
    }
  });

  it("never allows a state to transition to itself", () => {
    for (const s of CLAIM_STATES) expect(canTransition(s, s)).toBe(false);
  });
});

describe("actorFor > who is allowed to make each move", () => {
  it("the admin gate belongs to the admin", () => {
    expect(actorFor("requested", "approved")).toBe("admin");
    expect(actorFor("requested", "cancelled")).toBe("admin");
    expect(actorFor("approved", "cancelled")).toBe("admin");
  });

  it("logging the parcel's arrival is the admin's job", () => {
    expect(actorFor("approved", "received")).toBe("admin");
  });

  it("both verdicts on the goods belong to the mechanic", () => {
    expect(actorFor("received", "mechanic_approved")).toBe("mechanic");
    expect(actorFor("received", "mechanic_rejected")).toBe("mechanic");
  });

  it("shipping the replacement is the admin's job, not the mechanic's", () => {
    expect(actorFor("mechanic_approved", "shipped")).toBe("admin");
    expect(actorFor("shipped", "done")).toBe("admin");
  });

  it("returns null for a move that is not allowed at all", () => {
    expect(actorFor("requested", "shipped")).toBeNull();
  });

  it("every allowed move has exactly one responsible actor", () => {
    for (const from of CLAIM_STATES) {
      for (const to of nextClaimStates(from)) {
        const a = actorFor(from, to);
        expect(a).not.toBeNull();
        expect(CLAIM_ACTORS).toContain(a!);
      }
    }
  });
});

describe("orderStatusForClaim > what the order's Status column shows", () => {
  it("an open claim reads claim_pending at every mid-flight stage", () => {
    for (const s of ["requested", "approved", "received"] as ClaimState[]) {
      expect(orderStatusForClaim(s, "exchange")).toBe("claim_pending");
    }
  });

  it("an approved claim being exchanged reads claimed", () => {
    expect(orderStatusForClaim("mechanic_approved", "exchange")).toBe("claimed");
    expect(orderStatusForClaim("shipped", "exchange")).toBe("claimed");
    expect(orderStatusForClaim("done", "exchange")).toBe("claimed");
  });

  it("an approved claim resolved with money reads claimed too — payment_status carries the refund", () => {
    // operationalStatus turns claimed + payment 'refunded' into Refund, so the resolution lives on
    // the money axis rather than being duplicated here.
    expect(orderStatusForClaim("done", "refund")).toBe("claimed");
  });

  it("a mechanic rejection reads claim_rejected", () => {
    expect(orderStatusForClaim("mechanic_rejected", null)).toBe("claim_rejected");
  });

  it("an admin-cancelled claim returns the order to whatever it was — null", () => {
    // Nothing was shipped and no verdict was reached, so the order is still just delivered. The claim
    // record keeps the history; the order should not wear a scar for a conversation.
    expect(orderStatusForClaim("cancelled", null)).toBeNull();
  });
});
