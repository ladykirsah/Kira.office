---
name: kira-preview-build
description: Build an approved Kira.office canvas drawing into the Expo back office (apps/mobile), tests first, and show it on the local preview for the owner's approval. Use when the owner says "apply to preview", "build it", or approves a drawing for building. Covers TDD in apps/mobile/src/lib and apps/api, reusing built UI parts, restarting the "Kira new version" preview, the practice sign-in, checking every state in the iOS simulator and the Claude browser pane, local-only seed data, and the gates to run. Stops before any commit.
---

# Building a drawing onto the preview

**Goal:** the real app shows what the canvas shows, every state works, all checks are green, and **nothing is committed**. Read `docs/knowledge/conventions/expo-page-design-rules.md` again first; §8 is "check the build like the owner would".

## 1 · Tests first (`~/.claude/CLAUDE.md` §1, `docs/knowledge/operations/testing-and-lint.md`)

- **Page words and logic** go in `apps/mobile/src/lib/<page>Page.ts` (no screen code), with `<page>Page.test.ts` beside it (Vitest).
  - Write the test for the drawn words exactly ("ใช้ได้ถึง 30 พ.ย.", "สำหรับสินค้า DENSO, Sanden").
  - Include the states the drawing doesn't show: no end date, another year, used up, empty list.
- **Red for the right reason.** Add stand-in exports that return empty values (`export const kindLine = (_c) => ({ th: "", en: "" })`), so the test fails on its assertion rather than on a missing import.
  - Run from the **repo root**: `npx vitest run apps/mobile/src/lib/<file>.test.ts`. Running from `apps/mobile` finds no tests.
- **Server changes:**
  - Code: `apps/api/src/index.ts`, tests in `index.test.ts` (real-schema tests; use the seeded ids such as `br-denso` and `cm-vios`).
  - A new migration is `packages/db/migrations/NNNN_<what>.sql`. Take the next number after `origin/main`'s, and write a comment on what each column means.
  - Apply it locally: `npx wrangler d1 migrations apply kira-office --local`.
  - **A new page a role must not change** (it's outside that role's menu) goes on the setup list in `writeAreaOf` (`packages/core/src/staffAuth.ts`) with a 403 test. A hidden menu item is not a lock.
- **Green, then refactor.** Delete words and parts the new design replaces, together with their tests. Run the whole related folder again.

## 2 · Screens (`apps/mobile/src/ui/<page>/`)

- **Reuse built parts:** `Sheet`, `Group`, `Line`, `InputRow`, `ChoiceRow`, `SwitchRow`, `Segmented`, `FormPage`, `BigButton`, `PickerPill`, `LineIcon`, `Heading`, plus the `TYPE` and `SPACE` tokens.
- **Words** are `{ th, en }` phrases through `useLang().t()`.
- **Patterns to follow:**
  - The list tab lives in the URL (`router.setParams`).
  - Never nest a Pressable inside a Pressable.
  - Copy buttons use `lib/copyText`.
  - Dates use `PickerPill`.
- **Thai names sort with `localeCompare(…, "th")`.**

## 3 · Show it on the preview

- **Servers** (in `.claude/launch.json`):
  - "api" on port 8788 must be running.
  - "Kira new version" (port 8081) runs in CI mode with **no hot reload**. After every change, `preview_stop` it and `preview_start` it again.
- **Sign-in:** open `http://localhost:8081/sign-in?practice=1&to=<path>`. A reload drops the sign-in, so open the same URL again.
- **Look on the iOS simulator** (iPhone 17 Pro):
  - Use `control open_url`, then `screenshot`. Screenshots lag one step, so take two.
  - Tap coordinates in points ≈ displayed px × 0.437.
- **Read text and click in the Claude browser pane** (`get_page_text`, `find`, `left_click` by ref). Never use Playwright, and never use the owner's own Chrome for the preview.
- **Check every state, not only the drawn one:**
  - each list filter, the empty list, long text;
  - every sheet a tap opens;
  - saving with empty boxes (the messages sit under the right box);
  - edit vs add;
  - records the old back office saved;
  - two quick taps;
  - "no connection" (stop the api, use the page, start it again).
- **Local data:** seed the local D1 only, with removable ids and an `undo.sql` in `design-tools/`. Never write mock data to prod.
- **Leave the simulator** on the main page of the work for the owner.

## 4 · Checks to run (run them; don't paste them)

1. `node scripts/check-hidden-code.mjs`. Also grep the eslint configs for malware before linting (see the memory note on eslint config malware).
2. `npm run format && npm run lint && npm run typecheck && npm test`. Run it in the background and wait for the notification.
3. Only when `apps/admin` changed: `rm -rf apps/admin/.next-verify apps/admin/.next/types && NEXT_DIST_DIR=.next-verify NEXT_PUBLIC_API_BASE=https://api.airplusauto.com npm run build:check -w @l-shopee/admin`.

## 5 · Hand back

- Say, in plain bullets, what is on the preview, which states you checked, and any choice you made where the drawing was silent (for example "ลูกค้าใหม่ + some products → สำหรับลูกค้าใหม่ · สินค้า DENSO").
- Ask for their approval in the next-step box. **No commit and no lessons yet.** Lessons come after they approve (`kira-ship`).
- Never touch `apps/admin/src/app/globals.css`: it has an unrelated change the owner keeps out of commits.
