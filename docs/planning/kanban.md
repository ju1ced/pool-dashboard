# Zwembad-dashboard — Kanban

Bord voor `/projects/pool` (custom Lovelace-kaart `pool-dashboard.js`). Eén
sectie per status; elk ticket linkt naar zijn volledige beschrijving in
[`tickets.md`](tickets.md). Gemigreerd vanaf het losse, niet-project-getrackte
Kanban-bord-Artifact — zie `AGENTS.md`/changelog voor de aanleiding.

## Backlog

| Ticket                        | Onderwerp                                | Prioriteit | Afhankelijkheid                                                           |
| ----------------------------- | ---------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| [POOL-7](tickets.md#pool-7)   | Modus-indicator op de illustratie        | P1         | Weinig waarde vóór POOL-5                                                 |
| [POOL-8](tickets.md#pool-8)   | Vorstbeveiliging expliciet zichtbaar     | P1         | Weinig waarde vóór POOL-5                                                 |
| [POOL-16](tickets.md#pool-16) | Meldingen/alerts-voorkeuren              | P1         | Herbeoordeeld: geen goede fit voor een kaart, hoort bij HA-automatisering |
| [POOL-13](tickets.md#pool-13) | Onderhoud-/verbruiksartikelen-tracking   | P2         | Scope-check (mogelijk nieuwe helpers)                                     |
| [POOL-18](tickets.md#pool-18) | Canonieke watertemperatuur-sensor        | P0         | HA-zijde — aparte aanvraag nodig                                          |
| [POOL-19](tickets.md#pool-19) | Dode helper opruimen                     | P2         | HA-zijde — aparte aanvraag nodig                                          |
| [POOL-20](tickets.md#pool-20) | Automatiseringsconflicten oplossen       | P0         | HA-zijde — aparte aanvraag nodig                                          |
| [POOL-21](tickets.md#pool-21) | Warmtepomp-vermogenskoppeling bevestigen | P2         | HA-zijde — aparte aanvraag nodig                                          |

## Gepland

Geen tickets.

## In uitvoering

Geen tickets.

## Review/validatie

| Ticket                        | Onderwerp                                        | Prioriteit | Blokkade                             |
| ----------------------------- | ------------------------------------------------ | ---------- | ------------------------------------ |
| [POOL-23](tickets.md#pool-23) | Instellingen & diagnostiek opdelen in subsecties | P2         | Wacht op visuele bevestiging (PR #9) |

## Klaar

| Ticket                        | Onderwerp                                     | Prioriteit |
| ----------------------------- | --------------------------------------------- | ---------- |
| [POOL-1](tickets.md#pool-1)   | Kaart, editor, tests, HACS-bestanden en docs  | P2         |
| [POOL-2](tickets.md#pool-2)   | Zwembadillustratie met live waarden           | P2         |
| [POOL-3](tickets.md#pool-3)   | Illustratie + snelle bediening naast elkaar   | P2         |
| [POOL-4](tickets.md#pool-4)   | Technisch ontwerp seizoensmodus-backend       | P0         |
| [POOL-22](tickets.md#pool-22) | Warmtepomp-label uitlijning gecorrigeerd      | P2         |
| [POOL-9](tickets.md#pool-9)   | Energieverbruik-historiek per toestel         | P0         |
| [POOL-6](tickets.md#pool-6)   | Automatiseringen tonen per modus              | P1         |
| [POOL-10](tickets.md#pool-10) | Waterkwaliteit-trends (pH/ORP/zout)           | P1         |
| [POOL-11](tickets.md#pool-11) | Comfortscore in de kaart                      | P1         |
| [POOL-17](tickets.md#pool-17) | pH/ORP-setpoints instelbaar maken             | P2         |
| [POOL-12](tickets.md#pool-12) | Kostenraming op energieprijs                  | P2         |
| [POOL-15](tickets.md#pool-15) | PV/zonne-optimalisatie zichtbaar maken        | P1         |
| [POOL-14](tickets.md#pool-14) | Weersvoorspelling-context tonen (afgeschaald) | P1         |

## Geblokkeerd

| Ticket                      | Onderwerp                                      | Prioriteit | Blokkade                                                    |
| --------------------------- | ---------------------------------------------- | ---------- | ----------------------------------------------------------- |
| [POOL-5](tickets.md#pool-5) | Seizoensmodus-backend bouwen in Home Assistant | P0         | Vereist aparte, expliciete goedkeuring (zie `AGENTS.md` §5) |
