# Design System — Admin UI

The admin UI is a calm, scannable back-office for a non-developer owner (Thai/English). Coral accent,
white surfaces, generous framing, AA-contrast text. Tokens and shared component classes live in
[`apps/admin/src/app/globals.css`](../apps/admin/src/app/globals.css); most one-off layout is inline
`style` on the components.

## Tokens (`:root` in globals.css)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#fbfcfe` | page background |
| `--surface` | `#ffffff` | cards / frames |
| `--border` | `#e3e6ea` | hairline borders |
| `--hover` | `#eef1f4` | hover / image placeholder |
| `--text` | `#1f2430` | primary text (~16:1) |
| `--text-muted` | `#566071` | labels / secondary (AA ~6.8:1) |
| `--text-faint` | `#8b95a3` | decorative only (em dashes, placeholders) — **not for real info** |
| `--primary` | `#bf3c1d` | coral accent / primary buttons (AA ~5:1 white text) |
| `--primary-hover` | `#a13219` | hover |
| `--primary-soft` | `#fbe9e3` | soft accent fills (pills, active states) |
| `--primary-faint` | `#fdf4f0` | lightest wash for grouped panels |
| `--ok` `--warn` `--danger` | `#1a7f37` `#9a6700` `#c0291f` | status (all AA on white) |
| `--code-bg` | `#f0f2f5` | tags, code, monospace chips |
| `--ring` | `rgba(191,60,29,.32)` | focus ring |
| `--radius` | `12px` | default corner |
| `--shadow` | `0 1px 3px rgba(16,24,40,.08)` | card shadow |
| `--sidebar-w` | `232px` | left nav width |

**Rules:** never put real information in `--text-faint`. Values that matter are `--text` weight ~600;
their labels are `--text-muted` ~13px. Status is never color-only — pair with text/shape.

## Patterns

- **Framed section** — a titled, bordered `--surface` card (`border:1px solid --border`,
  `border-radius:--radius`). Used for Pricing, Part details, Fits these cars, the overview card. New
  grouped content should adopt this rather than floating on the page.
- **Tables** — equal padding on all four sides (general 12px, pricing `.ptbl` 14px, fitment `.ftbl`
  8px). No first/last-child padding zeroing. Pricing tables use **margin bars** (`.mwrap`/`.mtrack`/
  `.mfill.good|warn|bad`/`.mpct`) and bold profit; the online row gets a coral accent.
- **Tags** — `.tag`: filled (`background --code-bg`, `font-weight 500`, `padding 4px 11px`) for part
  details. Skimmable, not plain text.
- **Pills** — `.pill.soft` (primary-soft bg + primary text) for non-status chips like
  `scratch · not saved`; `.pill.good|warn|bad` for margin/health. Coral, not amber, for "soft."
- **Image frames** — `.frame` / `.frame.empty` (the "+ Add" tile) / `.cover-badge` / `.frame-x`
  (remove) in edit mode; the view-mode gallery is a 350px main image + a 350px-tall column of 110px
  thumbnails in rows of 3 (3×110 + 2×10 gap = 350), active thumb gets a 2px coral border.
- **Master–detail / spine grouping** — `.md-*` classes give the car-fitment editor a colored "spine"
  so an expanded editor visibly belongs to its row; era chips + a "has notes" dot summarize a row.
- **Buttons** — primary `.btn-primary` (coral); header actions are plain white buttons. Always set
  `type="button"` on non-submit buttons.

## Formatting

- Money: render satang via `baht()` (`PricingFields.tsx`). Inputs are THB; convert with `toSatang()`.
- Dates/times: `formatUpdatedAt(ms)` → `DD/MM/YYYY · HH:MM`, local 24-hour (`lib/format.ts`).
- Layout fills page width with responsive grids (`repeat(auto-fit, minmax(min(380px,100%),1fr))`),
  Pricing left / Fits right where both are present.

## When adding UI

1. Reuse tokens + the framed-section/table/tag/pill patterns above before inventing new styles.
2. Keep contrast AA; reserve `--text-faint` for decoration.
3. Verify live against the deployed API and share proof (measurement or screenshot).
