# Zwembad dashboard — §5 uitgewerkt: seizoensmodus-backend

> Publiek-repo-veilig: uitsluitend fictieve `example_*`-entity-ID's, zelfde conventie als
> `docs/design/proposal.md`. Status: **technisch voorstel, ter goedkeuring**. Niets hieruit is
> gebouwd of aan Home Assistant gewijzigd — zie `AGENTS.md`: dit onderdeel vereist een aparte,
> expliciete goedkeuring bovenop de goedkeuring van `proposal.md` zelf, omdat het automatiseringen
> raakt.

Dit document maakt `proposal.md` §5/§9 concreet genoeg om op te bouwen: exacte YAML voor de
nieuwe helper en het centrale script, en het exacte conditie-editpatroon voor de 5 betrokken
automatiseringen. Het is de tekst waarop u "ja, bouw dit in Home Assistant" kunt zeggen — tot die
goedkeuring blijft dit uitsluitend documentatie in dit repo.

---

## 1. `input_select.example_pool_season_mode`

```yaml
input_select:
  example_pool_season_mode:
    name: Zwembad seizoensmodus
    icon: mdi:sun-snowflake-variant
    options:
      - "Zomer"
      - "Winter"
      - "Onderhoud"
      - "Handmatig"
    initial: "Zomer"
```

`"Handmatig"` betekent: alle 5 automatiseringen slaan hun seizoensgebonden actie over (zie §3),
de gebruiker bedient filter/zout/warmtepomp zelf via de kaart se quick controls. Dit is niet
hetzelfde als zwemmodus (`swim_mode`, tijdelijk en auto-herstellend) — `"Handmatig"` blijft staan
tot de gebruiker een andere optie kiest.

## 2. `script.example_pool_apply_season_mode`

Eén atomaire actiesequentie, zoals `proposal.md` §5.2 vereist — geen losse service-calls vanuit
de kaart. De kaart roept dit script aan met `variables: { mode: "<value>" }` en doet verder niets.

```yaml
script:
  example_pool_apply_season_mode:
    alias: "Zwembad: pas seizoensmodus toe"
    mode: single
    fields:
      mode:
        description: "Doelmodus: Zomer, Winter, Onderhoud of Handmatig"
        example: "Winter"
    sequence:
      - action: input_select.select_option
        target:
          entity_id: input_select.example_pool_season_mode
        data:
          option: "{{ mode }}"
      - choose:
          # Zomer/Handmatig: geen geforceerde device-actie. De 5 automatiseringen (§3) volgen
          # vanaf hun eerstvolgende trigger de nieuwe modus-state. Geen "nu meteen aanzetten" —
          # dat zou filter/zout kunnen starten buiten hun normale tijdvenster.
          - conditions: "{{ mode in ['Zomer', 'Handmatig'] }}"
            sequence: []
          - conditions: "{{ mode == 'Winter' }}"
            sequence:
              - action: switch.turn_off
                target:
                  entity_id: switch.example_pool_filter_pump
              - action: switch.turn_off
                target:
                  entity_id: switch.example_pool_salt_system
              - action: input_boolean.turn_off
                target:
                  entity_id: input_boolean.example_pool_heater_power
              # Vorstbeveiliging blijft actief: die zit als aparte, modus-onafhankelijke trigger
              # in automation.example_pool_filter_start (§3.1) en wordt door deze wijziging niet
              # geraakt — zie proposal.md §5.2 punt "vorstbeveiliging blijft actief".
          - conditions: "{{ mode == 'Onderhoud' }}"
            sequence:
              - action: switch.turn_off
                target:
                  entity_id: switch.example_pool_filter_pump
              - action: switch.turn_off
                target:
                  entity_id: switch.example_pool_salt_system
              - action: input_boolean.turn_off
                target:
                  entity_id: input_boolean.example_pool_heater_power
              # Geen automatische herstart: de conditie-edits in §3 zorgen dat geen van de 5
              # automatiseringen filter/zout/warmtepomp opnieuw aanzet zolang de modus "Onderhoud" is.
```

## 3. Conditie-edits — patroon, per automatisering

**Principe (ongewijzigd t.o.v. `proposal.md` §5.2):** de 5 automatiseringen worden niet
herschreven. Elke automatisering krijgt exact één extra conditie toegevoegd aan haar bestaande
trigger-condities: een check op `input_select.example_pool_season_mode` die vervangt wat vandaag
impliciet via `now().month` gebeurt. Triggers, tijdstippen en de rest van de actie-sequentie
blijven ongewijzigd.

| #   | Fictieve automatisering                     | Rol vandaag (`now().month`-impliciet)                                     | Nieuwe conditie                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `automation.example_pool_filter_start`      | Kiest starttijd/actie o.b.v. mei-sep (dynamisch) vs okt-apr (vast 10:00)  | `{{ states('input_select.example_pool_season_mode') in ['Zomer','Handmatig'] }}` vóór de mei-sep-tak; `{{ ... == 'Winter' }}` vóór de okt-apr-tak. `'Onderhoud'` matcht geen van beide → automatisering doet niets.                                                                                         |
| 2   | `automation.example_pool_filter_stop`       | Stopt o.b.v. dezelfde seizoenslogica, doeluren, of veiligheids-stop 23:58 | Zelfde patroon als #1 voor de seizoensgebonden stoptijden. De 23:58-veiligheids-stop en de doeluren-tak blijven **ongewijzigd en modus-onafhankelijk** — een stop mag nooit geblokkeerd worden door de modus, enkel een start.                                                                              |
| 3   | `automation.example_pool_filter_hours_calc` | Berekent streefuren (6-12u zomer / 4u overgang / 2u winter) uit watertemp | Conditie op de modus i.p.v. `now().month`: `'Zomer'` → zomerformule, `'Winter'` → 2u vast, `'Onderhoud'`/`'Handmatig'` → **automatisering slaat de herberekening over** (doeluren blijven op hun laatste waarde staan; niet relevant zolang niets automatisch start).                                       |
| 4   | `automation.example_pool_pump_start_summer` | Legacy/parallel: zet filter+zout aan om 08:00 in mei-sep, ongeacht PV     | `{{ states('input_select.example_pool_season_mode') == 'Zomer' }}` toegevoegd. Dit lost meteen ook `proposal.md` §6's gemarkeerde race met #1 gedeeltelijk op qua zichtbaarheid (beide gedrag blijft draaien tenzij u apart vraagt deze automatisering op te ruimen — **niet onderdeel van dit voorstel**). |
| 5   | `automation.example_pool_pump_catchup`      | Inhaalmodus 20:00, mei-sep, zwemmodus uit, doeluren niet gehaald          | `{{ states('input_select.example_pool_season_mode') in ['Zomer','Handmatig'] }}` toegevoegd naast de bestaande condities (zwemmodus uit, doeluren niet gehaald).                                                                                                                                            |

**Voorbeeld conditie-edit (automatisering #1, patroon herbruikbaar voor de andere 4):**

```yaml
# Vóór (huidig, impliciet via now().month binnen de actie-choose, niet als aparte conditie):
condition: []
action:
  - choose:
      - conditions: "{{ now().month in [5,6,7,8,9] }}"
        sequence: [...dynamische PV/dringendheid-logica...]
      - conditions: "{{ now().month not in [5,6,7,8,9] }}"
        sequence: [...vaste 10:00-logica...]

# Na (voorgesteld):
condition: []
action:
  - choose:
      - conditions:
          - "{{ states('input_select.example_pool_season_mode') in ['Zomer', 'Handmatig'] }}"
        sequence: [...ongewijzigde dynamische PV/dringendheid-logica...]
      - conditions:
          - "{{ states('input_select.example_pool_season_mode') == 'Winter' }}"
        sequence: [...ongewijzigde vaste 10:00-logica...]
      # Geen derde tak: bij 'Onderhoud' matcht geen enkele conditie, dus de automatisering
      # triggert wel (state on/last_triggered blijven kloppen) maar voert geen actie uit.
```

Vorstbeveiliging (aparte trigger, <3°C) in dezelfde automatisering **blijft ongewijzigd** en dus
ook actief tijdens `'Onderhoud'`/`'Winter'` — expliciet vereist door `proposal.md` §5.2.

## 4. Wat dit voorstel bewust niet doet

- **Ruimt de bestaande conflicten niet op** (dubbele middernacht-stop, race op 08:00, dubbele
  doeluren-stop — `docs/discovery/inventory.local.md` §4). Dit voorstel voegt enkel een
  modus-conditie toe aan de 5 met seizoenslogica; de overige overlap blijft bestaan tenzij apart
  gevraagd.
- **Schrijft `input_number.example_pool_filter_hours_run` niet om of verwijdert hem niet** — dat
  is een aparte, kleinere opruiming (zie geheugen/`inventory.local.md` §5.3), niet onderdeel van
  de modus-flow.
- **Verandert geen enkele trigger-tijd, watertemperatuur-formule of PV-logica** — enkel de
  seizoensconditie (`now().month` → modus-state) wordt aangeraakt.

## 5. Uitrol- en terugvalplan (bij goedkeuring)

1. `input_select.example_pool_season_mode` aanmaken, `initial: "Zomer"` — geen enkele
   automatisering reageert hier al op vóór stap 2, dus dit alleen is zonder gedragswijziging.
2. `script.example_pool_apply_season_mode` aanmaken — nog steeds geen effect, niets roept het
   aan.
3. Conditie-edit op **één** automatisering eerst (#1, laagste risico — enkel startlogica), 24-48u
   observeren (`last_triggered` + logboek), dan de overige 4.
4. Kaart-config `mode:` pas invullen (`mode.select` + `mode.apply_script`) nadat stap 1-3 bevestigd
   werken — daarvóór blijft het moduswissel-blok in de kaart disabled (§5.3 van `proposal.md`).
5. **Terugval:** elke stap is onafhankelijk omkeerbaar — conditie-edit terugdraaien naar de
   originele `now().month`-tak, of `input_select`/script verwijderen, zonder dat de andere stappen
   geraakt worden. Geen van de stappen wijzigt bestaande entity-ID's, dus geen impact op dit
   card-repo's config-contract.

---

**Vraagt om uw goedkeuring** vóór enige van bovenstaande stappen in Home Assistant wordt
uitgevoerd — dit document zelf wijzigt niets buiten `/projects/pool`.
