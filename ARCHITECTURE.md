# Architecture

## Overview

Pool Dashboard Card is a single, dependency-free JavaScript module that
defines a Home Assistant Lovelace custom element. It follows the same
technical shape as `garden-dashboard` (a standalone module, Shadow DOM,
`ha-card` shell, theme variables read from HA with fallbacks) but is
otherwise its own implementation with a pool-specific data model.

```text
pool-dashboard.js
├── Pure helpers (no DOM / no window)      ← unit-tested in test/
│   ├── escapeHtml / isUnavailable / parseNumeric
│   ├── deriveStatus                       → normal | active | warning | critical | unavailable
│   ├── actionServiceFor / setValueDomain / shouldConfirm
│   ├── resolveThemeMode / modeImpactSummary / overridesFor
│   ├── historyBars
│   └── collectEntityIds / hasRelevantChange
├── PoolDashboardCard (custom element)
│   ├── setConfig / set hass / getCardSize / getGridOptions
│   ├── render pipeline (status → controls → mode → automations → settings)
│   └── actions (toggle, set setpoint, apply mode, revert overrides)
├── PoolDashboardCardEditor (minimal visual editor)
└── Registration (guarded define + window.customCards)
```

See `docs/design/proposal.md` for the full design rationale (Fase 2) behind
every choice below.

## Why a single module

The card must be usable without Mushroom, card-mod, layout-card,
decluttering-card or any other custom card, and installable as a HACS
Lovelace plugin that ships one JS file. A single ES module with Shadow DOM is
the simplest thing that satisfies all of that and keeps the review surface
small. No build step or framework is used.

## Data model

Configuration is entirely key-driven — no entity IDs are hard-coded. The
top-level keys (`status`, `water_temperature`, `target_temperature`,
`ambient_temperature`, `heater_power`) are taken verbatim from
`home-dashboard`'s pool entity-key-contract so a future summary card there can
read the same names; everything home-dashboard does not know about (chlorinator
diagnostics, salt system, water quality, season mode, automation overview)
lives nested under its own domain group. See `docs/configuration.md` for the
full schema.

## Status precedence

`deriveStatus(config, hass)` is pure and returns one of five keys, in this
strict precedence (highest first), each covered by an explicit test in
`test/helpers.test.js`:

1. **unavailable** — a required field (`status` if configured, the three
   temperatures, `heater_power`) is missing or `unavailable`/`unknown`. This
   wins even if a `critical` condition is also true, because the card cannot
   trust any other signal once a required field is unreadable.
2. **critical** — `has_error` is on, or the salt system's power reading dips
   below `salt_system.fault_below_watts` while the salt system is switched
   on. This is a simple point-in-time indicator only; the authoritative,
   time-windowed fault detection stays in the automation listed under
   `automations:` — the card deliberately does not duplicate that logic.
3. **warning** — a manual override is active (`overridesFor`): swim mode,
   filter catchup mode, or a heater-on-while-filter-off conflict.
4. **active** — filter, heater or salt system is currently running and
   nothing above applies.
5. **normal** — nothing running, nothing flagged.

## Season/winter mode — card prepared, backend not built

The mode-switch block (§5 of the proposal) is disabled and shows an
explanation unless **both** `mode.select` and `mode.apply_script` are
configured — the same opt-in gate pattern as `ha-kia-connect-dashboard`'s
`charger_controls`. When configured, the card calls **only**
`script.turn_on` on `mode.apply_script` with the target mode as a variable —
it never writes to `mode.select` directly and never creates or edits any
automation. The confirmation dialog shown before that call renders
`mode.impact.<target>` from the config verbatim; `modeImpactSummary` never
synthesizes a summary from live state, because the script — not the card —
is what actually acts, and the card cannot promise something it does not
control.

Building `input_select.pool_season_mode` and `script.pool_apply_season_mode`
themselves is out of scope for this repository (see the proposal's §5/§9) and
requires a separate, explicit approval since it touches Home Assistant
automations directly.

## Theming (light/dark)

The card reads Home Assistant's own theme CSS custom properties
(`--card-background-color`, `--warning-color`, …) with a dark fallback for
standalone use outside HA — the same pattern `garden-dashboard` uses. It never
renders its own light/dark toggle; that would fight HA's own theme setting.
An optional `theme_mode: light|dark` config key overrides the HA variables
with literal values from the `THEME_TOKENS` table for the rare case where one
card instance (e.g. a wall panel) must always show one theme regardless of
the active HA theme. Default is `"system"` — no override applied. See
`docs/design/proposal.md` §1a for the full token table.

## Rendering and update gating

`set hass` fires on every Home Assistant state push. The card gates
rendering with `hasRelevantChange(prevHass, nextHass, entityIds)` (pure,
tested): it compares only the configured entities' `state` and
`last_updated`, and skips the render entirely when nothing relevant changed.
Unlike `garden-dashboard`, the card has no drag-to-set control (setpoints use
discrete +/− stepper buttons, not a slider), so no interaction-focus guard is
needed — clicks always resolve to a single, immediate service call.

## Actions and safety

- The correct service is chosen from an entity's **real domain**
  (`switch`/`input_boolean`/`valve`/`button` via `actionServiceFor`,
  `number`/`input_number` via `setValueDomain`). Unsupported domains are
  refused rather than firing a guessed service.
- Confirmation is on by default (`confirm_actions`) for anything that changes
  physical equipment state, except swim mode and filter catchup mode, which
  are explicitly no-confirm per the proposal's §7 (meant for quick use) and
  the non-destructive setpoint stepper.
- Manual overrides (swim mode, catchup mode) can be reverted together via one
  "terug naar automatisch" action; the heater-on-while-filter-off conflict is
  informational only — there is no single safe action that resolves it (see
  `docs/troubleshooting.md`).
- Every action reports back through an in-card notice: sent, cancelled,
  missing entity, unsupported domain or service error. Internal errors are
  surfaced as short messages — never raw stack traces.

## Safe value handling

- All interpolated text passes through `escapeHtml`.
- `isUnavailable` treats `unavailable`, `unknown`, `none`, empty and
  null/undefined as "no value"; `parseNumeric` returns `null` for anything
  non-finite.
- Chlorinator diagnostic fields that are structurally `unavailable` today are
  shown gracefully (`Niet beschikbaar`) and never escalate the card's overall
  status — see `docs/troubleshooting.md`.
- Units come from each entity's `unit_of_measurement` attribute, with a
  couple of explicit overrides (ORP in mV) where the source sensor has none.

## History (layer 4)

`_historyEntities()` lists every entity the group shows a graph for:
`water_temperature`, the configured power-draw sensors
(`filter.power_draw`, `heater.power_draw`, `salt_system_fault` — POOL-9),
and the configured water-quality readings (`water_quality.ph/orp/salinity`
— POOL-10). Each entity's last 7 days is fetched once per card lifetime via
`hass.callApi("GET", "history/period/...")` and reduced to bar heights by
the pure, tested `historyBars` helper (bucket-averaged, normalized 0-100
per entity, returns `null` when fewer than two numeric points exist). The
fetch is best-effort and per-entity: while pending or on error that
entity's block shows a plain message instead of bars, independently of the
others, and nothing about it blocks the rest of the card from rendering.
This code path only runs against a real HA frontend — `callApi` does not
exist under the Node unit tests, so it is exercised through manual testing
(`docs/home-assistant-testing.md`), not `node --test`.

## Sections dashboard support

`getGridOptions()` returns `columns: "full"` by default (overridable via
`layout_options.grid_columns`) so the card can span a full-width Sections
dashboard. `getCardSize()` scales slightly with the number of configured
automations.

## Testing and CI

Pure helpers are exported under Node via a `module.exports` guard and covered
by `node --test` in `test/helpers.test.js`, including explicit precedence
tests for `deriveStatus`. A base-class shim
(`typeof HTMLElement !== "undefined" ? HTMLElement : class {}`) lets the
module `require` cleanly in Node without a browser shim. CI (GitHub Actions)
runs structure validation, `node --check`, markdownlint, Prettier `--check`
and the unit tests. Tests never perform real Home Assistant service calls.

## Privacy

No real entity IDs appear anywhere in the repository — the card is fully
generic and public docs/examples use fictional IDs only. Real mappings live in
a local, gitignored `*.local.*` file used solely for on-device testing.
