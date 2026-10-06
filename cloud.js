(function(){
  "use strict";

  const cfg = window.FANTASY_CONFIG || {};
  const cloud = {
    enabled: Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && window.supabase),
    client: null,
    user: null,
    locked: false,
    deadline: null,
    saveTimer: null,
    loadingTeam: false,
    currentGameweekId: null,
    currentGameweekNumber: null,
    liveScoreTimer: null
  };

  const original = {
    saveState,
    buyPlayer,
    sellPlayer,
    setBench,
    autoLineup,
    resetSquad,
    renderMarket,
    renderHeader
  };

  function make(tag,className,text){
    const el = document.createElement(tag);
    if(className) el.className = className;
    if(text != null) el.textContent = text;
    return el;
  }

  function injectUi(){
    document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="cloud.css">');
    const bar = make("div","cloud-bar");
    bar.innerHTML = '<span id="cloudStatus" class="cloud-status">Demo op dit toestel</span><button id="authButton" class="btn secondary-btn" type="button">Inloggen</button>';
    document.querySelector(".topbar").appendChild(bar);

    const deadline = make("div","deadline-card");
    deadline.id = "deadlineCard";
    deadline.innerHTML = '<span id="syncDot" class="sync-dot"></span><div><strong id="deadlineTitle">Speeldagdeadline</strong><small id="deadlineText">Nog niet gekoppeld</small></div>';
    document.querySelector("main").prepend(deadline);

    const transfers = make("div","transfer-card");
    transfers.id = "transferCard";
    transfers.innerHTML = '<div><strong id="transferTitle">Transfers</strong><small id="transferText">2 gratis per speeldag · daarna −4 punten per extra transfer</small></div><span id="transferCounter" class="transfer-counter">0 / 2</span>';
    deadline.insertAdjacentElement("afterend",transfers);

    const dialog = document.createElement("dialog");
    dialog.id = "authDialog";
    dialog.className = "auth-dialog";
    dialog.innerHTML = '<form id="authForm"><h2>Fantasy-account</h2><p>Log in met je naam en wachtwoord om je team, budget en score centraal te bewaren.</p><button id="googleAuthButton" class="google-auth-btn" type="button"><span class="google-g" aria-hidden="true">G</span><span>Doorgaan met Google</span></button><div class="auth-divider"><span>of met naam</span></div><label><span>Naam</span><input id="authIdentity" type="text" autocomplete="username" maxlength="28" placeholder="bv. Hugo"></label><label><span>Wachtwoord</span><input id="authPassword" type="password" autocomplete="current-password" minlength="4"></label><div id="authError" class="auth-error" role="alert"></div><div class="auth-actions"><button id="closeAuth" class="btn secondary-btn" type="button">Annuleren</button><button id="signupButton" class="btn secondary-btn" type="button">Account maken</button><button class="btn primary-btn" type="submit">Inloggen</button></div></form>';
    document.body.appendChild(dialog);

    document.getElementById("authButton").addEventListener("click", onAuthButton);
    document.getElementById("closeAuth").addEventListener("click", () => dialog.close());
    document.getElementById("googleAuthButton").addEventListener("click", signInWithGoogle);
    document.getElementById("authForm").addEventListener("submit", event => { event.preventDefault(); signIn(); });
    document.getElementById("signupButton").addEventListener("click", signUp);
  }

  function showSetupBanner(){
    const banner = make("div","backend-banner","De site draait nog in demomodus op dit toestel. Vul config.js in en voer de Supabase-migratie uit om accounts, live data, scores en deadlines te activeren.");
    document.querySelector("main").prepend(banner);
    document.getElementById("authButton").textContent = "Backend instellen";
    document.getElementById("deadlineText").textContent = "Demomodus — wijzigingen worden alleen lokaal bewaard";
    document.getElementById("transferText").textContent = "Wordt actief zodra de backend gekoppeld is";
  }

  function setStatus(text,kind){
    const el = document.getElementById("cloudStatus");
    el.textContent = text;
    el.className = "cloud-status" + (kind ? " " + kind : "");
    const dot = document.getElementById("syncDot");
    dot.className = "sync-dot" + (kind ? " " + kind : "");
  }

  function normalizeUsername(value){
    return String(value || "").trim().replace(/\s+/g," ").toLowerCase();
  }

  function usernameEmail(value){
    const normalized = normalizeUsername(value);
    if(normalized.includes("@")) return normalized;
    const bytes = new TextEncoder().encode(normalized);
    const hex = Array.from(bytes,b => b.toString(16).padStart(2,"0")).join("");
    return "u-" + hex + "@fantasy.invalid";
  }

  function authValues(){
    const identity = document.getElementById("authIdentity").value.trim();
    return {
      identity,
      email: usernameEmail(identity),
      password: document.getElementById("authPassword").value
    };
  }

  function authError(message){
    document.getElementById("authError").textContent = message || "";
  }

  async function onAuthButton(){
    if(!cloud.enabled){
      toast("Volg BACKEND_SETUP.md om Supabase te activeren.");
      return;
    }
    if(cloud.user){
      await cloud.client.auth.signOut();
      return;
    }
    authError("");
    document.getElementById("authDialog").showModal();
  }

  async function signIn(){
    authError("");
    const {identity,email,password} = authValues();
    if(!identity || !password){
      authError("Vul je naam en wachtwoord in, of kies Google.");
      return;
    }
    const {error} = await cloud.client.auth.signInWithPassword({email,password});
    if(error){
      if(/invalid login credentials/i.test(error.message)) authError("Naam of wachtwoord is fout.");
      else authError(error.message);
    }else document.getElementById("authDialog").close();
  }

  function oauthReturnUrl(){
    return location.origin + location.pathname;
  }

  async function signInWithGoogle(){
    authError("");
    const button = document.getElementById("googleAuthButton");
    button.disabled = true;
    button.classList.add("loading");
    try{
      const {error} = await cloud.client.auth.signInWithOAuth({
        provider:"google",
        options:{
          redirectTo:oauthReturnUrl(),
          queryParams:{prompt:"select_account"}
        }
      });
      if(error){
        authError(error.message);
        button.disabled = false;
        button.classList.remove("loading");
      }
    }catch(error){
      authError(error?.message || "Google-login kon niet worden gestart.");
      button.disabled = false;
      button.classList.remove("loading");
    }
  }

  async function signUp(){
    authError("");
    const {identity,email,password} = authValues();
    const displayName = identity.trim();
    if(!displayName || displayName.length > 28){
      authError("Kies een naam van 1 tot 28 tekens.");
      return;
    }
    if(password.length < 4){
      authError("Je wachtwoord moet minstens 4 tekens hebben.");
      return;
    }

    const button = document.getElementById("signupButton");
    button.disabled = true;
    button.textContent = "Bezig…";

    try{
      const response = await fetch(cfg.supabaseUrl + "/functions/v1/register-username",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "apikey":cfg.supabaseAnonKey
        },
        body:JSON.stringify({username:displayName,password})
      });

      let payload = {};
      try{ payload = await response.json(); }catch(_error){}

      if(!response.ok || !payload.ok){
        authError(payload.error || "Account kon niet worden gemaakt.");
        return;
      }

      const {error} = await cloud.client.auth.signInWithPassword({email,password});
      if(error){
        authError("Account is gemaakt, maar automatisch inloggen lukte niet: " + error.message);
        return;
      }

      document.getElementById("authDialog").close();
    }catch(error){
      authError(error?.message || "Account kon niet worden gemaakt.");
    }finally{
      button.disabled = false;
      button.textContent = "Account maken";
    }
  }

  function requireEditable(){
    if(!cloud.enabled) return true;
    if(!cloud.user){
      document.getElementById("authDialog").showModal();
      toast("Log eerst in om je team te wijzigen.");
      return false;
    }
    if(cloud.locked){
      toast("Je opstelling is vergrendeld omdat de speeldag begonnen is.");
      return false;
    }
    return true;
  }

  function wrapMutations(){
    saveState = function(){
      original.saveState();
      queueRemoteSave();
    };
    buyPlayer = function(id){ if(requireEditable()) return original.buyPlayer(id); };
    sellPlayer = function(id){ if(requireEditable()) return original.sellPlayer(id); };
    setBench = function(id){ if(requireEditable()) return original.setBench(id); };
    autoLineup = function(){ if(requireEditable()) return original.autoLineup(); };
    resetSquad = function(){ if(requireEditable()) return original.resetSquad(); };
    renderMarket = function(){
      original.renderMarket();
      document.querySelectorAll(".player-card").forEach(card => {
        const id = card.querySelector(".buy-btn")?.dataset.id;
        const player = id ? playerById(id) : null;
        const score = card.querySelector(".player-meta div:nth-child(2) strong");
        if(score && player) score.textContent = Number(player.score || 0).toFixed(1).replace(".0","");
      });
    };
    renderHeader = function(){
      original.renderHeader();
      if(cloud.enabled && cloud.user && cloud.totalPoints != null){
        const value = Number(cloud.totalPoints).toFixed(1).replace(".0","");
        document.getElementById("pointsDisplay").textContent = value;
        const leader = document.getElementById("leaderPoints");
        if(leader) leader.textContent = value + " pts";
      }
    };

    document.getElementById("teamName").addEventListener("change", () => {
      if(requireEditable()) queueRemoteSave(0);
    });
  }

  function queueRemoteSave(delay){
    if(!cloud.enabled || !cloud.user || cloud.locked || cloud.loadingTeam) return;
    clearTimeout(cloud.saveTimer);
    cloud.saveTimer = setTimeout(saveTeamRemote, delay == null ? 450 : delay);
  }

  async function saveTeamRemote(){
    setStatus("Team opslaan…","");
    const {data,error} = await cloud.client.rpc("save_my_team",{
      p_name: state.teamName,
      p_squad_ids: state.squad,
      p_bench_gk_id: state.benchGK,
      p_bench_outfield_id: state.benchOutfield
    });
    if(error){
      if(/locked|vergrendeld|deadline/i.test(error.message)){
        cloud.locked = true;
        updateEditability();
      }
      setStatus("Opslaan mislukt",cloud.locked ? "locked" : "");
      toast(error.message);
      await loadTeam();
      return;
    }
    setStatus("Online opgeslagen","online");
    const result = Array.isArray(data) ? data[0] : data;
    if(result && result.locked) cloud.locked = true;
    await loadTransferStatus();
    await loadTeam();
  }

  async function loadAllPriceHistory(){
    const rows = [];
    const pageSize = 1000;
    for(let from=0; from<10000; from+=pageSize){
      const {data,error} = await cloud.client
        .from("player_match_stats")
        .select("player_id,minutes,stats,fixtures(kickoff,status)")
        .range(from,from+pageSize-1);
      if(error) throw error;
      rows.push(...(data || []));
      if(!data || data.length < pageSize) break;
    }
    return rows;
  }

  async function loadPlayers(){
    const [{data,error},priceHistoryResult] = await Promise.all([
      cloud.client.from("players").select("id,name,club_name,position,minutes,price,total_points").eq("active",true).order("name"),
      loadAllPriceHistory()
        .then(data => ({data,error:null}))
        .catch(error => ({data:[],error}))
    ]);
    if(error) throw error;

    const priceRows = priceHistoryResult.data || [];
    if(priceHistoryResult.error){
      console.warn("Laatste prijswijziging kon niet volledig worden geladen",priceHistoryResult.error.message);
    }
    if(!data || !data.length) return;

    const latestPriceChange = new Map();
    for(const row of priceRows){
      const fixture = Array.isArray(row.fixtures) ? row.fixtures[0] : row.fixtures;
      if(!fixture || fixture.status !== "FT") continue;
      if(Number(row.minutes || 0) <= 0) continue;
      const deltaRaw = row.stats?.priceDelta;
      if(deltaRaw == null || !Number.isFinite(Number(deltaRaw))) continue;
      const kickoff = String(fixture.kickoff || "");
      const previous = latestPriceChange.get(String(row.player_id));
      if(!previous || kickoff > previous.kickoff){
        latestPriceChange.set(String(row.player_id),{
          kickoff,
          delta:Number(deltaRaw)
        });
      }
    }

    PLAYERS.splice(0,PLAYERS.length,...data.map(p => ({
      id:p.id,name:p.name,club:p.club_name,pos:p.position,minutes:p.minutes,
      price:Number(p.price),score:Number(p.total_points || 0),
      lastPriceDelta:latestPriceChange.get(String(p.id))?.delta ?? 0
    })));
    const clubs = [...new Set(PLAYERS.map(p => p.club))].sort((a,b) => a.localeCompare(b,"nl"));
    CLUBS.splice(0,CLUBS.length,...clubs);
    state.squad = state.squad.filter(id => PLAYERS.some(p => p.id === id));
    renderClubFilter();
  }

  async function loadFixtures(){
    const {data,error} = await cloud.client
      .from("fixtures")
      .select("id,kickoff,status,home_team,away_team,home_score,away_score,gameweeks(number)")
      .order("kickoff",{ascending:true})
      .limit(400);
    if(error) throw error;
    if(!data || !data.length) return;
    const date = new Intl.DateTimeFormat("nl-BE",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
    MATCHES.splice(0,MATCHES.length,...data.map(f => {
      const gameweek = f.gameweeks ? Number(f.gameweeks.number) : null;
      return {
        id:f.id,
        kickoff:f.kickoff,
        status:f.status,
        date:date.format(new Date(f.kickoff)),
        gameweek,
        week:"Speeldag " + (gameweek || "?"),
        home:f.home_team,away:f.away_team,
        homeScore:f.home_score == null ? "–" : f.home_score,
        awayScore:f.away_score == null ? "–" : f.away_score
      };
    }));
    renderMatches();
  }

  async function loadMatchDetail(fixtureId,fallbackMatch){
    const match = fallbackMatch || MATCHES.find(m => String(m.id) === String(fixtureId));
    if(!match) return;

    const {data,error} = await cloud.client
      .from("player_match_stats")
      .select("player_id,minutes,stats,fantasy_points,players(id,name,club_name,position)")
      .eq("fixture_id",fixtureId)
      .limit(100);
    if(error){
      console.error(error);
      document.getElementById("matchDetail").innerHTML = '<div class="empty-state">De wedstrijddata kon niet worden geladen.</div>';
      return;
    }

    const rows = (data || []).map(row => {
      const player = Array.isArray(row.players) ? row.players[0] : row.players;
      return {...row,player:player || {id:row.player_id,name:"Onbekend",club_name:"",position:"MID"}};
    });
    renderMatchDetail(match,rows);
  }

  async function loadGameweekBalance(){
    const {data,error} = await cloud.client.rpc("latest_gameweek_balance");
    if(error){
      console.warn("Balansdata nog niet beschikbaar",error.message);
      renderGameweekBalance([]);
      return;
    }
    renderGameweekBalance(data || []);
  }

  async function loadTeam(){
    if(!cloud.user) return;
    const {data,error} = await cloud.client.from("teams").select("team_name,squad_ids,bench_gk_id,bench_outfield_id,budget,total_points").eq("user_id",cloud.user.id).maybeSingle();
    if(error) throw error;
    if(!data) return;
    cloud.loadingTeam = true;
    state.teamName = data.team_name || "Mijn Fantasy Team";
    state.cash = Number(data.budget ?? START_BUDGET);
    state.squad = Array.isArray(data.squad_ids) ? data.squad_ids.filter(id => PLAYERS.some(p => p.id === id)) : [];
    state.benchGK = state.squad.includes(data.bench_gk_id) ? data.bench_gk_id : null;
    state.benchOutfield = state.squad.includes(data.bench_outfield_id) ? data.bench_outfield_id : null;
    original.saveState();
    cloud.loadingTeam = false;
    renderAll();
    cloud.totalPoints = Number(data.total_points || 0);
    updateEditability();
    renderHeader();
  }

  async function loadLeaderboard(){
    const {data,error} = await cloud.client.rpc("public_leaderboard");
    if(error) throw error;
    const card = document.querySelector(".leaderboard-card");
    card.innerHTML = '<div class="leader-head"><span>#</span><span>Team</span><span>Speeldag</span><span>Totaal</span></div>';
    (data || []).forEach((row,index) => {
      const mine = cloud.user && row.manager_id === cloud.user.id;
      const line = make("button","leader-row" + (mine ? " current-user" : ""));
      line.type = "button";
      const rank = make("span","rank",String(index + 1));
      const info = make("div");
      info.appendChild(make("strong","",row.team_name));
      if(mine) info.querySelector("strong").id = "leaderTeamName";
      info.appendChild(make("small","",mine ? "Jij · klik voor historiek" : "Klik voor historiek"));
      const latest = make("strong","gameweek-points",row.latest_gameweek_number
        ? "S" + row.latest_gameweek_number + " · " + Number(row.latest_gameweek_points || 0).toFixed(1).replace(".0","")
        : "—");
      const points = make("strong","",Number(row.total_points || 0).toFixed(1).replace(".0","") + " pts");
      if(mine) points.id = "leaderPoints";
      line.append(rank,info,latest,points);
      line.addEventListener("click",() => loadManagerHistory(row.manager_id,row.team_name));
      card.appendChild(line);
    });
    if(!data || !data.length){
      card.appendChild(make("div","empty-state","Nog geen teams in het leaderboard."));
    }
  }

  async function loadManagerHistory(managerId,teamName){
    const dialog = document.getElementById("managerDialog");
    const target = document.getElementById("managerHistory");
    target.innerHTML = '<p class="eyebrow">TEAMHISTORIEK</p><h2>' + escapeHtml(teamName) + '</h2><div class="empty-state">Speeldagen laden…</div>';
    if(!dialog.open) dialog.showModal();
    const {data,error} = await cloud.client.rpc("public_manager_history",{p_manager:managerId});
    if(error){
      target.innerHTML = '<p class="eyebrow">TEAMHISTORIEK</p><h2>' + escapeHtml(teamName) + '</h2><div class="empty-state">De historiek kon niet worden geladen.</div>';
      return;
    }
    const history = (data || []).map(row => {
      const starters = (row.starter_ids || []).map(id => playerById(id) || {id,name:id,pos:""});
      const benchIds = [row.bench_gk_id,row.bench_outfield_id].filter(Boolean);
      const bench = benchIds.map(id => playerById(id) || {id,name:"Onbekende speler",pos:""});
      const lineup = starters.map(player => '<div class="history-player"><strong>' + escapeHtml(player.name) + '</strong><small>' + escapeHtml(player.pos) + ' · basis</small></div>').join("") +
        bench.map(player => '<div class="history-player bench"><strong>' + escapeHtml(player.name) + '</strong><small>' + escapeHtml(player.pos) + ' · bank</small></div>').join("");
      const transferCost = Number(row.breakdown?.transfer_cost || 0);
      return '<article class="history-card"><div class="history-card-head"><div><strong>Speeldag ' + row.gameweek_number + '</strong><small>' + (transferCost ? " · −" + transferCost + " transferpunten" : "") + '</small></div><strong>' + points(row.points) + '</strong></div><div class="history-lineup">' + (lineup || '<span class="muted">Geen vastgezette spelers.</span>') + '</div></article>';
    }).join("");
    target.innerHTML = '<p class="eyebrow">TEAMHISTORIEK</p><h2>' + escapeHtml(teamName) + '</h2><p class="muted">Vastgezette opstellingen en behaalde score per speeldag.</p><div class="history-list">' + (history || '<div class="empty-state">Nog geen afgewerkte speeldagen.</div>') + '</div>';
  }

  async function loadPlayerStats(playerId){
    const player = playerById(playerId);
    if(!player) return;
    const {data,error} = await cloud.client
      .from("player_match_stats")
      .select("minutes,stats,fantasy_points,fixtures(kickoff,home_team,away_team,gameweeks(number))")
      .eq("player_id",playerId)
      .limit(100);
    if(error){
      console.error(error);
      return;
    }
    renderPlayerProfile(player,data || []);
  }

  async function loadDeadline(){
    const {data,error} = await cloud.client.rpc("current_edit_window");
    if(error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    cloud.locked = Boolean(row && row.locked);
    cloud.currentGameweekId = row?.gameweek_id ?? null;
    cloud.currentGameweekNumber = row?.gameweek_number ?? null;
    cloud.deadline = row && row.lock_at ? new Date(row.lock_at) : null;
    const card = document.getElementById("deadlineCard");
    card.classList.toggle("is-locked",cloud.locked);
    document.getElementById("deadlineTitle").textContent = row && row.gameweek_number ? "Speeldag " + row.gameweek_number : "Speeldagdeadline";
    if(!row){
      document.getElementById("deadlineText").textContent = "Nog geen speeldag uit de datafeed ontvangen";
    }else if(cloud.locked){
      document.getElementById("deadlineText").textContent = "Vergrendeld sinds " + formatDateTime(cloud.deadline);
    }else{
      document.getElementById("deadlineText").textContent = "Opstelling sluit op " + formatDateTime(cloud.deadline);
    }
    updateEditability();
  }

  async function loadCurrentGameweekPlayerScores(){
    const active = Boolean(cloud.locked && cloud.currentGameweekId);

    window.FANTASY_LIVE_SCORE_MODE = active;
    if(!active){
      window.FANTASY_GAMEWEEK_PLAYER_SCORES = {};
      renderTeam();
      return;
    }

    const {data,error} = await cloud.client
      .from("player_match_stats")
      .select("player_id,fantasy_points,fixtures!inner(gameweek_id,status)")
      .eq("fixtures.gameweek_id",cloud.currentGameweekId)
      .in("fixtures.status",["LIVE","FT"])
      .limit(1000);

    if(error){
      console.warn("Speeldagscore kon niet worden geladen",error.message);
      return;
    }

    const scores = {};
    for(const row of data || []){
      const id = String(row.player_id);
      scores[id] = Number(scores[id] || 0) + Number(row.fantasy_points || 0);
    }

    window.FANTASY_GAMEWEEK_PLAYER_SCORES = scores;
    renderTeam();
  }

  function startLiveScorePolling(){
    clearInterval(cloud.liveScoreTimer);
    cloud.liveScoreTimer = setInterval(async () => {
      if(!cloud.enabled || !cloud.user) return;
      try{
        await loadDeadline();
        await loadCurrentGameweekPlayerScores();
      }catch(error){
        console.warn("Live speeldagscore verversen mislukt",error);
      }
    },60000);
  }

  async function loadTransferStatus(){
    if(!cloud.user) return;
    const {data,error} = await cloud.client.rpc("my_transfer_status");
    if(error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const used = Number(row?.transfers_used || 0);
    const free = Number(row?.free_transfers || 2);
    const cost = Number(row?.point_cost || 0);
    document.getElementById("transferTitle").textContent = row?.gameweek_number ? "Transfers voor speeldag " + row.gameweek_number : "Transfers";
    document.getElementById("transferCounter").textContent = used + " / " + free + " gratis";
    document.getElementById("transferCounter").classList.toggle("has-cost",cost > 0);
    document.getElementById("transferText").textContent = cost > 0
      ? "Huidige puntenkost: −" + cost + " punten"
      : "2 gratis per speeldag · daarna −4 punten per extra transfer";
  }

  function formatDateTime(value){
    if(!value) return "onbekend";
    return new Intl.DateTimeFormat("nl-BE",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(value);
  }

  function updateEditability(){
    const disabled = cloud.enabled && (!cloud.user || cloud.locked);
    document.getElementById("teamName").disabled = disabled;
    document.getElementById("autoLineupBtn").disabled = disabled || !isSquadComplete();
    document.getElementById("resetBtn").disabled = disabled;
    if(cloud.locked) setStatus("Speeldag vergrendeld","locked");
  }

  async function refreshCloud(){
    if(!cloud.user) return;
    try{
      setStatus("Gegevens laden…","");
      await loadPlayers();
      await Promise.all([loadFixtures(),loadDeadline(),loadTransferStatus(),loadGameweekBalance()]);
      await loadCurrentGameweekPlayerScores();
      await loadTeam();
      await loadLeaderboard();
      startLiveScorePolling();
      if(!cloud.locked) setStatus("Online opgeslagen","online");
    }catch(error){
      console.error(error);
      setStatus("Verbindingsfout","");
      toast("Online gegevens konden niet worden geladen.");
    }
  }

  async function handleSession(session){
    cloud.user = session ? session.user : null;
    const button = document.getElementById("authButton");
    if(cloud.user){
      button.textContent = "Uitloggen";
      await refreshCloud();
    }else{
      cloud.locked = false;
      cloud.totalPoints = null;
      cloud.currentGameweekId = null;
      cloud.currentGameweekNumber = null;
      clearInterval(cloud.liveScoreTimer);
      window.FANTASY_LIVE_SCORE_MODE = false;
      window.FANTASY_GAMEWEEK_PLAYER_SCORES = {};
      button.textContent = "Inloggen";
      setStatus("Niet ingelogd","");
      document.getElementById("deadlineText").textContent = "Log in om de actuele deadline te zien";
      document.getElementById("transferTitle").textContent = "Transfers";
      document.getElementById("transferCounter").textContent = "0 / 2";
      document.getElementById("transferText").textContent = "Log in om je transfers voor de volgende speeldag te zien";
      state.squad = [];
      state.benchGK = null;
      state.benchOutfield = null;
      state.teamName = "Mijn Fantasy Team";
      state.cash = START_BUDGET;
      original.saveState();
      renderAll();
      updateEditability();
      try{
        await Promise.all([loadPlayers(),loadFixtures(),loadGameweekBalance()]);
        renderAll();
      }catch(error){
        console.warn("Publieke voetbaldata kon niet worden geladen",error);
      }
    }
  }

  injectUi();
  wrapMutations();
  window.addEventListener("fantasy:player-profile",event => {
    if(cloud.enabled && cloud.client && event.detail?.playerId) loadPlayerStats(event.detail.playerId);
  });
  window.addEventListener("fantasy:match-detail",event => {
    if(cloud.enabled && cloud.client && event.detail?.fixtureId) loadMatchDetail(event.detail.fixtureId,event.detail.match);
  });

  if(!cloud.enabled){
    showSetupBanner();
    return;
  }

  cloud.client = window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  cloud.client.auth.getSession().then(({data}) => handleSession(data.session));
  cloud.client.auth.onAuthStateChange((_event,session) => handleSession(session));
})();
