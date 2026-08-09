---
type: guide
title: State
description: The current snapshot of the project — what is live, what is blocked, what is parked, what is broken. Read this first, and keep its timestamp honest.
tags: [state, snapshot, handoff]
timestamp: 2026-08-09
status: live
sources: [session 2026-08-09]
---

# State

The freshest layer of the bundle — and the fastest-rotting one. Every file here is a
snapshot **as of its `timestamp`**. When you change what is true, change the file and the
timestamp in the same commit.

| Concept | What it holds |
| --- | --- |
| [current.md](current.md) | What is deployed and working, right now |
| [blockers.md](blockers.md) | Things that stop revenue or stop merges — most need the owner, not code |
| [parked.md](parked.md) | Deliberately deferred work, with the reason and the resume condition |
| [known-bugs.md](known-bugs.md) | Verified live bugs and traps nobody has fixed yet |

Older snapshots the repo already carries: `docs/STATE_OF_THE_BUILD.md` is the 2026-07-19
baseline (start-here doc of its era), and `docs/NEXT_UP.md` is the maintained parking lot.
The [conventions docs-map](../conventions/index.md) says which of the old docs to trust.
