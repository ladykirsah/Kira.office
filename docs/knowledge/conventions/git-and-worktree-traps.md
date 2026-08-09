---
type: trap
title: Git, worktree, and subagent traps
description: Squash-merge add/add recovery, stacked-PR auto-close, multi-session worktree hygiene, and the audit-subagent that mutated source and deleted tests
tags: [git, worktrees, squash-merge, subagents, traps]
timestamp: 2026-08-09
status: convention
sources: [squash-merge-branch-recovery.md, kira-dashboard-notifications-plan.md, airplus-returns-branch-parked.md, kira-subagent-mutated-my-files.md]
---

# Git, worktree, and subagent traps

Four hard-won lessons about version control in this repo. Each one silently destroys work if you don't know it.

## 1. This repo squash-merges PRs — old branches add/add-conflict with main

A long-lived branch that had a squash merge taken from it will **add/add-conflict with main on every shared file, even when content is identical**, because main's copies came from a different commit lineage. Hit 2026-07-30: `claude/financial-part-d4fa11` vs main after PR #86 → 10 conflicting files including `apps/api/src/index.ts` and `packages/core/src/index.ts`.

Do NOT hand-resolve (that's how work gets silently dropped) and avoid force-push / `-X ours`. The procedure that worked:

1. `git tag safety/pre-rebuild-<sha> HEAD` as cheap undo.
2. Find what main genuinely lacks with a **TWO-dot** diff: `git diff --name-only origin/main..HEAD`. Three dots compares against the merge base and misleadingly lists everything the squash already absorbed.
3. `git checkout -b <new-branch> origin/main`, then cherry-pick only the commits whose content is missing (they apply cleanly because their parent content is already in main).
4. **PROVE it**: `git diff <new-branch> <old-tip>` must be empty — identical trees means nothing was lost.
5. Re-run the full gate ([engineering-rules](engineering-rules.md)) before pushing.

Trigger heuristic: whenever `git merge-tree` reports CONFLICT (add/add) on files you didn't expect, suspect a squash merge and rebuild rather than resolve.

## 2. Deleting a stacked PR's base branch auto-CLOSES the stacked PR

PR #112 was stacked on #111's branch (base = `claude/dashboard-notifications`). When #111 merged and its branch was deleted, GitHub auto-CLOSED #112 — it does **not** retarget to main. Recovery = rebase the work onto main and open a fresh PR (#113 superseded #112). Avoid stacking PRs on branches that will be deleted at merge, or retarget before merging the base. (This also reinforces the owner's one-branch-per-session [batched commit flow](owner-session-workflow.md).)

## 3. Worktree hygiene: verify state and ownership before touching anything

- Twice, work in worktree `.claude/worktrees/airplus-car-parts-site-7ef223` sat on **NO branch and NO ref** while memories claimed it "built". **Check `git status` in every worktree (`git worktree list`) before assuming "built" means "in git".**
- On 2026-07-17 a `git stash -u` in that worktree swept up ANOTHER LIVE SESSION's in-flight edits (session `local_f2e58774` had `next dev` + workerd running there); the pop restored them by luck. **Never `git stash`/`reset`/`checkout` in a worktree you don't own; check `list_sessions` for `isRunning` first.**
- Tell-tale of a co-resident session: a test count jumping mid-session (733→738) was the other session's new test file appearing.
- Belt-and-braces backup of that worktree's original uncommitted state exists at scratchpad `pr20-worktree-uncommitted-backup.tgz`.

## 4. Subagents with write tools mutated source and DELETED tests

On Jul 30 2026 an adversarial-audit workflow (agents spawned with full tools) mutated the real working tree: changed the `listOrders` join to `c.name = o.buyer_username`, deleted the 4 join tests just written from `apps/api/src/index.test.ts` along with their imports, and left a 396K `apps/mutverify/` copy of the API behind. `git add` captured the mutated source; the missing tests only surfaced because the staged diffstat didn't list the test file.

Why it happens: audit agents with write tools edit files in place to test hypotheses and don't reliably restore them — and the suite still reports "all green" because removed tests simply stop existing.

Apply:

- Give audit/review agents **READ-ONLY tools**, or run them in `isolation: "worktree"`.
- After ANY agent run, **re-diff the working tree** and confirm your own edits are still there before staging.
- Keep a scratchpad copy of files you mutate for red/green proofs and diff back to it.
- Reconcile the test **COUNT**, not just the pass/fail line — a deleted test is a green suite.
