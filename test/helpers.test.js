"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  escapeHtml,
  isUnavailable,
  parseNumeric,
  actionServiceFor,
  setValueDomain,
  estimatedCostPerHour,
  daysSince,
  maintenanceOverdue,
  getConfigPath,
  setConfigPath,
  shouldConfirm,
  resolveThemeMode,
  modeImpactSummary,
  overridesFor,
  collectEntityIds,
  hasRelevantChange,
  deriveStatus,
  saltSystemFault,
  frostProtectionStatus,
  heaterFlowTemperatures,
  historyBars,
  THEME_TOKENS,
  ILLUS_TOKENS,
  resolveIllusMode,
} = require("../pool-dashboard.js");

test("isUnavailable detects the empty states", () => {
  ["unavailable", "unknown", "none", "", null, undefined].forEach((s) =>
    assert.equal(isUnavailable(s), true, `expected ${s} unavailable`),
  );
  assert.equal(isUnavailable("42"), false);
  assert.equal(isUnavailable("on"), false);
});

test("parseNumeric handles invalid numeric values", () => {
  assert.equal(parseNumeric("27.4"), 27.4);
  assert.equal(parseNumeric("abc"), null);
  assert.equal(parseNumeric("unavailable"), null);
  assert.equal(parseNumeric(""), null);
});

test("escapeHtml neutralises HTML injection", () => {
  assert.equal(
    escapeHtml('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
  assert.equal(escapeHtml("a & b"), "a &amp; b");
  assert.equal(escapeHtml(null), "");
});

test("actionServiceFor picks the domain-correct service", () => {
  assert.deepEqual(actionServiceFor("switch.pump", "start"), {
    domain: "switch",
    service: "turn_on",
  });
  assert.deepEqual(actionServiceFor("switch.pump", "stop"), {
    domain: "switch",
    service: "turn_off",
  });
  assert.deepEqual(actionServiceFor("input_boolean.heater", "start"), {
    domain: "input_boolean",
    service: "turn_on",
  });
  assert.deepEqual(actionServiceFor("valve.x", "start"), {
    domain: "valve",
    service: "open_valve",
  });
  assert.deepEqual(actionServiceFor("button.x", "start"), {
    domain: "button",
    service: "press",
  });
});

test("actionServiceFor rejects unsupported / missing entities", () => {
  assert.equal(actionServiceFor("sensor.temperature", "start"), null);
  assert.equal(actionServiceFor("button.x", "stop"), null);
  assert.equal(actionServiceFor(undefined, "start"), null);
  assert.equal(actionServiceFor("notanentity", "start"), null);
});

test("setValueDomain accepts number and input_number only", () => {
  assert.equal(setValueDomain("number.ph_setpoint"), "number");
  assert.equal(
    setValueDomain("input_number.target_temperature"),
    "input_number",
  );
  assert.equal(setValueDomain("sensor.water_temperature"), null);
  assert.equal(setValueDomain("switch.pump"), null);
  assert.equal(setValueDomain(undefined), null);
});

test("shouldConfirm defaults to true, disabled only by explicit false", () => {
  assert.equal(shouldConfirm({}), true);
  assert.equal(shouldConfirm({ confirm_actions: true }), true);
  assert.equal(shouldConfirm({ confirm_actions: false }), false);
  assert.equal(shouldConfirm(undefined), true);
});

test("resolveThemeMode defaults to system, rejects unknown values", () => {
  assert.equal(resolveThemeMode({}), "system");
  assert.equal(resolveThemeMode({ theme_mode: "light" }), "light");
  assert.equal(resolveThemeMode({ theme_mode: "dark" }), "dark");
  assert.equal(resolveThemeMode({ theme_mode: "solarized" }), "system");
  assert.equal(resolveThemeMode(undefined), "system");
});

test("THEME_TOKENS carries a literal light and dark pair for every card token", () => {
  const lightKeys = Object.keys(THEME_TOKENS.light).sort();
  const darkKeys = Object.keys(THEME_TOKENS.dark).sort();
  assert.deepEqual(lightKeys, darkKeys);
  assert.ok(lightKeys.includes("--pd-bg"));
  assert.ok(lightKeys.includes("--pd-critical"));
});

test("modeImpactSummary reads author-time text only, never synthesizes", () => {
  const config = {
    mode: { impact: { zomer: "Filter en zout terug automatisch." } },
  };
  assert.equal(
    modeImpactSummary(config, "zomer"),
    "Filter en zout terug automatisch.",
  );
  assert.equal(
    modeImpactSummary(config, "winter"),
    "Geen samenvatting geconfigureerd voor deze modus.",
  );
  assert.equal(
    modeImpactSummary({}, "zomer"),
    "Geen samenvatting geconfigureerd voor deze modus.",
  );
});

test("overridesFor reports swim mode and catchup mode as revertible", () => {
  const config = {
    swim_mode: "input_boolean.swim",
    filter: { catchup_mode: "input_boolean.catchup" },
  };
  const hass = {
    states: {
      "input_boolean.swim": { state: "on" },
      "input_boolean.catchup": { state: "on" },
    },
  };
  const overrides = overridesFor(config, hass);
  assert.equal(overrides.length, 2);
  assert.ok(overrides.every((o) => o.revertible));
  assert.deepEqual(overrides.map((o) => o.key).sort(), [
    "catchup_mode",
    "swim_mode",
  ]);
});

test("overridesFor flags a heater-on-while-filter-off conflict as informational only", () => {
  const config = {
    heater_power: "input_boolean.heater",
    filter: { pump: "switch.pump" },
  };
  const hass = {
    states: {
      "input_boolean.heater": { state: "on" },
      "switch.pump": { state: "off" },
    },
  };
  const overrides = overridesFor(config, hass);
  assert.equal(overrides.length, 1);
  assert.equal(overrides[0].key, "heater_manual_conflict");
  assert.equal(overrides[0].revertible, false);
});

test("overridesFor returns nothing when nothing is overridden", () => {
  const config = { swim_mode: "input_boolean.swim" };
  const hass = { states: { "input_boolean.swim": { state: "off" } } };
  assert.deepEqual(overridesFor(config, hass), []);
});

test("collectEntityIds gathers every nested entity id", () => {
  const config = {
    status: "sensor.status",
    water_temperature: "sensor.water",
    target_temperature: "input_number.target",
    ambient_temperature: "sensor.ambient",
    heater_power: "input_boolean.heater",
    swim_mode: "input_boolean.swim",
    comfort_score: "input_number.comfort_score",
    pv_mode: "input_boolean.pv",
    target_temperature_updated: "input_datetime.target_updated",
    energy_price: "sensor.energy_price",
    filter: { pump: "switch.pump", catchup_mode: "input_boolean.catchup" },
    salt_system: { power: "switch.salt", fault_below_watts: 15 },
    water_quality: { ph: "sensor.ph" },
    maintenance: {
      filter_cleaned: "input_datetime.filter_cleaned",
      filter_cleaning_interval_days: 90,
      salt_cell_replaced: "input_datetime.salt_cell_replaced",
      salt_cell_lifespan_days: 1095,
    },
    mode: { select: "input_select.mode", apply_script: "script.apply" },
    automations: [{ entity: "automation.filter_start" }],
  };
  const ids = collectEntityIds(config);
  assert.ok(ids.includes("sensor.status"));
  assert.ok(ids.includes("switch.pump"));
  assert.ok(ids.includes("input_select.mode"));
  assert.ok(ids.includes("automation.filter_start"));
  assert.ok(ids.includes("input_number.comfort_score"));
  assert.ok(ids.includes("input_boolean.pv"));
  assert.ok(ids.includes("input_datetime.target_updated"));
  assert.ok(ids.includes("sensor.energy_price"));
  assert.ok(ids.includes("input_datetime.filter_cleaned"));
  assert.ok(ids.includes("input_datetime.salt_cell_replaced"));
  // the numeric threshold must never be treated as an entity id
  assert.ok(!ids.includes(15));
  assert.ok(!ids.includes(90));
  assert.ok(!ids.includes(1095));
  assert.equal(ids.length, new Set(ids).size);
});

test("hasRelevantChange skips renders when tracked entities are unchanged", () => {
  const prev = {
    states: { "sensor.water": { state: "27.4", last_updated: "t1" } },
  };
  const same = {
    states: { "sensor.water": { state: "27.4", last_updated: "t1" } },
  };
  const changed = {
    states: { "sensor.water": { state: "27.6", last_updated: "t2" } },
  };
  assert.equal(hasRelevantChange(prev, same, ["sensor.water"]), false);
  assert.equal(hasRelevantChange(prev, changed, ["sensor.water"]), true);
});

test("deriveStatus: unavailable on a required field wins over everything else", () => {
  const config = {
    water_temperature: "sensor.water",
    target_temperature: "input_number.target",
    ambient_temperature: "sensor.ambient",
    heater_power: "input_boolean.heater",
    has_error: "binary_sensor.error",
  };
  const hass = {
    states: {
      "sensor.water": { state: "unavailable" },
      "input_number.target": { state: "27" },
      "sensor.ambient": { state: "20" },
      "input_boolean.heater": { state: "on" },
      // has_error is "on" too — unavailable must still win.
      "binary_sensor.error": { state: "on" },
    },
  };
  assert.equal(deriveStatus(config, hass).key, "unavailable");
});

test("deriveStatus: critical (has_error) beats warning (override active)", () => {
  const config = {
    water_temperature: "sensor.water",
    target_temperature: "input_number.target",
    ambient_temperature: "sensor.ambient",
    heater_power: "input_boolean.heater",
    has_error: "binary_sensor.error",
    swim_mode: "input_boolean.swim",
  };
  const hass = {
    states: {
      "sensor.water": { state: "27.4" },
      "input_number.target": { state: "27" },
      "sensor.ambient": { state: "20" },
      "input_boolean.heater": { state: "on" },
      "binary_sensor.error": { state: "on" },
      // an override is also active — critical must still win.
      "input_boolean.swim": { state: "on" },
    },
  };
  assert.equal(deriveStatus(config, hass).key, "critical");
});

test("deriveStatus: salt fault is critical only while the salt system is on", () => {
  const base = {
    water_temperature: "sensor.water",
    target_temperature: "input_number.target",
    ambient_temperature: "sensor.ambient",
    heater_power: "input_boolean.heater",
    salt_system_fault: "sensor.salt_power",
    salt_system: { power: "switch.salt", fault_below_watts: 15 },
  };
  const states = {
    "sensor.water": { state: "27.4" },
    "input_number.target": { state: "27" },
    "sensor.ambient": { state: "20" },
    "input_boolean.heater": { state: "off" },
    "sensor.salt_power": { state: "3" },
  };
  assert.equal(
    deriveStatus(base, {
      states: { ...states, "switch.salt": { state: "on" } },
    }).key,
    "critical",
  );
  assert.equal(
    deriveStatus(base, {
      states: { ...states, "switch.salt": { state: "off" } },
    }).key,
    "normal",
  );
});

test("saltSystemFault: the pool illustration's debietfout pill uses the exact same check as deriveStatus", () => {
  const config = {
    salt_system_fault: "sensor.salt_power",
    salt_system: { power: "switch.salt", fault_below_watts: 15 },
  };
  assert.equal(
    saltSystemFault(config, {
      states: {
        "sensor.salt_power": { state: "3" },
        "switch.salt": { state: "on" },
      },
    })?.watts,
    3,
  );
  assert.equal(
    saltSystemFault(config, {
      states: {
        "sensor.salt_power": { state: "3" },
        "switch.salt": { state: "off" },
      },
    }),
    null,
  );
  assert.equal(
    saltSystemFault(config, {
      states: {
        "sensor.salt_power": { state: "20" },
        "switch.salt": { state: "on" },
      },
    }),
    null,
  );
  assert.equal(saltSystemFault({}, { states: {} }), null);
});

test("frostProtectionStatus fires below the configured threshold", () => {
  const config = {
    water_temperature: "sensor.water",
    frost_protection_below: 3,
  };
  assert.deepEqual(
    frostProtectionStatus(config, {
      states: { "sensor.water": { state: "2.4" } },
    }),
    { watertemp: 2.4, threshold: 3 },
  );
  assert.equal(
    frostProtectionStatus(config, {
      states: { "sensor.water": { state: "3" } },
    }),
    null,
  );
  assert.equal(
    frostProtectionStatus(config, {
      states: { "sensor.water": { state: "10" } },
    }),
    null,
  );
});

test("frostProtectionStatus is never active without both fields configured", () => {
  assert.equal(
    frostProtectionStatus(
      { water_temperature: "sensor.water" },
      { states: { "sensor.water": { state: "1" } } },
    ),
    null,
  );
  assert.equal(
    frostProtectionStatus({ frost_protection_below: 3 }, { states: {} }),
    null,
  );
  assert.equal(frostProtectionStatus({}, { states: {} }), null);
});

test("resolveIllusMode: theme_mode override wins, else falls back to hass.themes.darkMode", () => {
  assert.equal(resolveIllusMode({ theme_mode: "light" }, {}), "light");
  assert.equal(resolveIllusMode({ theme_mode: "dark" }, {}), "dark");
  assert.equal(resolveIllusMode({}, { themes: { darkMode: false } }), "light");
  assert.equal(resolveIllusMode({}, { themes: { darkMode: true } }), "dark");
  assert.equal(resolveIllusMode({}, undefined), "dark");
});

test("ILLUS_TOKENS carries a literal light and dark pair for every illustration token", () => {
  const lightKeys = Object.keys(ILLUS_TOKENS.light).sort();
  const darkKeys = Object.keys(ILLUS_TOKENS.dark).sort();
  assert.deepEqual(lightKeys, darkKeys);
  assert.ok(lightKeys.includes("--pd-illus-wood"));
  assert.ok(lightKeys.includes("--pd-illus-water-1"));
});

test("deriveStatus: warning (override) beats active (something running)", () => {
  const config = {
    water_temperature: "sensor.water",
    target_temperature: "input_number.target",
    ambient_temperature: "sensor.ambient",
    heater_power: "input_boolean.heater",
    swim_mode: "input_boolean.swim",
    filter: { pump: "switch.pump" },
  };
  const hass = {
    states: {
      "sensor.water": { state: "27.4" },
      "input_number.target": { state: "27" },
      "sensor.ambient": { state: "20" },
      "input_boolean.heater": { state: "off" },
      "switch.pump": { state: "on" },
      "input_boolean.swim": { state: "on" },
    },
  };
  assert.equal(deriveStatus(config, hass).key, "warning");
});

test("deriveStatus: active when something runs and nothing is flagged", () => {
  const config = {
    water_temperature: "sensor.water",
    target_temperature: "input_number.target",
    ambient_temperature: "sensor.ambient",
    heater_power: "input_boolean.heater",
    filter: { pump: "switch.pump" },
  };
  const hass = {
    states: {
      "sensor.water": { state: "27.4" },
      "input_number.target": { state: "27" },
      "sensor.ambient": { state: "20" },
      "input_boolean.heater": { state: "off" },
      "switch.pump": { state: "on" },
    },
  };
  assert.equal(deriveStatus(config, hass).key, "active");
});

test("deriveStatus: normal when idle and nothing is flagged", () => {
  const config = {
    water_temperature: "sensor.water",
    target_temperature: "input_number.target",
    ambient_temperature: "sensor.ambient",
    heater_power: "input_boolean.heater",
  };
  const hass = {
    states: {
      "sensor.water": { state: "27.4" },
      "input_number.target": { state: "27" },
      "sensor.ambient": { state: "20" },
      "input_boolean.heater": { state: "off" },
    },
  };
  assert.equal(deriveStatus(config, hass).key, "normal");
});

test("historyBars normalizes bucketed values into 0-100 heights", () => {
  const points = [
    { state: "25" },
    { state: "26" },
    { state: "27" },
    { state: "28" },
    { state: "29" },
    { state: "30" },
  ];
  const bars = historyBars(points, 3);
  assert.equal(bars.length, 3);
  assert.equal(bars[0], 0);
  assert.equal(bars[bars.length - 1], 100);
  bars.forEach((h) => {
    assert.ok(h >= 0 && h <= 100);
  });
});

test("historyBars ignores unavailable/unknown points", () => {
  const points = [
    { state: "unavailable" },
    { state: "25" },
    { state: "unknown" },
    { state: "27" },
  ];
  assert.deepEqual(historyBars(points, 5), [0, 100]);
});

test("historyBars returns null with fewer than two numeric points", () => {
  assert.equal(historyBars([]), null);
  assert.equal(historyBars([{ state: "25" }]), null);
  assert.equal(
    historyBars([{ state: "unavailable" }, { state: "unknown" }]),
    null,
  );
  assert.equal(historyBars(null), null);
});

test("estimatedCostPerHour computes power x price, never a guess", () => {
  assert.ok(Math.abs(estimatedCostPerHour(1500, 0.3) - 0.45) < 1e-9);
  assert.equal(estimatedCostPerHour(0, 0.3), 0);
});

test("estimatedCostPerHour returns null on missing/invalid inputs", () => {
  assert.equal(estimatedCostPerHour(null, 0.3), null);
  assert.equal(estimatedCostPerHour(1500, null), null);
  assert.equal(estimatedCostPerHour(NaN, 0.3), null);
  assert.equal(estimatedCostPerHour(-5, 0.3), null);
  assert.equal(estimatedCostPerHour(1500, -0.1), null);
});

test("daysSince computes whole elapsed days from a date string", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.equal(daysSince("2026-09-18", now), 10);
  assert.equal(daysSince("2026-09-28T12:00:00Z", now), 0);
});

test("daysSince returns null for missing/invalid/future dates", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  assert.equal(daysSince(null, now), null);
  assert.equal(daysSince(undefined, now), null);
  assert.equal(daysSince("not-a-date", now), null);
  assert.equal(daysSince("2026-10-05", now), null);
});

test("maintenanceOverdue flags once elapsed days reach the interval", () => {
  assert.equal(maintenanceOverdue(89, 90), false);
  assert.equal(maintenanceOverdue(90, 90), true);
  assert.equal(maintenanceOverdue(200, 90), true);
});

test("maintenanceOverdue is never true without a valid days count or interval", () => {
  assert.equal(maintenanceOverdue(null, 90), false);
  assert.equal(maintenanceOverdue(200, null), false);
  assert.equal(maintenanceOverdue(200, 0), false);
  assert.equal(maintenanceOverdue(200, -5), false);
  assert.equal(maintenanceOverdue(200, NaN), false);
});

test("deriveStatus: a misconfigured (missing) required field is treated as unavailable", () => {
  const config = {
    target_temperature: "input_number.target",
    ambient_temperature: "sensor.ambient",
    heater_power: "input_boolean.heater",
    // water_temperature intentionally omitted
  };
  const hass = {
    states: {
      "input_number.target": { state: "27" },
      "sensor.ambient": { state: "20" },
      "input_boolean.heater": { state: "off" },
    },
  };
  assert.equal(deriveStatus(config, hass).key, "unavailable");
});

test("getConfigPath reads top-level and nested fields", () => {
  const config = { title: "Zwembad", filter: { pump: "switch.pump" } };
  assert.equal(getConfigPath(config, "title"), "Zwembad");
  assert.equal(getConfigPath(config, "filter.pump"), "switch.pump");
  assert.equal(getConfigPath(config, "filter.missing"), undefined);
  assert.equal(getConfigPath(config, "heater.mode"), undefined);
});

test("setConfigPath writes top-level and nested fields immutably", () => {
  const config = { filter: { pump: "switch.pump" } };
  const next = setConfigPath(config, "filter.hours_today", "sensor.hours");
  assert.equal(next.filter.hours_today, "sensor.hours");
  assert.equal(next.filter.pump, "switch.pump");
  // original config is untouched
  assert.equal(config.filter.hours_today, undefined);

  const top = setConfigPath(config, "title", "Zwembad");
  assert.equal(top.title, "Zwembad");
});

test("setConfigPath deletes the key on undefined instead of storing it", () => {
  const config = { title: "Zwembad", filter: { pump: "switch.pump" } };
  const next = setConfigPath(config, "title", undefined);
  assert.ok(!("title" in next));

  const nested = setConfigPath(config, "filter.pump", undefined);
  assert.ok(!("pump" in nested.filter));
});

test("heaterFlowTemperatures pairs inlet/outlet only while the heater runs", () => {
  const config = {
    water_temperature: "sensor.inlet",
    heater_power: "input_boolean.heater",
    heater: { outlet_temperature: "sensor.outlet" },
  };
  assert.deepEqual(
    heaterFlowTemperatures(config, {
      states: {
        "sensor.inlet": { state: "27.4" },
        "sensor.outlet": { state: "29.1" },
        "input_boolean.heater": { state: "on" },
      },
    }),
    { inlet: 27.4, outlet: 29.1 },
  );
  assert.equal(
    heaterFlowTemperatures(config, {
      states: {
        "sensor.inlet": { state: "27.4" },
        "sensor.outlet": { state: "29.1" },
        "input_boolean.heater": { state: "off" },
      },
    }),
    null,
  );
});

test("heaterFlowTemperatures is never active without both readings configured and live", () => {
  assert.equal(
    heaterFlowTemperatures(
      {
        water_temperature: "sensor.inlet",
        heater_power: "input_boolean.heater",
      },
      {
        states: {
          "sensor.inlet": { state: "27.4" },
          "input_boolean.heater": { state: "on" },
        },
      },
    ),
    null,
  );
  assert.equal(
    heaterFlowTemperatures(
      {
        water_temperature: "sensor.inlet",
        heater_power: "input_boolean.heater",
        heater: { outlet_temperature: "sensor.outlet" },
      },
      {
        states: {
          "sensor.inlet": { state: "unavailable" },
          "sensor.outlet": { state: "29.1" },
          "input_boolean.heater": { state: "on" },
        },
      },
    ),
    null,
  );
  assert.equal(heaterFlowTemperatures({}, { states: {} }), null);
});
