# GitHub

## ✅ Status: published

- Repo: **[`ladykirsah/Kira.office`](https://github.com/ladykirsah/Kira.office)** — **private**,
  default branch **`main`**, CI green.
- The npm workspace root is named `kira-office` (npm names can't contain uppercase or match
  `Kira.office`); only the GitHub repo uses `Kira.office`.

## How it was set up

The owner authenticated as `ladykirsah` (`gh auth login`), then:

```bash
gh repo create ladykirsah/Kira.office --private
git remote add origin https://github.com/ladykirsah/Kira.office.git
git push -u origin HEAD:main
```

> History note: the repo was first created as `l-shopee-backoffice` and renamed to `Kira.office`
> with `gh repo rename`. GitHub auto-redirects the old name, but the local remote URL was updated.

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
