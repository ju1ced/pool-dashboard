# Troubleshooting

## The card shows "Custom element doesn't exist: pool-dashboard-card"

- The resource is not loaded. Verify it under **Settings → Dashboards → ⋮ →
  Resources** points to `/hacsfiles/pool-dashboard/pool-dashboard.js` (HACS)
  or `/local/pool-dashboard.js` (manual) with `type: module`.
- Hard-refresh the browser (cache). On mobile, fully close and reopen the app.
- After an upgrade, bump the cache by reloading resources or appending
  `?v=2` to the resource URL.

## The whole card shows "Gegevens niet beschikbaar"

One of the required fields (`water_temperature`, `target_temperature`,
`ambient_temperature`, `heater_power`, or `status` if configured) is missing
from the config or its entity is `unavailable`/`unknown`. Check the mapping
and the entity's state in **Developer Tools → States**.

## A chlorinator diagnostic field always shows "Niet beschikbaar"

This is expected on some installs — several `heater.*` diagnostic fields
(compressor, circulate pump, coil/exhaust temperature, error description,
proxy online) can be structurally unavailable depending on your proxy
device's connectivity. The card shows this gracefully and **deliberately
does not escalate it to a warning or critical status** — only a soft "N
melding(en)" chip notes how many are currently unavailable. If a field that
normally reports a value suddenly goes unavailable, that is a real
connectivity problem worth investigating in Developer Tools, but the card
itself has no way to distinguish "always unavailable" from "just went
unavailable" without extra state history, so it treats both the same.

## The status banner says "critical — mogelijke debietfout zoutsysteem"

The `salt_system_fault` sensor's reading dropped below
`salt_system.fault_below_watts` (default 15 W) while `salt_system.power` is
on. This is a simple, instantaneous check for display purposes only — it is
not the same as the automation's own fault detection, which is
time-windowed (see `ARCHITECTURE.md`). If this fires on a normal, brief power
dip, raise `fault_below_watts` or lower it if it is missing real faults; the
automation itself remains the authoritative source — check its trace before
assuming the card is wrong.

## Start/stop does nothing, or says "Niet-ondersteund domein"

The card calls the service that matches the entity's real domain
(`switch`/`input_boolean`/`valve`/`button` for on/off,
`number`/`input_number` for setpoints). If the entity is something else, the
action is refused rather than firing a wrong service call. Confirm the
domain in Developer Tools and map the correct entity.

## The target-temperature stepper's +/− buttons are greyed out

`target_temperature` is not a `number.*` or `input_number.*` entity, so
there is nothing to write a new value to. Map it to the correct helper.

## The mode block is greyed out with an explanation

`mode.select` and `mode.apply_script` are not both configured. This block is
deliberately opt-in — see `docs/configuration.md`'s "mode" section and
`docs/design/proposal.md` §5 for why the backend script is not built by this
repository.

## The mode confirmation dialog says "Geen samenvatting geconfigureerd"

You configured `mode.select`/`mode.apply_script` but did not add a matching
entry under `mode.impact` for that specific target value. The card never
invents a summary of what a mode change will do — it only shows what you
wrote. Add the missing `mode.impact.<value>` entry.

## The override banner has no "terug naar automatisch" button

That is expected for the heater-on-while-filter-off conflict specifically —
there is no single safe action that resolves it automatically (turning the
heater off might not be what you want, and turning the filter on changes a
different piece of equipment). Resolve it manually, or configure your
automations so this state cannot occur. Swim mode and filter catch-up mode
**do** get a working revert button, since turning either off is
unambiguously safe.

## Confirmation dialog appears every time

That is the default safety behaviour for actions that change physical
equipment state. Set `confirm_actions: false` on the card to disable it
(recommended only on a trusted device). Swim mode and catch-up mode never
confirm, by design — see `docs/design/proposal.md` §7.

## Layout is too narrow / not full width

Add `layout_options: { grid_columns: full }`. In a Sections dashboard the
card already reports full width via `getGridOptions()`.

## The card looks the same in light and dark HA themes

The card reads Home Assistant's own theme variables — if it looks the same,
your active theme likely defines the same colors for both, or a
`theme_mode: light`/`dark` override is set in the card config (check for
that key first). There is no toggle in the card itself; theme comes from
Home Assistant.

## Reporting a problem

Include your card YAML with entity IDs redacted, a screenshot, and the
browser console output (F12 → Console). Never paste real long-lived tokens
or secrets.
