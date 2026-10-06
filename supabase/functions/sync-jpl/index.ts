import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SORARE_GRAPHQL = "https://api.sorare.com/graphql";
const COMPETITION_SLUG = "jupiler-pro-league";
const SEASON_START = 2026;
const SEASON_FROM = new Date("2026-07-01T00:00:00Z").getTime();
const SEASON_TO = new Date("2027-07-01T00:00:00Z").getTime();
const GAME_PAGE_SIZE = 50;
const PLAYER_BATCH_SIZE = 8;
const PLAYER_STATS_LAST = 15;

const weights: Record<string,Record<string,number>> = {
  GK:{minutes:.1,save:3,cleanSheet:20,savesInsideBox:5,punches:2,goalsConceded:-5,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:3,duelWon:.5,duelLost:-.5,clearances:2,interceptions:1,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.4,passMissed:-.2,successfulDribble:.2,shotOnTarget:2},
  DEF:{minutes:.1,goalsConceded:-5,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:4,duelWon:1,duelLost:-1,clearances:2,interceptions:2,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.4,passMissed:-.2,successfulDribble:.2,shotOnTarget:2},
  MID:{minutes:.1,goalsConceded:-3,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:3,duelWon:.5,duelLost:-.5,clearances:1,interceptions:2,possessionWon:.3,possessionLost:-.3,successfulPass:.2,successfulLongPass:.4,keyPass:.6,passMissed:-.3,successfulDribble:.3,shotOnTarget:2},
  FWD:{minutes:.1,goalsConceded:-1,foulsMade:-1,foulsDrawn:1,yellow:-3,red:-10,goal:10,assist:10,successfulTackles:2,duelWon:1,duelLost:-1,clearances:1,interceptions:1,possessionWon:.2,possessionLost:-.2,successfulPass:.1,successfulLongPass:.3,keyPass:.6,passMissed:-.1,successfulDribble:.5,shotOnTarget:4}
};

function env(name:string, fallback?:string){
  const value = Deno.env.get(name) || fallback;
  if(!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function num(value:unknown){
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeName(value:string){
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu,"")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g," ")
    .trim();
}

function positionCode(value:string){
  const p = String(value || "").toLowerCase();
  if(p.includes("goal")) return "GK";
  if(p.includes("def") || p.includes("back")) return "DEF";
  if(p.includes("mid")) return "MID";
  if(p.includes("forward") || p.includes("striker") || p.includes("wing")) return "FWD";
  return null;
}

function startingPrice(position:string, name:string, appearances=0, stars=0){
  if(normalizeName(name) === "hans vanaken") return 25;
  const apps = Math.max(0,num(appearances));
  if(apps === 0) return 1;
  if(apps <= 2) return 2;
  if(apps <= 5) return 4;
  const base:Record<string,number> = {GK:6,DEF:7,MID:8,FWD:9};
  const availability = Math.min(5,apps/2.5);
  const quality = Math.min(10,Math.max(0,num(stars))*2);
  return Math.min(24,Math.max(5,Math.round((base[position]+availability+quality)*2)/2));
}

function fantasyScore(position:string, stats:Record<string,number>){
  return Math.round(Object.entries(weights[position] || {})
    .reduce((total,[key,weight]) => total + num(stats[key])*weight,0)*100)/100;
}

function mapSorareStats(raw:any){
  return {
    minutes:num(raw.minsPlayed),
    save:num(raw.saves),
    cleanSheet:num(raw.cleanSheet),
    savesInsideBox:num(raw.savedIbox),
    punches:num(raw.punches),
    goalsConceded:num(raw.goalsConceded),
    foulsMade:num(raw.fouls),
    foulsDrawn:num(raw.wasFouled),
    yellow:num(raw.yellowCard),
    red:num(raw.redCard),
    goal:num(raw.goals),
    assist:num(raw.goalAssist),
    successfulTackles:num(raw.wonTackle),
    duelWon:num(raw.duelWon),
    duelLost:num(raw.duelLost),
    clearances:num(raw.totalClearance),
    interceptions:num(raw.interceptionWon),
    possessionWon:num(raw.possWon),
    possessionLost:num(raw.possLostCtrl),
    successfulPass:num(raw.accuratePass),
    successfulLongPass:num(raw.accurateLongBalls),
    // Sorare PlayerGameStats heeft momenteel geen rechtstreeks key-pass veld.
    keyPass:0,
    passMissed:num(raw.missedPass),
    successfulDribble:num(raw.wonContest),
    shotOnTarget:num(raw.ontargetScoringAtt)
  };
}

// De databasekolommen zijn bigint, maar PostgREST/JavaScript moet deze IDs exact kunnen
// teruglezen. Daarom houden we Sorare-hashes bewust binnen Number.MAX_SAFE_INTEGER.
function stableBigint(value:string){
  const bytes = new TextEncoder().encode(value);
  let hash = 1469598103934665603n;
  const prime = 1099511628211n;
  for(const byte of bytes){
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64,hash*prime);
  }
  hash &= 0x1fffffffffffffn; // 53 bits: veilig exact in JavaScript
  if(hash === 0n) hash = 1n;
  return hash.toString();
}

function playerDbId(slug:string){
  return `sorare-${slug}`;
}

function fixtureDbId(providerId:string){
  return stableBigint(`sorare-game:${providerId}`);
}

function statusCode(value:string){
  const s = String(value || "").toLowerCase();
  if(s === "played") return "FT";
  if(s === "playing" || s === "live") return "LIVE";
  if(s === "cancelled" || s === "canceled") return "CANC";
  if(s === "postponed") return "PST";
  return "NS";
}

function chunks<T>(items:T[],size:number){
  const result:T[][] = [];
  for(let i=0;i<items.length;i+=size) result.push(items.slice(i,i+size));
  return result;
}

function assignRounds(games:any[]){
  const sorted = [...games].sort((a,b) => new Date(a.date).getTime()-new Date(b.date).getTime());

  if(sorted.length !== 306){
    throw new Error(`JPL-kalender bevat ${sorted.length} wedstrijden; verwacht exact 306 voor 34 speeldagen.`);
  }

  const rounds = chunks(sorted,9).map((roundGames,index) => {
    const teams = new Set<string>();
    for(const game of roundGames){
      const home = String(game.homeTeam?.id || game.homeTeam?.slug || "");
      const away = String(game.awayTeam?.id || game.awayTeam?.slug || "");
      if(!home || !away) throw new Error(`Speeldag ${index+1} bevat een wedstrijd zonder twee clubs.`);
      teams.add(home);
      teams.add(away);
    }
    if(roundGames.length !== 9 || teams.size !== 18){
      throw new Error(
        `Sorare-kalender kan niet veilig in speeldagen worden verdeeld: speeldag ${index+1} heeft ${roundGames.length} wedstrijden en ${teams.size} unieke clubs.`
      );
    }
    return {number:index+1,games:roundGames};
  });

  if(rounds.length !== 34){
    throw new Error(`JPL-kalender gaf ${rounds.length} speeldagen; verwacht 34.`);
  }
  return rounds;
}

Deno.serve(async request => {
  if(request.method !== "POST") return new Response("Method not allowed",{status:405});
  const started = Date.now();

  try{
    const apiKey = env("SORARE_API_KEY");
    const db = createClient(
      env("SUPABASE_URL"),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      {auth:{persistSession:false}}
    );

    let apiCalls = 0;
    const sorare = async (query:string, variables:Record<string,unknown>={}) => {
      apiCalls += 1;
      for(let attempt=0;attempt<3;attempt++){
        const response = await fetch(SORARE_GRAPHQL,{
          method:"POST",
          headers:{
            "content-type":"application/json",
            "APIKEY":apiKey,
            "User-Agent":"Fantasy-JPL/1.0"
          },
          body:JSON.stringify({query,variables})
        });

        if(response.status === 429 && attempt < 2){
          const waitSeconds = Math.max(1,num(response.headers.get("retry-after")) || 2);
          await new Promise(resolve => setTimeout(resolve,waitSeconds*1000));
          continue;
        }

        const body = await response.json();
        if(!response.ok) throw new Error(`Sorare HTTP ${response.status}: ${JSON.stringify(body)}`);
        if(body.errors?.length){
          throw new Error(`Sorare GraphQL: ${body.errors.map((e:any)=>e.message).join(" | ")}`);
        }
        return body.data;
      }
      throw new Error("Sorare rate limit bleef actief na retries.");
    };

    let body:any = {};
    try{ body = await request.json(); }catch{ /* lege POST is geldig */ }
    const forcePlayers = body?.refreshPlayers === true;

    const {data:existingPlayers,error:existingPlayersError} = await db
      .from("players")
      .select("id,name,price,provider_player_id");
    if(existingPlayersError) throw existingPlayersError;

    const priceByName = new Map(
      (existingPlayers || []).map((p:any) => [normalizeName(p.name),Number(p.price)])
    );
    const sorareAlreadyLoaded = (existingPlayers || []).some((p:any) => String(p.id).startsWith("sorare-"));
    const unsafeProviderIds = (existingPlayers || []).some((p:any) =>
      String(p.id).startsWith("sorare-") && Math.abs(Number(p.provider_player_id || 0)) > Number.MAX_SAFE_INTEGER
    );
    const playersNeedRefresh = forcePlayers || !sorareAlreadyLoaded || unsafeProviderIds;

    const competitionQuery = `
      query {
        football {
          competition(slug:"${COMPETITION_SLUG}") {
            id
            name
            slug
            openForGameStats
            teams(first:30) {
              nodes {
                __typename
                ... on Club { id name slug }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      }
    `;
    const competitionData = await sorare(competitionQuery);
    const competition = competitionData?.football?.competition;
    if(!competition) throw new Error("Sorare gaf de Jupiler Pro League niet terug.");
    if(!competition.openForGameStats) throw new Error("Sorare markeert de Jupiler Pro League niet als openForGameStats.");

    const clubs = (competition.teams?.nodes || [])
      .filter((team:any) => team?.__typename === "Club" && team.slug);

    if(clubs.length !== 18){
      throw new Error(`Sorare gaf ${clubs.length} JPL-clubs terug; verwacht 18.`);
    }

    let importedPlayers = 0;
    if(playersNeedRefresh){
      const rows:any[] = [];
      for(const club of clubs){
        const rosterData = await sorare(`
          query Roster($slug:String!) {
            football {
              club(slug:$slug) {
                id
                name
                slug
                activePlayers(first:50) {
                  nodes {
                    id
                    slug
                    displayName
                    position
                    gameplayTierStars
                    lastFifteenSo5Appearances
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }
        `,{slug:club.slug});

        const sourceClub = rosterData?.football?.club;
        if(!sourceClub) throw new Error(`Sorare kon club ${club.slug} niet laden.`);

        for(const player of sourceClub.activePlayers?.nodes || []){
          const position = positionCode(player.position);
          if(!position || !player.slug) continue;
          const existingPrice = priceByName.get(normalizeName(player.displayName));
          rows.push({
            id:playerDbId(player.slug),
            provider_player_id:stableBigint(`sorare-player:${player.id || player.slug}`),
            name:player.displayName,
            club_id:stableBigint(`sorare-club:${sourceClub.id}`),
            club_name:sourceClub.name,
            position,
            minutes:0,
            price:existingPrice ?? startingPrice(
              position,
              player.displayName,
              player.lastFifteenSo5Appearances,
              player.gameplayTierStars
            ),
            active:true,
            updated_at:new Date().toISOString()
          });
        }
      }

      if(rows.length < 270){
        throw new Error(`Sorare roster-import gaf slechts ${rows.length} bruikbare JPL-spelers terug.`);
      }

      const {error:deactivateError} = await db.from("players").update({active:false}).eq("active",true);
      if(deactivateError) throw deactivateError;

      for(const part of chunks(rows,200)){
        const {error} = await db.from("players").upsert(part,{onConflict:"id"});
        if(error) throw error;
      }
      importedPlayers = rows.length;
    }

    const fetchGames = async (field:"pastGames"|"futureGames") => {
      const collected:any[] = [];
      let after:string|null = null;
      for(let page=0;page<20;page++){
        const data = await sorare(`
          query Games($after:String) {
            football {
              competition(slug:"${COMPETITION_SLUG}") {
                ${field}(first:${GAME_PAGE_SIZE},after:$after) {
                  nodes {
                    id
                    date
                    statusTyped
                    homeScore
                    awayScore
                    homeTeam {
                      __typename
                      ... on Club { id name slug }
                    }
                    awayTeam {
                      __typename
                      ... on Club { id name slug }
                    }
                  }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
          }
        `,{after});

        const connection = data?.football?.competition?.[field];
        const nodes = connection?.nodes || [];
        collected.push(...nodes);

        if(!connection?.pageInfo?.hasNextPage || !connection.pageInfo.endCursor) break;

        const times = nodes.map((g:any)=>new Date(g.date).getTime()).filter(Number.isFinite);
        if(field === "pastGames" && times.length && Math.max(...times) < SEASON_FROM) break;
        if(field === "futureGames" && times.length && Math.min(...times) >= SEASON_TO) break;

        after = connection.pageInfo.endCursor;
      }
      return collected;
    };

    const [pastGames,futureGames] = await Promise.all([
      fetchGames("pastGames"),
      fetchGames("futureGames")
    ]);

    const gameMap = new Map<string,any>();
    for(const game of [...pastGames,...futureGames]){
      const time = new Date(game.date).getTime();
      if(!Number.isFinite(time) || time < SEASON_FROM || time >= SEASON_TO) continue;
      if(!game.id || !game.homeTeam?.id || !game.awayTeam?.id) continue;
      gameMap.set(String(game.id),game);
    }

    const games = [...gameMap.values()];
    if(games.length < 100){
      throw new Error(`Sorare gaf slechts ${games.length} wedstrijden voor seizoen 2026/27 terug.`);
    }

    const rounds = assignRounds(games);
    const completeRoundCount = rounds.filter(r=>r.games.length===9).length;
    if(!completeRoundCount){
      throw new Error("Kon geen volledige JPL-speeldag van 9 wedstrijden reconstrueren.");
    }

    const now = Date.now();
    const gameweekRows = rounds.map(round => {
      const times = round.games.map(g=>new Date(g.date).getTime()).filter(Number.isFinite);
      const lockAt = Math.min(...times);
      const finished = round.games.length === 9 && round.games.every(g=>String(g.statusTyped).toLowerCase()==="played");
      const started = Number.isFinite(lockAt) && now >= lockAt;
      return {
        season:SEASON_START,
        number:round.number,
        name:`Speeldag ${round.number}`,
        lock_at:new Date(lockAt).toISOString(),
        status:finished ? "finished" : started ? "active" : "upcoming"
      };
    });

    const {data:gameweeks,error:gameweekError} = await db
      .from("gameweeks")
      .upsert(gameweekRows,{onConflict:"season,number"})
      .select("id,number,status,lock_at");
    if(gameweekError) throw gameweekError;

    const gameweekIds = new Map((gameweeks || []).map((g:any)=>[Number(g.number),Number(g.id)]));

    // De eerste Sorare-versie gebruikte 63-bit hashes. Die kunnen bij JSON -> JavaScript
    // afgerond worden, waardoor player stats nooit aan de juiste fixture gekoppeld raakten.
    // Ruim die legacy fixtures éénmalig op; ON DELETE CASCADE verwijdert ook lege/oude stats.
    const seasonGameweekIds = [...gameweekIds.values()];
    let migratedUnsafeFixtureIds = false;
    if(seasonGameweekIds.length){
      const {data:existingSeasonFixtures,error:existingFixtureError} = await db
        .from("fixtures")
        .select("id")
        .in("gameweek_id",seasonGameweekIds)
        .limit(1000);
      if(existingFixtureError) throw existingFixtureError;

      const hasUnsafeFixtureIds = (existingSeasonFixtures || []).some((fixture:any) =>
        Math.abs(Number(fixture.id || 0)) > Number.MAX_SAFE_INTEGER
      );
      if(hasUnsafeFixtureIds){
        const {error:cleanupError} = await db
          .from("fixtures")
          .delete()
          .in("gameweek_id",seasonGameweekIds);
        if(cleanupError) throw cleanupError;
        migratedUnsafeFixtureIds = true;
      }
    }

    // Verwijder een eventuele foutieve extra speeldag uit de eerdere reconstructie.
    const {error:extraGameweekError} = await db
      .from("gameweeks")
      .delete()
      .eq("season",SEASON_START)
      .gt("number",34);
    if(extraGameweekError) throw extraGameweekError;

    const roundByProviderGame = new Map<string,number>();
    for(const round of rounds){
      for(const game of round.games) roundByProviderGame.set(String(game.id),round.number);
    }

    const fixtureRows = games.flatMap(game => {
      const number = roundByProviderGame.get(String(game.id));
      const gameweekId = number ? gameweekIds.get(number) : null;
      if(!gameweekId) return [];
      return [{
        id:fixtureDbId(String(game.id)),
        gameweek_id:gameweekId,
        kickoff:game.date,
        status:statusCode(game.statusTyped),
        home_team:game.homeTeam?.name || "Onbekend",
        away_team:game.awayTeam?.name || "Onbekend",
        home_score:String(game.statusTyped).toLowerCase()==="played" ? num(game.homeScore) : null,
        away_score:String(game.statusTyped).toLowerCase()==="played" ? num(game.awayScore) : null,
        updated_at:new Date().toISOString()
      }];
    });

    for(const part of chunks(fixtureRows,200)){
      const {error} = await db.from("fixtures").upsert(part,{onConflict:"id"});
      if(error) throw error;
    }

    const latestCompleted = rounds
      .filter(r=>r.games.length===9 && r.games.every(g=>String(g.statusTyped).toLowerCase()==="played"))
      .sort((a,b)=>b.number-a.number)[0];

    if(!latestCompleted) throw new Error("Geen volledig afgewerkte JPL-speeldag gevonden.");

    const latestCompletedId = gameweekIds.get(latestCompleted.number);
    if(!latestCompletedId) throw new Error("Laatste afgewerkte speeldag ontbreekt in de database.");

    const {data:pending,error:pendingError} = await db
      .from("fixtures")
      .select("id,gameweek_id,kickoff")
      .eq("gameweek_id",latestCompletedId)
      .eq("stats_processed",false)
      .eq("status","FT")
      .order("kickoff",{ascending:true});
    if(pendingError) throw pendingError;

    let processedFixtures = 0;
    let importedPlayerRows = 0;
    const incompleteFixtures:string[] = [];
    const touchedGameweeks = new Set<number>();

    if((pending || []).length){
      const {data:activePlayers,error:activePlayersError} = await db
        .from("players")
        .select("id,name,position")
        .eq("active",true)
        .like("id","sorare-%");
      if(activePlayersError) throw activePlayersError;

      const slugs = (activePlayers || [])
        .map((p:any)=>String(p.id).replace(/^sorare-/,""))
        .filter(Boolean);

      if(slugs.length < 270){
        throw new Error(`Database bevat slechts ${slugs.length} actieve Sorare JPL-spelers. Voer eerst refreshPlayers uit.`);
      }

      const positionByPlayerId = new Map((activePlayers || []).map((p:any)=>[String(p.id),String(p.position)]));
      const pendingById = new Map((pending || []).map((f:any)=>[String(f.id),f]));
      const statRows:any[] = [];
      const rowCountByFixture = new Map<string,number>();

      for(const batch of chunks(slugs,PLAYER_BATCH_SIZE)){
        const data = await sorare(`
          query PlayerStats($slugs:[String!]!) {
            players(slugs:$slugs) {
              ... on Player {
                id
                slug
                displayName
                position
                gameStats(last:${PLAYER_STATS_LAST},lowCoverage:true) {
                  id
                  minsPlayed
                  saves
                  savedIbox
                  punches
                  cleanSheet
                  goalsConceded
                  fouls
                  wasFouled
                  yellowCard
                  redCard
                  goals
                  goalAssist
                  wonTackle
                  duelWon
                  duelLost
                  totalClearance
                  interceptionWon
                  possWon
                  possLostCtrl
                  accuratePass
                  accurateLongBalls
                  missedPass
                  wonContest
                  ontargetScoringAtt
                  footballGame {
                    id
                    date
                    statusTyped
                    competition { slug }
                  }
                }
              }
            }
          }
        `,{slugs:batch});

        for(const player of data?.players || []){
          if(!player?.slug) continue;
          const playerId = playerDbId(player.slug);
          const position = positionByPlayerId.get(playerId) || positionCode(player.position);
          if(!position) continue;

          for(const raw of player.gameStats || []){
            const sourceGame = raw.footballGame;
            if(sourceGame?.competition?.slug !== COMPETITION_SLUG) continue;
            if(String(sourceGame?.statusTyped).toLowerCase() !== "played") continue;

            const fixtureId = fixtureDbId(String(sourceGame.id));
            if(!pendingById.has(fixtureId)) continue;

            const stats = mapSorareStats(raw);
            statRows.push({
              fixture_id:fixtureId,
              player_id:playerId,
              minutes:stats.minutes,
              stats:{
                ...stats,
                provider:"sorare",
                sorareStatId:raw.id,
                sorareGameId:sourceGame.id
              },
              fantasy_points:fantasyScore(position,stats),
              updated_at:new Date().toISOString()
            });
            rowCountByFixture.set(fixtureId,(rowCountByFixture.get(fixtureId)||0)+1);
          }
        }
      }

      for(const part of chunks(statRows,200)){
        const {error} = await db.from("player_match_stats").upsert(part,{onConflict:"fixture_id,player_id"});
        if(error) throw error;
      }
      importedPlayerRows = statRows.length;

      for(const fixture of pending || []){
        const id = String(fixture.id);
        const count = rowCountByFixture.get(id) || 0;
        // Een volledige wedstrijd hoort minstens de 22 starters te bevatten.
        // We laten een fixture bewust pending bij te weinig Sorare-rijen.
        if(count < 18){
          incompleteFixtures.push(id);
          continue;
        }
        const {error} = await db.from("fixtures")
          .update({stats_processed:true,updated_at:new Date().toISOString()})
          .eq("id",fixture.id);
        if(error) throw error;
        touchedGameweeks.add(Number(fixture.gameweek_id));
        processedFixtures += 1;
      }
    }

    for(const gameweek of gameweeks || []){
      if(gameweek.status === "active"){
        const {error} = await db.rpc("lock_gameweek",{p_gameweek_id:gameweek.id});
        if(error) throw error;
      }
    }

    for(const id of touchedGameweeks){
      const {error} = await db.rpc("recalculate_gameweek_scores",{p_gameweek_id:id});
      if(error) throw error;
    }
    if(touchedGameweeks.size){
      const {error} = await db.rpc("refresh_player_totals");
      if(error) throw error;
    }

    return Response.json({
      ok:true,
      source:"Sorare",
      competition:COMPETITION_SLUG,
      season:SEASON_START,
      clubs:clubs.length,
      reconstructedGameweeks:rounds.length,
      completeGameweeks:completeRoundCount,
      migratedUnsafeFixtureIds,
      fixtures:fixtureRows.length,
      latestCompletedGameweek:latestCompleted.number,
      playerRefresh:playersNeedRefresh,
      playersImported:importedPlayers,
      pendingFixtures:(pending || []).length,
      processedFixtures,
      incompleteFixtures,
      importedPlayerRows,
      unsupportedScoringStats:["keyPass"],
      apiCalls,
      durationMs:Date.now()-started
    });
  }catch(error){
    console.error(error);
    return Response.json({
      ok:false,
      source:"Sorare",
      error:error instanceof Error ? error.message : String(error)
    },{status:500});
  }
});
