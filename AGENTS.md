# Project instructions — pool-dashboard

Project-specific working notes for this repository. These take precedence
over any general `/projects`-level instructions when they conflict.

## What this is

A HACS-installable Home Assistant Lovelace custom card (`pool-dashboard.js`,
element `custom:pool-dashboard-card`) showing a swimming pool's status, quick
controls, season/automation overview and settings on one page. Single
dependency-free ES module, Shadow DOM. Technical shape is inspired by
`/projects/garden-dashboard` — a reference, not a base to copy verbatim.

## Hard rules

- **Never commit real entity IDs or secrets.** Public files (JS, README,
  docs, tests, examples, defaults) use fictional `example_*` IDs only. Real
  mappings live only in gitignored `*.local.*` files. Before declaring done,
  grep the trackable files for real device/entity name fragments from
  `docs/discovery/inventory.local.md` and confirm zero hits.
- **No commit / push / branch / PR without the user's explicit permission.**
- **Scope is `/projects/pool` only.** Do not edit `/projects/juiced-dashboard`,
  `/projects/home-dashboard` or Home Assistant itself without a separate,
  explicit request — see `docs/design/proposal.md`'s scope decisions.
- **§5 of the proposal (season-mode backend: the `input_select` helper, the
  `script.pool_apply_season_mode` script, and the condition edits in the 5
  affected automations) is not built by this repository** and requires a
  separate, explicit approval before any of it is created in Home Assistant.
  The card only calls `script.turn_on` on `mode.apply_script` once that
  script exists; it never creates or edits automations itself.
- Never fire Home Assistant service calls from tests or during development
  that could change real pool equipment state. MCP inventory is read-only.
- Keep pure logic (status derivation, domain selection, escaping, override
  detection, render-gating) free of DOM/`window` so it stays unit-testable
  under Node.

## Local checks

```bash
npm install
npm run verify   # structure + syntax + markdownlint + prettier + tests
```

## Design decisions

- Config is key-driven, matching home-dashboard's pool entity-key-contract at
  the top level; everything else nests under domain groups (`filter`,
  `heater`, `salt_system`, `water_quality`, `mode`).
- `deriveStatus` precedence is fixed and tested:
  `unavailable > critical > warning > active > normal` — see
  `ARCHITECTURE.md`.
- The card reads HA's own theme variables (light/dark follows HA); it never
  renders its own theme toggle. `theme_mode: light|dark` is an explicit,
  opt-in override for a single card instance only.
- The salt-system fault check in the card is a simple point-in-time
  threshold, purely for display — the automation (with its time-windowed
  logic) stays the source of truth; the card does not duplicate it.
- `modeImpactSummary` renders only author-configured `mode.impact` text,
  never a synthesized description of what will happen.

## Change log

- Fase 2: design proposal + mock-up (approved).
- Fase 3: card, minimal editor, tests, HACS files, docs, CI.
- Fase 3.1: status chips → illustrated pool visual (layer 1 restyle only, no
  logic/entity-contract change).
- §5 technical proposal: exact helper/script YAML and per-automation
  condition-edit pattern for the season-mode backend, in
  `docs/design/season-mode-backend.md` — documentation only, awaiting
  separate approval; nothing built in Home Assistant.
- Fase 3.2: pool illustration replaced with the full equipment scene from
  the approved design mockup (wood-deck pool + illustrated filter pump, salt
  system and heat pump, generic default labels with optional per-group
  `label` override, "Verbruik" power badges via new `filter.power_draw` /
  `heater.power_draw`, salt system verbruik reusing `salt_system_fault`).
  The v0.2.1 illustration shipped in Fase 3.1 diverged from the mockup that
  was actually approved (a later design-artifact iteration the shipped card
  never picked up); this replaces it. Debietfout check factored into shared
  `saltSystemFault` helper so the status banner and the illustration can't
  disagree.
- Fase 3.2 hotfix (v0.3.1, incomplete): swapped `.pi-scene`'s CSS
  `aspect-ratio` for a padding-bottom-% height technique. This did not
  actually fix the illustration — see v0.3.2 below for the real cause.
- Fase 3.2 hotfix (v0.3.2, real fix): the actual cause of the invisible
  illustration in v0.3.0/v0.3.1 was width, not height.
  `ha-card.pool-shell` is `display:flex; flex-direction:column`, and
  `.pool-illustration` had `margin:0 auto` with no explicit `width` — auto
  cross-axis margins switch off `align-items:stretch`, so the item shrank
  to its max-content width. Every descendant of `.pi-scene` is
  `position:absolute` (no intrinsic width), so max-content resolved to 0,
  collapsing the whole box to 0×0 regardless of the height technique used.
  Fixed by adding an explicit `width:100%` on `.pool-illustration`.
- Fase 3.2 layout (v0.3.3): illustration and "Snelle bediening" placed
  side by side (`.pool-hero-row`, a two-column CSS Grid, not flex — after
  the v0.3.0/v0.3.1 collapse, grid's `1fr` tracks were deliberately chosen
  since they size from the row's own definite width rather than a child's
  intrinsic content). Collapses to a single column under 640px. Override
  banners moved to render right after the status banner (previously
  between the illustration and the controls, which no longer works once
  those two share a row).
- Fase 4 (roadmap, tracked at
  <https://claude.ai/artifact/PXEph9FvbDzqHbk2eCN7sc>): POOL-9 — Historie
  group now shows a 7-day bar graph per configured power sensor
  (`filter.power_draw`, `heater.power_draw`, `salt_system_fault`), not
  just water temperature, reusing the existing `historyBars()`/history-API
  fetch, generalized to a list via `_historyEntities()`. POOL-6 —
  `automations[].group` is now actually rendered (sub-headings, first-seen
  order) instead of being reserved-but-unused, plus a live "N actief"
  count in the group summary; and a new optional `mode.automations` map
  lets the mode group list a mode's own automations' on/off state — this
  half is forward-built and NOT live-testable yet, since it only renders
  once `mode.select`/`mode.apply_script` name real entities, which needs
  the still-unapproved §5 backend (POOL-5).
