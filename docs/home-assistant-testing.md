# Home Assistant testing procedure

This is a manual smoke test to run the card against a real Home Assistant
instance after installing or upgrading it. It deliberately avoids changing
real pool equipment state unless you explicitly choose to.

## 1. Prepare a local, private mapping

Create a **local, gitignored** config file mapping the card to your real
entities. Any file matching `*.local.*` is ignored by git (see
`.gitignore`), so your real entity IDs never leave your machine.

Suggested location: `home-assistant.local.yaml` in the repo root.

```yaml
# home-assistant.local.yaml — LOCAL ONLY, never commit.
type: custom:pool-dashboard-card
title: Zwembad
confirm_actions: true
water_temperature: sensor.<your_water_temperature>
target_temperature: input_number.<your_target_temperature>
ambient_temperature: sensor.<your_ambient_temperature>
heater_power: input_boolean.<your_heater_power>
has_error: binary_sensor.<your_heater_has_error>
swim_mode: input_boolean.<your_swim_mode>
filter:
  pump: switch.<your_filter_pump>
  hours_today: sensor.<your_filter_hours_today>
  hours_target: input_number.<your_filter_hours_target>
  catchup_mode: input_boolean.<your_filter_catchup>
salt_system:
  power: switch.<your_salt_system>
  chlorination_level: number.<your_chlorination_level>
  boost: switch.<your_salt_boost>
  boost_remaining: sensor.<your_salt_boost_remaining>
water_quality:
  ph: sensor.<your_ph>
  orp: sensor.<your_orp>
  salinity: sensor.<your_salinity>
automations:
  - entity: automation.<your_filter_start>
    group: filtering
    summary: "Start filter op optimaal tijdstip"
```

## 2. Install the resource

Copy `pool-dashboard.js` to `config/www/pool-dashboard.js` and register it
under **Settings → Dashboards → ⋮ → Resources**:

```yaml
url: /local/pool-dashboard.js
type: module
```

Hard-refresh the browser. On the test dashboard (`dashboard-test`), add the
card via **Edit dashboard → Add card → Manual** and paste your local config.

## 3. What to verify

### Rendering — layers 1–5

- [ ] Status banner shows the correct label/tone for: normal, active (filter
      or heater running), warning (an override active), critical (`has_error`
      on, or salt power below `fault_below_watts` while the salt system is
      on), unavailable (temporarily point a required field at a
      non-existent entity).
- [ ] Chips show water/ambient temperature, pH/ORP/salinity (only when
      configured), and a "N melding(en)" chip when chlorinator diagnostic
      fields are unavailable.
- [ ] Quick controls: filter, heater, target-temperature stepper, salt
      system, boost, swim mode, catch-up mode — each appears only when
      configured.
- [ ] The mode block is disabled with an explanation when `mode:` is not
      configured, and shows the configured options when it is.
- [ ] The automations list shows state, last-triggered time, and a
      "controleren" badge for any entry with a `note`.
- [ ] Settings/diagnostics show setpoints and heat-pump diagnostics, with
      "Niet beschikbaar" for structurally-unavailable chlorinator fields.

### Safe states

- [ ] Point `water_temperature` at a non-existent entity → the whole card
      falls back to "Gegevens niet beschikbaar", and nothing crashes.
- [ ] An `unavailable` toggle entity shows disabled-looking state on the
      next click attempt (the action reports "Apparaat niet beschikbaar").

### Interaction

- [ ] Filter/heater/salt/boost toggles ask for confirmation by default;
      cancelling shows "Actie geannuleerd" and calls no service.
- [ ] Swim mode and catch-up mode toggle **without** a confirmation dialog.
- [ ] The target-temperature stepper's +/− buttons call
      `number.set_value`/`input_number.set_value` immediately (watch the
      entity in Developer Tools).
- [ ] With an override active (e.g. swim mode on), the override banner
      appears with a working "Nu terug naar automatisch" button.
- [ ] Clicking a chip or an automation row opens the Home Assistant
      more-info dialog for that entity.
- [ ] **Only if `mode:` is configured and you want to test it live:**
      clicking a mode button shows the configured `mode.impact` text in the
      confirmation dialog, then calls `script.turn_on` on
      `mode.apply_script` — verify in **Developer Tools → States** /
      **Logbook**, not by assuming.

### Theming

- [ ] Switch your Home Assistant profile theme between light and dark
      (Settings → your profile) — the card follows it automatically, with no
      button of its own.
- [ ] With `theme_mode: light` (then `dark`) set in the config, the card
      keeps that theme regardless of the HA profile setting.

### Responsiveness

- [ ] Resize from a wide desktop down to ~360 px width — no horizontal
      scrolling, layout collapses to a single column.
- [ ] In a Sections dashboard, the card spans the full width.

## 4. Cross-check services (read-only)

In **Developer Tools → States**, confirm each on/off entity's domain matches
what you expect (`switch`, `input_boolean`, `valve` or `button`), and each
setpoint's domain is `number` or `input_number`. The card calls the matching
service for that domain and refuses anything else — see
`docs/configuration.md`.
