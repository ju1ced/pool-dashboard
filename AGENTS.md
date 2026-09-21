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
