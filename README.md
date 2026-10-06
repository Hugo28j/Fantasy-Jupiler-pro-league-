# Fantasy Jupiler Pro League

Fantasygame voor het Jupiler Pro League-seizoen 2026/27. Spelers bouwen met €100M een selectie van acht spelers (2 GK, 2 DEF, 2 MID en 2 FWD), stellen zes basisspelers op en plaatsen één keeper en één veldspeler op de bank.

De GitHub Pages-client werkt zonder configuratie in lokale demomodus. De repository bevat daarnaast een Supabase-backend voor accounts, centrale teamopslag, automatische Sorare GraphQL-import, puntentelling en een server-side speeldagdeadline.

Spelregels: €100M budget, gebalanceerde prijzen van €1M tot €25M met Hans Vanaken als duurste speler, +0,1 punt per gespeelde minuut, automatische bankwissels en 2 gratis transfers per speeldag. Gratis transfers worden niet opgespaard; iedere extra transfer kost 4 punten.

De demodata bevat minstens 15 spelers per club en de volledige officiële selectie van Club Brugge. Met de backend actief toont het leaderboard totaal- en speeldagscores, klikbare teamhistoriek en spelersfiches met statistieken per wedstrijd.

De pagina **Wedstrijden** bevat de negen uitslagen van de laatste afgewerkte JPL-speeldag en een balansdashboard. De beveiligde Sorare-sync importeert de nieuwste volledige speeldag, berekent de fantasy-score van iedere speler en vergelijkt de gemiddelden van keepers, verdedigers, middenvelders en aanvallers.

Zie [BACKEND_SETUP.md](BACKEND_SETUP.md) om de online functies te activeren.
