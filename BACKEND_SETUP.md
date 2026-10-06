# Backend activeren

De code voor punten 1–4 staat in de repository, maar GitHub Pages kan zelf geen database of geheime voetbal-API-sleutel bewaren. Gebruik daarom één Supabase-project als beveiligde backend.

## 1. Supabase maken

1. Maak een project op <https://supabase.com/dashboard>.
2. Open **SQL Editor** en voer de bestanden in `supabase/migrations/` in nummervolgorde volledig uit (`001`, daarna `002`, enzovoort).
3. Open **Authentication → URL Configuration**. Zet de GitHub Pages-URL als **Site URL** en voeg dezelfde URL toe bij **Redirect URLs**.
4. Kopieer bij **Project Settings → API** de Project URL en de publieke anon/publishable key naar `config.js`.

De publieke sleutel mag in de website staan. De `service_role`-sleutel en voetbal-API-key mogen daar nooit staan.

## 2. Automatische JPL-data via Sorare

De productie-sync gebruikt nu de officiële Sorare GraphQL API als databron. De Jupiler Pro League staat bij Sorare onder de competitie-slug `jupiler-pro-league`. Sorare levert de 18 clubs, de actieve spelerskernen, wedstrijden en gedetailleerde individuele player-game stats.

### Sorare developer key

Maak in Sorare een developer API key aan via:

<https://sorare.com/settings/developer>

Bewaar die sleutel uitsluitend als Supabase secret. Zet hem nooit in `config.js`, GitHub, browser-JavaScript of een chatbericht.

Voeg in **Supabase → Edge Functions → Secrets** deze secret toe:

```text
SORARE_API_KEY=JOUW_PRIVATE_SORARE_KEY
```

De Supabase-waarden `SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` worden door de Edge Function-omgeving gebruikt en horen eveneens nooit in de publieke websitecode.

### Deployen en eerste test

Deploy daarna de nieuwste versie van:

```text
supabase/functions/sync-jpl/index.ts
```

als Edge Function `sync-jpl`.

Voer de eerste test uit met een POST-body:

```json
{"refreshPlayers":true}
```

De eerste run:
- haalt alle 18 JPL-clubs bij Sorare op;
- importeert de actieve spelerskernen;
- bouwt de 2026/27-speeldagen uit de Sorare-wedstrijdkalender;
- importeert de laatste volledig afgewerkte speeldag;
- berekent de fantasy-punten en zet volledig geïmporteerde fixtures op `stats_processed=true`.

Controleer in de JSON-respons vooral `ok`, `clubs`, `playersImported`, `latestCompletedGameweek`, `processedFixtures`, `importedPlayerRows` en `apiCalls`.

Voer daarna meteen een tweede test uit met:

```json
{}
```

Reeds verwerkte wedstrijden horen dan niet opnieuw geïmporteerd te worden. De spelerskernen worden alleen opnieuw opgehaald wanneer de database nog geen Sorare-spelers bevat of wanneer expliciet `{"refreshPlayers":true}` wordt gebruikt.

### Mapping naar het fantasy-puntensysteem

Sorare levert rechtstreeks de belangrijkste velden voor dit spel, waaronder:
- minuten;
- saves, saves inside box en punches;
- clean sheets en goals conceded;
- fouls gemaakt en gekregen;
- gele en rode kaarten;
- goals en assists;
- tackles won;
- duels won/lost;
- clearances en interceptions;
- possession won/lost;
- accurate passes;
- accurate long balls;
- missed passes;
- successful contests/dribbles;
- shots on target.

Het huidige Sorare `PlayerGameStats`-schema bevat geen rechtstreeks veld voor **key passes**. Daarom staat alleen `keyPass` voorlopig op 0. De sync meldt dit ook via `unsupportedScoringStats:["keyPass"]`; de andere velden worden rechtstreeks uit Sorare gemapt.

### Automatische planning

Plan automatische synchronisatie pas nadat de twee handmatige tests correct zijn. De sync slaat fixtures met `stats_processed=true` over. Een aparte periodieke spelersrefresh kan later met `{"refreshPlayers":true}` worden gepland zodat transfers en kernwijzigingen meekomen.

## 3. Wat server-side wordt afgedwongen

- ieder account heeft één centraal team;
- maximaal €100M en maximaal acht unieke spelers;
- maximaal twee spelers per positie; een volledig team moet exact 2 GK, 2 DEF, 2 MID en 2 FWD hebben;
- een geldige bank bestaat uit één keeper en één veldspeler;
- de deadline is het startuur van de eerste wedstrijd van de speeldag;
- na die deadline weigert de database elke teamwijziging, ook wanneer iemand de browsercode manipuleert;
- de opstelling wordt per speeldag bevroren en scores worden opnieuw berekend zodra wedstrijdstatistieken binnenkomen.
- de reservekeeper kan uitsluitend de basiskeeper vervangen en de veldreserve kan maximaal één afwezige veldspeler vervangen;
- iedere gespeelde minuut levert 0,1 punt op;
- na de eerste vastgezette selectie zijn 2 transfers per speeldag gratis en kost iedere extra transfer 4 punten.
- het leaderboard toont de totaalscore, de laatste speeldagscore en na een klik alle eerder vastgezette teams;
- spelersfiches lezen de verwerkte wedstrijdstatistieken rechtstreeks uit `player_match_stats`;
- actieve spelers zonder speelminuten kunnen als budgetoptie vanaf €1M geprijsd worden.
- de balansproef toont per positie het gemiddelde, minimum en maximum en markeert een verschil van meer dan 10 punten als mogelijke scheeftrekking.

## 4. Productiecontrole

Maak twee testaccounts. Bouw op beide een team, controleer dat ze op het leaderboard verschijnen, zet tijdelijk een `lock_at` in het verleden en verifieer dat kopen, verkopen, bank wisselen en teamnaam wijzigen worden geweigerd. Zet de deadline daarna terug op het echte aftrapuur.
