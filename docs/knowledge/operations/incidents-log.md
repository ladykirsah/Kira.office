---
type: incident
title: Production incidents and lessons
description: Chronological log of every production incident and near-miss, each with its root cause and the standing rule it produced.
tags: [incidents, postmortem, lessons, cloudflare, r2, kv, secrets]
timestamp: 2026-08-09
status: historical
sources: [kira-office-architecture.md, kira-office-access-login-setup.md, next-public-env-inlined-at-build.md, kira-500s-root-cause-transient-r2.md, kira-bughunt-2026-07-26.md, kira-storefront-had-no-deploy-job.md]
---

# Production incidents and lessons

Newest standing rules live in the linked concept files; this log preserves the *why*.

## 2026-07-05 — Deploy jobs silently skipped for weeks

GH Actions deploy jobs were guarded `if token unset then echo skip; exit 0`; the `CLOUDFLARE_API_TOKEN` secret was unset, so every "deploy" skipped **yet passed green**. The API worker ran pre-PR#4 code for weeks while merges looked deployed; applying migrations correct for the NEW code then broke the STALE live code (dropped columns → 500s). Fix: set the secret, harden jobs to fail loudly. Rules produced: the loud-failure contract in [ci-pipeline](ci-pipeline.md); verify the live worker after any deploy ([deploy-runbook](deploy-runbook.md)); prod rollback net = D1 Time Travel (30 days).

## 2026-07-18 — Secret-handling near-misses

(a) The owner pasted a plaintext password for lady.kirsah@gmail.com into chat — it was NOT stored/echoed/used anywhere (the users table then had no password field); owner told to change it + enable 2FA. (b) Separately, an API token pasted at the shell prompt echoed as `command not found: cfut_…` and leaked into a screenshot → owner deleted/revoked it. Standing rules: reference secrets by NAME only, never in chat; for secret entry prefer `wrangler login` browser-OAuth, or `read -s` pasted only AFTER the prompt appears.

## 2026-07-19 era — Wildcard Worker Route shadowing + cross-account split

Post-deploy, `admin.homeseeker.me` served the **API worker's** page instead of the admin. Cause: the API worker had a dashboard-added wildcard Worker Route `*.homeseeker.me/*` (NOT in `wrangler.jsonc`) which shadowed `kiraoffice-admin`'s custom domain. Fix: add a specific route for the API host, then DELETE the wildcard. Lesson: when a hostname serves the wrong worker, check each worker's dashboard **Domains tab for wildcard routes** before blaming the custom domain. Same era: the admin worker originally sat on the wrong CF account (homeseeker `8724aa41…`) while api+storefront+zone were on GoGoCash (`187ab61ed9…`) — the split caused 1003 cross-account proxy failures; everything was consolidated onto GoGoCash. (Related wrangler trap — named envs INHERIT top-level routes — is a [platform](../platform/index.md) concern.)

## 2026-07-22 — localhost baked into the prod bundle (~16h broken images)

A deploy from a dev shell inlined `http://localhost:8788` into the storefront bundle; every image broken ~16h with all checks green. Full mechanism, incident detail, and the three guards now in place: [next-public-env-trap](next-public-env-trap.md).

## 2026-07 (ongoing until PR #48) — Intermittent 500s: transient R2/KV "(10001)" with no retry

~1 in 8 image requests returned 500 (measured 6/51). `wrangler tail` showed R2 `get` throwing "We encountered an internal error. Please try again. (10001)"; the throw hit the top-level boundary in `apps/api/src/index.ts` and became a 500.

**THE TRAP:** the boundary *catches*, so the Worker never throws — the Cloudflare dashboard **"Errors" metric counts UNCAUGHT exceptions** and read 0 across 520 invocations while customers saw broken images; 67 tail events all showed `outcome: ok`. NEVER conclude "the Worker is fine" from `Errors: 0` or `outcome: ok` — read the `logs` array (a caught error still `console.error`s); filtering tail on `outcome != 'ok'` is the wrong filter.

Why `/shop-info` was among the worst: it fans out `SHOP_TEXT_FIELDS.length + 2` concurrent `KV.get`s under `Promise.all` — one unlucky read rejects the whole page; fan-out multiplies exposure. Also: PR #45 (bare fetch in the admin proxy) was a real fix but NOT this root cause — don't re-credit it.

**The fix — `retryRead` (PR #48, commit 45ab525, `packages/core/src/retryRead.ts`):** 3 attempts, 50/150 ms backoff, only for transient-looking messages ('10001', 'internal error', 'please try again', connection lost/reset/timeout). Design invariants:
- **READS ONLY** — a failed-looking write may have applied; retrying could double-apply an order/payment/stock movement.
- **A `TypeError` from our own bug fails fast** — don't retry bugs.
- **`null` is an answer, not an error** — R2/KV null = "no such key" = 404; returned as-is, never retried.

Applied to all 5 storage reads (1× `IMAGES.get`, 4× `KV.get`). Verified after deploy: 102/102 images 200 (was 6 failures/51).

## 2026-07-26 — Whole-app bug hunt: 6 findings, all fixed same day

Adversarial 6-area hunt found 6 MEDIUM/LOW findings, no critical — all fixed and deployed to prod Jul 26 (#1/#2/#4/#6 in PR #74; #3/#5 in PR #75 with migration 0063). For pattern awareness: (1) refund path lacked a stage guard (`refundSaleToDb` could refund a draft/quote id → oversell + phantom financial_record); (2) `addBarcodeToProduct` bare INSERT missing `ON CONFLICT(barcode_value) DO NOTHING`; (3) POS quotation dropped the bill discount (`DraftInput` had no discount field); (4) coupon limits read-then-insert TOCTOU (flash-sale caps use guarded UPDATE, coupons didn't); (5) checkout confirm total < charged when a campaign lapses in-cart; (6) quotation counter never seeded on mount → UNIQUE collision with a misleading "offline?" toast.

**REJECTED findings — do NOT chase:** RBAC "defined but not enforced" (single-owner, Access-gated by design — since evolved, see [auth](../auth/index.md)); `requireAccess` fail-open (`ACCESS_*` set in prod); plate-normalization on `onsite_sales` (the proposed fix was wrong); `updateProduct` full-row null (moot after `saveFullProduct`). Core pricing/coupon/barcode math verified clean. Feature-level context lives in [commerce](../commerce/index.md) and [back-office](../back-office/index.md).

## 2026-08-04 — Storefront had no deploy job at all

Merging AirPlus Insight (#124) shipped the admin page + API but the storefront beacon (POST `/api/track` + page-view/product-view/add-to-cart hooks) stayed undeployed — the traffic half of Insight would have read zero forever, every check green, no error anywhere. Only a manual `npm run deploy -w @l-shopee/storefront` finished the release. Lesson (one level above "never trust a green deploy check"): **the check wasn't lying, it did not EXIST** — grep the workflow for a job per deployable app. Fix: PR #125 (squash 559b506) added `deploy-storefront` mirroring the other jobs (same account, same `CLOUDFLARE_API_TOKEN`, missing token fails loudly, only the custom-domain wart tolerated) plus the NEXT_PUBLIC runner guard. Verified end-to-end after merge: all four jobs green, new `airplus-storefront` version deployed by CI, live beacon POST classified and written to prod D1. Standing contract: [ci-pipeline](ci-pipeline.md).

## 2026-08 — Staff login 500s at PBKDF2 210k (fixed in PR #123)

Every prod staff login 500'd because Workers refuses PBKDF2 at 210k rounds; PR #123 (fc8434d) fixed the count at 100k. Logged here for the timeline; the auth design and its ceilings live in [auth](../auth/index.md).
