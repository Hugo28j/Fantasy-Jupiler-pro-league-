# Backend activeren

De code voor punten 1–4 staat in de repository, maar GitHub Pages kan zelf geen database of geheime voetbal-API-sleutel bewaren. Gebruik daarom één Supabase-project als beveiligde backend.

## 1. Supabase maken

1. Maak een project op <https://supabase.com/dashboard>.
2. Open **SQL Editor** en voer de bestanden in `supabase/migrations/` in nummervolgorde volledig uit (`001`, daarna `002`, enzovoort).
3. Open **Authentication → URL Configuration**. Zet de GitHub Pages-URL als **Site URL** en voeg dezelfde URL toe bij **Redirect URLs**.
4. Kopieer bij **Project Settings → API** de Project URL en de publieke anon/publishable key naar `config.js`.

De publieke sleutel mag in de website staan. De `service_role`-sleutel en voetbal-API-key mogen daar nooit staan.

## 2. Automatische JPL-data

1. Maak een gratis API‑Football/API‑Sports-account en sleutel aan. De gratis formule heeft 100 requests per dag. De sync is daarom zo opgebouwd dat reeds verwerkte wedstrijden worden overgeslagen en de volledige spelerslijst niet bij iedere run opnieuw wordt opgehaald.
2. Installeer de Supabase CLI en koppel het project.
3. Voeg de geheime sleutel toe en deploy de functie:

```bash
supabase secrets set API_FOOTBALL_KEY=JOUW_SLEUTEL API_FOOTBALL_LEAGUE_ID=144 API_FOOTBALL_SEASON=2026
supabase functions deploy sync-jpl
```

4. Roep `sync-jpl` één keer handmatig aan vanuit **Edge Functions**. De eerste run haalt de kalender op, vult de spelerslijst en verwerkt alleen de nog niet verwerkte wedstrijden van de nieuwste volledig afgewerkte speeldag. Controleer in de JSON-respons vooral `ok`, `processedFixtures`, `playersImported` en `apiCalls`.
5. Roep de functie daarna meteen een tweede keer aan. Als dezelfde speeldag al verwerkt is, hoort `processedFixtures` nu 0 te zijn en hoort de spelerslijst niet opnieuw opgehaald te worden (`playerRefresh:false`). Zo controleer je dat de gratis API-limiet niet onnodig wordt verbruikt.
6. Plan de functie pas daarna automatisch. Gebruik op het gratis API-Football-plan **niet iedere 15 minuten**. Een veilige start is **iedere 2 uur** via **Integrations → Cron → Create job → Supabase Edge Function → sync-jpl**. Elke normale run gebruikt dan meestal alleen de fixture-aanvraag; de volledige spelerslijst wordt maximaal ongeveer één keer per 24 uur vernieuwd en reeds verwerkte wedstrijden worden overgeslagen.

API-FOOTBALL levert de meeste waarden uit de huidige puntentabel rechtstreeks. De velden `savesInsideBox`, `punches`, `clearances`, `possessionLost` en `successfulLongPass` zitten niet in zijn standaard player-fixture response en blijven daarom bewust 0; ze worden niet geschat. Als die vijf statistieken moeten meetellen, is een databron met die expliciete velden nodig en moet alleen de mapping in `supabase/functions/sync-jpl/index.ts` worden aangepast.

Na de sync toont **Wedstrijden → Puntenbalans** alle spelers van die speeldag, hun minuten, score en iedere statistiek uit de puntentabel. Sorare is niet als hoofdbron gebruikt: toegang tot player-game-statistieken vereist daar authenticatie met een persoonlijk account/JWT, terwijl API‑Football een aparte serversleutel ondersteunt.

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
