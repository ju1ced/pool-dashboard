# Configuration reference

All examples use generic, fictional entity IDs. Replace them with your own.
Water temperature especially: map it to whichever sensor your heater
automations actually use (see the warning under "Top-level fields" below), or
the card and the automations can disagree about whether the pool is on
temperature.

## Top-level fields

| Field                 | Type    | Required | Description                                                                                                                                                                                       |
| --------------------- | ------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `type`                | string  | yes      | Must be `custom:pool-dashboard-card`.                                                                                                                                                             |
| `title`               | string  | no       | Card heading (default `Zwembad`).                                                                                                                                                                 |
| `status`              | entity  | no       | Optional status sensor. Currently used only as an extra required-field check for the "unavailable" state — the card always derives its own status label.                                          |
| `water_temperature`   | entity  | yes      | Pool water temperature. **Map this to the same sensor your heater automations use.**                                                                                                              |
| `target_temperature`  | entity  | yes      | Target temperature, `number.*` or `input_number.*` so the stepper can write it.                                                                                                                   |
| `ambient_temperature` | entity  | yes      | Outside/air temperature, shown as an informational badge on the pool illustration.                                                                                                                |
| `heater_power`        | entity  | yes      | Heat pump on/off, `switch.*` or `input_boolean.*`.                                                                                                                                                |
| `has_error`           | entity  | no       | Heat pump fault flag (`binary_sensor.*`). `on` → critical status.                                                                                                                                 |
| `salt_system_fault`   | entity  | no       | Salt system power-draw sensor. Used with `salt_system.fault_below_watts` for a simple flow-fault indicator (see below), and shown as the salt system's "Verbruik" badge on the pool illustration. |
| `swim_mode`           | entity  | no       | Swim-mode helper (`input_boolean.*`). Toggling it in the card turns filter + salt system off temporarily (see "Quick controls").                                                                  |
| `confirm_actions`     | boolean | no       | Ask for confirmation before actions (default `true`).                                                                                                                                             |
| `theme_mode`          | string  | no       | `system` (default, follows the active HA theme) \| `light` \| `dark`. See below.                                                                                                                  |
| `layout_options`      | object  | no       | Sections dashboard sizing (`grid_columns`, `grid_rows`).                                                                                                                                          |

## `filter`

| Field                 | Description                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `filter.pump`         | Filter pump, `switch.*`. Drives the Start/Stop toggle and the running hours meta line.    |
| `filter.hours_today`  | Hours run today (sensor).                                                                 |
| `filter.hours_target` | Target hours for today (`input_number.*` or sensor).                                      |
| `filter.catchup_mode` | Filter catch-up helper (`input_boolean.*`). No confirmation (quick control).              |
| `filter.power_draw`   | Optional live power sensor (W), shown as the pump's "Verbruik" badge on the illustration. |
| `filter.label`        | Optional display name on the pool illustration (default "Filterpomp").                    |

## `heater`

All optional. `heater.label` and `heater.power_draw` are shown on the pool
illustration; every other field renders in **Instellingen & diagnostiek**
only when configured, and gracefully as "Niet beschikbaar" when the entity's
state is `unavailable` — several of these are structurally unavailable on
some installs (see `docs/troubleshooting.md`).

| Field                        | Description                                                                        |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `heater.label`               | Optional display name on the pool illustration (default "Warmtepomp").             |
| `heater.power_draw`          | Optional live power sensor (W), shown as the "Verbruik" badge on the illustration. |
| `heater.mode`                | Heat pump operating mode.                                                          |
| `heater.compressor`          | Compressor on/off diagnostic.                                                      |
| `heater.circulate_pump`      | Circulation pump diagnostic.                                                       |
| `heater.coil_temperature`    | Coil temperature diagnostic.                                                       |
| `heater.exhaust_temperature` | Exhaust temperature diagnostic.                                                    |
| `heater.error_description`   | Free-text fault description, shown in the status banner when `has_error` is on.    |
| `heater.proxy_online`        | Connectivity diagnostic for the heat-pump proxy device.                            |

## `salt_system`

| Field                            | Description                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `salt_system.power`              | Salt system on/off, `switch.*`.                                                                                                                                                                                                                                                                                                                         |
| `salt_system.label`              | Optional display name on the pool illustration (default "Zoutsysteem").                                                                                                                                                                                                                                                                                 |
| `salt_system.chlorination_level` | Chlorination level, `number.*`, shown in settings.                                                                                                                                                                                                                                                                                                      |
| `salt_system.boost`              | Boost switch, `switch.*`. The card toggles it on/off with the same `switch.turn_on`/`switch.turn_off` domain-safe lookup as every other on/off control.                                                                                                                                                                                                 |
| `salt_system.boost_remaining`    | Remaining boost time, shown live on the Boost control while active.                                                                                                                                                                                                                                                                                     |
| `salt_system.fault_below_watts`  | Optional number (default `15`). Simple, point-in-time flow-fault indicator: **critical** status when `salt_system_fault`'s reading is below this while `salt_system.power` is on. This is deliberately not the same as the automation's own fault detection (which is time-windowed) — the automation stays the source of truth; see `ARCHITECTURE.md`. |

## `water_quality`

All optional, shown as badges on the pool illustration (layer 1) and setpoints
(layer 5, settings):
`ph`, `ph_setpoint`, `orp`, `orp_setpoint`, `salinity`. `ph_setpoint` and
`orp_setpoint` must be `number.*` to be settable in a future revision — today
they are display-only in **Instellingen**.

## `mode` — season/winter switch (opt-in, requires backend)

```yaml
mode:
  select: input_select.example_pool_season_mode
  apply_script: script.example_pool_apply_season_mode
  impact:
    zomer: "Filter, warmtepomp en zoutsysteem terug op automatisch schema."
    winter: "Filter, zout en warmtepomp expliciet uit. Vorstbeveiliging blijft actief."
    onderhoud: "Alles uit, geen automatische herstart."
  automations:
    zomer:
      [automation.example_pool_filter_start, automation.example_pool_heater_on]
    winter: [automation.example_pool_frost_protection]
```

The mode block is **disabled and shows an explanation** unless both
`mode.select` and `mode.apply_script` are configured — this backend
(`input_select.pool_season_mode` + `script.pool_apply_season_mode` +
condition edits in 5 automations) is not part of this repository and needs a
separate approval; see `docs/design/proposal.md` §5/§9 and the full technical
spec in `docs/design/season-mode-backend.md`.

When configured, clicking a mode button shows a confirmation dialog with the
matching `mode.impact.<value>` text (verbatim, never synthesized — if a
target mode has no `impact` entry the dialog says so explicitly), then calls
**only** `script.turn_on` on `mode.apply_script` with
`variables: { mode: "<value>" }`. The card never calls
`input_select.select_option` directly and never creates or edits an
automation.

`mode.automations` is optional: a map from a mode value to the list of
`automation.*` entities that mode affects. When the active mode has a
matching entry, the mode group lists those automations' live on/off state
underneath the buttons — the same read-only row style as the `automations`
overview below, just scoped to the current mode instead of all of them.

## `automations` — read-only overview

```yaml
automations:
  - entity: automation.example_pool_filter_start
    group: filtering
    summary: "Start filter op optimaal tijdstip (PV/dringendheid/seizoen)"
  - entity: automation.example_pool_pump_start_summer
    group: filtering
    summary: "PV-blinde start-zomer variant"
    note: "dupliceert automation.example_pool_filter_start"
```

| Field     | Required | Description                                                                                                                                                                                                                                                              |
| --------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `entity`  | yes      | The `automation.*` entity. Live `state` and `last_triggered` are read.                                                                                                                                                                                                   |
| `group`   | no       | Free-text grouping label. Automations sharing a `group` value render together under that heading, in first-seen order; automations without one render flat, as before this existed.                                                                                      |
| `summary` | no       | Author-time one-line description of what the automation does and when.                                                                                                                                                                                                   |
| `note`    | no       | Author-time flag (e.g. "dupliceert …") — shown as a small "controleren" badge instead of the last-triggered time. The card never decides this itself; see `docs/design/proposal.md` §6 for why a Lovelace card cannot introspect an automation's real trigger/condition. |

An `automation.*` entity that no longer exists renders as "Onbekend" instead
of crashing the card.

## Theming — light/dark follows Home Assistant

The card reads Home Assistant's own theme CSS variables
(`--card-background-color`, `--primary-text-color`, `--warning-color`, …)
with a dark fallback for standalone use outside HA. It never renders its own
light/dark toggle. For the rare case where one card instance (e.g. a fixed
wall panel) must always show one theme regardless of the active HA theme:

```yaml
theme_mode: light # or: dark
```

Default is `system` (no override — HA's active theme decides).

## Confirmation prompts

By default any action that changes physical equipment state shows a browser
confirm dialog. Swim mode and filter catch-up mode are the exception — they
are meant for quick, frequent use and never confirm (see
`docs/design/proposal.md` §7). To disable confirmation entirely (for example
on a trusted wall tablet):

```yaml
type: custom:pool-dashboard-card
confirm_actions: false
```

## Missing and unavailable entities

- **Missing** (key not in config): the corresponding row/control is simply
  not rendered.
- **`unknown`**: shown as `Onbekend`.
- **`unavailable`**: shown as `Niet beschikbaar`; if the entity is one of the
  four required fields (or `status`, when configured), the whole card falls
  back to the "Gegevens niet beschikbaar" status.

The card never shows a guessed value for a missing or unavailable entity.

## Full-width in a Sections dashboard

```yaml
type: custom:pool-dashboard-card
title: Zwembad
layout_options:
  grid_columns: full
  grid_rows: auto
```

`getGridOptions()` defaults to full width even without this block.
