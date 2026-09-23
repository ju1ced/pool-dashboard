# Zwembad dashboard — Fase 2: Ontwerpvoorstel

> Publiek-repo-veilig: uitsluitend fictieve `example_*`-entity-ID's, zelfde conventie als
> `garden-dashboard`. Echte ID's blijven in `docs/discovery/inventory.local.md` (gitignored).
> Status: **voorstel, ter goedkeuring**. Niets hieruit is gebouwd of aan Home Assistant gewijzigd.

## Scope-beslissingen uit Fase 1 (bindend voor dit ontwerp)

- Enkel `/projects/pool`. Geen wijzigingen aan `juiced-dashboard`, `home-dashboard` of Home
  Assistant zelf.
- Testdashboard voor latere validatie: `dashboard-test`.
- Entity-key-contract houdt rekening met home-dashboard's toekomstige integratie, zonder die
  integratie nu te bouwen.

---

## 1. Vorm: zelfstandige HACS-kaart, config-driven

Zelfde architectuur als `garden-dashboard`: één afhankelijkheidsvrije ES-module
(`pool-dashboard.js`), Shadow DOM, geen build-stap, `custom:pool-dashboard-card`. Geen aparte
HA-view nodig — de gebruiker plakt één kaart-YAML in een bestaande view (bv. juiced-dashboard's
`zwembad.yaml`, maar dat gebeurt niet door dit project). Reden om niet te kiezen voor de
`juiced-dashboard`-stijl "losse entities-kaarten + restriction-card" (het huidige zwembad-view):
die aanpak kan geen samengestelde status/waarschuwingen-logica, geen "wat gebeurt er bij
moduswissel"-preview en geen automatisatie-overzicht renderen — dat vereist JS-logica, geen YAML.

```text
pool-dashboard.js
├── Pure helpers (geen DOM/window — unit-testbaar)
│   ├── escapeHtml / isUnavailable / parseNumeric
│   ├── deriveStatus()         → normal | active | warning | critical | unavailable
│   ├── actionServiceFor()     → domein-veilige service-lookup (zoals garden-dashboard)
│   ├── shouldConfirm()
│   ├── setValueDomain()       → number/input_number-lookup voor setpoints (zoals garden-dashboard's durationControlDomain)
│   ├── modeImpactSummary()    → tekstuele preview vóór moduswissel, uit `mode.impact` (auteurstijd, nooit gesynthetiseerd)
│   ├── overridesFor()         → welke handmatige overrides actief zijn (voor de override-banner + "terug naar automatisch")
│   ├── resolveThemeMode()     → theme_mode-config → wel/niet overschrijven van HA-thema-vars (§1a)
│   ├── historyBars()          → history/period-respons → genormaliseerde staafhoogtes voor laag 4
│   └── collectEntityIds() / hasRelevantChange()
├── PoolDashboardCard (custom element)
│   ├── setConfig / set hass / getCardSize / getGridOptions
│   ├── render: status → quick controls → modus → automatiseringen → historie → instellingen
│   └── acties (start/stop, modus wissel, boost, setpoints)
├── PoolDashboardCardEditor (minimale visuele editor)
└── Registratie (guarded define + window.customCards)
```

---

## 1a. Theming: licht/donker volgt het HA-thema, geen eigen toggle in de kaart

**Correctie op eerdere versie van dit voorstel:** de mock-up toonde enkel een vast donker thema
("Juiced Horizon", hardcoded `--jh-*`-kleuren). Dat is verkeerd — net zoals `garden-dashboard`
en `home-dashboard` moet de kaart het **actieve HA-thema** volgen (licht of donker, naargelang
wat de gebruiker/het wandpaneel in HA heeft ingesteld), zonder een eigen zon/maan-knop in de
kaart. Zo'n knop zou tegen HA's eigen thema-instelling ingaan.

**Mechanisme (zoals `garden-dashboard`, `garden-dashboard.js` §`_styles()`):** de kaart leest
HA's native CSS custom properties met een donkere fallback voor standalone-preview buiten HA.
HA vult deze properties zelf in op basis van het actieve thema — licht of donker — dus de kaart
zelf bevat geen licht/donker-logica.

| Kaarttoken        | HA-bron                        | Donkere fallback | Lichte fallback (referentie)                    |
| ----------------- | ------------------------------ | ---------------- | ----------------------------------------------- |
| `--pd-bg`         | `--card-background-color`      | `#20242d`        | `#ffffff`                                       |
| `--pd-bg-raised`  | `--secondary-background-color` | `#2b303a`        | `#f7f9fa`                                       |
| `--pd-border`     | `--divider-color`              | `#343a46`        | `#d8e1dc`-achtig (zie `prototype/styles.css:9`) |
| `--pd-text`       | `--primary-text-color`         | `#f4f6f8`        | `#18231f`-achtig (`prototype/styles.css:7`)     |
| `--pd-text-muted` | `--secondary-text-color`       | `#8a94a3`        | `#66736d`-achtig (`prototype/styles.css:8`)     |
| `--pd-ok`         | `--success-color`              | `#7ee787`        | HA-standaard (thema-afhankelijk)                |
| `--pd-info`       | `--info-color`                 | `#5cc8ff`        | HA-standaard                                    |
| `--pd-warning`    | `--warning-color`              | `#ffd166`        | HA-standaard                                    |
| `--pd-critical`   | `--error-color`                | `#ff6b6b`        | HA-standaard                                    |
| `--pd-offline`    | `--disabled-text-color`        | `#6f7885`        | HA-standaard                                    |

De donkere fallbackwaarden reproduceren de huidige "Juiced Horizon"-look voor wie geen HA-thema
doorgeeft (bv. deze mock-up, of standalone review buiten HA). De lichte referentiewaarden komen
uit reeds gevalideerde tokens in `home-dashboard/prototype/styles.css:3-20` (niet opnieuw
uitgevonden) — puur ter illustratie in de mock-up, want in een echte HA-omgeving levert HA zelf
de effectieve licht/donker-waarden via bovenstaande CSS-variabelen.

**Optionele override — `theme_mode`:** voor het uitzonderingsgeval waarbij een specifiek
wandpaneel altijd hetzelfde thema moet tonen ongeacht de globale HA-instelling (zie §2), kan
`theme_mode: light` of `theme_mode: dark` in de kaartconfig de HA-variabelen overschrijven met
letterlijke waarden — zelfde patroon als home-dashboard's `ThemeMode` (`"system" | "light" |
"dark"`, default `"system"`) in `home-dashboard/src/theme/palettes.ts:3,36-72`, maar zonder
paletkeuze (dat is hier niet gevraagd). Bij `"system"` (default) zet de kaart geen enkele van
bovenstaande variabelen zelf — ze blijven volledig aan HA overgelaten.

---

## 2. Entity-key-contract (config-schema, geen echte ID's)

Top-level sleutels zijn **verbatim** overgenomen van home-dashboard's pool-contract
(`docs/configuration/specialists.md`), zodat een toekomstige samenvattingskaart daar dezelfde
namen kan lezen. Alles wat home-dashboard niet kent, zit genest onder domeingroepen —
géén 25 losse proxy-sensoren plat in hun vocabulaire drukken.

```yaml
type: custom:pool-dashboard-card
title: Zwembad

# Verplicht voor de statussamenvatting (home-dashboard-compatibel, top-level):
status: sensor.example_pool_status # optioneel; afgeleid indien afwezig
water_temperature: sensor.example_pool_water_temperature
target_temperature: input_number.example_pool_target_temperature
ambient_temperature: sensor.example_pool_ambient_temperature
heater_power: input_boolean.example_pool_heater_power

# Optioneel, voor foutdetectie in de statussamenvatting:
has_error: binary_sensor.example_pool_heater_has_error
salt_system_fault: sensor.example_pool_salt_system_power # vermogensval = debietfout

# Optioneel — "zwemmodus": schakelt filter + zoutsysteem tijdelijk uit (zie §7).
# Top-level omdat de override filter én salt_system samen raakt, niet één domeingroep.
swim_mode: input_boolean.example_pool_swim_mode

filter:
  pump: switch.example_pool_filter_pump
  hours_today: sensor.example_pool_filter_hours_today
  hours_target: input_number.example_pool_filter_hours_target
  catchup_mode: input_boolean.example_pool_filter_catchup

heater:
  mode: input_select.example_pool_heater_mode
  compressor: binary_sensor.example_pool_heater_compressor
  circulate_pump: binary_sensor.example_pool_heater_circulate_pump
  coil_temperature: sensor.example_pool_heater_coil_temperature
  exhaust_temperature: sensor.example_pool_heater_exhaust_temperature
  error_description: sensor.example_pool_heater_error_description
  proxy_online: binary_sensor.example_pool_heater_proxy_online

salt_system:
  power: switch.example_pool_salt_system
  chlorination_level: number.example_pool_salt_chlorination_level
  boost: switch.example_pool_salt_boost
  boost_remaining: sensor.example_pool_salt_boost_remaining
  fault_below_watts:
    15 # optioneel; eenvoudige momentopname-drempel voor §8's
    # debietfout-indicator. Puur informatief — de automatisering
    # (met haar 10-minuten-vensterlogica) blijft de bron van waarheid;
    # de kaart herimplementeert die vensterlogica niet.

water_quality:
  ph: sensor.example_pool_ph
  ph_setpoint: number.example_pool_ph_setpoint
  orp: sensor.example_pool_orp
  orp_setpoint: number.example_pool_orp_setpoint
  salinity: sensor.example_pool_salinity

# Optioneel — enkel actief als geconfigureerd (zie §5):
mode:
  select: input_select.example_pool_season_mode # zomer/winter/onderhoud/handmatig
  apply_script: script.example_pool_apply_season_mode
  impact: # auteurstijd-tekst per doelmodus, getoond vóór bevestiging.
    # De kaart toont ENKEL wat hier staat — nooit een gesynthetiseerde
    # samenvatting uit live state, want het script is wat echt handelt.
    # Zonder tekst voor een modus: "geen samenvatting geconfigureerd".
    zomer: "Filter, warmtepomp en zoutsysteem terug op automatisch schema."
    winter: "Filter, zout en warmtepomp expliciet uit. Vorstbeveiliging blijft actief."
    onderhoud: "Alles uit, geen automatische herstart."

# Auteurstijd-configuratie, geen live HA-data (zie §6):
automations:
  - entity: automation.example_pool_filter_start
    group: filtering
    summary: "Start filter op optimaal tijdstip (PV/dringendheid/seizoen)"
  - entity: automation.example_pool_filter_stop
    group: filtering
    summary: "Stopt filter op eindtijd of bij bereikte doeluren"
  - entity: automation.example_pool_pump_start_summer
    group: filtering
    summary: "PV-blinde start-zomer variant"
    note: "dupliceert automation.example_pool_filter_start" # optioneel, auteurstijd, zie §6
  # ... (zie §6 voor volledige lijst/groepering)

confirm_actions: true # default aan, per instantie uitschakelbaar (wandpaneel)
battery_warning: null # n.v.t. voor pool, ter consistentie met garden-dashboard-schema
theme_mode: system # system (default, volgt HA-thema) | light | dark — zie §1a
```

**Watertemperatuur wordt bewust niet hardcoded.** `water_temperature` moet door de gebruiker
gemapt worden naar wélke sensor de verwarmingsautomatiseringen ook gebruiken (vandaag: de
proxy-inlet-sensor) — anders toont de kaart "op temperatuur" terwijl de automatisering het
oneens is. Dit wordt expliciet gedocumenteerd in `docs/configuration.md`, met een waarschuwing.

---

## 3. Informatiearchitectuur (5 lagen, zoals gevraagd)

1. **Status & waarschuwingen** — altijd zichtbaar, bovenaan.
2. **Snelle bediening** — direct onder status, geen scrollen nodig op mobiel.
3. **Planning & automatisaties** — samengevouwen overzicht, uitklapbaar.
4. **Historische informatie** — grafieken, standaard ingeklapt/onderaan.
5. **Geavanceerde instellingen** — setpoints, chlorinator-detail, diagnostiek — achter een
   "Instellingen"-expander of subpagina, nooit in de eerste weergave.

Progressive disclosure via `expander-card`-achtig gedrag **binnen** de kaart zelf (eigen
in-card toggle-state, geen extra HA-resource nodig) — consistent met de Casa-studie in de
Obsidian-vault en met juiced-dashboard's eigen "status mag verdwijnen, bediening/navigatie
blijft"-regel.

---

## 4. Layout per formfactor

- **Mobiel (≤480px, primair doel):** één kolom. Statuschips wrappen. Quick controls als volle-
  breedte knoppenrij (max 2 per rij). Grafieken en instellingen volledig ingeklapt bij eerste
  render.
- **Tablet/wandscherm (481-1024px):** twee kolommen vanaf laag 2 (bediening | modus+automatiseringen
  naast elkaar), status blijft full-width bovenaan.
- **Desktop (>1024px):** drie kolommen mogelijk in de instellingen-laag (warmtepomp-diagnostiek |
  chlorinator-config | historie), maar status/bediening blijven newspaper-style bovenaan voor
  scanbaarheid — geen "wall of cards".
- `getGridOptions()` → `columns: "full"` als default (Sections-layout, zoals garden-dashboard),
  overrideable.

---

## 5. Zomer/wintermodus — flow en vereiste backend (nog niet gebouwd, ter goedkeuring)

**Bevinding uit Fase 1:** er bestaat geen modus-helper. Seizoen zit hardcoded als `now().month`
in 5 automatiseringen. Een schakelaar zonder backend zou puur cosmetisch zijn — expliciet
verboden in de opdracht.

**Voorstel (vereist uw goedkeuring, wordt niet automatisch uitgevoerd):**

1. Nieuwe `input_select.pool_season_mode` met opties `Zomer / Winter / Onderhoud / Handmatig`.
2. Eén nieuw, centraal `script.pool_apply_season_mode` dat, bij wijziging van de select:
   - de betrokken automatiseringen (filter opstarten/stoppen/filteruren, start zomer,
     inhaalmodus) **niet herschrijft**, maar via een `condition`-check op de nieuwe
     `input_select` laat verlopen in plaats van op `now().month` — d.w.z. de 5 automatiseringen
     krijgen een kleine conditie-aanpassing (vervang `now().month`-blok door
     `states('input_select.pool_season_mode')`), niet een volledige herschrijving.
   - bij **Winter**: filter/zout/warmtepomp expliciet uitschakelen, vorstbeveiliging (al
     aanwezig als aparte trigger) blijft actief.
   - bij **Onderhoud**: alles uit, geen automatische herstart (voor de "Handmatige
     override"-behoefte uit de opdracht).
   - één atomische actiesequentie, geen losse service-calls vanuit de kaart zelf — exact zoals
     gevraagd ("voorkom een half uitgevoerde toestand").
3. De kaart **roept enkel** `script.pool_apply_season_mode` aan; ze maakt of wijzigt nooit zelf
   automatiseringen. Het moduswissel-blok in de kaart is **volledig uitgeschakeld** (grijs, met
   uitleg) tenzij `mode.select` én `mode.apply_script` in de config staan — zelfde
   opt-in-gate-patroon als Kia-dashboard's `charger_controls: true`.
4. **Vóór uitvoering** toont de kaart een samenvatting (uit statische, per-modus tekst in de
   kaartconfig, geen live introspectie nodig): welke automatiseringen worden overbrugd, of
   filtering/verwarming/zout aan- of uitgaan, of vorstbeveiliging actief blijft.
5. Dit punt (§5) wordt **niet gebouwd** in Fase 3 zonder apart akkoord — het raakt automatiseringen,
   wat buiten de scope-afspraak "enkel `/projects/pool`" valt. De kaart wordt wél al voorbereid
   om `mode.apply_script` te kunnen aanroepen zodra dat script bestaat.

**Uitgewerkt technisch voorstel** (exacte helper-/script-YAML en het conditie-editpatroon per
automatisering, klaar voor uw goedkeuring): zie `docs/design/season-mode-backend.md`.

---

## 6. Automatisatie-overzicht — wat een Lovelace-kaart wél en niet kan tonen

**Technische beperking (belangrijk om nu vast te leggen, niet pas in Fase 3 te ontdekken):**
een `automation.*` entity geeft via de normale HA-state-API enkel `state` (on/off),
`last_triggered`, `mode` en `current` (aantal actieve runs). **Geen enkele kaart kan** "volgende
geplande uitvoering" of de exacte trigger-conditie live opvragen zonder de admin-websocket-API
(traces), wat een gewone Lovelace-kaart niet hoort te gebruiken. Noch `garden-dashboard`, noch
`ha-kia-connect-dashboard`, noch de huidige `juiced-dashboard/views/zwembad.yaml` toont dit —
geen van de sibling-projecten heeft een automatisatie-overzicht.

**Ontwerp:** de kaart toont per automatisering:

- naam, groep (filtering/verwarming/waterkwaliteit/zout/veiligheid — uit `automations:`-config),
- actief/inactief (live, uit `state`),
- "laatst uitgevoerd" (live, uit `last_triggered`),
- een **auteurstijd-samenvatting** van trigger/voorwaarde (`summary:`/`schedule:` in de config —
  vaste tekst, geen live introspectie), bijgewerkt wanneer de automatisering wijzigt.
- geen "volgende uitvoering" en geen live foutdetectie van de automatisering zelf (wel de
  functionele foutdetectie die al als aparte automatisering bestaat, bv. zoutsysteem-debietfout
  — die heeft een eigen doel-entity en hoort dus bij Status & waarschuwingen, niet hier).

Groepering (uit Fase 1-inventaris, 17 automatiseringen): Filtering (8), Verwarming (4),
Waterkwaliteit/Zout (3 incl. debietfout), overige/legacy gemarkeerd als **mogelijk overbodig**
(dubbele middernacht-stop, PV-blinde start-zomer) — zie inventaris §4. Dit ontwerp toont ze wel
(transparantie), maar markeert ze visueel als "dupliceert [andere automatisering]" zodat de
gebruiker zelf kan beslissen ze op te ruimen — **de kaart ruimt niets zelf op.**

---

## 7. Snelle bediening — lijst en veiligheid

| Control                       | Actie                                                                                            | Bescherming                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filterpomp aan/uit            | `switch.turn_on/off` op `filter.pump`                                                            | Confirm (default aan)                                                                                                                                                                                           |
| Warmtepomp aan/uit            | `input_boolean.turn_on/off` op `heater_power`                                                    | Confirm **+ waarschuwing**: als `filter.pump` uit staat, toont de kaart "wordt automatisch teruggedraaid door _Zwembad Warmtepomp uitschakelen_" (zie Fase 1-conflict §4.4/§4.9) — géén stille override         |
| Doeltemperatuur aanpassen     | `input_number.set_value` op `target_temperature`                                                 | Geen confirm (niet-destructief), debounce tijdens slepen (zoals garden-dashboard's `hasRelevantChange`)                                                                                                         |
| Zoutsysteem aan/uit           | `switch.turn_on/off` op `salt_system.power`                                                      | Confirm                                                                                                                                                                                                         |
| Zout-boost                    | `switch.turn_on` op `salt_system.boost`                                                          | Confirm, toont resterende tijd live                                                                                                                                                                             |
| Zwemmodus                     | toggelt swim-mode helper                                                                         | Geen confirm (bedoeld voor snel gebruik); kaart toont expliciet: "schakelt filter/zout nu uit, automatisch terug aan om 20:00 — een geplande start kan de pomp eerder al herstarten" (uit Fase 1-conflict §4.5) |
| Filter-inhaalmodus            | toggelt catchup-helper                                                                           | Geen confirm                                                                                                                                                                                                    |
| Tijdelijke boost (filter)     | n.v.t. — geen aparte boost-entity voor filter gevonden; **niet gebouwd**, gemeld als ontbrekend  | —                                                                                                                                                                                                               |
| Terug naar automatisch schema | zet alle override-helpers (`zwemmodus`, `catchup_mode`, evt. `mode.select` → vorige modus) terug | Confirm                                                                                                                                                                                                         |

**Override-banner:** zodra `zwemmodus`, `catchup_mode` of `heater_power` afwijkt van wat de kaart
als "automatisch" beschouwt, verschijnt een banner: wat er nu manueel is, wat dit tijdelijk
buiten automatische regeling zet, en één knop "Terug naar automatisch".

Alle service-calls via een domein-veilige lookup (zoals `garden-dashboard`'s `actionServiceFor`,
uitgebreid met `input_select.select_option`, `number.set_value`, `script.turn_on`). Onbekend
domein → geweigerd met duidelijke melding, nooit een gegokte call.

---

## 8. Waarschuwingen en edge cases

- `unavailable`/`unknown` op elk verplicht veld (`status`, temperaturen, `heater_power`) →
  hele statuskaart valt terug op `unavailable`-tone (grijs, "gegevens niet beschikbaar"), quick
  controls voor dat specifieke apparaat disabled, nooit een gegiste 0-waarde tonen.
- 4 chlorinator-velden staan vandaag structureel op `unavailable` (Fase 1 §1.2) — kaart moet dit
  gracieus tonen, niet als storing interpreteren tenzij het net veranderd is.
- Vermogensval-detectie zout (debietfout) → `critical`, prominent, met de automatisering die dit
  al detecteert als bron (geen dubbele logica in de kaart).
- Warmtepomp `has_error` aan → `critical`, toont `error_description` als beschikbaar.
- Drie watertemperatuur-bronnen bestaan (Fase 1 §1.3) — de kaart toont er **één** (de
  geconfigureerde `water_temperature`), met een kleine "i"-tooltip die uitlegt welke sensor dit
  is, om verwarring met de automatiseringslogica te vermijden.
- Moduswissel-blok volledig verborgen/disabled zolang `mode:` niet geconfigureerd is (§5).
- Automatisatie-overzicht toont "onbekend" i.p.v. crash als een geconfigureerde `automation.*`
  entity niet (meer) bestaat.

---

## 9. Benodigde backend-wijzigingen — samenvatting (alles ter goedkeuring, niets gebouwd)

| Wijziging                                                                                                     | Nodig voor                                                                                              | Repo/systeem                                                |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `input_select.pool_season_mode` + `script.pool_apply_season_mode` + conditie-aanpassing in 5 automatiseringen | Niet-cosmetische zomer/winter-modus (§5)                                                                | Home Assistant (na goedkeuring, niet in scope van dit repo) |
| Geen wijziging nodig                                                                                          | Alle overige quick controls, status, historie, automatisatie-overzicht (read-only + bestaande entities) | —                                                           |

Alles behalve de modus-flow kan met de **bestaande** entiteiten en automatiseringen gebouwd
worden — geen andere backend-wijziging is noodzakelijk voor de rest van dit ontwerp.

---

## 10. Fase 3 — hoe getest wordt (aangepast aan scope-beslissing "enkel dit repo")

Een custom card live installeren in `dashboard-test` vereist het plaatsen van `pool-dashboard.js`
op de HA-host en het registreren als Lovelace-resource — beide zijn HA-schrijfacties buiten
`/projects/pool`. Daarom, naar het precedent van `garden-dashboard`:

- **Automatisch:** `node --test` op de pure helpers (`deriveStatus`, `actionServiceFor`,
  `shouldConfirm`, `modeImpactSummary`, `resolveThemeMode`, …), `node --check` syntax,
  structuurcontrole (`scripts/check_required_structure.js`), markdownlint/prettier — allemaal
  lokaal, geen HA nodig.
- **Handmatig:** `docs/home-assistant-testing.md` — een stap-voor-stap checklist die u zelf
  uitvoert (of waarvoor u mij vraagt de kaart-YAML te leveren) na het handmatig toevoegen van de
  resource aan `dashboard-test`. Dekt: normale staten, `unavailable`/`unknown` per veld,
  confirm-dialogen, override-banner, modus-blok uit/aan naargelang config, responsive op
  ~360px/tablet/desktop, **en de kaart in zowel HA's lichte als donkere thema** (thema wisselen
  via HA's eigen profielinstelling, niet via de kaart) plus `theme_mode: light`/`dark`-override.
- Ik lever een **paste-klare YAML-snippet** (fictieve ID's) die u zelf naar uw echte entity-ID's
  kunt mappen en in `dashboard-test` plakt.

---

## 11. Implementatieplan per bestand

```text
pool-dashboard.js                       # kaart + editor + registratie
hacs.json                               # filename: pool-dashboard.js
package.json                            # npm scripts: test/check:syntax/check:structure/lint/verify
README.md
LICENSE
ARCHITECTURE.md                         # zelfde structuur als garden-dashboard/ARCHITECTURE.md
AGENTS.md / CLAUDE.md                   # privacyregels, geen commit/push zonder toestemming,
                                         # nooit live service-calls vanuit tests
docs/
  configuration.md                      # volledig schema (§2), voorbeeld-YAML, watertemp-waarschuwing
  home-assistant-testing.md             # handmatige checklist (§10)
  troubleshooting.md
  design/proposal.md                    # dit document
  discovery/inventory.local.md          # (gitignored) Fase 1, echte entity-ID's
scripts/
  check_required_structure.js
test/
  helpers.test.js                       # deriveStatus, actionServiceFor, shouldConfirm,
                                         # modeImpactSummary, resolveThemeMode, collectEntityIds,
                                         # hasRelevantChange
.github/workflows/ci.yaml               # syntax + structure + markdownlint + prettier + tests
.markdownlint-cli2.yaml / .prettierignore
.gitignore                              # al aangemaakt (*.local.*)
```

---

## 12. Mock-up

Zie visuele render (mobiel + tablet/desktop-breedte, licht + donker):
<https://claude.ai/artifact/8CxWdYypQRBQXTLEx5cfsf>

Toont laag 1 (status), laag 2 (bediening + override-banner) en het ingeklapte laag 3/4/5-patroon,
in zowel het donkere "Juiced Horizon"-thema (`#20242d`-kaarten, zoals gedocumenteerd in Fase 1
§3.3) als een licht thema — zie §1a voor het licht/donker-mechanisme (HA-thema-variabelen, geen
eigen toggle in de kaart zelf). De mock-up bevat, puur als **demo-affordance** om beide te tonen,
een licht/donker-knop op paginaniveau (zelfde patroon als `home-dashboard/prototype/app.js:256-282`
z'n "Donkere modus"/"Lichte modus"-knop) — die knop bestaat niet in de kaart zelf.

---

**Vraagt om uw goedkeuring** vóór verdere implementatie: het geheel van dit ontwerp (§1-4, §6-8,
§10-11) kan gebouwd worden zonder Home Assistant te wijzigen. §5 (moduswissel-backend) vereist
een apart akkoord omdat het automatiseringen raakt.

---

## 13. Fase 3 — schema-aanvullingen tijdens implementatie

Bij het bouwen bleek §7's bedieningstabel drie sleutels te gebruiken die in §2's schema nog
ontbraken. Toegevoegd (zie §2, bijgewerkt): top-level `swim_mode`, `salt_system.fault_below_watts`,
`mode.impact` en, voor §6's "dupliceert [andere automatisering]"-markering, een optioneel
`note`-veld per `automations[]`-item. Geen van deze wijzigt de scope of vereist HA-wijzigingen —
het zijn ontbrekende config-sleutels voor bediening/weergave die al in §6/§7 beschreven stonden.
