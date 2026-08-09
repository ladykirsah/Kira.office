---
type: guide
title: The two doors to prod D1
description: MCP connector and wrangler CLI fail independently — try BOTH before declaring prod unreadable.
tags: [d1, wrangler, mcp, cloudflare, access]
timestamp: 2026-08-09
status: live
sources: [cloudflare-d1-access-via-wrangler.md]
---

# The two doors to prod D1

## Why two doors

There are two independent read paths into production D1, and **they fail independently**. On 9 Aug 2026 the MCP connector — previously written off after a 401 on Jul 16/17 — was the ONLY one working while wrangler's OAuth had expired mid-session (`auth token has expired and could not be refreshed`); the session diagnosed blind for a while when one MCP call would have shown the row. Standing rule: **try BOTH doors before concluding prod data is unreadable.** A door that failed last month may work today.

## Door 1 — Cloudflare MCP connector

`d1_database_query` with `account_id` + `database_id`.

## Door 2 — wrangler CLI

Needs `CLOUDFLARE_ACCOUNT_ID` pinned, because the login sees **three** accounts and errors `More than one account available` non-interactively:

| account | id |
|---|---|
| GoGoCash (everything lives here) | `187ab61ed9dbc6e616cb23e6b95aa8f1` |
| homeseeker | `8724aa41ebe346f0cbd1c62126fe8942` |
| Lady.kirsah personal | `91fab55faac52bc576a7bdd681455cc9` |

Usage:

```
CLOUDFLARE_ACCOUNT_ID=187ab61ed9dbc6e616cb23e6b95aa8f1 \
  npx wrangler d1 migrations list kira-office --remote
# or:
  npx wrangler d1 execute kira-office --remote --json --command "SELECT …"
```

- **OAuth recovery:** `npx wrangler login` (interactive only) or a `CLOUDFLARE_API_TOKEN` env var. **CI is unaffected** by a local OAuth expiry — it uses the repo secret of that name.
- **`--json` output is noisy** (banner + JSON array): extract via regex `[\s*{.*}\s*]` + `json.loads()[0]['results']`, not grep.

## Database ids

| database | id |
|---|---|
| prod `kira-office` | `2e88a362-ffd7-4255-b178-e511d475f687` |
| staging `kira-office-staging` | `85f22f44-063d-424e-91ef-39e1fa1fef24` |

## Safety tiering

Reads are safe (R2). **Writes and `migrations apply --remote` are R1+ and owner-gated** — see [d1-migration-discipline](d1-migration-discipline.md) for the migration rules and [conventions](../conventions/index.md) for the R-tier working agreement.
