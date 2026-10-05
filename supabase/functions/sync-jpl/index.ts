import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const API_ROOT = "https://v3.football.api-sports.io";
const FINISHED = new Set(["FT","AET","PEN"]);
const TERMINAL = new Set(["FT","AET","PEN","PST","CANC","ABD","AWD","WO"]);
const LIVE = new Set(["1H","HT","2H","ET","BT","P","SUSP","INT"]);

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

async function football(path:string){
  const response = await fetch(`${API_ROOT}${path}`,{headers:{"x-apisports-key":env("API_FOOTBALL_KEY")}});
  if(!response.ok) throw new Error(`API-FOOTBALL ${response.status}: ${await response.text()}`);
  const body = await response.json();
  if(body.errors && Object.keys(body.errors).length) throw new Error(`API-FOOTBALL: ${JSON.stringify(body.errors)}`);
  return body;
}

function roundNumber(label:string){
  const found = String(label || "").match(/(\d+)\s*$/);
  return found ? Number(found[1]) : null;
}

function positionCode(value:string){
  const p = String(value || "").toLowerCase();
  if(p.includes("goal")) return "GK";
  if(p.includes("def")) return "DEF";
  if(p.includes("mid")) return "MID";
  return "FWD";
}

function startingPrice(position:string,minutes=0,name="",stat:any={}){
  if(name.toLowerCase() === "hans vanaken") return 25;
  if(minutes <= 0) return 1;
  if(minutes < 90) return 2;
  if(minutes < 270) return 4;
  const base:Record<string,number> = {GK:8,DEF:9,MID:10,FWD:11};
  const availability = Math.min(4,minutes/180);
  const output = num(stat.goals?.total)*.75 + num(stat.goals?.assists)*.5;
  const rating = Math.max(0,num(stat.games?.rating)-6.5);
  return Math.min(24,Math.round((base[position]+availability+output+rating)*2)/2);
}

function num(value:unknown){
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function accuracy(value:unknown){
  return num(String(value ?? "0").replace("%",""));
}

function fantasyScore(position:string,stats:Record<string,number>){
  return Math.round(Object.entries(weights[position] || {}).reduce((total,[key,weight]) => total + num(stats[key])*weight,0)*100)/100;
}

function mapStats(raw:any,position:string,teamGoalsConceded:number){
  const passes = num(raw.passes?.total);
  const successfulPass = Math.round(passes * accuracy(raw.passes?.accuracy) / 100);
  const duelWon = num(raw.duels?.won);
  const tackles = num(raw.tackles?.total);
  const interceptions = num(raw.tackles?.interceptions);
  const minutes = num(raw.games?.minutes);
  return {
    minutes,
    save:num(raw.goals?.saves),
    cleanSheet:position === "GK" && minutes > 0 && teamGoalsConceded === 0 ? 1 : 0,
    savesInsideBox:0,
    punches:0,
    goalsConceded:minutes > 0 ? teamGoalsConceded : 0,
    foulsMade:num(raw.fouls?.committed),
    foulsDrawn:num(raw.fouls?.drawn),
    yellow:num(raw.cards?.yellow),
    red:num(raw.cards?.red),
    goal:num(raw.goals?.total),
    assist:num(raw.goals?.assists),
    successfulTackles:tackles,
    duelWon,
    duelLost:Math.max(0,num(raw.duels?.total)-duelWon),
    clearances:0,
    interceptions,
    possessionWon:tackles+interceptions,
    possessionLost:0,
    successfulPass,
    successfulLongPass:0,
    keyPass:num(raw.passes?.key),
    passMissed:Math.max(0,passes-successfulPass),
    successfulDribble:num(raw.dribbles?.success),
    shotOnTarget:num(raw.shots?.on)
  };
}

Deno.serve(async request => {
  if(request.method !== "POST") return new Response("Method not allowed",{status:405});
  const started = Date.now();
  try{
    const season = Number(env("API_FOOTBALL_SEASON","2026"));
    const league = Number(env("API_FOOTBALL_LEAGUE_ID","144"));
    const db = createClient(env("SUPABASE_URL"),env("SUPABASE_SERVICE_ROLE_KEY"),{auth:{persistSession:false}});
    const {data:existingPlayers,error:existingPlayersError} = await db.from("players").select("provider_player_id,price");
    if(existingPlayersError) throw existingPlayersError;
    const existingPrices = new Map((existingPlayers || []).map(p => [Number(p.provider_player_id),Number(p.price)]));

    const fixturesPayload = await football(`/fixtures?league=${league}&season=${season}`);
    const fixtures = fixturesPayload.response || [];
    const byRound = new Map<number,any[]>();
    for(const item of fixtures){
      const number = roundNumber(item.league?.round);
      if(!number) continue;
      if(!byRound.has(number)) byRound.set(number,[]);
      byRound.get(number)!.push(item);
    }

    const gameweekIds = new Map<number,number>();
    for(const [number,games] of byRound){
      const lockAt = games.map(g => new Date(g.fixture.date).getTime()).sort((a,b) => a-b)[0];
      const statuses = games.map(g => g.fixture.status.short);
      const status = statuses.every(s => TERMINAL.has(s)) ? "finished" : (Date.now() >= lockAt || statuses.some(s => LIVE.has(s))) ? "active" : "upcoming";
      const {data,error} = await db.from("gameweeks").upsert({season,number,name:`Speeldag ${number}`,lock_at:new Date(lockAt).toISOString(),status},{onConflict:"season,number"}).select("id").single();
      if(error) throw error;
      gameweekIds.set(number,data.id);
    }

    const fixtureRows = fixtures.flatMap((item:any) => {
      const number = roundNumber(item.league?.round);
      const gameweekId = number ? gameweekIds.get(number) : null;
      if(!gameweekId) return [];
      return [{
        id:item.fixture.id,gameweek_id:gameweekId,kickoff:item.fixture.date,
        status:item.fixture.status.short,home_team:item.teams.home.name,away_team:item.teams.away.name,
        home_score:item.goals.home,away_score:item.goals.away,updated_at:new Date().toISOString()
      }];
    });
    if(fixtureRows.length){
      const {error} = await db.from("fixtures").upsert(fixtureRows,{onConflict:"id"});
      if(error) throw error;
    }

    let page = 1;
    const playerRows:any[] = [];
    do{
      const payload = await football(`/players?league=${league}&season=${season}&page=${page}`);
      for(const entry of payload.response || []){
        const stat = entry.statistics?.[0] || {};
        const position = positionCode(stat.games?.position);
        const minutes = num(stat.games?.minutes);
        playerRows.push({
          id:`af-${entry.player.id}`,provider_player_id:entry.player.id,name:entry.player.name,
          club_id:stat.team?.id,club_name:stat.team?.name || "Onbekende club",position,minutes,
          price:existingPrices.get(Number(entry.player.id)) ?? startingPrice(position,minutes,entry.player.name,stat),
          active:true,updated_at:new Date().toISOString()
        });
      }
      const total = num(payload.paging?.total) || 1;
      page += 1;
      if(page > total) break;
    }while(page <= 50);
    if(playerRows.length){
      const {error} = await db.from("players").upsert(playerRows,{onConflict:"provider_player_id",ignoreDuplicates:false});
      if(error) throw error;
    }

    const {data:pending,error:pendingError} = await db.from("fixtures").select("id,gameweek_id").in("status",[...FINISHED]).eq("stats_processed",false).limit(25);
    if(pendingError) throw pendingError;
    const rawFixture = new Map(fixtures.map((f:any) => [f.fixture.id,f]));
    const touchedGameweeks = new Set<number>();

    for(const fixture of pending || []){
      const payload = await football(`/fixtures/players?fixture=${fixture.id}`);
      const sourceFixture:any = rawFixture.get(fixture.id);
      const rows:any[] = [];
      for(const teamBlock of payload.response || []){
        const isHome = sourceFixture && teamBlock.team.id === sourceFixture.teams.home.id;
        const conceded = sourceFixture ? num(isHome ? sourceFixture.goals.away : sourceFixture.goals.home) : 0;
        for(const entry of teamBlock.players || []){
          const raw = entry.statistics?.[0] || {};
          const position = positionCode(raw.games?.position);
          const id = `af-${entry.player.id}`;
          const stats = mapStats(raw,position,conceded);
          await db.from("players").upsert({
            id,provider_player_id:entry.player.id,name:entry.player.name,club_id:teamBlock.team.id,
            club_name:teamBlock.team.name,position,minutes:0,
            price:existingPrices.get(Number(entry.player.id)) ?? startingPrice(position,0,entry.player.name,raw),
            active:true,updated_at:new Date().toISOString()
          },{onConflict:"provider_player_id",ignoreDuplicates:true});
          rows.push({fixture_id:fixture.id,player_id:id,minutes:num(raw.games?.minutes),stats,fantasy_points:fantasyScore(position,stats),updated_at:new Date().toISOString()});
        }
      }
      if(rows.length){
        const {error} = await db.from("player_match_stats").upsert(rows,{onConflict:"fixture_id,player_id"});
        if(error) throw error;
      }
      const {error} = await db.from("fixtures").update({stats_processed:true,updated_at:new Date().toISOString()}).eq("id",fixture.id);
      if(error) throw error;
      touchedGameweeks.add(fixture.gameweek_id);
    }

    for(const [number,id] of gameweekIds){
      const games = byRound.get(number) || [];
      const lockAt = Math.min(...games.map(g => new Date(g.fixture.date).getTime()));
      if(Date.now() >= lockAt) await db.rpc("lock_gameweek",{p_gameweek_id:id});
    }
    for(const id of touchedGameweeks) await db.rpc("recalculate_gameweek_scores",{p_gameweek_id:id});
    await db.rpc("refresh_player_totals");

    return Response.json({ok:true,season,league,fixtures:fixtureRows.length,players:playerRows.length,processedFixtures:(pending || []).length,durationMs:Date.now()-started});
  }catch(error){
    console.error(error);
    return Response.json({ok:false,error:error instanceof Error ? error.message : String(error)},{status:500});
  }
});
