---
name: kira-ship
description: Ship approved Kira.office work all the way to live in one turn. The steps are lessons filed (memory + rulebook), simplify, a signed commit on a fresh branch, push, PR, any prod database change, merge, deploys green, health check, page ✅ on the canvas, then the next page. Use when the owner says "approved, ship it", "ship it", "Yes, finish it", or "approve > file lesson > commit > PR > CI pass > merge". Never use it before the owner has approved the preview.
---

# Shipping approved work

"Ship it" approves the whole flow, so finish it in the same turn. Never hand back while checks are still running (owner: *"all this should be done, since i told you to ship"*).

```
lessons → simplify → commit → push → PR → prod migration (if any) → merge → deploys green
  → health check → canvas ✅ → tell the next page
```

## 1 · File the lessons first (they ship in the same commit)

- **Collect** everything you got wrong and everything the owner corrected in this round.
  - If the context was summarised, read the owner's own words with `python3 .claude/skills/kira-ship/scripts/owner_messages.py <session.jsonl> <since>`.
- **Rulebook:** add bullets to `docs/knowledge/conventions/expo-page-design-rules.md` in the right section. Each bullet gets the owner's words in *italics*, the page and the date. Add the round to the `sources:` line.
- **Memory:** one fact per note, with **Why** and **How to apply**. Update a note that already covers it rather than adding a duplicate, and add one line to `MEMORY.md`.
- **Tell the owner** the lessons in a few plain bullets in the final reply.

## 2 · Simplify, commit, push

1. Run `/simplify` on the changed code (skip it for docs-only changes). Run `npx tsc --noEmit -p apps/mobile --noUnusedLocals` and clean up what it finds in the new files.
2. **Branch.** This repo squash-merges, so after a merge the old branch can't be reused.
   - If `git diff --quiet HEAD origin/main` passes, run `git switch -c claude/<topic> origin/main`; your uncommitted work comes along.
   - Otherwise rebuild the branch (memory: squash-merge-branch-recovery).
3. **Stage everything except `apps/admin/src/app/globals.css`:** `git add -A -- . ':!apps/admin/src/app/globals.css'`. Scan the staged diff for secrets.
4. **Make a signed commit** with the noreply address (no attribution lines):
   ```
   git -c user.name=ladykirsah -c user.email=283359991+ladykirsah@users.noreply.github.com \
     -c gpg.format=ssh -c user.signingkey=$HOME/.ssh/kira_signing_ed25519.pub -c commit.gpgsign=true \
     commit -q -F <message file>
   ```
   Check it is signed with `git cat-file -p HEAD | grep -c "BEGIN SSH SIGNATURE"` (the local "N" from `%G?` is normal).
5. **Push:** `git push -u origin claude/<topic>`.
   - The push guard (`~/.claude/hooks/gate-git-writes.py`) needs the owner's approval of a plain-prose `Plan:` line. Put that line in your **final message, before the owner's "go"**. Lines written mid-turn have been lost from the transcript.
   - If the guard wrongly blocks an approved flow, the owner's standing rule is to fix the guard test-first (`gate-git-writes.test.py`, keep a `.bak-<date>` copy). Never send them back for another approval word.
6. **Open the PR:** `gh pr create --repo ladykirsah/Kira.office --base main …`. The body has the sections *What ships · Database · Tests · Rollback*. Then bind the PR with `mcp__ccd_pr__get_status`.

## 3 · Database change before the merge

If the PR adds a migration, apply it to prod **before** merging. Use the `kira-prod-migration` skill, and ask for that step by name first.

## 4 · Merge, then watch the deploys

- **Checks still running:** `mcp__ccd_pr__set_auto_merge` (squash, with the PR `url`). Signed commits merge by themselves.
- **Checks already green** (auto-merge refuses a "clean" PR): `gh api -X PUT repos/ladykirsah/Kira.office/pulls/<n>/merge -f merge_method=squash`. Never `--admin`, never a force push.
- **Find the run:** `gh run list --repo ladykirsah/Kira.office --branch main --limit 3`. Pick the **CI** run (event `push`) for the merge sha.
- **Wait once:** `gh run watch <id> --repo ladykirsah/Kira.office --exit-status`. Run it in the foreground with timeout 600000, or in the background, but not both. Don't poll.
- **Expect** `build`, `deploy` (API), `deploy-admin` and `deploy-storefront` all to succeed. Merging to main deploys all three apps. The "Workers Builds" check always fails and can be ignored.
- **Health check:**
  - `curl https://api.airplusauto.com/health` returns 200.
  - Gated routes (for example `/coupons`, `https://airplusauto.com/api/account/coupons`) return **401**. A 404 means the deploy didn't land; a 500 means the schema doesn't match.

## 5 · Close the loop

- **Canvas** (`kira-canvas-design` step 10):
  - Mark the page "✅ … · done".
  - Change its "ยังไม่ได้สร้างในแอป" captions to "สร้างในแอปแล้ว (<date>)".
  - Set `launch.page` to the next page.
  - Re-read the live canvas.json before you publish.
- **Memory:** add one status line to `kira-expo-migration-goal.md` covering the PR, squash sha, run id, migration and restore point, canvas version, and NOW = the next page. Update its `MEMORY.md` line.
- **Final reply:** what is live, the lessons, and "next page: …".
