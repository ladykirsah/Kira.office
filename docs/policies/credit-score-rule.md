# Credit Score Rule — AirPlus (internal design, staff-only)

**Status:** design/plan — not implemented. No schema for this exists yet (see "What needs to be built").
**Visibility:** the score/tier is **never shown to the customer** — staff-only, per your instruction. The customer only ever sees the *effect* (COD offered, needs approval, or not offered), consistent with what's already promised in the Privacy Notice.
**Last updated:** 16 July 2026

---

## 1. The five tiers

| Tier | Meaning | Customer-facing effect |
|---|---|---|
| **Star** | Excellent, proven track record | COD always allowed, no friction. (Reserved for future loyalty perks — not building that now, just leaving room for it.) |
| **Good** | Healthy standing — the default | COD always allowed |
| **Watch** | Some risk signal, not yet blocked | COD available, but **requires Super Admin manual approval** per order |
| **Bad** | Real risk signal | COD **not offered** — customer can still buy via prepayment (bank transfer/PromptPay/card) |
| **Block** | Severe/repeated risk signal | **Cannot place any order at all** — most severe tier |

Every new customer starts at **Good** (not Star — that's earned), matching your call to allow COD freely from the first order.

## 2. What moves a customer down (negative events)

Three event types, weighted by severity as you ranked them:

| Event | Definition | Severity | Demotion |
|---|---|---|---|
| **Cancelled after shipped** | Order cancelled while in transit (ToS §8 Case 2), paid by a non-COD method | Bad | −1 tier |
| **Refused COD** | Same event, but the order's payment method was COD — i.e., the customer backed out of paying at the door | Worse | −2 tiers |
| **Illegitimate claim** | A claim the mechanic rejects at 0% (Claim Policy §4) — i.e., not a real defect | Worst | −2 tiers on the first one; a **second** one sends the customer straight to **Block** |

**Important distinction:** a claim the mechanic *approves* (100% or partial) is a legitimate defect and must **never** count against the score — only claims the mechanic actually rejects count here. Penalizing genuine defect claims would punish customers for something that was your product's fault, not theirs.

## 3. Path back up (recovery)

- A tier demotion isn't permanent by default: **3 consecutive clean, completed orders** (no cancellations, no rejected claims) while below Good promotes the customer back up one tier.
- **5 consecutive clean orders** from Good promotes to Star.
- **Block does not auto-recover.** Given it means "cannot order at all," lifting it requires a Super Admin to manually review and reinstate — too severe to leave to an automatic counter.

## 4. Manual override

Super Admin can move any customer to any tier at their own discretion at any time — this is the same authority already implied by Watch-tier's manual-COD-approval role. In practice, this is also how a customer's implicit "right to object" (already promised in the Privacy Notice) gets honored: since the customer never sees their tier, a dispute would surface as "why can't I use COD?" via your contact channels (LINE OA/phone/email), and Super Admin can look them up and decide — not a separate formal appeals process, just using the access you already have.

## 5. What needs to be built (this is a plan, not code)

None of this exists in the current schema. To implement it, you'd need, at minimum:
- An AirPlus customer/account table (doesn't exist yet — the only customer table today is the on-site, plate-keyed one for Den Air Service)
- A `tier` field per AirPlus customer (Star/Good/Watch/Bad/Block) + a history log of tier changes and why (for the Super Admin to review, and as your own audit trail)
- Order-outcome tracking: cancelled-after-shipped, and which payment method was used (to distinguish "Bad" from "Worse")
- A link from the Claim/Returns flow's mechanic decision (100%/partial/0%) into this scoring logic, so a 0% outcome actually triggers the "illegitimate claim" event
- The checkout flow itself needs to check the tier before offering COD as a payment option, and route Watch-tier orders into a manual-approval queue for Super Admin

This lives partly in this back-office/API repo (order outcomes, tier storage) and partly in the AirPlus storefront repo (checkout logic that reads the tier and decides whether to show COD) — which isn't part of this codebase.

## 6. Open questions / my assumptions flagged for your review

- **Recovery counts (3 clean orders to go up one tier, 5 to reach Star) are my proposed defaults**, not something you specified — reasonable starting points, but you have no real data yet to calibrate against, so expect to adjust after you see actual behavior.
- **Demotion amounts (−1 / −2 / −2-then-Block) are also my proposal**, built directly from your severity ranking (bad < worse < worst) but the exact tier-count jumps are a judgment call — flag if you want a stricter or gentler ladder.
- Does the second "illegitimate claim → Block" escalation need a time window (e.g., two within 12 months), or does it apply no matter how far apart the two claims are?
