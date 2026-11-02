---
name: kira-owner-loop
description: How the Kira.office owner works and decides. Read it first on every request in this repo. It maps the owner's short words to the ONE step they asked for (draw on the canvas, apply to preview, ship it, pause), and covers how they pick between designs, what to check before building, and how to reply. Use it when the owner sends a short instruction ("show me…", "go for C with some changes", "apply to preview", "ship it", "Yes, finish it", "drop it", "stop"), a screenshot, or a canvas selection, or whenever you are unsure what is approved.
---

# Working with the Kira.office owner

The owner is non-technical and judges by the screen: the design canvas and the preview. Every bad round so far came from a step done out of order, or from building something they didn't ask for.

## The loop: do only the step they named

```
draw on canvas → apply to preview → their approval → file lessons → commit → PR → CI
  → prod migration (if any) → merge → deploys green → page ✅ on canvas → next page
```

| They say | It means | Use |
|---|---|---|
| "show me …", "draw …", "how about make it like this" + a screenshot, "show me 5 designs" | Draw on the canvas only. Nothing in the repo changes. | `kira-canvas-design` |
| "go for C", "go for B with products as C", "go for C with some changes: …" | They picked that option. Apply each listed change to it. The pick replaces the other options on the board. | `kira-canvas-design` |
| "apply to preview", "build it" | Build it in `apps/mobile` (tests first) and show it on the preview. No commit. | `kira-preview-build` |
| "approved, ship it", "ship it", "Yes, finish it" | The whole ship flow, in one turn, to live. | `kira-ship` |
| "Yes, apply it" (to your question about the live database) | The prod database change, and only that. | `kira-prod-migration` |
| "drop it", "the current one is good" | Keep what exists. Change nothing. | — |
| "Yes, remove them" | Remove exactly the thing just discussed, nothing further. | — |
| "stop", "wait", "pause", or a rejected tool call | Stop at once. Say exactly what ran and what didn't, then wait. | — |
| "sorry X = 1st section" | They are correcting their own last instruction. Redo the step with it. | — |
| "lock this", "file it" | Make it a standing rule: put it in the rulebook and in memory. | — |

- An approval counts wherever it sits in the message ("lock this and go").
- Never make them repeat an approval word just to satisfy a check.

## How they decide

- **They decide the business; you decide the process.** Never ask them about process.
- **Options:**
  - Give 3 that really differ, labelled A/B/C, recommend one, and draw all three on the canvas.
  - When they select one part of a design, each option changes *that* part.
- **Picks come with edits.** They pick one and list changes, or merge parts ("A for clear graph and colouring, B is the big %").
  - Apply only those changes.
  - Keep every function the old design had.
- **A screenshot from another app** (Apple Settings, Shopify) means "make ours look like this".
  - Keep its layout.
  - Map their words onto it ("Family can be my team member").
- **"Did you forget X?"** usually means they can't find it.
  - Answer yes or no first, then point to where it is.
  - Offer to move it as an option, and change nothing until they answer.
- **A short answer that reads two ways:** ask a yes/no question back instead of guessing.
- **Settled decisions** live in `docs/DECISIONS.md` and the rulebook. Never re-argue them.

## Before building anything

- **Draw only what the system has.**
  - Check `packages/db/migrations`, `apps/api/src/index.ts` and `apps/mobile/src/lib` for the field.
  - If it's missing, say so first and tag it **ระบบยังไม่มี** on the drawing.
  - Never build a smaller stand-in and explain it afterwards.
- **Scope spill.** If the work touches something they didn't ask for (another page, a shared part, a schema change), stop and say:
  1. what it touches,
  2. what happens to it,
  3. the options.

  Then wait for their answer.
- **Change only what they selected.** Everything else stays exactly as it was.

## Replying

- Plain words and short bullets. Gloss any technical term once.
- **Never paste** code, test output, diffs, file lists or commit messages. Run the checks; don't narrate them.
- Say what changed on screen and what is still open. If something is half-done (for example 1 of 6 database changes applied), say so exactly.
- At most one question, in the next-step box, with buttons that answer it.
- Never offer to merge or deploy unasked. Never commit before they approve.

## Read before acting

- `docs/knowledge/conventions/expo-page-design-rules.md`: every design rule they set. Read it before drawing and again before building.
- `docs/knowledge/conventions/owner-communication-and-scope.md` and `owner-session-workflow.md`.
- `~/.claude/CLAUDE.md` §0.5: their locked loop, scope-spill rule, and evidence rules.
- The memory index (`MEMORY.md` in the project memory folder): live status and open items.
