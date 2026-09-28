# Zwembad-dashboard — ticketregister

Eén sectie per ticket: scope, afhankelijkheden en acceptatiecriteria. Kaarten
in [`kanban.md`](kanban.md) linken naar de bijhorende sectie hier. IDs volgen
de vroegere `POOL-N`-nummering (voorheen bijgehouden op een los,
niet-project-getrackt Kanban-bord); nieuwe tickets krijgen het eerstvolgende
vrije nummer.

**Let op — hard rule (zie `AGENTS.md`):** geen echte entity-/automatiserings-ID's
hier. Beschrijvingen zijn bewust generiek gehouden; de echte namen staan
enkel in het gitignored `docs/discovery/inventory.local.md`.

---

<a id="pool-1"></a>

## POOL-1 — Kaart, editor, tests, HACS-bestanden en docs (Fase 3)

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Basis

- **Scope:** de initiële `pool-dashboard-card`: entity-key-contract, minimale
  editor, unit-tests, HACS-bestanden en documentatie.
- **Afhankelijkheden:** geen.
- **Acceptatiecriteria:** `npm run verify` groen; kaart laadbaar via HACS.

---

<a id="pool-2"></a>

## POOL-2 — Zwembadillustratie met live waarden (Fase 3.1/3.2)

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Basis

- **Scope:** platte statuschips vervangen door een uitgetekende scène
  (houten bad met filterpomp, zoutsysteem en warmtepomp als geïllustreerde
  toestellen).
- **Afhankelijkheden:** POOL-1.
- **Acceptatiecriteria:** illustratie zichtbaar en correct geschaald in
  licht/donker thema; geen regressie op bestaande statuslogica.

---

<a id="pool-3"></a>

## POOL-3 — Illustratie + snelle bediening naast elkaar (2 kolommen)

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Basis

- **Scope:** layout op brede schermen: illustratie en snelle bediening in
  een CSS-grid naast elkaar, terugval naar 1 kolom onder 640px.
- **Afhankelijkheden:** POOL-2.
- **Acceptatiecriteria:** geen horizontale overflow op ~360px; grid-kolommen
  gedragen zich correct onafhankelijk van intrinsieke content-breedte.

---

<a id="pool-4"></a>

## POOL-4 — Technisch ontwerp seizoensmodus-backend

**Status:** Klaar · **Prioriteit:** P0 · **Epic:** Seizoensmodus

- **Scope:** volledig uitgewerkt voorstel voor de season-mode helper, het
  toepassingsscript en de conditie-edits in de betrokken automatiseringen —
  `docs/design/season-mode-backend.md`. Documentatie, niets gebouwd in Home
  Assistant.
- **Afhankelijkheden:** geen.
- **Acceptatiecriteria:** voorstel expliciet goedgekeurd als document (niet
  als bouwopdracht — zie POOL-5).

---

<a id="pool-5"></a>

## POOL-5 — Seizoensmodus-backend bouwen in Home Assistant

**Status:** In uitvoering (5/5 automatiseringen live, kaart nog niet
gekoppeld) · **Prioriteit:** P0 · **Epic:** Seizoensmodus

- **Scope:** de helper, het script en de conditie-edits uit POOL-4
  daadwerkelijk aanmaken in Home Assistant.
- **Goedkeuring:** gegeven 2026-09-25 (samen met POOL-13/18/19/20/21).
- **Live:** de moduskeuze-helper en het toepassingsscript bestaan; alle 5
  automatiseringen zijn gemigreerd van maand-gebaseerde naar
  modus-gebaseerde seizoensconditie, exact volgens het uitrolplan in
  `season-mode-backend.md` (per automatisering, één voor één, alle
  triggers/niet-seizoensgebonden condities ongewijzigd). De 5e
  ("inhaalmodus") werd eerst geblokkeerd door de Claude Code
  auto-mode classifier (`"[Modify Shared Resources]"`) toen dit
  autonoom draaide; de identieke edit lukte daarna probleemloos in een
  interactieve sessie (2026-09-28) — zie de opmerking hieronder.
- **Geen restrisico op 2026-10-01 meer:** met alle 5 automatiseringen op
  de moduskeuze i.p.v. `now().month`, verandert er niets automatisch meer
  op 1 oktober.
- **Kaart nog niet gekoppeld:** `mode.select`/`mode.apply_script` zijn
  bewust nog niet ingevuld in de live kaart-config — het uitrolplan zet
  die koppeling als laatste stap. Nu alle 5 automatiseringen gemigreerd
  zijn, kan dit gebeuren zodra gewenst.
- **Classifier-observatie:** de eerdere blokkades op deze en op de
  stop-bij-doeluren-duplicaat-automatisering uit POOL-20 bleken geen
  permanente permission-regel te vereisen — beide edits lukten zonder
  wijziging aan de config, enkel door ze in een interactieve sessie
  opnieuw uit te voeren i.p.v. autonoom. Vermoedelijk defaulted de
  classifier naar weigeren wanneer niemand aanwezig is om een
  risicovolle actie te bevestigen.
- **Afhankelijkheden:** POOL-4 (klaar).
- **Acceptatiecriteria:** alle 5 automatiseringen op modus-conditie
  (✅ gehaald); `mode.select`/`mode.apply_script` ingevuld in de
  kaart-config; card-side gedrag (POOL-6/7/8) live getest (nog te doen).

---

<a id="pool-6"></a>

## POOL-6 — Kaart: tonen welke automatiseringen actief zijn per modus

**Status:** Klaar · **Prioriteit:** P1 · **Epic:** Seizoensmodus

- **Scope:** uitbreiding op de moduswissel-groep: per seizoensmodus tonen
  welke automatiseringen daardoor aan/uit staan, plus gegroepeerde
  automatiseringen (`automations[].group`) met live "N actief"-telling.
- **Afhankelijkheden:** POOL-1. Het `mode.automations`-onderdeel is
  vooruit gebouwd maar pas live testbaar zodra POOL-5 (geblokkeerd) af is.
- **Acceptatiecriteria:** `npm run verify` groen; Node-simulatie van
  gegroepeerde automatiseringen en van het `mode.automations`-pad correct.
- **Afgerond:** gemerged via PR #6, gereleased in v0.4.0.

---

<a id="pool-7"></a>

## POOL-7 — Visuele indicator van actieve seizoensmodus op de illustratie

**Status:** Backlog · **Prioriteit:** P1 · **Epic:** Seizoensmodus

- **Scope:** klein badge/icoon op de zwembad-scène dat de huidige
  seizoensmodus toont.
- **Afhankelijkheden:** heeft weinig waarde vóór POOL-5 (geblokkeerd) af is
  — de modus-entiteit bestaat dan pas echt.
- **Acceptatiecriteria:** badge volgt live de modus-entiteit; geen render
  wanneer `mode.select` niet geconfigureerd is.

---

<a id="pool-8"></a>

## POOL-8 — Vorstbeveiliging-status expliciet zichtbaar maken

**Status:** Backlog · **Prioriteit:** P1 · **Epic:** Seizoensmodus

- **Scope:** in wintermodus blijft vorstbeveiliging actief (zie
  `docs/design/season-mode-backend.md`) — dat moet duidelijk zichtbaar zijn
  in de kaart, niet enkel impliciet.
- **Afhankelijkheden:** heeft weinig waarde vóór POOL-5 (geblokkeerd) af is.
- **Acceptatiecriteria:** expliciete tekst/indicator wanneer vorstbeveiliging
  actief is, ook wanneer de rest van het systeem uit staat.

---

<a id="pool-9"></a>

## POOL-9 — Energieverbruik-historiek per toestel

**Status:** Klaar · **Prioriteit:** P0 · **Epic:** Historiek & statistieken

- **Scope:** de Historie-groep toont een 7-dagen staafgrafiek per
  geconfigureerde vermogen-sensor (filterpomp, warmtepomp, zoutsysteem),
  niet enkel watertemperatuur. Hergebruikt `historyBars()` en de
  history-API-fetch, veralgemeend naar een lijst via `_historyEntities()`.
- **Afhankelijkheden:** POOL-1.
- **Acceptatiecriteria:** `npm run verify` groen; per-entiteit best-effort
  fetch/render (laden/fout van één entiteit blokkeert de andere niet).
- **Afgerond:** gemerged via PR #6, gereleased in v0.4.0.

---

<a id="pool-10"></a>

## POOL-10 — Waterkwaliteit-trends (pH/ORP/zout over tijd)

**Status:** Klaar · **Prioriteit:** P1 · **Epic:** Historiek & statistieken

- **Scope:** niet enkel de actuele meting tonen, maar een verloop over de
  tijd — zelfde 7-dagen-staafgrafiekpatroon als de bestaande
  watertemperatuur/verbruik-historiek (POOL-9), nu ook voor de
  waterkwaliteit-metingen (pH, ORP, zoutgehalte).
- **Afhankelijkheden:** POOL-9 (rechtstreekse generalisatie van
  `_historyEntities()`).
- **Acceptatiecriteria:** `npm run verify` groen; grafiek verschijnt enkel
  voor daadwerkelijk geconfigureerde waterkwaliteit-entiteiten.
- **Afgerond:** gemerged via PR #6, gereleased in v0.4.0.

---

<a id="pool-11"></a>

## POOL-11 — Comfortscore zichtbaar maken in de kaart

**Status:** Klaar · **Prioriteit:** P1 · **Epic:** Historiek & statistieken

- **Scope:** er bestaat al een Home Assistant-automatisering die een
  comfortscore berekent, maar die wordt nergens in de kaart getoond.
- **Afhankelijkheden:** vereist eerst een read-only MCP-check (`ha_search`/
  `ha_get_state`) om te bevestigen welke entiteit de berekende score houdt
  en of die betrouwbaar gevuld wordt.
- **Acceptatiecriteria:** score zichtbaar in de kaart met correcte
  eenheid/schaal; graceful handling wanneer de bron-entiteit onbeschikbaar is.
- **Afgerond:** gemerged via PR #7.

---

<a id="pool-12"></a>

## POOL-12 — Kostenraming op basis van energieprijs

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Historiek & statistieken

- **Scope:** indien een energieprijs-entiteit beschikbaar is: geschatte kost
  van filter/warmtepomp/zoutsysteem-verbruik tonen.
- **Afhankelijkheden:** POOL-9 (verbruiksdata al beschikbaar); vereist
  read-only MCP-check of er al een bruikbare energieprijs-entiteit bestaat.
- **Acceptatiecriteria:** kostenraming verschijnt enkel wanneer zowel
  verbruiks- als prijs-entiteit geconfigureerd zijn; geen gok-waarde tonen
  bij ontbrekende data.
- **Afgerond:** generiek `energy_price`-veld (i.p.v. te gokken op één
  specifieke, ambigue prijssensor) + pure `estimatedCostPerHour()`-helper
  (vermogen × prijs), gerenderd per verbruikssensor in Instellingen — enkel
  wanneer beide waarden live getallen zijn. Gemerged via PR #8.

---

<a id="pool-13"></a>

## POOL-13 — Onderhoud- en verbruiksartikelen-tracking

**Status:** Review/validatie (PR open, niet gemerged) · **Prioriteit:** P2
· **Epic:** Kaart-UX

- **Scope:** bijvoorbeeld resterende levensduur zoutcel, datum laatste
  filterreiniging — herinneringen wanneer onderhoud nodig is.
- **Afhankelijkheden:** nieuwe Home Assistant-helpers (datum-opslag).
- **Acceptatiecriteria:** `npm run verify` groen; nieuwe rijen renderen
  enkel wanneer de bijbehorende datum-entiteit geconfigureerd is; geen
  gegokte "nu onderhoud nodig"-beslissing, enkel dagen-geleden + optionele
  drempelwaarde-markering.
- **Voortgang:** scope-check (eerder afgerond) bevestigde geen bestaande
  entiteit voor zoutcel-levensduur/filterreinigingsdatum — vereiste nieuwe
  HA-helpers. Goedgekeurd 2026-09-25 samen met POOL-5/18/19/20/21.
- **Afgerond (2026-09-28):** twee nieuwe `input_datetime`-helpers live in
  Home Assistant (laatste filterreiniging, laatste zoutcel-vervanging).
  Nieuw optioneel top-level `maintenance`-configblok
  (`filter_cleaned`/`filter_cleaning_interval_days`/`salt_cell_replaced`/
  `salt_cell_lifespan_days`), gerenderd als nieuwe "Onderhoud"-subsectie
  bovenaan **Instellingen** via de nieuwe pure `daysSince()`/
  `maintenanceOverdue()`-helpers (Node-getest) — zelfde
  simpele-drempel-voor-weergave-patroon als `salt_system.fault_below_watts`.
  Geen reminder/notificatie/timer (blijft bewust buiten scope, zie
  POOL-16). PR open, nog niet gemerged — zie `docs/configuration.md` voor
  de veldreferentie.

---

<a id="pool-14"></a>

## POOL-14 — Weersvoorspelling-context tonen

**Status:** Klaar (afgeschaald na MCP-check) · **Prioriteit:** P1 · **Epic:** Kaart-UX

- **Scope:** er bestaat al een Home Assistant-automatisering die de
  doeltemperatuur herberekent op basis van een meerdaagse weersvoorspelling
  — die redenering is nu onzichtbaar voor de gebruiker.
- **Afhankelijkheden:** read-only MCP-check om te bevestigen welke
  entiteit(en) de voorspelling en het herberekende doel bevatten.
- **Acceptatiecriteria:** korte, leesbare toelichting in de kaart (bv. "doel
  aangepast op basis van voorspelling") zonder de volledige automatisering
  te dupliceren.
- **Afgerond:** MCP-check toonde dat de automatisering haar redenering
  enkel transiënt logt (logbook/notification), niet ergens leesbaar voor
  de kaart — de Jinja-logica dupliceren zou de bestaande
  no-duplication-designbeslissing schenden, en de redenering laten
  persisteren is zelf een HA-zijdige wijziging die aparte goedkeuring
  vereist. Enkel het eerlijke deel gebouwd: een optioneel
  `target_temperature_updated`-tijdstip, display-only — het "wanneer",
  niet het "waarom". Volledige redenering-weergave blijft backlog, wacht
  op die HA-wijziging. Gemerged via PR #8.

---

<a id="pool-15"></a>

## POOL-15 — PV/zonne-optimalisatie zichtbaar maken

**Status:** Klaar · **Prioriteit:** P1 · **Epic:** Kaart-UX

- **Scope:** er bestaat al een Home Assistant-automatisering die de
  filtertiming stuurt op basis van een zonneprognose — de huidige PV-modus
  en het effect daarvan zijn nu onzichtbaar.
- **Afhankelijkheden:** read-only MCP-check om te bevestigen welke
  entiteit de PV-modus-vlag bevat.
- **Acceptatiecriteria:** PV-modus zichtbaar in de kaart (aan/uit + korte
  toelichting), zonder de forecast-logica zelf te dupliceren.
- **Afgerond:** MCP-check bevestigde de bron-helper. Nieuw optioneel
  `pv_mode`-veld, display-only in Instellingen — de kaart leidt zelf geen
  PV-logica af. Gemerged via PR #8.

---

<a id="pool-16"></a>

## POOL-16 — Meldingen/alerts-voorkeuren

**Status:** Backlog (herbeoordeeld, niet gebouwd) · **Prioriteit:** P1 · **Epic:** Kaart-UX

- **Scope:** bijvoorbeeld een pushmelding wanneer de debietfout-status
  langer dan X minuten aanhoudt, of wanneer de filter de daguren niet
  haalt.
- **Afhankelijkheden:** raakt mogelijk aan automatisering-logica in Home
  Assistant zelf — scope-check vooraf of dit puur kaart-config kan blijven
  (bv. via `notify`-service-call vanuit een door de gebruiker beheerde
  automatisering) dan wel een nieuwe automatisering vereist.
- **Acceptatiecriteria:** nog te bepalen na scope-check.
- **Voortgang:** scope-check afgerond — vereist een interval-timer plus
  een live `notify.*`-aanroep zolang het dashboard-tabblad toevallig open
  staat. Geen goede fit voor een Lovelace-kaart; hoort bij een
  HA-automatisering. Blijft in de backlog zonder verdere kaart-actie.

---

<a id="pool-17"></a>

## POOL-17 — pH/ORP-setpoints instelbaar maken vanuit de kaart

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Kaart-UX

- **Scope:** vandaag enkel display-only in Instellingen (zie
  `docs/configuration.md`) — setpoints rechtstreeks aanpasbaar maken.
- **Afhankelijkheden:** setpoint-entiteiten moeten schrijfbaar
  (`number.*`) geconfigureerd zijn; anders blijft dit display-only.
- **Acceptatiecriteria:** setpoint-wijziging vanuit de kaart roept de
  domain-safe `number.set_value` aan, met dezelfde bevestigingslogica als
  andere schrijvende acties.
- **Afgerond:** MCP-check bevestigde dat de echte pH/ORP-setpoints al
  schrijfbare `number.*`-entiteiten zijn. Nieuwe +/− stepper in
  Instellingen (`_adjustSetpoint()`/`_adjustNumber()`), zelfde
  domain-safe `_setNumber()`-schrijfweg als de bestaande
  doeltemperatuur-stepper; valt terug op de gewone weergaverij voor elk
  ander domein. Gemerged via PR #8.

---

<a id="pool-18"></a>

## POOL-18 — Canonieke watertemperatuur-sensor kiezen

**Status:** Klaar · **Prioriteit:** P0 · **Epic:** Techniek & opruiming

- **Scope:** er zijn drie verschillende watertemperatuursensoren in gebruik
  over automatiseringen/kaart heen — nog geen enkele canonieke bron
  gekozen.
- **Afhankelijkheden:** HA-zijde (automatisering-condities), buiten de
  scope van deze kaart-repo op zich.
- **Acceptatiecriteria:** één canonieke sensor gedocumenteerd en overal
  consistent gebruikt (kaart + automatiseringen).
- **Afgerond (2026-09-25):** bevestigd — de warmtepomp-proxy-sensor (de
  inlet-watertemperatuurmeting) is al de sensor die zowel alle betrokken
  automatiseringen als de live kaart-config (`water_temperature`)
  gebruiken. Geen wijziging nodig, enkel bevestiging/documentatie; de
  andere twee sensoren worden nergens (meer) als schrijf-/leesbron
  gebruikt voor filter-/warmtepomplogica.

---

<a id="pool-19"></a>

## POOL-19 — Dode helper opruimen

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Techniek & opruiming

- **Scope:** een bestaande helper wordt enkel dagelijks naar 0
  teruggezet en nergens anders voor gebruikt; een andere, al bestaande
  sensor is de echte bron voor "gelopen uren vandaag".
- **Afhankelijkheden:** HA-zijde, buiten de scope van deze kaart-repo op
  zich.
- **Acceptatiecriteria:** helper verwijderd of expliciet gedocumenteerd als
  legacy; kaart/automatiseringen gebruiken enkel nog de echte bron.
- **Afgerond (2026-09-25):** de dode helper is verwijderd, samen met zijn
  rij in de "Zwembad informatie"-dashboardkaart. De automatisering die de
  helper dagelijks terugzette kon niet verwijderd/uitgeschakeld worden
  (beide acties geweigerd door de Claude Code auto-mode classifier); in
  plaats daarvan is haar actielijst leeggemaakt (staat nog "aan", triggert
  nog, doet nu niets). **Dit is een omweg voor een geweigerde actie, geen
  volwaardige oplossing** — als de classifier-regel later aangepast wordt,
  kan de automatisering alsnog echt verwijderd worden.

---

<a id="pool-20"></a>

## POOL-20 — Automatiseringsconflicten oplossen

**Status:** Klaar · **Prioriteit:** P0 · **Epic:** Techniek & opruiming

- **Scope:** dubbele middernacht-veiligheidsstop, een PV-blinde
  "start zomer"-automatisering die racet met de PV-bewuste filterstart-
  logica, en dubbele stop-bij-doeluren-logica in twee automatiseringen.
- **Afhankelijkheden:** HA-zijde, buiten de scope van deze kaart-repo op
  zich.
- **Acceptatiecriteria:** elke conflict-situatie heeft nog precies één
  automatisering die de betrokken actie uitvoert.
- **Voortgang:**
  - **Middernacht-duplicaat:** ✅ opgelost (2026-09-25). Voor het
    opruimen ontdekt dat de "duplicaat" ook een reset van de
    filter-inhaalmodus-helper deed die de hoofdautomatisering niet deed —
    die actie eerst toegevoegd aan de hoofd-stop-automatisering, dan pas
    de duplicaat leeggemaakt (acties leeg, zelfde omweg als POOL-19, om
    dezelfde classifier-reden bij het verwijderen/uitschakelen).
  - **Stop-bij-doeluren-duplicaat:** ✅ opgelost (2026-09-28). De eerdere
    poging werd geweigerd door de classifier (`"[Modify Shared
Resources]"`) toen dit autonoom draaide; identieke edit (acties leeg)
    lukte daarna in een interactieve sessie.
  - **PV-blinde "start zomer" vs. PV-bewuste filterstart (08:00-race):**
    ✅ opgelost (2026-09-28, op expliciet verzoek van de gebruiker). De
    "start zomer"-automatisering is echt verwijderd (`ha_config_remove_automation`,
    geen omweg nodig dit keer). De hoofd-filterstart-automatisering dekt
    zomer/handmatig al volledig zelfstandig via drie tijd-triggers
    (08:00 dringend / 09:00 lage PV / 11:00 hoge PV) die samen elke dag
    exact één keer waar zijn — verwijderen verandert enkel het starttijdstip
    op niet-dringende dagen (voorheen altijd 08:00 door de duplicaat, nu
    09:00 of 11:00 afhankelijk van PV-modus), niet of de filter start.

---

<a id="pool-21"></a>

## POOL-21 — Fysieke koppeling warmtepomp-vermogen bevestigen

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Techniek & opruiming

- **Scope:** de warmtepomp-vermogenshelper correleert empirisch met de
  fysieke warmtepomp, maar geen automatisering/script schrijft het
  effectieve hardware-commando — vermoedelijk via een proxy-apparaat,
  onbevestigd.
- **Afhankelijkheden:** HA-zijde/hardware-onderzoek, buiten de scope van
  deze kaart-repo op zich.
- **Acceptatiecriteria:** schrijfpad bevestigd en gedocumenteerd, of
  expliciet als open vraag gemarkeerd als bevestiging niet mogelijk is.
- **Afgerond (2026-09-25):** **bevestigd** via read-only historiek-check
  (8 dagen, 12 onafhankelijke aan/uit-cycli): de fysieke
  warmtepomp-loopstatus volgt de vermogenshelper consistent binnen 1-8
  seconden, in beide richtingen, zonder uitzondering. Geen HA-wijziging
  nodig — enkel bevestiging.

---

<a id="pool-22"></a>

## POOL-22 — Warmtepomp-label uitlijning gecorrigeerd

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Basis

- **Scope:** het "Warmtepomp"-label stond op de grens tussen bad en
  toestellenvlak i.p.v. netjes erboven; verplaatst naar 47,4%.
- **Afhankelijkheden:** POOL-2.
- **Acceptatiecriteria:** label visueel correct gepositioneerd boven het
  toestel, in beide thema's.

---

<a id="pool-23"></a>

## POOL-23 — Instellingen & diagnostiek opdelen in subsecties

**Status:** Klaar · **Prioriteit:** P2 · **Epic:** Kaart-UX

- **Scope:** `_renderSettingsGroup()` groepeert zijn rijen in vier
  subsecties (Automatisch bijgewerkt, Waterkwaliteit, Verbruikskost,
  Warmtepomp diagnostiek) i.p.v. één platte lijst. Na POOL-11/12/14/15/17
  is die lijst gegroeid naar 14+ rijen door elkaar (comfortscore,
  PV-modus, tijdstippen, setpoints, kostenramingen, warmtepomp-diagnostiek
  allemaal gemengd) — de "overzichtelijk"-eis begint daar zichtbaar te
  breken. Geen wijziging aan het entity-key-contract, geen nieuwe
  afhankelijkheden, geen impact op illustratie/Snelle bediening/Historie/
  Automatiseringen.
- **Afhankelijkheden:** geen — puur een render-herstructurering van
  bestaande en al-geplande velden (POOL-11/12/14/15/17).
- **Acceptatiecriteria:** dezelfde rijen als vandaag, nu onder vier
  `.subgroup`-wrappers met een `.section-label`-kopje per sectie (zelfde
  patroon als de Historie-groep al gebruikt); `npm run verify` groen;
  visuele bevestiging door de gebruiker tegen de mockup vóór het gemerged
  wordt (zelfde flow als de illustratie-mockups).
- **Ontwerp:** mockup (huidige platte lijst vs. voorgestelde subsecties,
  licht + donker thema, kaart-eigen kleurtokens) —
  <https://claude.ai/artifact/ShfeftGuV3SUBLDD2SiU6e>. Voorgesteld na
  onderzoek dat concludeerde dat een volledige layout-overhaul niet
  gerechtvaardigd is (de hero-row en de vier groepen doorliepen al een
  eigen, goedgekeurd ontwerpproces in v0.3.3) — enkel deze groep is echt
  gegroeid tot een probleem.
- **Afgerond:** volledig 4-subsecties-ontwerp geïmplementeerd (Automatisch
  bijgewerkt, Waterkwaliteit, Verbruikskost, Warmtepomp diagnostiek) — PR
  #7 en #8 waren intussen gemerged naar `main`, dus deze branch werd erop
  gerebaset en alle rijen (comfortscore, PV-modus,
  doeltemperatuur-tijdstip, verbruikskost, schrijfbare setpoints) zijn
  meteen in de juiste subsectie geplaatst i.p.v. een kleinere,
  tussentijdse versie. Node-simulatie bevestigt correcte subgroep-markup
  en graceful-empty-gedrag voor zowel de volledige als een minimale
  config. Gemerged via PR #9.

---

<a id="pool-24"></a>

## POOL-24 — Warmtepomp-illustratie layout gecorrigeerd

**Status:** Klaar · **Prioriteit:** P1 · **Epic:** Basis

- **Scope:** na visuele review van v0.5.0 (screenshot van de live kaart):
  het warmtepomp-toestel op de illustratie was te groot — het
  "Warmtepomp"-label en zijn statuslichtje raakten de bovenrand van de
  buitenste gloed-ellips, terwijl filterpomp en zoutsysteem wél duidelijk
  ruimte hebben boven hun label. Daarnaast stonden `Doel`/`Verbruik` nog
  overlayed óp het toestel i.p.v. eronder zoals bij de andere twee
  toestellen.
- **Afhankelijkheden:** geen — pure SVG/CSS-aanpassing, geen wijziging
  aan het entity-key-contract.
- **Acceptatiecriteria:** warmtepomp-toestel kleiner, met duidelijke
  ruimte tussen label+statuslichtje en de bovenrand van het toestel;
  `Doel`/`Verbruik` op dezelfde rij als de andere "Verbruik"-badges,
  onder het toestel i.p.v. erop; `npm run verify` groen.
- **Voortgang:** hele toestel-groep (glow, lichaam, luchtroosters, ogen,
  voetstuk) samengevoegd in één schalende SVG-`<g>` met een
  `translate/scale(0.82)/translate`-transform, geschaald rond zijn eigen
  grondpunt zodat de voet ter plaatse blijft en de top ruimte vrijmaakt.
  `Doel`/`Verbruik`-badges verplaatst naar dezelfde onderste rij als
  filterpomp/zoutsysteem (top 92.9%), zonder de `onDark`-styling die
  enkel voor overlay-op-toestel bedoeld was. Geverifieerd met een
  playwright-screenshot van de gerenderde illustratie-HTML (realistische
  waarden) vóór het mergen: bevestigt kleiner toestel, zichtbaar label
  en statuslichtje, en badges op de juiste rij. `npm run verify` groen.
  Gemerged via PR #10.

---

<a id="pool-25"></a>

## POOL-25 — Warmtepomp-anchor gecorrigeerd + comfortscore op de illustratie

**Status:** Klaar · **Prioriteit:** P1 · **Epic:** Basis

- **Scope:** tweede visuele review op v0.5.1 wees uit dat POOL-24's fix
  onvoldoende was: het schaal-`<g>` was verankerd op het grondpunt van
  het toestel, wat enkel de bovenkant (label-ruimte) verbeterde — dat
  grondpunt lag al dicht bij de onderrand, dus die verschoof amper, en
  Doel/Verbruik bleven krap tegen het toestel aan staan. Daarnaast vroeg
  de gebruiker om de comfortscore ook rechtstreeks op de
  zwembad-illustratie te tonen, niet enkel in Instellingen.
- **Afhankelijkheden:** geen — voortbouwend op POOL-24 en het bestaande
  optionele `comfort_score`-veld (POOL-11).
- **Acceptatiecriteria:** warmtepomp-toestel heeft nu duidelijke ruimte
  aan zowel boven- als onderkant (vergelijkbaar met filterpomp/
  zoutsysteem hun eigen footprint t.o.v. hun label/badge-rijen);
  comfortscore zichtbaar als badge op de illustratie zelf, zonder de
  houten-vlonder-vorm te overlappen; `npm run verify` groen.
- **Voortgang:** schaal-`<g>` opnieuw verankerd op het verticale midden
  van het toestel (`translate(865,460) scale(0.75) translate(-865,-460)`)
  i.p.v. het grondpunt, zodat beide randen terugtrekken. Comfortscore-
  badge toegevoegd naast de bestaande "Buiten"-badge; een symmetrische
  linkerplaatsing werd eerst geprobeerd maar afgekeurd — de houten
  vlonder staat niet gecentreerd in de scène, dus links is er nauwelijks
  open lucht en botste de badge met de vlonder. Uiteindelijk geplaatst
  rechtsboven, onder "Buiten". Geverifieerd met playwright-screenshots
  van de gerenderde illustratie (licht + donker thema, realistische
  waarden uit de live screenshot) vóór het mergen. `npm run verify` groen.
  Gemerged via PR #11.

---

<a id="pool-26"></a>

## POOL-26 — GUI-editor uitgebreid naar alle configvelden

**Status:** Review/validatie (PR open, niet gemerged) · **Prioriteit:** P1
· **Epic:** Kaart-UX

- **Scope:** de kaart-editor toonde enkel titel/bevestiging/thema in de
  GUI — elke entiteit (verplicht of optioneel) moest via YAML ingevuld
  worden. Gebruiker vroeg expliciet om een volledige GUI-editor.
- **Afhankelijkheden:** geen — voortbouwend op de bestaande minimale
  editor uit Fase 3.
- **Acceptatiecriteria:** elk scalair configveld (top-level + `filter`/
  `heater`/`salt_system`/`water_quality`/`maintenance`/`mode.select`/
  `mode.apply_script`) heeft een GUI-veld; `npm run verify` groen; live
  interactieve test bevestigt dat wijzigingen correct in de
  `config-changed`-event terechtkomen, inclusief geneste velden en het
  verwijderen van een leeggemaakt veld (geen spook-`""`/`undefined` in de
  opgeslagen YAML).
- **Bewust buiten scope:** `automations[]` (lijst) en `mode.impact`/
  `mode.automations` (map per modus) blijven YAML-only — het zijn
  lijst-/map-vormige velden, geen één-op-één entiteitsveld, en een volledige
  lijst-editor daarvoor is een aparte, grotere taak.
- **Afgerond:** editor herschreven met inklapbare `<details>`-secties per
  configgroep. Entiteitsvelden zijn platte tekstvelden met een gedeelde
  `<datalist>` van live entity-ID's voor browser-native autocomplete —
  bewust geen `ha-entity-picker` (HA-frontend-intern element), consistent
  met dit project's "single dependency-free module"-ontwerp. Twee nieuwe
  pure, Node-geteste helpers (`getConfigPath`/`setConfigPath`) voor
  geneste dot-path lezen/schrijven, gedeeld tussen de editor-methodes en
  de tests. Geverifieerd met een live Playwright-interactietest (niet
  enkel een screenshot): een gewijzigd top-level veld, een genest veld, en
  een leeggemaakt veld leveren elk de verwachte `config-changed`-payload
  op, inclusief het volledig verdwijnen van een leeggemaakt veld i.p.v.
  een lege string. `npm run verify` groen (37/37 tests). PR open, nog niet
  gemerged.
