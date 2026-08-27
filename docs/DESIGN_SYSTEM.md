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
  Any table that **lists records** follows the locked list-table pattern below.
- **Tags** — `.tag`: filled (`background --code-bg`, `font-weight 500`, `padding 4px 11px`) for part
  details. Skimmable, not plain text.
- **Pills** — `.pill.soft` (primary-soft bg + primary text) for non-status chips like
  `scratch · not saved`; `.pill.good|warn|bad` for margin/health. Coral, not amber, for "soft."
- **File picker — LOCKED (owner, 4 Aug 2026).** Never a bare `<input type="file">`: the browser
  draws its own grey "Choose File / No file chosen" chip in its own font and size, ignoring every
  token here. Use `FilePickButton` (`app/FilePickButton.tsx`) — a hidden input clicked by a real
  `.btn-sm` reading `＋ Choose…`, which becomes `＋ <filename>` once something is picked. Affiliate
  Promote is where this started and is the reference.
- **Image frames** — `.frame` / `.frame.empty` (the "+ Add" tile) / `.cover-badge` / `.frame-x`
  (remove) in edit mode; the view-mode gallery is a 350px main image + a 350px-tall column of 110px
  thumbnails in rows of 3 (3×110 + 2×10 gap = 350), active thumb gets a 2px coral border.
- **Master–detail / spine grouping** — `.md-*` classes give the car-fitment editor a colored "spine"
  so an expanded editor visibly belongs to its row; era chips + a "has notes" dot summarize a row.
- **Control sizes — two tiers, matched by height.** Put controls on the same row in the same tier so
  they line up. **L = 40px**: default `button`, `.btn-primary` (coral), `.btn-danger` (red), and the
  default `input`/`select` / `inputL`. **S = 32px**: `.btn-soft` (lighter coral) and the size-only
  `.btn-sm` modifier (composes with any colour, e.g. `btn-danger btn-sm`), matched by `inputS`
  (`lib/inputStyles.ts`, floored to 32px). Header actions are plain white buttons; always set
  `type="button"` on non-submit buttons. (Heights are measured, not the `min-height` values — the base
  `input` min-height is 40px, so `inputS` needs its own 32px floor to match the S buttons.)

## List table — LOCKED (owner's brief, 4 Aug 2026)

The products table is the reference implementation (`apps/admin/src/app/products/ProductsTable.tsx`
+ the `.products-*` rules in `globals.css`). Every screen that lists records — staff, orders,
customers, stock movements — copies this shape. Change it here first, then everywhere; don't fork a
second table style per page.

**1. Tabs above the frame.** `.tabs` / `.tab`, one per meaningful subset, each label carrying its
count: `All (3)`, `Out of stock (3)`. Active = coral text + 2px coral bottom border, and only the
active tab is coral — see the red-is-active rule. A tab with 0 rows still shows; the zero is the
answer.

**2. One framed section holds toolbar + table.** `border:1px solid --border`, `border-radius:8px`,
`padding:18px`, `background:--surface`. Nothing floats outside it.

**3. Toolbar, top of the frame.** Flex row, `gap:10px`, wrap, `margin-bottom:12px`. Free-text search
first (`.tbar-input`, S size, 240px), then `Sort by…`, then a filter select that appears **only**
once a sort dimension is picked. Unset controls read `--text-faint` / weight 400; once set they go
`--text` / weight 500, so you can see at a glance whether a filter is on.

**4. Fixed layout, frozen identity column.** `table-layout:fixed`, `width:100%`, and a `min-width`
that forces horizontal scroll inside `.products-scroll` rather than squeezing cells. A `<colgroup>`
gives the identity column the slack and every other column a fixed px width. The identity column is
`.freeze-col` — sticky left on `--surface`; its divider shadow appears only while the table actually
overflows (the `.frozen` class), so it never draws a line for nothing.

On a phone (≤741px) a list table marked `list-cards` stops being a table: each row becomes a card, the identity cell leads it full width, and every other cell prints its own column name from `data-label`. Opt-in per screen — a card without labels is worse than the scroll. Products is the reference.

**5. The identity cell is picture + name + tags.** 56px square thumbnail (`--hover` background,
6px radius, emoji placeholder when there's no image), the name as a 600-weight link on one line with
ellipsis and a `title` holding the full text, and under it a row of `.tag.tag-sm` chips. No tags → a
`tableText.subtitle` line with the reference code instead. The cell is never just text.

**6. Cells state their type.** `th` is 12px/600/muted with a 2px bottom rule; `td` is 12px padding,
1px rule, middle-aligned, hovering to `--hover` (the frozen cell hovers with it). Numbers are
centred or right-aligned per column, and **an empty value is an em dash in `.muted`, never a blank
cell** — blank reads as broken.

**7. Status is a pill; actions are one menu.** The state column uses a pill/tag, never colour alone,
and holds nothing else — a row's readiness note (`.why`) goes under the name in the identity cell,
where it has the width to stay on one line and stays visible on a phone without scrolling sideways.
The last column is a single `Actions` dropdown — not a row of buttons that grows every time
something is added. Inline editors (stock, price) live in their own cell and keep a neutral focus
ring.

**8. Empty state, not an empty table.** `.empty` with an emoji and a sentence that distinguishes
"nothing exists yet" from "nothing matches this filter" — they need different next steps.

## Formatting

- Money: render satang via `baht()` (`PricingFields.tsx`). Inputs are THB; convert with `toSatang()`.
- Dates/times: `formatUpdatedAt(ms)` → `DD/MM/YYYY · HH:MM`, local 24-hour (`lib/format.ts`).
- Layout fills page width with responsive grids (`repeat(auto-fit, minmax(min(380px,100%),1fr))`),
  Pricing left / Fits right where both are present.

## When adding UI

1. Reuse tokens + the framed-section/table/tag/pill patterns above before inventing new styles.
2. Keep contrast AA; reserve `--text-faint` for decoration.
3. Verify live against the deployed API and share proof (measurement or screenshot).
