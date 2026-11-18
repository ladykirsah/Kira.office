# GitHub

## ✅ Status: published

- Repo: **[`ladykirsah/TeamPit`](https://github.com/ladykirsah/TeamPit)** — **public** (owner's choice, 18 Nov 2026),
  default branch **`main`**, CI green.
- The npm workspace root is named `kira-office` (npm names can't contain uppercase or match
  `TeamPit`); only the GitHub repo uses `TeamPit`.

## Public on purpose

The owner kept the repo **public** when it was renamed to TeamPit (18 Nov 2026, pick *B*).
Anyone can read the code and the docs, so secrets, tokens, customer data and exported records
never go in it (`.gitignore`, `scripts/check-hidden-code.mjs` and the pre-push checks below guard
this). Changing the visibility is the owner's call only.

## How it was set up

The owner authenticated as `ladykirsah` (`gh auth login`), then (the first set-up; the name and
visibility have changed since):

```bash
gh repo create ladykirsah/TeamPit --private
git remote add origin https://github.com/ladykirsah/TeamPit.git
git push -u origin HEAD:main
```

> History note: the repo was first created as `l-shopee-backoffice`, renamed once, and renamed to
> `TeamPit` on 18 Nov 2026 (plan 9.2: TeamPit everywhere). GitHub forwards the old addresses; the
> local remote URL was updated. When `gh` says "Bad credentials", the owner signs in again with
> `gh auth refresh -h github.com -s workflow` (code at github.com/login/device, as `ladykirsah`).
> Run it with no keyboard (`< /dev/null`) so it waits without a key press, and open the page in the
> owner's Chrome. That Chrome also holds `janPhat` — pick `ladykirsah`. The code is 8 characters
> (`XXXX-XXXX`), not the 6-digit code from the owner's phone; show it in big text.

## Pushing future changes

```bash
git push                      # current branch tracks origin/main
# or open a PR from a feature branch:
git push -u origin <branch> && gh pr create --base main
```

## Pre-push checklist

- No `.env`, `.dev.vars`, or real `wrangler.jsonc` ids/secrets committed (`.gitignore` covers them).
- Docs reflect current decisions ([DECISIONS.md](DECISIONS.md) is the source of truth).
- Tests / lint / typecheck green (`npm test && npm run lint && npm run typecheck`).
- Confirm the active `gh` account before pushing (`gh api user --jq .login`).
