# Backend activeren

De code voor punten 1–4 staat in de repository, maar GitHub Pages kan zelf geen database of geheime voetbal-API-sleutel bewaren. Gebruik daarom één Supabase-project als beveiligde backend.

## 1. Supabase maken

1. Maak een project op <https://supabase.com/dashboard>.
2. Open **SQL Editor** en voer de bestanden in `supabase/migrations/` in nummervolgorde volledig uit (`001`, daarna `002`, enzovoort).
3. Open **Authentication → URL Configuration**. Zet de GitHub Pages-URL als **Site URL** en voeg dezelfde URL toe bij **Redirect URLs**.
4. Kopieer bij **Project Settings → API** de Project URL en de publieke anon/publishable key naar `config.js`.

De publieke sleutel mag in de website staan. De `service_role`-sleutel en voetbal-API-key mogen daar nooit staan.

## 2. Automatische JPL-data

1. Maak een API-FOOTBALL-account en sleutel aan.
2. Installeer de Supabase CLI en koppel het project.
3. Voeg de geheime sleutel toe en deploy de functie:

```bash
supabase secrets set API_FOOTBALL_KEY=JOUW_SLEUTEL API_FOOTBALL_LEAGUE_ID=144 API_FOOTBALL_SEASON=2026
supabase functions deploy sync-jpl
```

4. Roep `sync-jpl` één keer aan vanuit **Edge Functions** om spelers, speeldagen, wedstrijden en afgewerkte wedstrijdstatistieken te importeren.
5. Plan de functie daarna iedere 15 minuten via **Integrations → Cron → Create job → Supabase Edge Function → sync-jpl**.

API-FOOTBALL levert de meeste waarden uit de huidige puntentabel rechtstreeks. De velden `savesInsideBox`, `punches`, `clearances`, `possessionLost` en `successfulLongPass` zitten niet in zijn standaard player-fixture response en blijven daarom bewust 0; ze worden niet geschat. Als die vijf statistieken moeten meetellen, is een databron met die expliciete velden nodig en moet alleen de mapping in `supabase/functions/sync-jpl/index.ts` worden aangepast.

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

## 4. Productiecontrole

Maak twee testaccounts. Bouw op beide een team, controleer dat ze op het leaderboard verschijnen, zet tijdelijk een `lock_at` in het verleden en verifieer dat kopen, verkopen, bank wisselen en teamnaam wijzigen worden geweigerd. Zet de deadline daarna terug op het echte aftrapuur.
