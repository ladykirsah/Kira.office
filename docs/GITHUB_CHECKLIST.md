# GitHub Checklist

The user provided this GitHub profile:

https://github.com/ladykirsah

That is a profile URL, not a repository URL. Before pushing, confirm the exact repository.

## Needed From User

- Exact repository URL, or approval to create a new repository.
- Repository name.
- Private or public visibility.
- Default branch preference, usually `main`.

## Local Setup Steps

```bash
git init
git branch -M main
git add .
git commit -m "Prepare L Shopee project documentation"
```

## Existing Remote Repo Flow

```bash
git remote add origin <repo-url>
git push -u origin main
```

## New Repo Flow With GitHub CLI

```bash
gh repo create ladykirsah/l-shopee-backoffice --private --source=. --remote=origin --push
```

Use `--public` only if the user explicitly approves a public repository.

## Pre-Push Check

- Confirm no `.env` or secrets exist.
- Confirm docs reflect current requirements.
- Confirm remote URL is correct.
- Confirm user has approved repo visibility.
