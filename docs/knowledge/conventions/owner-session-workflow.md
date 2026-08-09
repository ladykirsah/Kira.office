---
type: convention
title: Owner session workflow and approval gates
description: The mandatory brief→ask→plan→action→approve-result→commit→PR→merge loop, the ask>plan>action one-pass override, batched commits, and deploy rules
tags: [workflow, owner, approvals, git, deploy]
timestamp: 2026-08-09
status: convention
sources: [kira-session-workflow.md, plan-before-action.md, owner-ask-plan-action-is-one-pass.md, kira-batched-commit-flow.md, airplus-deploy-on-request-only.md, onsite-pos-customer-roadmap.md]
---

# Owner session workflow and approval gates

How every working session with the owner runs. These rules were each set by the owner after a specific failure — treat them as binding.

## The mandatory loop (set 27 Jul 2026)

For EVERY session: **brief → ask → plan → action → approve-RESULT → commit → PR → merge.**

- Lead with a short **brief** (where things stand).
- **ASK** clarifying questions before planning.
- Present a short **plan** but do **not** wait for plan approval — owner: "I only approve the result."
- Do the action; get approval of the **RESULT** (the only gate); then commit → PR → merge.
- Reproduce what the owner gives faithfully; don't impose designs/optimizations; minimal scratch files.
- Scope: the owner works by selecting a DOM element in the preview and describing the change — change ONLY that element unless they state a general rule; when applying a general rule, say out loud which extra things it touched so they can veto (full detail: [owner-communication-and-scope](owner-communication-and-scope.md)).

## Plan-before-action (default mode, set 2026-07-26)

For any fix/change when no other flow is invoked: lead with a concise plan (root cause + the change + files + reversibility + how it'll be verified), **pause for the OK, THEN edit**. Keep it short — the owner wants to be informed and steer, not read essays. Deploys and other outward-facing/irreversible steps always need explicit confirmation regardless. Option lists use letters A/B/C, never numbers ([owner-communication-and-scope](owner-communication-and-scope.md)).

## "ask > plan > action" = ONE pass (override, set 2026-08-04)

When the owner writes "ask me anything > plan > action" (or "ask > plan > fix"), that is one instruction covering the whole turn: (1) ask clarifying questions, (2) state the plan, (3) **build it in the SAME turn**. Do NOT end the turn with "OK to build?" — owner verbatim: "i said ask me > plan > action, please finish the flow, without asking me" (after being stopped for approval three times in one session). The questions ARE the approval gate; once answered, the plan is a statement of what is about to happen, not a request.

Still true inside an ask>plan>action turn: genuinely irreversible/outward-facing steps (prod migrations, deploys) need an explicit yes. And plan-before-action still applies whenever the owner has NOT invoked this flow.

## Batched commit flow (set 2 Aug 2026)

Owner's rhythm, set after a session was over-fragmented into 3 PRs with repeated "want to merge?" prompts:

- Keep ALL of a session's work on **ONE branch**; commit locally as needed; push/PR/merge **ONCE** when the batch is done.
- Never keep asking whether to merge — when the owner says "merge as you want", just do it.
- **CRITICAL: never switch to a branch off origin/main mid-session** — it reverts the working tree and the running local preview snaps back to the old UX/UI, losing in-progress work from the preview.
- Per-change PRs feel like being rushed and break the owner's flow.

Related git mechanics (squash merges, stacked PRs, worktrees): [git-and-worktree-traps](git-and-worktree-traps.md).

## Deploy rules

- **Never auto-deploy after changes.** Owner said explicitly 2026-07-11 (after several per-change storefront redeploys): they control deploy timing (review/batch changes, avoid churn). Workflow: implement → verify locally (dev server + lint/tsc/tests) → report "ready to deploy when you say". Run a deploy ONLY on an explicit "deploy" / "push it".
- "Never deploy" means never deploy **UNPROMPTED** — the owner may delegate the whole sequence. On 30 Jul they said "you do it for me please" and it was run end-to-end. When delegated, **VERIFY prod afterwards** (health signals) rather than assuming.
- Deploy paths/mechanics themselves: [operations](../operations/index.md).

## Autonomy grant — and its boundary

The owner's ops habit is "do them all yourself": full autonomy including merges and prod migrations was granted 2026-07-05 (twice). Later rules narrowed the deploy part to on-request-only (above). Read the two together: engineering process decisions, merges, and migrations inside an agreed batch are yours; **deploy timing is the owner's** unless they explicitly hand it over in that session.
