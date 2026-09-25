/**
 * Pool Dashboard Card
 * A self-contained Home Assistant Lovelace custom card for a swimming pool:
 * status, quick controls, season/automation overview, history and advanced
 * settings. No external custom cards, themes or helpers required.
 *
 * Lovelace type: custom:pool-dashboard-card
 *
 * The pure helper functions at the top of this file carry no DOM or `window`
 * dependency so they can be unit-tested directly under Node (see test/).
 * See docs/design/proposal.md for the full design rationale.
 */

/* ------------------------------------------------------------------ *
 * Pure helpers (no DOM / no window) — unit tested
 * ------------------------------------------------------------------ */

const UNAVAILABLE_STATES = [
  "unavailable",
  "unknown",
  "none",
  "",
  "null",
  "undefined",
];

const THEME_MODES = ["system", "light", "dark"];

// Literal fallback pairs for the `theme_mode: light|dark` override (§1a of
// docs/design/proposal.md). In "system" mode (the default) none of this is
// used — the card reads Home Assistant's own theme variables instead.
const THEME_TOKENS = {
  dark: {
    "--pd-bg": "#20242d",
    "--pd-bg-raised": "#2b303a",
    "--pd-border": "#343a46",
    "--pd-text": "#f4f6f8",
    "--pd-text-muted": "#8a94a3",
    "--pd-ok": "#7ee787",
    "--pd-info": "#5cc8ff",
    "--pd-warning": "#ffd166",
    "--pd-critical": "#ff6b6b",
    "--pd-offline": "#6f7885",
  },
  light: {
    "--pd-bg": "#ffffff",
    "--pd-bg-raised": "#f7f9fa",
    "--pd-border": "#d8e1dc",
    "--pd-text": "#18231f",
    "--pd-text-muted": "#66736d",
    "--pd-ok": "#1f8a4c",
    "--pd-info": "#0d72a6",
    "--pd-warning": "#8a5a00",
    "--pd-critical": "#b3261e",
    "--pd-offline": "#68727c",
  },
};

// Palette for the illustrated pool scene (layer 1 restyle). These have no
// Home Assistant CSS variable to key off — HA doesn't ship "wood" or
// "pool-equipment-plastic" tokens — so, unlike THEME_TOKENS above, this pair
// is always resolved and applied explicitly (see `_applyIllusPalette`),
// picking dark vs light from `theme_mode` when set, else from
// `hass.themes.darkMode`.
const ILLUS_TOKENS = {
  dark: {
    "--pd-illus-sky-1": "#172336",
    "--pd-illus-sky-2": "#241d17",
    "--pd-illus-yard": "#16130f",
    "--pd-illus-wood-light": "#8c6338",
    "--pd-illus-wood": "#6b4726",
    "--pd-illus-wood-dark": "#3c2614",
    "--pd-illus-water-1": "#0b3a4d",
    "--pd-illus-water-2": "#1e7fa0",
    "--pd-illus-equip": "#423d33",
    "--pd-illus-equip-panel": "#565046",
    "--pd-illus-panel-dark": "#0c0a08",
    "--pd-illus-pump-body": "#726c59",
    "--pd-illus-pump-lid": "#4a4638",
    "--pd-illus-heater-accent": "#eab765",
    "--pd-illus-screen": "#081820",
    "--pd-illus-screen-text": "#79eee0",
  },
  light: {
    "--pd-illus-sky-1": "#cdeaf0",
    "--pd-illus-sky-2": "#eef2df",
    "--pd-illus-yard": "#f3ecdf",
    "--pd-illus-wood-light": "#c89463",
    "--pd-illus-wood": "#a9713f",
    "--pd-illus-wood-dark": "#7a4e27",
    "--pd-illus-water-1": "#1e86ac",
    "--pd-illus-water-2": "#7fdcef",
    "--pd-illus-equip": "#eceae4",
    "--pd-illus-equip-panel": "#cfccc2",
    "--pd-illus-panel-dark": "#201c18",
    "--pd-illus-pump-body": "#c7c4b4",
    "--pd-illus-pump-lid": "#e3e0d3",
    "--pd-illus-heater-accent": "#d9a441",
    "--pd-illus-screen": "#0e2430",
    "--pd-illus-screen-text": "#7df3e6",
  },
};

/**
 * Which of ILLUS_TOKENS.dark/.light applies: the `theme_mode` override when
 * set to "light"/"dark", else Home Assistant's own dark-mode flag
 * (`hass.themes.darkMode`), defaulting to dark when neither is known (no
 * `hass` yet, e.g. the very first render).
 */
function resolveIllusMode(config, hass) {
  const mode = resolveThemeMode(config);
  if (mode === "light" || mode === "dark") return mode;
  return hass?.themes?.darkMode === false ? "light" : "dark";
}

/** Escape a value for safe interpolation into innerHTML. */
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
}

/** True when a raw HA state carries no usable value. */
function isUnavailable(state) {
  if (state === null || state === undefined) return true;
  return UNAVAILABLE_STATES.includes(String(state).trim().toLowerCase());
}

/** Parse a numeric state; returns a finite Number or null. */
function parseNumeric(state) {
  if (isUnavailable(state)) return null;
  const value = Number.parseFloat(state);
  return Number.isFinite(value) ? value : null;
}

/**
 * Resolve the correct service for an on/off action based on the entity's
 * real domain. Returns { domain, service } or null when unsupported.
 * `action` is "start" or "stop". Shared with garden-dashboard's contract.
 */
function actionServiceFor(entityId, action) {
  if (!entityId || typeof entityId !== "string" || !entityId.includes("."))
    return null;
  const domain = entityId.split(".")[0];
  const start = action === "start";
  switch (domain) {
    case "switch":
    case "input_boolean":
      return { domain, service: start ? "turn_on" : "turn_off" };
    case "valve":
      return { domain, service: start ? "open_valve" : "close_valve" };
    case "button":
      return start ? { domain, service: "press" } : null;
    default:
      return null;
  }
}

/**
 * The domain that can be written with `<domain>.set_value` for a numeric
 * setpoint (target temperature, pH/ORP setpoint, chlorination level), or
 * null when the entity is not a settable numeric entity.
 */
function setValueDomain(entityId) {
  if (typeof entityId !== "string") return null;
  const domain = entityId.split(".")[0];
  return domain === "number" || domain === "input_number" ? domain : null;
}

/**
 * Instantaneous running cost of a power-draw reading, in currency/hour —
 * pure arithmetic on two already-live values (Watts, currency/kWh), never a
 * guessed or cumulative figure (POOL-12). Returns null when either input is
 * missing or not a finite, non-negative number, so callers render nothing
 * rather than a bogus estimate.
 */
function estimatedCostPerHour(watts, pricePerKwh) {
  if (typeof watts !== "number" || !Number.isFinite(watts) || watts < 0)
    return null;
  if (
    typeof pricePerKwh !== "number" ||
    !Number.isFinite(pricePerKwh) ||
    pricePerKwh < 0
  )
    return null;
  return (watts / 1000) * pricePerKwh;
}

/** Confirmation is on by default; only an explicit `false` disables it. */
function shouldConfirm(config) {
  return config?.confirm_actions !== false;
}

/**
 * Validate `theme_mode`; anything other than "light"/"dark" resolves to the
 * default "system" (card sets no color overrides, HA's theme decides).
 */
function resolveThemeMode(config) {
  const mode = config?.theme_mode;
  return THEME_MODES.includes(mode) ? mode : "system";
}

/**
 * Author-time impact text for a season-mode target, from `mode.impact`.
 * Never synthesized from live state — the apply script is what actually
 * acts, so the card can only show what the config author wrote down.
 */
function modeImpactSummary(config, targetMode) {
  const text = config?.mode?.impact?.[targetMode];
  return typeof text === "string" && text.trim()
    ? text.trim()
    : "Geen samenvatting geconfigureerd voor deze modus.";
}

/**
 * Which manual overrides are currently active, for the override banner and
 * the "terug naar automatisch" action. Pure: reads only `hass.states`.
 * - swim_mode / catchup_mode: revertible (the card can turn them back off).
 * - heater_manual_conflict: informational only (no single action reverts a
 *   manual heater-on-while-filter-off state — see docs/troubleshooting.md).
 */
function overridesFor(config, hass) {
  const states = hass?.states || {};
  const overrides = [];

  const swimEntity = config?.swim_mode;
  if (swimEntity && String(states[swimEntity]?.state).toLowerCase() === "on") {
    overrides.push({
      key: "swim_mode",
      revertible: true,
      entity: swimEntity,
      label: "Zwemmodus AAN",
      detail:
        "Filter en zoutsysteem staan tijdelijk uit, automatisch terug aan om 20:00 — een geplande start kan de pomp eerder al herstarten.",
    });
  }

  const catchupEntity = config?.filter?.catchup_mode;
  if (
    catchupEntity &&
    String(states[catchupEntity]?.state).toLowerCase() === "on"
  ) {
    overrides.push({
      key: "catchup_mode",
      revertible: true,
      entity: catchupEntity,
      label: "Filter-inhaalmodus AAN",
      detail:
        "Filter loopt buiten het normale schema om ontbrekende uren in te halen.",
    });
  }

  const heaterEntity = config?.heater_power;
  const pumpEntity = config?.filter?.pump;
  if (
    heaterEntity &&
    pumpEntity &&
    String(states[heaterEntity]?.state).toLowerCase() === "on" &&
    String(states[pumpEntity]?.state).toLowerCase() !== "on"
  ) {
    overrides.push({
      key: "heater_manual_conflict",
      revertible: false,
      entity: heaterEntity,
      label: "Warmtepomp handmatig AAN gezet",
      detail:
        'terwijl filter UIT staat: wordt teruggedraaid door "Zwembad Warmtepomp uitschakelen" zodra dat evalueert.',
    });
  }

  return overrides;
}

/** Collect every entity id referenced by a card config (deduplicated). */
function collectEntityIds(config) {
  const ids = new Set();
  const add = (value) => {
    if (typeof value === "string" && value.includes(".")) ids.add(value);
  };
  add(config?.status);
  add(config?.water_temperature);
  add(config?.target_temperature);
  add(config?.ambient_temperature);
  add(config?.heater_power);
  add(config?.has_error);
  add(config?.salt_system_fault);
  add(config?.swim_mode);
  add(config?.comfort_score);
  add(config?.pv_mode);
  add(config?.target_temperature_updated);
  add(config?.energy_price);
  Object.values(config?.filter || {}).forEach(add);
  Object.values(config?.heater || {}).forEach(add);
  Object.values(config?.salt_system || {}).forEach((v) => {
    if (typeof v === "string") add(v);
  });
  Object.values(config?.water_quality || {}).forEach(add);
  add(config?.mode?.select);
  add(config?.mode?.apply_script);
  (config?.automations || []).forEach((a) => add(a?.entity));
  return [...ids];
}

/**
 * True when any tracked entity changed state / relevant attribute between two
 * hass objects. Used to skip needless full re-renders.
 */
function hasRelevantChange(prevHass, nextHass, entityIds) {
  if (!prevHass || !nextHass) return true;
  const prev = prevHass.states || {};
  const next = nextHass.states || {};
  for (const id of entityIds) {
    const a = prev[id];
    const b = next[id];
    if (!a || !b) {
      if (a !== b) return true;
      continue;
    }
    if (a.state !== b.state) return true;
    if (a.last_updated !== b.last_updated) return true;
  }
  return false;
}

/**
 * Simple, point-in-time salt-system flow-fault check: the configured
 * `salt_system_fault` power reading dips below `salt_system.fault_below_watts`
 * (default 15) while `salt_system.power` is switched on. Deliberately not the
 * automation's own time-windowed fault detection — see
 * `salt_system.fault_below_watts` in docs/configuration.md. Shared by
 * `deriveStatus` (critical status banner) and the pool illustration's
 * debietfout pill so the two can never disagree.
 * Returns `{ watts, threshold }` when the fault condition holds, else null.
 */
function saltSystemFault(config, hass) {
  const states = hass?.states || {};
  const faultEntity = config?.salt_system_fault;
  const saltPowerEntity = config?.salt_system?.power;
  if (!faultEntity || !saltPowerEntity) return null;
  const threshold = Number.isFinite(config?.salt_system?.fault_below_watts)
    ? config.salt_system.fault_below_watts
    : 15;
  const saltOn = String(states[saltPowerEntity]?.state).toLowerCase() === "on";
  const watts = parseNumeric(states[faultEntity]?.state);
  if (!saltOn || watts === null || watts >= threshold) return null;
  return { watts, threshold };
}

/**
 * Aggregate the overall pool status from a config + hass snapshot.
 * Pure: reads only `hass.states`. Precedence (highest first):
 *   unavailable > critical > warning > active > normal
 * - unavailable: a required field (status if configured, water/target/
 *   ambient temperature, heater_power) is missing/unavailable/unknown.
 * - critical: heater `has_error` is on, or the salt system shows a power
 *   dip below `salt_system.fault_below_watts` while it is switched on (a
 *   simple point-in-time indicator only — the authoritative, time-windowed
 *   fault detection stays in the automation listed under `automations:`).
 * - warning: a manual override is active (see `overridesFor`).
 * - active: filter, heater or salt system currently running, nothing else
 *   flagged.
 * - normal: nothing running, nothing flagged.
 */
function deriveStatus(config, hass) {
  const states = hass?.states || {};
  const requiredKeys = [
    "water_temperature",
    "target_temperature",
    "ambient_temperature",
    "heater_power",
  ];
  if (config?.status) requiredKeys.push("status");

  for (const key of requiredKeys) {
    const entityId = config?.[key];
    if (!entityId || isUnavailable(states[entityId]?.state)) {
      return {
        key: "unavailable",
        label: "Gegevens niet beschikbaar",
        detail: "Eén of meer verplichte velden zijn niet beschikbaar.",
      };
    }
  }

  const hasErrorEntity = config?.has_error;
  if (
    hasErrorEntity &&
    String(states[hasErrorEntity]?.state).toLowerCase() === "on"
  ) {
    return {
      key: "critical",
      label: "Storing warmtepomp",
      detail:
        states[config?.heater?.error_description]?.state &&
        !isUnavailable(states[config?.heater?.error_description]?.state)
          ? states[config.heater.error_description].state
          : "Zie diagnostiek voor details.",
    };
  }

  const fault = saltSystemFault(config, hass);
  if (fault) {
    return {
      key: "critical",
      label: "Mogelijke debietfout zoutsysteem",
      detail: `Vermogen (${fault.watts} W) onder drempel (${fault.threshold} W) terwijl het zoutsysteem aan staat.`,
    };
  }

  const overrides = overridesFor(config, hass);
  if (overrides.length) {
    return {
      key: "warning",
      label: "Handmatige override actief",
      detail: overrides.map((o) => o.label).join(" · "),
    };
  }

  const running = [
    config?.filter?.pump,
    config?.heater_power,
    config?.salt_system?.power,
  ].some(
    (entityId) =>
      entityId && String(states[entityId]?.state).toLowerCase() === "on",
  );
  if (running) {
    return { key: "active", label: "Alles normaal — actief", detail: "" };
  }

  return { key: "normal", label: "Alles normaal", detail: "" };
}

/**
 * Reduce a raw Home Assistant history/period response for one entity (an
 * array of `{ state, last_changed }` points) into up to `bucketCount`
 * normalized bar heights (0-100). Non-numeric/unavailable points are
 * dropped. Returns null when fewer than two numeric points remain — there
 * is nothing meaningful to draw.
 */
function historyBars(points, bucketCount = 7) {
  if (!Array.isArray(points)) return null;
  const numeric = points
    .map((p) => parseNumeric(p?.state))
    .filter((value) => value !== null);
  if (numeric.length < 2) return null;
  const bucketSize = Math.max(1, Math.ceil(numeric.length / bucketCount));
  const buckets = [];
  for (let i = 0; i < numeric.length; i += bucketSize) {
    const slice = numeric.slice(i, i + bucketSize);
    buckets.push(slice.reduce((sum, v) => sum + v, 0) / slice.length);
  }
  const kept = buckets.slice(-bucketCount);
  const min = Math.min(...kept);
  const max = Math.max(...kept);
  const range = max - min || 1;
  return kept.map((v) => Math.round(((v - min) / range) * 100));
}

/* ------------------------------------------------------------------ *
 * The custom element
 * ------------------------------------------------------------------ */

// In the browser this is the real HTMLElement; under Node (unit tests) the
// class body is never instantiated, so a plain base keeps `require` working.
const CardBase = typeof HTMLElement !== "undefined" ? HTMLElement : class {};

class PoolDashboardCard extends CardBase {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._entityIds = [];
    this._notice = "";
    this._built = false;
    this._history = {};
  }

  static getConfigElement() {
    return document.createElement("pool-dashboard-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Zwembad",
      confirm_actions: true,
      theme_mode: "system",
    };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("pool-dashboard-card: invalid configuration.");
    }
    if (config.automations && !Array.isArray(config.automations)) {
      throw new Error("pool-dashboard-card: `automations` must be a list.");
    }
    this._config = config;
    this._entityIds = collectEntityIds(config);
    this._applyThemeOverride();
    this._applyIllusPalette();
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this._config) return;
    this._maybeLoadHistory();
    // Cheap (a handful of inline custom properties) — re-applied on every
    // push so `theme_mode: system` keeps following HA's live dark-mode
    // toggle, which (unlike the core --pd-* tokens) this palette can't do
    // via CSS var() alone — see ILLUS_TOKENS.
    this._applyIllusPalette();
    if (this._built && prev && !hasRelevantChange(prev, hass, this._entityIds))
      return;
    this._render();
  }

  /**
   * Entities the history group (layer 4) shows a 7-day bar graph for, each
   * with its own label/unit. Water temperature plus, where configured, the
   * power-draw readings added for POOL-9 (filter/heater/salt system) — the
   * same entities the pool illustration's "Verbruik" badges already use —
   * and the water-quality readings added for POOL-10 (pH/ORP/zout).
   */
  _historyEntities() {
    const wq = this._config?.water_quality || {};
    return [
      { key: this._config?.water_temperature, label: "Watertemperatuur" },
      { key: this._config?.filter?.power_draw, label: "Filterpomp" },
      { key: this._config?.heater?.power_draw, label: "Warmtepomp" },
      { key: this._config?.salt_system_fault, label: "Zoutsysteem" },
      { key: wq.ph, label: "pH" },
      { key: wq.orp, label: "ORP" },
      { key: wq.salinity, label: "Zoutgehalte" },
    ].filter((e) => e.key);
  }

  /**
   * Best-effort, one-shot fetch of the last 7 days of history for each
   * `_historyEntities()` entry. Never blocks rendering: while pending or on
   * error that entity's history block shows a plain message instead of
   * bars, independently of the others. Not exercised under Node tests —
   * `hass.callApi` only exists in a real HA frontend.
   */
  _maybeLoadHistory() {
    const entities = this._historyEntities();
    if (!entities.length) return;
    if (typeof this._hass?.callApi !== "function") {
      entities.forEach(({ key }) => {
        if (this._history[key] === undefined)
          this._history[key] = "unsupported";
      });
      return;
    }
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    entities.forEach(({ key: entityId }) => {
      if (this._history[entityId] !== undefined) return;
      this._history[entityId] = "pending";
      this._hass
        .callApi(
          "GET",
          `history/period/${since}?filter_entity_id=${entityId}&minimal_response`,
        )
        .then((result) => {
          this._history[entityId] = Array.isArray(result?.[0]) ? result[0] : [];
          this._render();
        })
        .catch(() => {
          this._history[entityId] = "error";
          this._render();
        });
    });
  }

  getCardSize() {
    const automations = this._config?.automations?.length || 0;
    return 8 + Math.ceil(automations / 4);
  }

  getGridOptions() {
    const layout = this._config?.layout_options || {};
    return {
      columns:
        layout.grid_columns === "full" || layout.grid_columns === undefined
          ? "full"
          : layout.grid_columns,
      rows: layout.grid_rows || "auto",
      min_columns: 6,
    };
  }

  /* --- theming (§1a) ---------------------------------------------- */

  _applyThemeOverride() {
    const mode = resolveThemeMode(this._config);
    const tokens = THEME_TOKENS[mode];
    // Clear any previous override first so switching back to "system"
    // returns full control to HA's own theme variables.
    Object.keys(THEME_TOKENS.dark).forEach((name) =>
      this.style.removeProperty(name),
    );
    if (tokens) {
      Object.entries(tokens).forEach(([name, value]) =>
        this.style.setProperty(name, value),
      );
    }
  }

  _applyIllusPalette() {
    const tokens = ILLUS_TOKENS[resolveIllusMode(this._config, this._hass)];
    Object.entries(tokens).forEach(([name, value]) =>
      this.style.setProperty(name, value),
    );
  }

  /* --- small state accessors ------------------------------------- */

  _obj(entityId) {
    return entityId && this._hass ? this._hass.states[entityId] : undefined;
  }

  _localeLang() {
    return this._hass?.locale?.language || navigator.language || "nl-BE";
  }

  _formatDateTime(value) {
    if (!value) return "--";
    const date =
      typeof value === "number" ? new Date(value) : new Date(String(value));
    if (Number.isNaN(date.getTime())) return "--";
    return new Intl.DateTimeFormat(this._localeLang(), {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  /** Format a measurement with its unit, safely handling missing/unknown. */
  _measure(entityId, { digits = 1, unitOverride } = {}) {
    const obj = this._obj(entityId);
    if (!obj) return { value: "Niet ingesteld", unit: "", available: false };
    if (isUnavailable(obj.state)) {
      return {
        value: obj.state === "unavailable" ? "Niet beschikbaar" : "Onbekend",
        unit: "",
        available: false,
      };
    }
    const numeric = parseNumeric(obj.state);
    const unit = unitOverride ?? obj.attributes?.unit_of_measurement ?? "";
    if (numeric === null) {
      const text = String(obj.state);
      return {
        value: text.length > 32 ? `${text.slice(0, 32)}…` : text,
        unit,
        available: true,
      };
    }
    const rounded = Math.round(numeric * 10 ** digits) / 10 ** digits;
    return { value: String(rounded), unit, available: true };
  }

  _moreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        bubbles: true,
        composed: true,
        detail: { entityId },
      }),
    );
  }

  _confirm(message) {
    if (!shouldConfirm(this._config)) return true;
    return window.confirm(message);
  }

  _notify(message) {
    this._notice = message;
    this._render();
    window.clearTimeout(this._noticeTimer);
    this._noticeTimer = window.setTimeout(() => {
      if (this._notice === message) {
        this._notice = "";
        this._render();
      }
    }, 6000);
  }

  /* --- actions --------------------------------------------------- */

  async _callService(domain, service, data, successMessage) {
    try {
      await this._hass.callService(domain, service, data);
      this._notify(successMessage || `Verzonden: ${domain}.${service}`);
    } catch (error) {
      this._notify(`Fout bij actie: ${error?.message || "onbekende fout"}`);
    }
  }

  /** Toggle an on/off entity via its real domain, with optional confirm. */
  async _toggle(entityId, { confirm = true, label } = {}) {
    if (!entityId) {
      this._notify("Geen entity ingesteld voor deze bediening.");
      return;
    }
    const obj = this._obj(entityId);
    if (!obj || obj.state === "unavailable") {
      this._notify(`Apparaat niet beschikbaar: ${entityId}`);
      this._moreInfo(entityId);
      return;
    }
    const turningOn = String(obj.state).toLowerCase() !== "on";
    const call = actionServiceFor(entityId, turningOn ? "start" : "stop");
    if (!call) {
      this._notify(`Niet-ondersteund domein: ${entityId.split(".")[0]}`);
      this._moreInfo(entityId);
      return;
    }
    if (
      confirm &&
      !this._confirm(
        `${label || entityId} ${turningOn ? "inschakelen" : "uitschakelen"}?`,
      )
    ) {
      this._notify("Actie geannuleerd.");
      return;
    }
    await this._callService(
      call.domain,
      call.service,
      { entity_id: entityId },
      `${label || entityId} ${turningOn ? "ingeschakeld" : "uitgeschakeld"}.`,
    );
  }

  async _setNumber(entityId, value, label) {
    const domain = setValueDomain(entityId);
    if (!domain) {
      this._notify(
        "Waarde kan niet worden ingesteld (geen number/input_number-entity).",
      );
      return;
    }
    await this._callService(
      domain,
      "set_value",
      { entity_id: entityId, value: Number(value) },
      `${label || entityId} ingesteld op ${value}.`,
    );
  }

  /**
   * Shared +/- stepper logic for any writable numeric entity (target
   * temperature, pH/ORP setpoints): reads the entity's own step/min/max
   * attributes when HA reports them, falling back to `defaults` otherwise.
   */
  async _adjustNumber(entityId, delta, label, defaults = {}) {
    const obj = this._obj(entityId);
    const current = parseNumeric(obj?.state);
    if (current === null) {
      this._notify(`${label || entityId} niet beschikbaar.`);
      return;
    }
    const step = Number.isFinite(obj?.attributes?.step)
      ? obj.attributes.step
      : (defaults.step ?? 1);
    const min = Number.isFinite(obj?.attributes?.min)
      ? obj.attributes.min
      : (defaults.min ?? -1000);
    const max = Number.isFinite(obj?.attributes?.max)
      ? obj.attributes.max
      : (defaults.max ?? 1000);
    const next = Math.min(max, Math.max(min, current + delta * step));
    await this._setNumber(entityId, next, label);
  }

  async _adjustTarget(delta) {
    await this._adjustNumber(
      this._config?.target_temperature,
      delta,
      "Doeltemperatuur",
      { step: 0.5, min: 0, max: 40 },
    );
  }

  async _adjustSetpoint(entityId, delta, label) {
    await this._adjustNumber(entityId, delta, label, { step: 0.1 });
  }

  async _revertOverrides() {
    const overrides = overridesFor(this._config, this._hass).filter(
      (o) => o.revertible,
    );
    if (!overrides.length) return;
    if (
      !this._confirm("Alle handmatige overrides terugzetten naar automatisch?")
    ) {
      this._notify("Actie geannuleerd.");
      return;
    }
    for (const override of overrides) {
      await this._toggle(override.entity, {
        confirm: false,
        label: override.label,
      });
    }
  }

  async _applyMode(targetMode) {
    const script = this._config?.mode?.apply_script;
    if (!this._config?.mode?.select || !script) {
      this._notify("Moduswissel is niet geconfigureerd.");
      return;
    }
    const impact = modeImpactSummary(this._config, targetMode);
    if (!this._confirm(`Overschakelen naar "${targetMode}"?\n\n${impact}`)) {
      this._notify("Actie geannuleerd.");
      return;
    }
    await this._callService(
      "script",
      "turn_on",
      { entity_id: script, variables: { mode: targetMode } },
      `Moduswissel naar "${targetMode}" verzonden.`,
    );
  }

  /* --- rendering ------------------------------------------------- */

  _render() {
    if (!this.shadowRoot || !this._config) return;
    const status = deriveStatus(this._config, this._hass || { states: {} });
    const overrides = overridesFor(this._config, this._hass || { states: {} });

    // A full innerHTML rebuild closes every open <details>; remember which
    // ones were open and restore them below so re-renders triggered by a
    // routine hass push don't collapse a section the user just opened.
    const openGroups = new Set(
      [...this.shadowRoot.querySelectorAll("details.group[open]")].map(
        (el) => el.dataset.group,
      ),
    );

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card class="pool-shell">
        <div class="card-head">
          <h2>🏊 ${escapeHtml(this._config.title || "Zwembad")}</h2>
        </div>
        ${this._renderStatusBanner(status)}
        ${overrides.map((o) => this._renderOverrideBanner(o)).join("")}
        <div class="pool-hero-row">
          ${this._renderPoolIllustration()}
          <div class="pool-quick-col">
            ${this._renderControls()}
          </div>
        </div>
        ${this._renderModeGroup()}
        ${this._renderAutomationsGroup()}
        ${this._renderHistoryGroup()}
        ${this._renderSettingsGroup()}
        ${this._notice ? `<div class="notice" role="status">${escapeHtml(this._notice)}</div>` : ""}
      </ha-card>`;

    this.shadowRoot.querySelectorAll("details.group").forEach((el) => {
      if (openGroups.has(el.dataset.group)) el.open = true;
    });

    this._built = true;
    this._bindEvents();
  }

  _bindEvents() {
    const root = this.shadowRoot;
    root
      .querySelectorAll("[data-info]")
      .forEach((el) =>
        el.addEventListener("click", () => this._moreInfo(el.dataset.info)),
      );
    root.querySelectorAll("[data-toggle]").forEach((el) =>
      el.addEventListener("click", () =>
        this._toggle(el.dataset.toggle, {
          confirm: el.dataset.confirm !== "false",
          label: el.dataset.label,
        }),
      ),
    );
    root
      .querySelectorAll("[data-target-step]")
      .forEach((el) =>
        el.addEventListener("click", () =>
          this._adjustTarget(Number(el.dataset.targetStep)),
        ),
      );
    root.querySelectorAll("[data-setpoint-step]").forEach((el) =>
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        this._adjustSetpoint(
          el.dataset.setpointEntity,
          Number(el.dataset.setpointStep),
          el.dataset.setpointLabel,
        );
      }),
    );
    root
      .querySelectorAll("[data-revert]")
      .forEach((el) =>
        el.addEventListener("click", () => this._revertOverrides()),
      );
    root
      .querySelectorAll("[data-mode]")
      .forEach((el) =>
        el.addEventListener("click", () => this._applyMode(el.dataset.mode)),
      );
  }

  _renderStatusBanner(status) {
    const warnLike =
      status.key === "warning" ||
      status.key === "critical" ||
      status.key === "unavailable";
    return `
      <div class="status-banner ${warnLike ? "warn" : ""} tone-${status.key}">
        <div class="ic"><ha-icon icon="${status.key === "normal" || status.key === "active" ? "mdi:check" : "mdi:alert"}"></ha-icon></div>
        <div class="t">
          <b>${escapeHtml(status.label)}</b>
          ${status.detail ? `<span>${escapeHtml(status.detail)}</span>` : ""}
        </div>
      </div>`;
  }

  /**
   * Illustrated pool scene (Fase 3.1/3.2 restyle): a generic wood-decked pool
   * with three illustrated equipment silhouettes (filter pump, salt system,
   * heat pump), badges for live readings, and a debietfout pill driven by
   * `saltSystemFault` — the same check the status banner uses, so the two
   * can never disagree. Geometry (viewBox, positions) is ported 1:1 from the
   * approved design mockup; only fills/labels/values are data-driven.
   */
  _renderPoolIllustration() {
    const water = this._measure(this._config.water_temperature);
    const ambient = this._measure(this._config.ambient_temperature);
    const target = this._measure(this._config.target_temperature);
    const ph = this._measure(this._config.water_quality?.ph);
    const orp = this._measure(this._config.water_quality?.orp, {
      unitOverride: "mV",
    });
    const salinity = this._measure(this._config.water_quality?.salinity);
    const saltPower = this._measure(this._config.salt_system_fault, {
      digits: 0,
    });
    const pumpPower = this._measure(this._config.filter?.power_draw, {
      digits: 0,
    });
    const heaterPower = this._measure(this._config.heater?.power_draw, {
      digits: 0,
    });
    const filterHours = this._measure(this._config.filter?.hours_today);
    const filterTarget = this._measure(this._config.filter?.hours_target, {
      digits: 0,
    });

    const heaterFields = [
      "compressor",
      "circulate_pump",
      "coil_temperature",
      "exhaust_temperature",
      "error_description",
      "proxy_online",
    ];
    const noticeCount = heaterFields.filter((key) => {
      const entityId = this._config.heater?.[key];
      return entityId && isUnavailable(this._obj(entityId)?.state);
    }).length;

    const fault = saltSystemFault(this._config, this._hass || { states: {} });

    const dotFor = (entityId) => {
      if (!entityId) return "muted";
      const state = this._obj(entityId)?.state;
      if (isUnavailable(state)) return "offline";
      return String(state).toLowerCase() === "on" ? "ok" : "muted";
    };

    const pos = (left, top) => `left:${left}%; top:${top}%;`;

    const badge = (left, top, entityId, label, m, { onDark = false } = {}) => `
      <div class="pi-badge${onDark ? " on-dark" : ""}" style="${pos(left, top)}" ${entityId ? `data-info="${escapeHtml(entityId)}"` : ""}>
        <span class="lbl">${escapeHtml(label)}</span>
        <span class="val">${escapeHtml(m.value)}${m.unit ? ` ${escapeHtml(m.unit)}` : ""}</span>
      </div>`;

    const equipLabel = (left, top, entityId, label) => `
      <div class="pi-equip-label" style="${pos(left, top)}" ${entityId ? `data-info="${escapeHtml(entityId)}"` : ""}>
        <span class="dot ${dotFor(entityId)}"></span>${escapeHtml(label)}
      </div>`;

    const pumpLabel = this._config.filter?.label || "Filterpomp";
    const saltLabel = this._config.salt_system?.label || "Zoutsysteem";
    const heaterLabel = this._config.heater?.label || "Warmtepomp";

    return `
      <div class="pool-illustration">
        <div class="pi-scene">
          <svg viewBox="0 0 1040 680" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="pi-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--pd-illus-sky-1)"></stop>
                <stop offset="100%" stop-color="var(--pd-illus-sky-2)"></stop>
              </linearGradient>
              <linearGradient id="pi-water" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stop-color="var(--pd-illus-water-2)"></stop>
                <stop offset="100%" stop-color="var(--pd-illus-water-1)"></stop>
              </linearGradient>
              <clipPath id="pi-wood-clip">
                <polygon points="72,40 728,40 760,72 760,248 728,280 72,280 40,248 40,72"></polygon>
              </clipPath>
              <clipPath id="pi-egg-clip">
                <ellipse cx="865" cy="470" rx="105" ry="135"></ellipse>
              </clipPath>
            </defs>

            <rect x="0" y="0" width="1040" height="680" fill="url(#pi-sky)"></rect>
            <rect x="0" y="310" width="1040" height="370" fill="var(--pd-illus-yard)"></rect>
            <line x1="0" y1="310" x2="1040" y2="310" stroke="var(--pd-border)" stroke-width="2"></line>

            <ellipse cx="400" cy="298" rx="380" ry="16" fill="var(--pd-text)" opacity=".08"></ellipse>

            <polygon points="72,40 728,40 760,72 760,248 728,280 72,280 40,248 40,72" fill="var(--pd-illus-wood)"></polygon>
            <g clip-path="url(#pi-wood-clip)">
              <g stroke="var(--pd-illus-wood-dark)" stroke-width="2" opacity=".4">
                <line x1="20" y1="90" x2="780" y2="90"></line>
                <line x1="20" y1="104" x2="780" y2="104"></line>
                <line x1="20" y1="118" x2="780" y2="118"></line>
                <line x1="20" y1="132" x2="780" y2="132"></line>
                <line x1="20" y1="146" x2="780" y2="146"></line>
                <line x1="20" y1="160" x2="780" y2="160"></line>
                <line x1="20" y1="174" x2="780" y2="174"></line>
                <line x1="20" y1="188" x2="780" y2="188"></line>
                <line x1="20" y1="202" x2="780" y2="202"></line>
                <line x1="20" y1="216" x2="780" y2="216"></line>
                <line x1="20" y1="230" x2="780" y2="230"></line>
                <line x1="20" y1="244" x2="780" y2="244"></line>
                <line x1="20" y1="258" x2="780" y2="258"></line>
              </g>
              <g stroke="var(--pd-illus-wood-dark)" stroke-width="3" opacity=".5">
                <line x1="203" y1="72" x2="203" y2="280"></line>
                <line x1="334" y1="72" x2="334" y2="280"></line>
                <line x1="466" y1="72" x2="466" y2="280"></line>
                <line x1="597" y1="72" x2="597" y2="280"></line>
              </g>
            </g>

            <rect x="72" y="40" width="656" height="18" fill="var(--pd-illus-wood-light)"></rect>
            <rect x="72" y="58" width="656" height="32" fill="url(#pi-water)"></rect>
            <rect x="650" y="62" width="70" height="24" rx="4" fill="var(--pd-illus-water-2)" opacity=".55"></rect>
            <path d="M110,74 Q160,67 210,74 T320,74 T430,74 T540,74 T650,74" fill="none" stroke="var(--pd-illus-sky-1)" stroke-width="2" stroke-linecap="round" opacity=".5"></path>

            <g fill="var(--pd-illus-equip-panel)">
              <polygon points="58,280 90,280 82,304 66,304"></polygon>
              <polygon points="280,280 308,280 302,300 286,300"></polygon>
              <polygon points="500,280 528,280 522,300 506,300"></polygon>
              <polygon points="712,280 744,280 736,304 720,304"></polygon>
            </g>

            <!-- filter pump -->
            <rect x="65" y="610" width="270" height="12" rx="5" fill="var(--pd-illus-wood-dark)" opacity=".2"></rect>
            <rect x="75" y="470" width="140" height="110" rx="50" fill="var(--pd-illus-pump-body)"></rect>
            <rect x="235" y="460" width="140" height="76" rx="36" fill="var(--pd-illus-panel-dark)"></rect>
            <rect x="255" y="480" width="60" height="16" rx="4" fill="var(--pd-illus-equip-panel)" opacity=".7"></rect>
            <rect x="255" y="548" width="60" height="30" rx="9" fill="var(--pd-illus-equip-panel)"></rect>
            <circle cx="270" cy="563" r="5" fill="var(--pd-illus-screen-text)"></circle>
            <circle cx="290" cy="563" r="5" fill="var(--pd-illus-screen-text)"></circle>
            <circle cx="155" cy="478" r="44" fill="var(--pd-illus-pump-lid)" stroke="var(--pd-illus-equip-panel)" stroke-width="4"></circle>
            <circle cx="155" cy="478" r="30" fill="none" stroke="var(--pd-illus-equip-panel)" stroke-width="2" opacity=".5"></circle>
            <circle cx="155" cy="478" r="6" fill="var(--pd-illus-panel-dark)"></circle>

            <!-- salt system -->
            <rect x="410" y="560" width="260" height="40" rx="20" fill="var(--pd-illus-equip)"></rect>
            <circle cx="410" cy="580" r="16" fill="none" stroke="var(--pd-illus-equip-panel)" stroke-width="5"></circle>
            <circle cx="670" cy="580" r="16" fill="none" stroke="var(--pd-illus-equip-panel)" stroke-width="5"></circle>
            <rect x="520" y="522" width="40" height="48" fill="var(--pd-illus-equip-panel)"></rect>
            <rect x="440" y="400" width="200" height="130" rx="28" fill="var(--pd-illus-equip)"></rect>
            <rect x="456" y="416" width="168" height="90" rx="16" fill="var(--pd-illus-panel-dark)"></rect>
            <rect x="482" y="434" width="100" height="34" rx="8" fill="var(--pd-illus-screen)"></rect>
            <circle cx="610" cy="428" r="8" fill="var(--pd-ok)" opacity=".25"></circle>
            <circle cx="610" cy="428" r="5" fill="var(--pd-ok)"></circle>
            <g>
              <circle cx="488" cy="486" r="10" fill="var(--pd-illus-screen-text)" opacity=".2"></circle>
              <circle cx="488" cy="486" r="7" fill="var(--pd-illus-screen-text)"></circle>
              <circle cx="516" cy="486" r="10" fill="var(--pd-illus-screen-text)" opacity=".2"></circle>
              <circle cx="516" cy="486" r="7" fill="var(--pd-illus-screen-text)"></circle>
              <circle cx="544" cy="486" r="10" fill="var(--pd-illus-screen-text)" opacity=".2"></circle>
              <circle cx="544" cy="486" r="7" fill="var(--pd-illus-screen-text)"></circle>
              <circle cx="572" cy="486" r="10" fill="var(--pd-illus-screen-text)" opacity=".2"></circle>
              <circle cx="572" cy="486" r="7" fill="var(--pd-illus-screen-text)"></circle>
            </g>

            <!-- heat pump: scaled down (anchored on its ground shadow) so
                 the "Warmtepomp" equip-label + status dot above it, which
                 sit just above the un-scaled top edge, have clear space
                 instead of touching the outer glow ellipse. -->
            <g transform="translate(865,628) scale(0.82) translate(-865,-628)">
              <ellipse cx="865" cy="475" rx="140" ry="165" fill="var(--pd-illus-heater-accent)" opacity=".12"></ellipse>
              <ellipse cx="865" cy="615" rx="62" ry="13" fill="var(--pd-illus-equip-panel)"></ellipse>
              <rect x="840" y="598" width="50" height="20" fill="var(--pd-illus-equip-panel)"></rect>
              <ellipse cx="865" cy="470" rx="105" ry="135" fill="var(--pd-illus-equip)"></ellipse>
              <g clip-path="url(#pi-egg-clip)">
                <rect x="760" y="335" width="210" height="140" fill="var(--pd-illus-panel-dark)"></rect>
                <g fill="var(--pd-illus-equip-panel)" opacity=".55">
                  <rect x="765" y="335" width="9" height="270"></rect>
                  <rect x="782" y="335" width="9" height="270"></rect>
                  <rect x="799" y="335" width="9" height="270"></rect>
                  <rect x="816" y="335" width="9" height="270"></rect>
                  <rect x="833" y="335" width="9" height="270"></rect>
                  <rect x="850" y="335" width="9" height="270"></rect>
                  <rect x="867" y="335" width="9" height="270"></rect>
                  <rect x="884" y="335" width="9" height="270"></rect>
                  <rect x="901" y="335" width="9" height="270"></rect>
                  <rect x="918" y="335" width="9" height="270"></rect>
                  <rect x="935" y="335" width="9" height="270"></rect>
                  <rect x="952" y="335" width="9" height="270"></rect>
                  <rect x="969" y="335" width="9" height="270"></rect>
                </g>
                <rect x="760" y="475" width="210" height="13" fill="var(--pd-illus-water-2)"></rect>
                <ellipse cx="822" cy="400" rx="38" ry="44" fill="var(--pd-illus-equip)"></ellipse>
                <ellipse cx="908" cy="400" rx="38" ry="44" fill="var(--pd-illus-equip)"></ellipse>
                <circle cx="814" cy="406" r="10" fill="var(--pd-illus-panel-dark)"></circle>
                <circle cx="900" cy="406" r="10" fill="var(--pd-illus-panel-dark)"></circle>
              </g>
              <path d="M845,444 L885,444 L865,464 Z" fill="var(--pd-illus-heater-accent)"></path>
              <rect x="852" y="452" width="26" height="13" rx="3" fill="var(--pd-illus-panel-dark)"></rect>
            </g>
          </svg>

          <div class="pi-overlay">
            ${
              noticeCount > 0
                ? `<div class="pi-alert-badge" style="${pos(8, 4)}"><span class="dot warning"></span>${noticeCount} melding${noticeCount > 1 ? "en" : ""}</div>`
                : ""
            }

            <div class="pi-float-therm ${water.available ? "" : "offline"}" style="${pos(38.5, 10.9)}" ${this._config.water_temperature ? `data-info="${escapeHtml(this._config.water_temperature)}"` : ""}>
              <b>${escapeHtml(water.value)}${water.available ? "°" : ""}</b>
              <span>Water</span>
            </div>
            ${this._config.ambient_temperature ? badge(92.3, 14, this._config.ambient_temperature, "Buiten", ambient) : ""}

            ${equipLabel(19.2, 58.5, this._config.filter?.pump, pumpLabel)}
            ${
              this._config.filter?.hours_today
                ? badge(19.2, 92.9, this._config.filter.hours_today, "Filter", {
                    value: `${filterHours.value}${this._config.filter?.hours_target ? ` / ${filterTarget.value}` : ""}`,
                    unit: "h",
                  })
                : ""
            }
            ${this._config.filter?.power_draw ? badge(28.3, 92.9, this._config.filter.power_draw, "Verbruik", pumpPower) : ""}

            ${equipLabel(51.9, 56.2, this._config.salt_system?.power, saltLabel)}
            ${fault ? `<div class="pi-warn-pill" style="${pos(63.9, 57.6)}">▲ debietfout</div>` : ""}
            ${this._config.water_quality?.ph ? badge(40.4, 92.9, this._config.water_quality.ph, "pH", ph) : ""}
            ${this._config.water_quality?.orp ? badge(49.5, 92.9, this._config.water_quality.orp, "ORP", orp) : ""}
            ${this._config.water_quality?.salinity ? badge(58.7, 92.9, this._config.water_quality.salinity, "Zout", salinity) : ""}
            ${this._config.salt_system_fault ? badge(67.8, 92.9, this._config.salt_system_fault, "Verbruik", saltPower) : ""}

            ${equipLabel(83.2, 47.4, this._config.heater_power, heaterLabel)}
            ${this._config.target_temperature ? badge(78.7, 92.9, this._config.target_temperature, "Doel", target) : ""}
            ${this._config.heater?.power_draw ? badge(87.7, 92.9, this._config.heater.power_draw, "Verbruik", heaterPower) : ""}
          </div>
        </div>
      </div>`;
  }

  _renderOverrideBanner(override) {
    return `
      <div class="override-banner">
        <span class="ic"><ha-icon icon="mdi:alert-circle-outline"></ha-icon></span>
        <div>
          <b>${escapeHtml(override.label)}</b> ${escapeHtml(override.detail)}
          ${override.revertible ? `<button class="back" data-revert>↺ Nu terug naar automatisch</button>` : ""}
        </div>
      </div>`;
  }

  _renderControls() {
    const pumpEntity = this._config.filter?.pump;
    const pumpOn = String(this._obj(pumpEntity)?.state).toLowerCase() === "on";
    const heaterEntity = this._config.heater_power;
    const heaterOn =
      String(this._obj(heaterEntity)?.state).toLowerCase() === "on";
    const saltEntity = this._config.salt_system?.power;
    const saltOn = String(this._obj(saltEntity)?.state).toLowerCase() === "on";
    const boostEntity = this._config.salt_system?.boost;
    const boostOn =
      String(this._obj(boostEntity)?.state).toLowerCase() === "on";
    const swimEntity = this._config.swim_mode;
    const swimOn = String(this._obj(swimEntity)?.state).toLowerCase() === "on";
    const catchupEntity = this._config.filter?.catchup_mode;
    const catchupOn =
      String(this._obj(catchupEntity)?.state).toLowerCase() === "on";

    const targetObj = this._obj(this._config.target_temperature);
    const target = this._measure(this._config.target_temperature);
    const hoursToday = this._measure(this._config.filter?.hours_today, {
      digits: 1,
    });
    const hoursTarget = this._measure(this._config.filter?.hours_target, {
      digits: 0,
    });
    const boostRemaining = this._measure(
      this._config.salt_system?.boost_remaining,
    );

    const heaterWarning =
      heaterEntity && pumpEntity && heaterOn && !pumpOn
        ? `<span class="meta warn">Wordt automatisch teruggedraaid door "Zwembad Warmtepomp uitschakelen"</span>`
        : "";

    const toggleCtrl = (entityId, icon, name, on, meta, confirm = true) =>
      entityId
        ? `<div class="ctrl">
            <div class="row1"><span class="name"><span class="ic">${icon}</span>${escapeHtml(name)}</span>
              <div class="toggle ${on ? "on" : ""}" data-toggle="${escapeHtml(entityId)}" data-confirm="${confirm}" data-label="${escapeHtml(name)}"><i></i></div></div>
            ${meta ? `<span class="meta">${meta}</span>` : ""}
          </div>`
        : "";

    return `
      <div class="section-label" style="margin-bottom:6px;">Snelle bediening</div>
      <div class="controls">
        ${toggleCtrl(pumpEntity, "💧", "Filterpomp", pumpOn, `${hoursToday.value}${hoursToday.unit ? ` ${escapeHtml(hoursToday.unit)}` : ""} / ${hoursTarget.value}${hoursTarget.unit ? ` ${escapeHtml(hoursTarget.unit)}` : ""} vandaag`)}
        ${toggleCtrl(heaterEntity, "🔥", "Warmtepomp", heaterOn, heaterWarning)}
        ${
          targetObj
            ? `<div class="ctrl wide">
              <div class="stepper">
                <span class="name"><span class="ic">🌡️</span>Doeltemperatuur</span>
                <div class="stepper-controls">
                  <button data-target-step="-1" ${!setValueDomain(this._config.target_temperature) ? "disabled" : ""}>−</button>
                  <span class="val">${escapeHtml(target.value)}${target.unit ? escapeHtml(target.unit) : "°"}</span>
                  <button data-target-step="1" ${!setValueDomain(this._config.target_temperature) ? "disabled" : ""}>+</button>
                </div>
              </div>
            </div>`
            : ""
        }
        ${toggleCtrl(saltEntity, "⚗️", "Zoutsysteem", saltOn)}
        ${toggleCtrl(boostEntity, "🚀", "Boost", boostOn, boostOn && boostRemaining.available ? `Nog ${boostRemaining.value}${boostRemaining.unit ? ` ${escapeHtml(boostRemaining.unit)}` : ""}` : "")}
        ${toggleCtrl(swimEntity, "🏊", "Zwemmodus", swimOn, "Schakelt filter/zout nu uit, automatisch terug aan om 20:00", false)}
        ${toggleCtrl(catchupEntity, "⏩", "Filter-inhaalmodus", catchupOn, "", false)}
      </div>`;
  }

  /**
   * One live-state row, shared by the automations group and the mode
   * group's per-mode status list. `compact` (the mode group) drops the
   * summary sub-line and shows a plain aan/uit instead of last-triggered.
   */
  _automationRow(entityId, { summary, note, compact = false } = {}) {
    const obj = this._obj(entityId);
    const known = !!obj;
    const on = known && String(obj.state).toLowerCase() === "on";
    const name =
      obj?.attributes?.friendly_name || entityId || "Onbekende automatisering";
    const lastTriggered = obj?.attributes?.last_triggered
      ? this._formatDateTime(obj.attributes.last_triggered)
      : "—";
    return `
      <div class="auto-row" data-info="${escapeHtml(entityId || "")}">
        <span class="auto-dot ${known && on ? "" : "off"}"></span>
        <div class="auto-t">
          <div class="n">${escapeHtml(name)}</div>
          ${compact ? "" : `<div class="s">${escapeHtml(summary || (known ? "" : "Onbekend — entity niet gevonden"))}</div>`}
        </div>
        ${
          note
            ? `<span class="auto-flag">controleren</span>`
            : `<span class="auto-last">${escapeHtml(known ? (compact ? (on ? "aan" : "uit") : lastTriggered) : "onbekend")}</span>`
        }
      </div>`;
  }

  /**
   * Zomer/winter/lente/herfst-moduswissel. When `mode.automations` maps the
   * active mode value to a list of entity ids (POOL-6 — forward-compatible:
   * meaningless until `mode.select`/`mode.apply_script` name a real
   * `input_select`/`script`, which this repo does not build, see
   * AGENTS.md §5), also lists their live on/off state under the buttons.
   */
  _renderModeGroup() {
    const select = this._config.mode?.select;
    const script = this._config.mode?.apply_script;
    const configured = !!(select && script);
    const current = configured ? this._obj(select)?.state : null;
    const options = configured
      ? this._obj(select)?.attributes?.options || []
      : [];
    const modeAutomations =
      configured && current ? this._config.mode?.automations?.[current] : null;
    const statusRows =
      Array.isArray(modeAutomations) && modeAutomations.length
        ? modeAutomations
            .map((entityId) => this._automationRow(entityId, { compact: true }))
            .join("")
        : "";

    return `
      <details class="group" data-group="mode">
        <summary>Zomer / winter modus <span class="chev">▶</span></summary>
        <div class="body">
          ${
            configured
              ? `<div class="mode-row">
                ${options
                  .map(
                    (opt) =>
                      `<button class="mode-btn ${opt === current ? "active" : ""}" data-mode="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`,
                  )
                  .join("")}
              </div>
              ${
                statusRows
                  ? `<div class="section-label" style="margin:12px 0 6px;">Actief bij "${escapeHtml(current)}"</div>${statusRows}`
                  : ""
              }`
              : `<p class="meta">Moduswissel niet geconfigureerd — voeg <code>mode.select</code> en <code>mode.apply_script</code> toe aan de kaartconfiguratie om dit te activeren.</p>`
          }
        </div>
      </details>`;
  }

  /**
   * Read-only automation overview (POOL-6): grouped under each entry's
   * `group` label when set, in first-seen order, with a live "N actief"
   * summary. Automations without a `group` render flat, unchanged from
   * before this grouping existed — a config that never sets `group` looks
   * exactly as it did.
   */
  _renderAutomationsGroup() {
    const automations = this._config.automations || [];
    if (!automations.length) return "";

    const groupOrder = [];
    const byGroup = new Map();
    automations.forEach((a) => {
      const g = a.group || "";
      if (!byGroup.has(g)) {
        byGroup.set(g, []);
        groupOrder.push(g);
      }
      byGroup.get(g).push(a);
    });

    const activeCount = automations.filter((a) => {
      const obj = this._obj(a.entity);
      return obj && String(obj.state).toLowerCase() === "on";
    }).length;

    const sections = groupOrder
      .map((g) => {
        const rows = byGroup
          .get(g)
          .map((a) =>
            this._automationRow(a.entity, { summary: a.summary, note: a.note }),
          )
          .join("");
        return g
          ? `<div class="auto-group"><div class="auto-group-label">${escapeHtml(g)}</div>${rows}</div>`
          : rows;
      })
      .join("");

    return `
      <details class="group" data-group="automations">
        <summary>Automatiseringen · ${automations.length}<span class="auto-active-count"> · ${activeCount} actief</span> <span class="chev">▶</span></summary>
        <div class="body">${sections}</div>
      </details>`;
  }

  _renderHistoryGroup() {
    const entities = this._historyEntities();
    if (!entities.length) return "";

    const blocks = entities
      .map(({ key, label }) => {
        const entry = this._history?.[key];
        const bars = Array.isArray(entry) ? historyBars(entry) : null;
        const unit = this._obj(key)?.attributes?.unit_of_measurement;
        const inner =
          entry === undefined || entry === "pending"
            ? `<p class="meta">Laden…</p>`
            : bars
              ? `<div class="graph">${bars.map((h) => `<i style="height:${Math.max(4, h)}%"></i>`).join("")}</div>`
              : `<p class="meta">Geen historiek beschikbaar.</p>`;
        return `
          <div class="history-block">
            <div class="section-label" style="margin-bottom:6px;">${escapeHtml(label)}${unit ? ` (${escapeHtml(unit)})` : ""} · 7 dagen</div>
            ${inner}
          </div>`;
      })
      .join("");

    return `
      <details class="group" data-group="history">
        <summary>Historie <span class="chev">▶</span></summary>
        <div class="body" style="padding-top:10px;">${blocks}</div>
      </details>`;
  }

  /**
   * POOL-23: rows are clustered into labelled subsections instead of one
   * flat list — this group has grown past the point where a flat list
   * stays scannable. Empty subsections (no configured entities) render
   * nothing, so the group degrades gracefully for minimal configs.
   */
  _renderSettingsGroup() {
    const wq = this._config.water_quality || {};
    const heater = this._config.heater || {};
    const settingRow = (entityId, label, opts) => {
      if (!entityId) return "";
      const m = this._measure(entityId, opts);
      return `<div class="settings-row" data-info="${escapeHtml(entityId)}"><span class="l">${escapeHtml(label)}</span><span class="v ${m.available ? "" : "unavail"}">${escapeHtml(m.value)}${m.unit ? ` ${escapeHtml(m.unit)}` : ""}</span></div>`;
    };
    const dateRow = (entityId, label) => {
      if (!entityId) return "";
      const obj = this._obj(entityId);
      const known = !!obj && !isUnavailable(obj.state);
      const value = !obj
        ? "Niet ingesteld"
        : known
          ? this._formatDateTime(obj.state)
          : obj.state === "unavailable"
            ? "Niet beschikbaar"
            : "Onbekend";
      return `<div class="settings-row" data-info="${escapeHtml(entityId)}"><span class="l">${escapeHtml(label)}</span><span class="v ${known ? "" : "unavail"}">${escapeHtml(value)}</span></div>`;
    };
    // POOL-17: pH/ORP setpoints are writable (number/input_number), unlike
    // the rest of this group — a +/- stepper instead of the passive
    // settingRow(), reusing the same _setNumber() domain-safe write path as
    // the Quick-controls target-temperature stepper. Falls back to a plain
    // settingRow() when the configured entity isn't a settable domain.
    const setpointRow = (entityId, label, opts = {}) => {
      if (!entityId) return "";
      if (!setValueDomain(entityId)) return settingRow(entityId, label, opts);
      const m = this._measure(entityId, opts);
      return `
        <div class="settings-row setpoint">
          <span class="l">${escapeHtml(label)}</span>
          <span class="stepper-controls mini">
            <button data-setpoint-step="-1" data-setpoint-entity="${escapeHtml(entityId)}" data-setpoint-label="${escapeHtml(label)}" ${!m.available ? "disabled" : ""}>−</button>
            <span class="v">${escapeHtml(m.value)}${m.unit ? ` ${escapeHtml(m.unit)}` : ""}</span>
            <button data-setpoint-step="1" data-setpoint-entity="${escapeHtml(entityId)}" data-setpoint-label="${escapeHtml(label)}" ${!m.available ? "disabled" : ""}>+</button>
          </span>
        </div>`;
    };
    // POOL-12: pure power × price arithmetic, never a guess — renders
    // nothing unless both the power-draw entity and energy_price are live
    // numbers. Reuses the same power-draw sensors the illustration's
    // "Verbruik" badges and the Historie graphs already read.
    const priceEntity = this._config.energy_price;
    const costRow = (wattsEntityId, label) => {
      if (!priceEntity || !wattsEntityId) return "";
      const watts = parseNumeric(this._obj(wattsEntityId)?.state);
      const price = parseNumeric(this._obj(priceEntity)?.state);
      const cost = estimatedCostPerHour(watts, price);
      if (cost === null) return "";
      return `<div class="settings-row" data-info="${escapeHtml(wattsEntityId)}"><span class="l">${escapeHtml(label)}</span><span class="v">€${cost.toFixed(2)}/u</span></div>`;
    };
    const subgroups = [
      {
        title: "Automatisch bijgewerkt",
        rows: [
          settingRow(this._config.comfort_score, "Comfortscore", {
            digits: 0,
            unitOverride: "/ 100",
          }),
          dateRow(
            this._config.target_temperature_updated,
            "Doeltemperatuur laatst aangepast",
          ),
          settingRow(this._config.pv_mode, "PV-modus"),
        ],
      },
      {
        title: "Waterkwaliteit",
        rows: [
          setpointRow(wq.ph_setpoint, "pH-setpoint"),
          setpointRow(wq.orp_setpoint, "ORP-setpoint", {
            unitOverride: "mV",
          }),
          settingRow(
            this._config.salt_system?.chlorination_level,
            "Chlorinatie",
            { unitOverride: "%" },
          ),
        ],
      },
      {
        title: "Verbruikskost",
        rows: [
          costRow(this._config.filter?.power_draw, "Filterpomp verbruik"),
          costRow(this._config.heater?.power_draw, "Warmtepomp verbruik"),
          costRow(this._config.salt_system_fault, "Zoutsysteem verbruik"),
        ],
      },
      {
        title: "Warmtepomp diagnostiek",
        rows: [
          settingRow(heater.mode, "Warmtepomp-modus"),
          settingRow(heater.compressor, "Compressor"),
          settingRow(heater.circulate_pump, "Circulatiepomp"),
          settingRow(heater.coil_temperature, "Coil-temperatuur"),
          settingRow(heater.exhaust_temperature, "Uitlaattemperatuur"),
          settingRow(heater.proxy_online, "Proxy online"),
        ],
      },
    ];
    const body = subgroups
      .map(({ title, rows }) => {
        const content = rows.filter(Boolean).join("");
        return content
          ? `<div class="subgroup"><div class="section-label" style="margin-bottom:6px;">${escapeHtml(title)}</div>${content}</div>`
          : "";
      })
      .join("");
    return `
      <details class="group" data-group="settings">
        <summary>Instellingen &amp; diagnostiek <span class="chev">▶</span></summary>
        <div class="body">${body}</div>
      </details>`;
  }

  _styles() {
    return `
      :host {
        display:block;
        --pd-bg:var(--card-background-color, #20242d);
        --pd-bg-raised:var(--secondary-background-color, #2b303a);
        --pd-border:var(--divider-color, #343a46);
        --pd-text:var(--primary-text-color, #f4f6f8);
        --pd-text-muted:var(--secondary-text-color, #8a94a3);
        --pd-ok:var(--success-color, #7ee787);
        --pd-info:var(--info-color, #5cc8ff);
        --pd-warning:var(--warning-color, #ffd166);
        --pd-critical:var(--error-color, #ff6b6b);
        --pd-offline:var(--disabled-text-color, #6f7885);
        font-family:var(--primary-font-family, Roboto, system-ui, sans-serif);
      }
      ha-card.pool-shell { border:1px solid var(--pd-border); border-radius:18px; background:var(--pd-bg);
        color:var(--pd-text); padding:16px; display:flex; flex-direction:column; gap:16px; overflow:hidden; }
      h1,h2,h3,p { margin:0; }
      button { font:inherit; color:inherit; cursor:pointer; }
      .card-head { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .card-head h2 { font-size:15px; font-weight:700; }

      .status-banner { display:flex; align-items:center; gap:10px; border-radius:12px; padding:10px 12px;
        background:color-mix(in srgb, var(--pd-ok) 12%, transparent); border:1px solid color-mix(in srgb, var(--pd-ok) 30%, transparent); }
      .status-banner.warn { background:color-mix(in srgb, var(--pd-warning) 12%, transparent); border-color:color-mix(in srgb, var(--pd-warning) 32%, transparent); }
      .status-banner.tone-critical, .status-banner.tone-unavailable { background:color-mix(in srgb, var(--pd-critical) 14%, transparent); border-color:color-mix(in srgb, var(--pd-critical) 34%, transparent); }
      .status-banner .ic { width:30px; height:30px; border-radius:9px; flex:none; display:grid; place-items:center;
        background:color-mix(in srgb, var(--pd-ok) 18%, transparent); color:var(--pd-ok); }
      .status-banner.warn .ic { background:color-mix(in srgb, var(--pd-warning) 18%, transparent); color:var(--pd-warning); }
      .status-banner.tone-critical .ic, .status-banner.tone-unavailable .ic { background:color-mix(in srgb, var(--pd-critical) 18%, transparent); color:var(--pd-critical); }
      .status-banner .t b { display:block; font-size:13.5px; font-weight:700; }
      .status-banner .t span { display:block; font-size:11.5px; color:var(--pd-text-muted); margin-top:1px; }

      .chip { display:inline-flex; align-items:center; gap:6px; background:var(--pd-bg-raised); border:1px solid var(--pd-border);
        border-radius:99px; padding:6px 11px 6px 8px; font-size:12px; color:var(--pd-text-muted); font-variant-numeric:tabular-nums; cursor:pointer; }
      .chip .dot { width:7px; height:7px; border-radius:50%; flex:none; background:var(--pd-text-muted); }
      .chip .dot.ok { background:var(--pd-ok); }
      .chip .dot.warning { background:var(--pd-warning); } .chip .dot.offline { background:var(--pd-offline); }
      .chip .dot.muted { background:var(--pd-text-muted); }
      .chip b { color:var(--pd-text); font-weight:700; font-size:12.5px; }

      /* .pool-illustration/.pool-quick-col live in .pool-hero-row's CSS Grid
         (see below), not a flex row — deliberately, after v0.3.0/v0.3.1
         shipped this box collapsed to 0×0 from a flex shrink-to-fit +
         auto-margin interaction (see AGENTS.md changelog). Grid's 1fr
         tracks size from the row's own definite width, not from a child's
         intrinsic content, so they can't repeat that failure mode even
         though every descendant here is still position:absolute/percentage
         width and so still has no intrinsic size of its own. min-width:0
         overrides the grid item's default auto min-size regardless. */
      .pool-hero-row { display:grid; grid-template-columns:1fr 1fr; align-items:start; gap:16px; }
      .pool-hero-row .pool-illustration, .pool-hero-row .pool-quick-col { min-width:0; }
      .pool-quick-col { display:flex; flex-direction:column; gap:10px; }
      @media (max-width:640px) {
        .pool-hero-row { grid-template-columns:1fr; }
      }
      .pool-illustration { width:100%; }
      .pi-scene { position:relative; width:100%; height:0; padding-bottom:65.3846%; border-radius:18px; overflow:hidden; background:var(--pd-illus-yard); }
      .pi-scene svg { position:absolute; inset:0; width:100%; height:100%; display:block; }
      .pi-overlay { position:absolute; inset:0; }

      .pi-badge { position:absolute; transform:translate(-50%,-50%); display:flex; flex-direction:column; align-items:center; gap:1px; cursor:pointer; }
      .pi-badge .lbl { font-size:10px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--pd-text-muted); }
      .pi-badge .val { font-weight:700; font-size:13px; color:var(--pd-illus-screen-text); background:var(--pd-illus-screen);
        border-radius:7px; padding:3px 8px; font-variant-numeric:tabular-nums; white-space:nowrap; }
      .pi-badge.on-dark .lbl { color:color-mix(in srgb, var(--pd-illus-screen-text) 55%, var(--pd-text-muted)); }

      .pi-float-therm { position:absolute; transform:translate(-50%,-50%); width:64px; height:64px; border-radius:50%;
        background:color-mix(in srgb, var(--pd-bg) 88%, transparent); border:3px solid var(--pd-illus-water-2);
        display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer;
        box-shadow:0 4px 10px color-mix(in srgb, var(--pd-text) 22%, transparent); }
      .pi-float-therm b { font-size:14px; font-weight:700; line-height:1; color:var(--pd-text); font-variant-numeric:tabular-nums; }
      .pi-float-therm span { font-size:8px; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--pd-text-muted); margin-top:2px; }
      .pi-float-therm.offline b { font-size:11px; color:var(--pd-offline); }

      .pi-equip-label { position:absolute; transform:translate(-50%,0); font-size:11px; font-weight:700; color:var(--pd-text);
        text-align:center; display:flex; align-items:center; gap:5px; white-space:nowrap; cursor:pointer; }
      .pi-equip-label .dot { width:7px; height:7px; border-radius:50%; flex:none; background:var(--pd-text-muted); }
      .pi-equip-label .dot.ok { background:var(--pd-ok); box-shadow:0 0 6px color-mix(in srgb, var(--pd-ok) 70%, transparent); }
      .pi-equip-label .dot.offline { background:var(--pd-offline); }

      .pi-warn-pill { position:absolute; transform:translate(-50%,-50%); display:inline-flex; align-items:center; gap:5px;
        background:color-mix(in srgb, var(--pd-warning) 20%, var(--pd-bg)); border:1px solid color-mix(in srgb, var(--pd-warning) 45%, transparent);
        color:var(--pd-warning); font-size:10px; font-weight:700; padding:4px 9px 4px 7px; border-radius:99px; white-space:nowrap; }

      .pi-alert-badge { position:absolute; transform:translate(-50%,-50%); display:inline-flex; align-items:center; gap:5px;
        background:color-mix(in srgb, var(--pd-warning) 20%, var(--pd-bg)); border:1px solid color-mix(in srgb, var(--pd-warning) 45%, transparent);
        color:var(--pd-warning); font-size:11px; font-weight:700; padding:4px 10px 4px 8px; border-radius:99px; white-space:nowrap; cursor:default; }
      .pi-alert-badge .dot { width:7px; height:7px; border-radius:50%; background:var(--pd-warning); flex:none; }

      @media (max-width: 480px) {
        .pi-badge .val, .pi-float-therm b { font-size:11px; }
      }

      .override-banner { display:flex; align-items:flex-start; gap:9px; background:color-mix(in srgb, var(--pd-warning) 14%, transparent);
        border:1px solid color-mix(in srgb, var(--pd-warning) 36%, transparent); border-radius:12px; padding:10px 11px; font-size:12px; color:var(--pd-text-muted); }
      .override-banner .ic { color:var(--pd-warning); }
      .override-banner b { color:var(--pd-text); }
      .override-banner .back { margin-top:6px; display:inline-flex; font-size:11.5px; font-weight:700; color:var(--pd-info); background:none; border:none; padding:0; }

      .section-label { font-size:11px; font-weight:700; letter-spacing:.07em; text-transform:uppercase; color:var(--pd-text-muted); margin:2px 0 -4px; }
      .controls { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
      .ctrl { background:var(--pd-bg-raised); border:1px solid var(--pd-border); border-radius:13px; padding:10px 11px; display:flex; flex-direction:column; gap:6px; }
      .ctrl.wide { grid-column:1/-1; }
      .ctrl .row1 { display:flex; align-items:center; justify-content:space-between; gap:6px; }
      .ctrl .name { font-size:12.5px; font-weight:600; display:flex; align-items:center; gap:7px; }
      .toggle { width:34px; height:20px; border-radius:99px; background:var(--pd-border); position:relative; flex:none; }
      .toggle.on { background:color-mix(in srgb, var(--pd-ok) 70%, transparent); }
      .toggle i { position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%; background:#fff; }
      .toggle.on i { left:16px; }
      .ctrl .meta { font-size:11px; color:var(--pd-text-muted); }
      .ctrl .meta.warn { color:var(--pd-warning); }
      .stepper { display:flex; align-items:center; justify-content:space-between; }
      .stepper-controls { display:flex; align-items:center; gap:10px; }
      .stepper .val { font-size:18px; font-weight:700; font-variant-numeric:tabular-nums; }
      .stepper button { width:26px; height:26px; border-radius:8px; border:1px solid var(--pd-border); background:var(--pd-bg); color:var(--pd-text); font-size:14px; }
      .stepper button:disabled { opacity:.4; cursor:not-allowed; }

      .group { border:1px solid var(--pd-border); border-radius:13px; overflow:hidden; background:var(--pd-bg-raised); }
      .group summary { list-style:none; cursor:pointer; display:flex; align-items:center; justify-content:space-between; padding:11px 12px; font-size:12.5px; font-weight:700; }
      .group summary::-webkit-details-marker { display:none; }
      .group[open] summary .chev { transform:rotate(90deg); display:inline-block; }
      .group .body { padding:0 12px 12px; border-top:1px solid var(--pd-border); }
      .group .body p.meta { padding-top:10px; font-size:11px; color:var(--pd-text-muted); line-height:1.5; }

      .auto-row { display:flex; align-items:center; gap:9px; padding:8px 0; border-top:1px solid var(--pd-border); cursor:pointer; }
      .auto-row:first-child { border-top:0; margin-top:10px; }
      .auto-dot { width:7px; height:7px; border-radius:50%; flex:none; background:var(--pd-ok); }
      .auto-dot.off { background:var(--pd-offline); }
      .auto-t { min-width:0; flex:1; }
      .auto-t .n { font-size:12px; font-weight:600; word-break:break-word; }
      .auto-t .s { font-size:11px; color:var(--pd-text-muted); }
      .auto-flag { font-size:10px; background:color-mix(in srgb, var(--pd-warning) 15%, transparent); color:var(--pd-warning);
        border:1px solid color-mix(in srgb, var(--pd-warning) 30%, transparent); padding:2px 7px; border-radius:99px; flex:none; }
      .auto-last { font-size:10.5px; color:var(--pd-text-muted); flex:none; text-align:right; }
      .auto-group { margin-top:10px; }
      .auto-group:first-child { margin-top:0; }
      .auto-group-label { font-size:10.5px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--pd-text-muted);
        padding-top:10px; }
      .auto-group .auto-row:first-child { border-top:0; margin-top:2px; }
      summary .auto-active-count { color:var(--pd-text-muted); font-weight:400; }

      .mode-row { display:flex; gap:6px; margin-top:10px; }
      .mode-btn { flex:1; text-align:center; padding:9px 6px; border-radius:10px; font-size:11.5px; font-weight:700;
        border:1px solid var(--pd-border); background:var(--pd-bg); color:var(--pd-text-muted); }
      .mode-btn.active { background:color-mix(in srgb, var(--pd-info) 16%, transparent); border-color:color-mix(in srgb, var(--pd-info) 45%, transparent); color:var(--pd-info); }

      .settings-row { display:flex; align-items:center; justify-content:space-between; padding:7px 0; border-top:1px solid var(--pd-border); font-size:12px; cursor:pointer; }
      .settings-row:first-child { border-top:0; margin-top:6px; }
      .settings-row .l { color:var(--pd-text-muted); }
      .settings-row .v { font-weight:600; font-variant-numeric:tabular-nums; }
      .settings-row .v.unavail { color:var(--pd-text-muted); font-style:italic; font-weight:400; }
      .subgroup + .subgroup { margin-top:14px; }

      .history-block + .history-block { margin-top:14px; }
      .graph { height:64px; display:flex; align-items:flex-end; gap:3px; background:var(--pd-bg-raised);
        border:1px solid var(--pd-border); border-radius:10px; padding:8px 8px 6px; }
      .graph i { flex:1; border-radius:2px 2px 0 0;
        background:linear-gradient(180deg, var(--pd-info), color-mix(in srgb, var(--pd-info) 25%, transparent)); }

      .notice { padding:10px 14px; border-radius:10px; font-size:13px; background:var(--pd-bg-raised); border:1px solid var(--pd-border); }

      @media (max-width:480px) { .controls { grid-template-columns:1fr 1fr; } }
    `;
  }
}

/* ------------------------------------------------------------------ *
 * Minimal visual editor (optional; full config is YAML)
 * ------------------------------------------------------------------ */

class PoolDashboardCardEditor extends CardBase {
  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _emit(patch) {
    this._config = { ...this._config, ...patch };
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        bubbles: true,
        composed: true,
        detail: { config: this._config },
      }),
    );
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const c = this._config || {};
    this.shadowRoot.innerHTML = `
      <style>
        .ed { display:flex; flex-direction:column; gap:12px; padding:8px 4px; font-family:inherit; }
        label { display:flex; flex-direction:column; gap:4px; font-size:13px; color:var(--secondary-text-color,#888); }
        input[type=text] { padding:8px 10px; border-radius:8px; border:1px solid var(--divider-color,#ccc);
          background:var(--card-background-color,#fff); color:var(--primary-text-color,#222); }
        select { padding:8px 10px; border-radius:8px; border:1px solid var(--divider-color,#ccc);
          background:var(--card-background-color,#fff); color:var(--primary-text-color,#222); }
        .row { display:flex; align-items:center; gap:8px; font-size:14px; color:var(--primary-text-color,#222); }
        .hint { font-size:12px; color:var(--secondary-text-color,#888); line-height:1.4; }
        code { background:var(--secondary-background-color,#eee); padding:1px 5px; border-radius:5px; }
      </style>
      <div class="ed">
        <label>Titel
          <input type="text" id="title" value="${escapeHtml(c.title || "")}" placeholder="Zwembad">
        </label>
        <div class="row">
          <input type="checkbox" id="confirm" ${c.confirm_actions !== false ? "checked" : ""}>
          <span>Bevestiging vragen voor acties</span>
        </div>
        <label>Thema
          <select id="theme_mode">
            <option value="system" ${!c.theme_mode || c.theme_mode === "system" ? "selected" : ""}>Systeem (volgt HA)</option>
            <option value="light" ${c.theme_mode === "light" ? "selected" : ""}>Licht (vast)</option>
            <option value="dark" ${c.theme_mode === "dark" ? "selected" : ""}>Donker (vast)</option>
          </select>
        </label>
        <p class="hint">Entiteiten, modus en automatiseringen worden geconfigureerd via YAML. Zie
          <code>docs/configuration.md</code> voor alle opties, of gebruik de code-editor.</p>
      </div>`;

    this.shadowRoot
      .getElementById("title")
      .addEventListener("input", (e) => this._emit({ title: e.target.value }));
    this.shadowRoot
      .getElementById("confirm")
      .addEventListener("change", (e) =>
        this._emit({ confirm_actions: e.target.checked }),
      );
    this.shadowRoot
      .getElementById("theme_mode")
      .addEventListener("change", (e) =>
        this._emit({ theme_mode: e.target.value }),
      );
  }
}

/* ------------------------------------------------------------------ *
 * Registration (guarded against double definition)
 * ------------------------------------------------------------------ */

if (typeof customElements !== "undefined") {
  if (!customElements.get("pool-dashboard-card")) {
    customElements.define("pool-dashboard-card", PoolDashboardCard);
  }
  if (!customElements.get("pool-dashboard-card-editor")) {
    customElements.define(
      "pool-dashboard-card-editor",
      PoolDashboardCardEditor,
    );
  }
}

if (typeof window !== "undefined") {
  window.customCards = window.customCards || [];
  if (!window.customCards.some((card) => card.type === "pool-dashboard-card")) {
    window.customCards.push({
      type: "pool-dashboard-card",
      name: "Pool Dashboard Card",
      description:
        "Status, bediening, modus en automatiseringen van het zwembad in één kaart.",
      preview: false,
      documentationURL: "https://github.com/ju1ced/pool-dashboard",
    });
  }
}

/* Export pure helpers for Node-based unit tests. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    PoolDashboardCard,
    escapeHtml,
    isUnavailable,
    parseNumeric,
    actionServiceFor,
    setValueDomain,
    estimatedCostPerHour,
    shouldConfirm,
    resolveThemeMode,
    ILLUS_TOKENS,
    resolveIllusMode,
    modeImpactSummary,
    overridesFor,
    collectEntityIds,
    hasRelevantChange,
    deriveStatus,
    saltSystemFault,
    historyBars,
    THEME_TOKENS,
  };
}
