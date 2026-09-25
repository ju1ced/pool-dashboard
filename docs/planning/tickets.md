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

**Status:** Geblokkeerd · **Prioriteit:** P0 · **Epic:** Seizoensmodus

- **Scope:** de helper, het script en de conditie-edits uit POOL-4
  daadwerkelijk aanmaken in Home Assistant.
- **Blokkade:** vereist aparte, expliciete goedkeuring vooraleer dit in Home
  Assistant gebouwd wordt (zie `AGENTS.md` §5). Niet starten zonder die
  goedkeuring, ook al staat de rest van de roadmap open.
- **Afhankelijkheden:** POOL-4 (klaar).
- **Acceptatiecriteria:** n.v.t. tot goedkeuring gegeven is.

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

**Status:** Backlog · **Prioriteit:** P2 · **Epic:** Kaart-UX

- **Scope:** bijvoorbeeld resterende levensduur zoutcel, datum laatste
  filterreiniging — herinneringen wanneer onderhoud nodig is.
- **Afhankelijkheden:** vermoedelijk nieuwe Home Assistant-helpers nodig
  (datum-opslag) — scope-check vooraf, mogelijk buiten wat de kaart alleen
  kan oplossen.
- **Acceptatiecriteria:** nog te bepalen na scope-check.
- **Voortgang:** scope-check afgerond via read-only MCP-check — geen
  bestaande entiteit voor zoutcel-levensduur, filterreinigingsdatum of
  onderhoud in het algemeen. Vereist eerst nieuwe HA-helpers (bv.
  `input_datetime`/`input_number`), wat buiten de scope van deze kaart-repo
  op zich valt — vereist een aparte, expliciete aanvraag (zie `AGENTS.md`).
  Blijft in de backlog zonder verdere kaart-actie tot die helpers bestaan.

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

**Status:** Backlog · **Prioriteit:** P0 · **Epic:** Techniek & opruiming

- **Scope:** er zijn drie verschillende watertemperatuursensoren in gebruik
  over automatiseringen/kaart heen — nog geen enkele canonieke bron
  gekozen.
- **Afhankelijkheden:** HA-zijde (automatisering-condities), buiten de
  scope van deze kaart-repo op zich — vereist een aparte, expliciete
  aanvraag zoals elke HA-wijziging (zie `AGENTS.md`).
- **Acceptatiecriteria:** één canonieke sensor gedocumenteerd en overal
  consistent gebruikt (kaart + automatiseringen).

---

<a id="pool-19"></a>

## POOL-19 — Dode helper opruimen

**Status:** Backlog · **Prioriteit:** P2 · **Epic:** Techniek & opruiming

- **Scope:** een bestaande helper wordt enkel dagelijks naar 0
  teruggezet en nergens anders voor gebruikt; een andere, al bestaande
  sensor is de echte bron voor "gelopen uren vandaag".
- **Afhankelijkheden:** HA-zijde, buiten de scope van deze kaart-repo op
  zich — vereist een aparte, expliciete aanvraag (zie `AGENTS.md`).
- **Acceptatiecriteria:** helper verwijderd of expliciet gedocumenteerd als
  legacy; kaart/automatiseringen gebruiken enkel nog de echte bron.

---

<a id="pool-20"></a>

## POOL-20 — Automatiseringsconflicten oplossen

**Status:** Backlog · **Prioriteit:** P0 · **Epic:** Techniek & opruiming

- **Scope:** dubbele middernacht-veiligheidsstop, een PV-blinde
  "start zomer"-automatisering die racet met de PV-bewuste filterstart-
  logica, en dubbele stop-bij-doeluren-logica in twee automatiseringen.
- **Afhankelijkheden:** HA-zijde, buiten de scope van deze kaart-repo op
  zich — vereist een aparte, expliciete aanvraag (zie `AGENTS.md`).
- **Acceptatiecriteria:** elke conflict-situatie heeft nog precies één
  automatisering die de betrokken actie uitvoert.

---

<a id="pool-21"></a>

## POOL-21 — Fysieke koppeling warmtepomp-vermogen bevestigen

**Status:** Backlog · **Prioriteit:** P2 · **Epic:** Techniek & opruiming

- **Scope:** de warmtepomp-vermogenshelper correleert empirisch met de
  fysieke warmtepomp, maar geen automatisering/script schrijft het
  effectieve hardware-commando — vermoedelijk via een proxy-apparaat,
  onbevestigd.
- **Afhankelijkheden:** HA-zijde/hardware-onderzoek, buiten de scope van
  deze kaart-repo op zich.
- **Acceptatiecriteria:** schrijfpad bevestigd en gedocumenteerd, of
  expliciet als open vraag gemarkeerd als bevestiging niet mogelijk is.

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
