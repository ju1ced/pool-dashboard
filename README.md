# Pool Dashboard Card

A self-contained [Home Assistant](https://www.home-assistant.io/) Lovelace
custom card showing a swimming pool's status, quick controls, season and
automation overview, and advanced settings on one page. It is designed to
drop straight into an existing dashboard view — no separate view, YAML
includes, themes, Mushroom, card-mod or any other custom cards required.

- Status banner (normal / active / warning / critical / unavailable) derived
  from your entities, never a guessed value
- Quick controls: filter pump, heat pump (with an explicit warning when it
  will be auto-reverted), target-temperature stepper, salt system, boost,
  swim mode, filter catch-up mode
- Override banner with a one-click "terug naar automatisch" for manual
  overrides
- Season/winter mode block — **opt-in and disabled by default**; see
  [docs/configuration.md](docs/configuration.md#mode--seasonwinter-switch-opt-in-requires-backend)
- Read-only automation overview (state, last-triggered, author-time summary)
- 7-day water temperature history graph (collapsed by default)
- Graceful handling of missing, `unknown` and `unavailable` entities
- Responsive from wide desktop dashboards down to ~360 px phones
- Follows Home Assistant's own light/dark theme — no toggle of its own
- Works full-width in a Sections dashboard

> **Type:** `custom:pool-dashboard-card` · **Resource:** `pool-dashboard.js`

## Installation

### HACS (recommended)

1. In HACS, open the three-dot menu → **Custom repositories**.
2. Add `https://github.com/ju1ced/pool-dashboard` with category
   **Lovelace** (Dashboard / Plugin).
3. Install **Pool Dashboard Card**.
4. HACS registers the resource automatically. If you manage resources
   manually (or use YAML mode), add:

   ```yaml
   url: /hacsfiles/pool-dashboard/pool-dashboard.js
   type: module
   ```

5. Reload your browser (hard refresh) so the new resource is picked up.

### Manual

1. Copy `pool-dashboard.js` to `config/www/pool-dashboard.js`.
2. Add the resource under **Settings → Dashboards → ⋮ → Resources**:

   ```yaml
   url: /local/pool-dashboard.js
   type: module
   ```

3. Hard-refresh the browser.

## Quick start

Add the card to any existing view (via **Edit dashboard → Add card →
Manual**) with a minimal config (replace the example IDs with your own):

```yaml
type: custom:pool-dashboard-card
title: Zwembad
water_temperature: sensor.example_pool_water_temperature
target_temperature: input_number.example_pool_target_temperature
ambient_temperature: sensor.example_pool_ambient_temperature
heater_power: input_boolean.example_pool_heater_power
```

A more complete configuration:

```yaml
type: custom:pool-dashboard-card
title: Zwembad
confirm_actions: true

water_temperature: sensor.example_pool_water_temperature
target_temperature: input_number.example_pool_target_temperature
ambient_temperature: sensor.example_pool_ambient_temperature
heater_power: input_boolean.example_pool_heater_power
has_error: binary_sensor.example_pool_heater_has_error
salt_system_fault: sensor.example_pool_salt_system_power
swim_mode: input_boolean.example_pool_swim_mode

filter:
  pump: switch.example_pool_filter_pump
  hours_today: sensor.example_pool_filter_hours_today
  hours_target: input_number.example_pool_filter_hours_target
  catchup_mode: input_boolean.example_pool_filter_catchup

salt_system:
  power: switch.example_pool_salt_system
  chlorination_level: number.example_pool_salt_chlorination_level
  boost: switch.example_pool_salt_boost
  boost_remaining: sensor.example_pool_salt_boost_remaining
  fault_below_watts: 15

water_quality:
  ph: sensor.example_pool_ph
  orp: sensor.example_pool_orp
  salinity: sensor.example_pool_salinity

automations:
  - entity: automation.example_pool_filter_start
    group: filtering
    summary: "Start filter op optimaal tijdstip (PV/dringendheid/seizoen)"
```

Full-width in a Sections dashboard:

```yaml
type: custom:pool-dashboard-card
title: Zwembad
layout_options:
  grid_columns: full
  grid_rows: auto
```

See **[docs/configuration.md](docs/configuration.md)** for every option, and
**[docs/troubleshooting.md](docs/troubleshooting.md)** if something looks off.

## Documentation

- [Configuration reference](docs/configuration.md)
- [Home Assistant testing procedure](docs/home-assistant-testing.md)
- [Troubleshooting](docs/troubleshooting.md)
- [Architecture](ARCHITECTURE.md)
- [Design proposal (Fase 2)](docs/design/proposal.md)

## Development

```bash
npm install
npm run verify   # structure + syntax + markdown + prettier + unit tests
```

Pure helper logic (status derivation, safe parsing, domain selection, HTML
escaping, render-gating, override detection) lives at the top of
`pool-dashboard.js` and is unit-tested with Node's built-in test runner.

## License

[MIT](LICENSE)
