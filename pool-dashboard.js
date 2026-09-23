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

  const faultEntity = config?.salt_system_fault;
  const saltPowerEntity = config?.salt_system?.power;
  const faultThreshold = Number.isFinite(config?.salt_system?.fault_below_watts)
    ? config.salt_system.fault_below_watts
    : 15;
  if (faultEntity && saltPowerEntity) {
    const saltOn =
      String(states[saltPowerEntity]?.state).toLowerCase() === "on";
    const watts = parseNumeric(states[faultEntity]?.state);
    if (saltOn && watts !== null && watts < faultThreshold) {
      return {
        key: "critical",
        label: "Mogelijke debietfout zoutsysteem",
        detail: `Vermogen (${watts} W) onder drempel (${faultThreshold} W) terwijl het zoutsysteem aan staat.`,
      };
    }
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
    this._render();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (!this._config) return;
    this._maybeLoadHistory();
    if (this._built && prev && !hasRelevantChange(prev, hass, this._entityIds))
      return;
    this._render();
  }

  /**
   * Best-effort, one-shot fetch of the last 7 days of `water_temperature`
   * history for layer 4. Never blocks rendering: while pending or on error
   * the history group shows a plain message instead of bars. Not exercised
   * under Node tests — `hass.callApi` only exists in a real HA frontend.
   */
  _maybeLoadHistory() {
    const entityId = this._config?.water_temperature;
    if (!entityId) return;
    if (this._history[entityId] !== undefined) return;
    if (typeof this._hass?.callApi !== "function") {
      this._history[entityId] = "unsupported";
      return;
    }
    this._history[entityId] = "pending";
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
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

  async _adjustTarget(delta) {
    const entityId = this._config?.target_temperature;
    const obj = this._obj(entityId);
    const current = parseNumeric(obj?.state);
    if (current === null) {
      this._notify("Doeltemperatuur niet beschikbaar.");
      return;
    }
    const step = Number.isFinite(obj?.attributes?.step)
      ? obj.attributes.step
      : 0.5;
    const min = Number.isFinite(obj?.attributes?.min) ? obj.attributes.min : 0;
    const max = Number.isFinite(obj?.attributes?.max) ? obj.attributes.max : 40;
    const next = Math.min(max, Math.max(min, current + delta * step));
    await this._setNumber(entityId, next, "Doeltemperatuur");
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
        ${this._renderPoolIllustration()}
        ${overrides.map((o) => this._renderOverrideBanner(o)).join("")}
        ${this._renderControls()}
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

  _renderPoolIllustration() {
    const water = this._measure(this._config.water_temperature);
    const ambient = this._measure(this._config.ambient_temperature);
    const ph = this._measure(this._config.water_quality?.ph);
    const orp = this._measure(this._config.water_quality?.orp, {
      unitOverride: "mV",
    });
    const salinity = this._measure(this._config.water_quality?.salinity);

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

    const badge = (dotClass, entityId, label, m) => `
      <span class="chip" ${entityId ? `data-info="${escapeHtml(entityId)}"` : ""}>
        <span class="dot ${dotClass}"></span>${escapeHtml(label)} <b>${escapeHtml(m.value)}${m.unit ? ` ${escapeHtml(m.unit)}` : ""}</b>
      </span>`;

    return `
      <div class="pool-illustration">
        <svg viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="pi-water-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="var(--pd-info)" stop-opacity="0.55"></stop>
              <stop offset="100%" stop-color="var(--pd-info)" stop-opacity="0.16"></stop>
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="600" height="220" rx="22" class="pi-deck"></rect>
          <rect x="12" y="12" width="576" height="196" rx="15" class="pi-water" fill="url(#pi-water-grad)"></rect>
          <path class="pi-wave" d="M12,70 Q 56,56 100,70 T 188,70 T 276,70 T 364,70 T 452,70 T 540,70 T 588,70"></path>
          <path class="pi-wave pi-wave-2" d="M12,126 Q 56,112 100,126 T 188,126 T 276,126 T 364,126 T 452,126 T 540,126 T 588,126"></path>
          <path class="pi-wave pi-wave-3" d="M12,174 Q 56,162 100,174 T 188,174 T 276,174 T 364,174 T 452,174 T 540,174 T 588,174"></path>
        </svg>
        <div class="pi-overlay">
          <div class="pi-top-row">
            ${badge(ambient.available ? "muted" : "offline", this._config.ambient_temperature, "Buiten", ambient)}
            ${noticeCount > 0 ? `<span class="chip pi-alert"><span class="dot warning"></span>${noticeCount} melding${noticeCount > 1 ? "en" : ""}</span>` : ""}
          </div>
          <div class="pi-center" ${this._config.water_temperature ? `data-info="${escapeHtml(this._config.water_temperature)}"` : ""}>
            <span class="pi-water-value ${water.available ? "" : "offline"}"><b>${escapeHtml(water.value)}</b>${water.available && water.unit ? `<small>${escapeHtml(water.unit)}</small>` : ""}</span>
            <span class="pi-water-label">Watertemperatuur</span>
          </div>
          <div class="pi-bottom-row">
            ${this._config.water_quality?.ph ? badge(ph.available ? "ok" : "offline", this._config.water_quality.ph, "pH", ph) : ""}
            ${this._config.water_quality?.orp ? badge(orp.available ? "ok" : "offline", this._config.water_quality.orp, "ORP", orp) : ""}
            ${this._config.water_quality?.salinity ? badge(salinity.available ? "ok" : "offline", this._config.water_quality.salinity, "Zout", salinity) : ""}
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
      <div class="section-label">Snelle bediening</div>
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

  _renderModeGroup() {
    const select = this._config.mode?.select;
    const script = this._config.mode?.apply_script;
    const configured = !!(select && script);
    const current = configured ? this._obj(select)?.state : null;
    const options = configured
      ? this._obj(select)?.attributes?.options || []
      : [];

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
              </div>`
              : `<p class="meta">Moduswissel niet geconfigureerd — voeg <code>mode.select</code> en <code>mode.apply_script</code> toe aan de kaartconfiguratie om dit te activeren.</p>`
          }
        </div>
      </details>`;
  }

  _renderAutomationsGroup() {
    const automations = this._config.automations || [];
    if (!automations.length) return "";

    const rows = automations
      .map((a) => {
        const obj = this._obj(a.entity);
        const known = !!obj;
        const on = known && String(obj.state).toLowerCase() === "on";
        const name =
          obj?.attributes?.friendly_name ||
          a.entity ||
          "Onbekende automatisering";
        const lastTriggered = obj?.attributes?.last_triggered
          ? this._formatDateTime(obj.attributes.last_triggered)
          : "—";
        return `
          <div class="auto-row" data-info="${escapeHtml(a.entity || "")}">
            <span class="auto-dot ${known && on ? "" : "off"}"></span>
            <div class="auto-t">
              <div class="n">${escapeHtml(name)}</div>
              <div class="s">${escapeHtml(a.summary || (known ? "" : "Onbekend — entity niet gevonden"))}</div>
            </div>
            ${a.note ? `<span class="auto-flag">controleren</span>` : `<span class="auto-last">${escapeHtml(known ? lastTriggered : "onbekend")}</span>`}
          </div>`;
      })
      .join("");

    return `
      <details class="group" data-group="automations">
        <summary>Automatiseringen · ${automations.length} <span class="chev">▶</span></summary>
        <div class="body">${rows}</div>
      </details>`;
  }

  _renderHistoryGroup() {
    const entityId = this._config.water_temperature;
    if (!entityId) return "";
    const entry = this._history?.[entityId];
    const bars = Array.isArray(entry) ? historyBars(entry) : null;
    const body =
      entry === undefined || entry === "pending"
        ? `<p class="meta">Historiek laden…</p>`
        : bars
          ? `<div class="section-label" style="margin-bottom:6px;">Watertemperatuur · 7 dagen</div>
             <div class="graph">${bars.map((h) => `<i style="height:${Math.max(4, h)}%"></i>`).join("")}</div>`
          : `<p class="meta">Geen historiek beschikbaar.</p>`;
    return `
      <details class="group" data-group="history">
        <summary>Historie <span class="chev">▶</span></summary>
        <div class="body" style="padding-top:10px;">${body}</div>
      </details>`;
  }

  _renderSettingsGroup() {
    const wq = this._config.water_quality || {};
    const heater = this._config.heater || {};
    const settingRow = (entityId, label, opts) => {
      if (!entityId) return "";
      const m = this._measure(entityId, opts);
      return `<div class="settings-row" data-info="${escapeHtml(entityId)}"><span class="l">${escapeHtml(label)}</span><span class="v ${m.available ? "" : "unavail"}">${escapeHtml(m.value)}${m.unit ? ` ${escapeHtml(m.unit)}` : ""}</span></div>`;
    };
    return `
      <details class="group" data-group="settings">
        <summary>Instellingen &amp; diagnostiek <span class="chev">▶</span></summary>
        <div class="body">
          ${settingRow(wq.ph_setpoint, "pH-setpoint")}
          ${settingRow(wq.orp_setpoint, "ORP-setpoint", { unitOverride: "mV" })}
          ${settingRow(this._config.salt_system?.chlorination_level, "Chlorinatie", { unitOverride: "%" })}
          ${settingRow(heater.mode, "Warmtepomp-modus")}
          ${settingRow(heater.compressor, "Compressor")}
          ${settingRow(heater.circulate_pump, "Circulatiepomp")}
          ${settingRow(heater.coil_temperature, "Coil-temperatuur")}
          ${settingRow(heater.exhaust_temperature, "Uitlaattemperatuur")}
          ${settingRow(heater.proxy_online, "Proxy online")}
        </div>
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

      .pool-illustration { position:relative; border-radius:18px; overflow:hidden; min-height:168px; background:var(--pd-bg-raised); }
      .pool-illustration svg { position:absolute; inset:0; width:100%; height:100%; display:block; }
      .pi-deck { fill:var(--pd-bg-raised); }
      .pi-water { stroke:var(--pd-border); stroke-width:1; }
      .pi-wave { fill:none; stroke:var(--pd-info); stroke-opacity:.4; stroke-width:3; stroke-linecap:round; }
      .pi-wave-2 { stroke-opacity:.25; }
      .pi-wave-3 { stroke-opacity:.14; }
      .pi-overlay { position:relative; z-index:1; display:flex; flex-direction:column; justify-content:space-between;
        min-height:168px; padding:12px 14px 14px; gap:8px; }
      .pi-top-row { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; }
      .pi-alert { background:color-mix(in srgb, var(--pd-warning) 18%, var(--pd-bg-raised)); color:var(--pd-warning);
        border-color:color-mix(in srgb, var(--pd-warning) 42%, transparent); }
      .pi-center { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; text-align:center; cursor:pointer; }
      .pi-water-value { display:inline-flex; align-items:baseline; gap:2px; font-size:34px; font-weight:800; color:var(--pd-text);
        font-variant-numeric:tabular-nums; text-shadow:0 1px 3px color-mix(in srgb, var(--pd-bg) 55%, transparent); }
      .pi-water-value small { font-size:15px; font-weight:700; }
      .pi-water-value.offline { font-size:16px; font-weight:600; color:var(--pd-offline); }
      .pi-water-label { font-size:11px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--pd-text-muted); margin-top:2px; }
      .pi-bottom-row { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; }

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

      .mode-row { display:flex; gap:6px; margin-top:10px; }
      .mode-btn { flex:1; text-align:center; padding:9px 6px; border-radius:10px; font-size:11.5px; font-weight:700;
        border:1px solid var(--pd-border); background:var(--pd-bg); color:var(--pd-text-muted); }
      .mode-btn.active { background:color-mix(in srgb, var(--pd-info) 16%, transparent); border-color:color-mix(in srgb, var(--pd-info) 45%, transparent); color:var(--pd-info); }

      .settings-row { display:flex; align-items:center; justify-content:space-between; padding:7px 0; border-top:1px solid var(--pd-border); font-size:12px; cursor:pointer; }
      .settings-row:first-child { border-top:0; margin-top:6px; }
      .settings-row .l { color:var(--pd-text-muted); }
      .settings-row .v { font-weight:600; font-variant-numeric:tabular-nums; }
      .settings-row .v.unavail { color:var(--pd-text-muted); font-style:italic; font-weight:400; }

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
    shouldConfirm,
    resolveThemeMode,
    modeImpactSummary,
    overridesFor,
    collectEntityIds,
    hasRelevantChange,
    deriveStatus,
    historyBars,
    THEME_TOKENS,
  };
}
