---
name: kira-prod-migration
description: Apply a Kira.office D1 migration (packages/db/migrations/NNNN_*.sql) to the live database safely, before the PR merges. Use when shipping work whose PR adds a migration, or when the owner says "Yes, apply it" about the live database. Covers asking the owner by name first, the wrangler path, the Cloudflare D1 console path through the owner's Chrome when wrangler's login has expired, restore points, one statement at a time, recording the migration, verifying, and what to say if interrupted.
---

# Applying a database change to live

**When:** the CI never runs migrations, and new code that reads new columns gives a 500 until they exist. So always apply them **before** the merge.

**Background:** `docs/knowledge/operations/d1-migration-discipline.md` and `prod-d1-access.md`. The live database is `kira-office` on the GoGoCash account; its id is in `wrangler.jsonc` and in those docs.

## 0 · Ask by name first

- **Ask first, by name, even after "ship it".** The app's safety check blocked a prod write on "ship it" alone (2 Nov 2026). Ask one plain question in the next-step box: *"May I add the new coupon columns to the live database now?"*
- **Wait for a clear yes** ("Yes, apply it").
- **Explain the change in one line:** additive (new columns or table) versus anything that changes or deletes data. Anything that is not additive needs a stop and a full explanation.

## 1 · Way A: wrangler (when its login works)

```
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler d1 migrations list kira-office --remote   # read-only
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 npx wrangler d1 migrations apply kira-office --remote
```

If it says to set `CLOUDFLARE_API_TOKEN`, the login has expired. Never try to sign in for the owner; use way B.

## 2 · Way B: the D1 console in the owner's Chrome

1. **Open the console** with the Claude-in-Chrome tools (load them all in one ToolSearch). Open a new tab at `dash.cloudflare.com/187ab61ed9dbc6e616cb23e6b95aa8f1/workers/d1/databases/<database id>/console`. The owner is already signed in there.
2. **Make a restore point:** run `/bookmark`, and keep the `/restore <id>` line for the report.
3. **Read what's applied:** `SELECT name FROM d1_migrations ORDER BY id DESC LIMIT 3`. The new file must not already be there.
4. **Run the statements one at a time:**
   - Take only the statements from the file (`grep -vE "^\s*--|^\s*$"`).
   - Join each onto one line, type it, press Enter, and wait about 2 s.
   - Check each one says "successfully executed" before typing the next.
5. **Record it:** `INSERT INTO d1_migrations (name) VALUES ('<NNNN_file>.sql')`. Without this, a later `wrangler migrations apply` would run it again.
6. **Verify with one read-only query.** Check the last migration name, a count of the new columns via `pragma_table_info('<table>')`, any new table via `sqlite_master`, and the table's row count.
7. **Close the tab** you opened.

## 3 · If the owner stops you halfway

- Stop at once.
- Say exactly how many statements ran (for example "1 of 6"), and whether anything is typed in the box but not run.
- Say whether the half-done state is harmless. Added columns are; old code ignores them.
- Leave the PR unmerged until the rest is applied. When they say to go on, start from the next unrun statement and check the box first.

## 4 · Report

- In plain words: done, what was added, the live row count, and that a restore point exists.
- Put the restore point id in the memory status line, not in the reply.
