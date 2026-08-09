---
type: convention
title: Owner communication, scope discipline, and working channels
description: Don't overwhelm the owner; selected elements ARE the scope; letters for options; screenshots over dev servers; mockups to Artifacts only; where the owner's NLP copy frameworks live
tags: [workflow, owner, communication, scope, artifacts, screenshots]
timestamp: 2026-08-09
status: convention
sources: [dont-overwhelm-the-owner.md, owner-selected-elements-scope.md, ask-options-use-letters-not-numbers.md, low-credit-working-mode.md, airplus-preview-workflow.md, nlp-knowledge-location.md]
---

# Owner communication, scope discipline, and working channels

The owner is a small-business operator (car A/C shop), not an engineer. Every rule here came from an incident where the assistant's default behaviour cost them time, money, or trust.

## Don't overwhelm the owner (incident 2026-07-16)

The owner asked what to build; the response was a 1.36M-token audit, an 18k-line PR review, ~11 open questions, and git-surgery choices for THEM to arbitrate. Owner: "i think i am kinda lost right now… all i want is only work on Kira.office work flow and features… then test with mock info. then, connect system with Shopee and AirPlus."

Rules that came out of it:

1. Their build order is fixed — see [owner-sequencing-rules](owner-sequencing-rules.md). Channel/storefront defects are step-3 problems; don't raise them at step 1 unless blocking.
2. **Decide-then-report on engineering process** (branching, scoping, sequencing) — ask the owner only about the BUSINESS.
3. One feature at a time, shown working the same day.
4. A finding they can't act on today is noise — put it in memory/knowledge, not chat.

## Selected elements = the whole scope (incident 2026-07-27)

On a barcode-page mock the owner selected 7 controls and said "wrong size"; the assistant fixed the sizes AND restructured the card, product chip, radii and spacing. Owner: "you did not work based on my brief again, so what the points of selected items? reverse action" — full revert required.

Rules:

- Selected elements = the complete work list; **everything else stays byte-identical**.
- If the fix is ambiguous (smaller? bigger? inconsistent?) ASK with A/B/C options before touching anything.
- If something else genuinely needs fixing, note it in one line at the end and let the owner decide — never bundle it in.
- "reverse action" = restore the previous state exactly (keep the prior file content, re-render, confirm byte-identical), then ask.

## Options use letters, never numbers (set 2026-07-17)

The plan being executed is numbered 1, 2, 3…, so numbering ad-hoc choices made "option 2" vs "plan step 2" ambiguous. Apply:

- Numbers = the plan only ("step 5" always means the plan's step 5).
- Letters = everything else, including AskUserQuestion option sets and inline prose choices; sub-options go A1/A2 or a/b/c, never plain numbers.
- Keep the plan's own numbering **stable** — don't renumber steps because one is done or dropped, or the shared reference breaks.

## Screenshots are the input channel; low-credit mode (set 2026-07-22)

Dev servers/watchers/browser verification once burned credit the owner wanted for real problems. So:

- The owner sends a **screenshot** (often with an element selection) — do NOT spin up admin/API/storefront dev servers to "go and look"; read the screenshot + the source and answer.
- Start a local stack only when the owner asks or a fix genuinely cannot be made without running it — and say why first.
- **Below ~20% credit**: fewer tool calls, no optional verification passes, no background monitors, no contact sheets or preview artifacts unless asked, short replies (findings and decisions, not the reasoning trail). Stop background tasks and preview servers as soon as they stop being needed, without being asked twice.
- Rationale (owner's framing): the expensive habits mostly serve the assistant's confidence, not the owner's outcome.

## Design mockups go to Artifacts ONLY

Never write `_preview-*.html` into `apps/storefront/public/` or serve mockups on the localhost:3002 dev server — it "messes with AirPlus on the preview window". The owner arranges panes horizontally: [preview = live AirPlus] | [artifacts = mockup], to compare options against the actual store. Every design preview → an Artifact (scratchpad file + Artifact tool; **republish the same file path to keep one URL**; a new path only for a genuinely new topic). After finishing a mockup, navigate the preview window back to the relevant real AirPlus page.

## Owner's NLP copywriting frameworks (live outside this repo)

The owner is an NLP Trainer; their NLP writing engine was built in the 10x project. For AirPlus FAQs / storefront copy, read these paths directly:

- `/Users/admin/Developer/10x/memory/nlp_knowledge_base.md` — core frameworks: Milton Model, presuppositions, K→A→V ordering, pacing/leading, outcome-first framing + applied GoGoCash moves
- `/Users/admin/Developer/10x/memory/user_nlp_background.md` — owner's NLP background
- `/Users/admin/Developer/10x/skills/gogocash-caption-writer/SKILL.md` — caption-writer skill in the GoGoCash voice; **ADAPT the tone for AirPlus, don't copy the fintech-bestie voice**
- Source manual: `/Users/admin/Desktop/Drop Anything/Life Lab Academy/Master/NLP TLT Hypno Master Prac_Manual TH.pdf`

The `~/.claude/skills/gogocash-caption-writer` symlink was fixed Jul 19 2026 to point at the 10x copy, but has been observed broken again since — reading the 10x paths directly is the reliable route.
