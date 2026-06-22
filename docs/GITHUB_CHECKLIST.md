# GitHub Checklist

Target: **private** repository named **`l-shopee-backoffice`**, owner intended to be
**`ladykirsah`** (from the profile URL https://github.com/ladykirsah).

## ⛔ Blocker: account mismatch

The local GitHub CLI is authenticated as **`janPhat`** (only org membership: `mygogocash`).
`ladykirsah` is a **separate personal account**, so `janPhat` **cannot create or push** a repo
under `ladykirsah`. Resolve one of these before pushing:

- **Option A (recommended): log in as `ladykirsah`.** The owner runs `gh auth login` (or provides
  a Personal Access Token with `repo` scope for `ladykirsah`), then we push.
- **Option B: create under `mygogocash`** (the org `janPhat` can access) if that org is the
  owner's business and acceptable: `gh repo create mygogocash/l-shopee-backoffice --private`.
- **Option C: owner pre-creates the repo** at `ladykirsah/l-shopee-backoffice` (private) and adds
  `janPhat` as a collaborator with write access; then we add the remote and push.
- **Option D: push under `janPhat`** as a temporary home, transfer to `ladykirsah` later.

## Local Setup (already done in this folder)

```bash
git init            # already a git repo
git branch -M main  # default branch
git add . && git commit -m "..."
```

## Push — Existing Remote

```bash
git remote add origin <repo-url>
git push -u origin main
```

## Push — New Repo via GitHub CLI (once the account is correct)

```bash
# only after resolving the blocker above
gh repo create <owner>/l-shopee-backoffice --private --source=. --remote=origin --push
```

Use `--public` only with explicit owner approval (default is private).

## Pre-Push Check

- No `.env` or secrets committed (`.gitignore` covers `.env*`).
- Docs reflect current decisions (DECISIONS.md is the source of truth).
- Correct remote URL and owner account.
- Owner approved visibility (private).
