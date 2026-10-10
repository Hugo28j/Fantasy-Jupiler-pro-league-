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
    liveScoreTimer: null,
    initialSetupComplete: false,
    onboardingSeen: false,
    transfersUsed: 0,
    freeTransfers: 2,
    transferCost: 0,
    unlimitedTransfers: true,
    baselineSquad: null,
    leagues: [],
    selectedLeague: "global",
    leaderboardRows: [],
    selectedLeaderboardManager: null,
    selectedLeaderboardLineup: null,
    selectedLeaderboardTeamName: "",
    selectedLeaderboardManagerName: ""
  };

  const original = {
    saveState,
    buyPlayer,
    sellPlayer,
    setBench,
    setCaptain,
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

  function accountDefaultTeamName(){
    const meta = cloud.user?.user_metadata || {};
    return String(meta.display_name || meta.name || meta.full_name || "Mijn Fantasy Team").trim().slice(0,28) || "Mijn Fantasy Team";
  }

  function incomingTransfersForSquad(squad){
    if(cloud.unlimitedTransfers || !Array.isArray(cloud.baselineSquad)) return 0;
    const baseline = new Set(cloud.baselineSquad.map(String));
    return (Array.isArray(squad) ? squad : []).filter(id => !baseline.has(String(id))).length;
  }

  function extraTransferCostForPurchase(id){
    if(cloud.unlimitedTransfers || !Array.isArray(cloud.baselineSquad)) return 0;
    const current = incomingTransfersForSquad(state.squad);
    const next = incomingTransfersForSquad([...state.squad,String(id)]);
    const currentCost = Math.max(0,current-cloud.freeTransfers)*4;
    const nextCost = Math.max(0,next-cloud.freeTransfers)*4;
    return Math.max(0,nextCost-currentCost);
  }

  function confirmExtraTransfer(cost){
    return new Promise(resolve => {
      const dialog = document.getElementById("transferConfirmDialog");
      const textTarget = document.getElementById("transferConfirmText");
      const ok = document.getElementById("transferConfirmOk");
      const cancel = document.getElementById("transferConfirmCancel");
      textTarget.textContent = "Je gratis transfers zijn opgebruikt. Als je deze speler koopt, kost dit −" + cost + " punten.";
      const finish = value => {
        ok.onclick = null;
        cancel.onclick = null;
        if(dialog.open) dialog.close();
        resolve(value);
      };
      ok.onclick = () => finish(true);
      cancel.onclick = () => finish(false);
      dialog.oncancel = event => { event.preventDefault(); finish(false); };
      dialog.showModal();
    });
  }

  function injectUi(){
    document.head.insertAdjacentHTML("beforeend", '<link rel="stylesheet" href="cloud.css?v=018">');
    const bar = make("div","cloud-bar");
    bar.innerHTML = '<span id="cloudStatus" class="cloud-status">Demo op dit toestel</span><button id="authButton" class="btn secondary-btn" type="button">Inloggen</button>';
    const navTools = document.querySelector(".nav-header-tools") || document.querySelector(".tabs");
    navTools.appendChild(bar);

    const headerStats = document.querySelector(".header-stats");
    const deadlineStat = make("div","header-live-stat deadline-card");
    deadlineStat.id = "deadlineCard";
    deadlineStat.innerHTML = '<span id="deadlineTitle">Deadline</span><strong id="deadlineText">—</strong><i id="syncDot" class="sync-dot" aria-hidden="true"></i>';
    const transferStat = make("div","header-live-stat transfer-card");
    transferStat.id = "transferCard";
    transferStat.innerHTML = '<span id="transferTitle">Transfers</span><strong id="transferCounter" class="transfer-counter">∞</strong><small id="transferText" hidden></small><button id="resetTransfersBtn" class="header-reset-transfer" type="button" title="Transfers resetten" aria-label="Transfers resetten" disabled>↶</button>';
    headerStats.append(deadlineStat,transferStat);

    const dialog = document.createElement("dialog");
    dialog.id = "authDialog";
    dialog.className = "auth-dialog";
    dialog.innerHTML = '<form id="authForm"><h2>Fantasy-account</h2><p>Log in met je naam en wachtwoord om je team, budget en score centraal te bewaren.</p><button id="googleAuthButton" class="google-auth-btn" type="button"><span class="google-g" aria-hidden="true">G</span><span>Doorgaan met Google</span></button><div class="auth-divider"><span>of met naam</span></div><label><span>Naam</span><input id="authIdentity" type="text" autocomplete="username" maxlength="28" placeholder="bv. Hugo"></label><label><span>Wachtwoord</span><input id="authPassword" type="password" autocomplete="current-password" minlength="4"></label><div id="authError" class="auth-error" role="alert"></div><div class="auth-actions"><button id="closeAuth" class="btn secondary-btn" type="button">Annuleren</button><button id="signupButton" class="btn secondary-btn" type="button">Account maken</button><button class="btn primary-btn" type="submit">Inloggen</button></div></form>';
    document.body.appendChild(dialog);

    const onboarding = document.createElement("dialog");
    onboarding.id = "onboardingDialog";
    onboarding.className = "onboarding-dialog";
    onboarding.innerHTML =
      '<div class="onboarding-shell">' +
        '<p class="eyebrow">EERSTE SELECTIE</p>' +
        '<h2>Bouw eerst je ploeg</h2>' +
        '<p>Je kiest <strong>8 spelers</strong>: 2 keepers, 2 verdedigers, 2 middenvelders en 2 aanvallers. Je start met <strong>€125M</strong>.</p>' +
        '<p>Daarvan staan <strong>6 spelers in de basis</strong> en <strong>2 op de bank</strong>: precies 1 reservekeeper en 1 veldspeler. Er kan maximaal 1 keeper in de basis staan. De reservekeeper kan alleen de keeper vervangen wanneer die niet speelt; de veldreserve kan maximaal één niet-spelende veldspeler vervangen.</p>' +
        '<p>Voor je eerste speeldag mag je onbeperkt je selectie aanpassen. Daarna krijg je <strong>2 gratis transfers per speeldag</strong>; extra transfers kosten punten.</p>' +
        '<label class="onboarding-team-name"><span>Teamnaam (optioneel)</span><input id="onboardingTeamName" maxlength="28" autocomplete="off" placeholder="Leeg = je gebruikersnaam"></label>' +
        '<button id="onboardingOk" class="btn primary-btn" type="button">Oké, bouw mijn ploeg</button>' +
      '</div>';
    document.body.appendChild(onboarding);

    document.getElementById("onboardingOk").addEventListener("click",async () => {
      const chosenName = document.getElementById("onboardingTeamName").value.trim();
      try{
        const {data:nameResult,error:nameError} = await cloud.client.rpc("update_my_team_name",{p_name:chosenName || null});
        if(nameError) throw nameError;
        state.teamName = String(nameResult || chosenName || accountDefaultTeamName()).slice(0,28);
        original.saveState();
        renderAll();
        await cloud.client.rpc("mark_onboarding_seen");
        cloud.onboardingSeen = true;
        onboarding.close();
        if(window.activateFantasyTab) window.activateFantasyTab("market",true);
      }catch(error){
        toast(error.message || "Teamnaam kon niet worden opgeslagen.");
      }
    });

    const transferConfirm = document.createElement("dialog");
    transferConfirm.id = "transferConfirmDialog";
    transferConfirm.className = "transfer-confirm-dialog";
    transferConfirm.innerHTML = '<div class="transfer-confirm-shell"><p class="eyebrow">EXTRA TRANSFER</p><h2>Deze transfer kost punten</h2><p id="transferConfirmText"></p><div class="transfer-confirm-actions"><button id="transferConfirmCancel" class="btn secondary-btn" type="button">Annuleren</button><button id="transferConfirmOk" class="btn danger-btn" type="button">Oké, uitvoeren</button></div></div>';
    document.body.appendChild(transferConfirm);

    bindSettingsUi();

    document.getElementById("authButton").addEventListener("click", onAuthButton);
    document.getElementById("closeAuth").addEventListener("click", () => dialog.close());
    document.getElementById("googleAuthButton").addEventListener("click", signInWithGoogle);
    document.getElementById("authForm").addEventListener("submit", event => { event.preventDefault(); signIn(); });
    document.getElementById("signupButton").addEventListener("click", signUp);
    document.getElementById("resetTransfersBtn").addEventListener("click", resetTransfers);
  }


  function bindSettingsUi(){
    document.getElementById("teamNameSettingsForm")?.addEventListener("submit",async event => {
      event.preventDefault();
      if(!cloud.user){ toast("Log eerst in."); return; }
      const input = document.getElementById("settingsTeamName");
      const button = event.submitter;
      if(button) button.disabled = true;
      try{
        const {data,error} = await cloud.client.rpc("update_my_team_name",{p_name:input.value.trim() || null});
        if(error) throw error;
        state.teamName = String(data || accountDefaultTeamName()).slice(0,28);
        original.saveState();
        renderAll();
        await loadLeaderboard().catch(() => {});
        toast("Teamnaam opgeslagen.");
      }catch(error){
        toast(error.message || "Teamnaam kon niet worden opgeslagen.");
      }finally{
        if(button) button.disabled = false;
      }
    });

    document.getElementById("passwordSettingsForm")?.addEventListener("submit",async event => {
      event.preventDefault();
      if(!cloud.user){ toast("Log eerst in."); return; }
      const password = document.getElementById("settingsPassword").value;
      const repeat = document.getElementById("settingsPasswordRepeat").value;
      if(password.length < 4){ toast("Gebruik minstens 4 tekens."); return; }
      if(password !== repeat){ toast("De twee wachtwoorden zijn niet hetzelfde."); return; }
      const button = event.submitter;
      if(button) button.disabled = true;
      const {error} = await cloud.client.auth.updateUser({password});
      if(button) button.disabled = false;
      if(error){ toast(error.message); return; }
      document.getElementById("settingsPassword").value = "";
      document.getElementById("settingsPasswordRepeat").value = "";
      toast("Wachtwoord gewijzigd.");
    });

    document.getElementById("deleteAccountBtn")?.addEventListener("click",async () => {
      if(!cloud.user){ toast("Log eerst in."); return; }
      if(!confirm("Je account, ploeg, scores en competities worden definitief verwijderd. Doorgaan?")) return;
      if(!confirm("Dit kan niet ongedaan gemaakt worden. Account echt verwijderen?")) return;
      const button = document.getElementById("deleteAccountBtn");
      button.disabled = true;
      button.textContent = "Verwijderen…";
      try{
        const {error} = await cloud.client.rpc("delete_my_account");
        if(error) throw error;
        try{ await cloud.client.auth.signOut({scope:"local"}); }catch(_error){}
        localStorage.removeItem("fantasy-jpl-2026-v1");
        location.reload();
      }catch(error){
        button.disabled = false;
        button.textContent = "Account definitief verwijderen";
        toast(error.message || "Account kon niet worden verwijderd.");
      }
    });
  }

  function showSetupBanner(){
    const banner = make("div","backend-banner","De site draait nog in demomodus op dit toestel. Vul config.js in en voer de Supabase-migratie uit om accounts, live data, scores en deadlines te activeren.");
    document.querySelector("main").prepend(banner);
    document.getElementById("authButton").textContent = "Backend instellen";
    document.getElementById("deadlineText").textContent = "Demomodus — wijzigingen worden alleen lokaal bewaard";
    document.getElementById("transferCounter").textContent = "—";
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
    buyPlayer = async function(id){
      if(!requireEditable()) return;
      const extraCost = extraTransferCostForPurchase(id);
      if(extraCost > 0 && !(await confirmExtraTransfer(extraCost))) return;
      return original.buyPlayer(id);
    };
    sellPlayer = function(id){ if(requireEditable()) return original.sellPlayer(id); };
    setBench = function(id){ if(requireEditable()) return original.setBench(id); };
    setCaptain = function(id){ if(requireEditable()) return original.setCaptain(id); };
    autoLineup = function(){ if(requireEditable()) return original.autoLineup(); };
    resetSquad = function(){ if(requireEditable()) return original.resetSquad(); };
    renderMarket = function(){
      original.renderMarket();
      document.querySelectorAll(".player-card").forEach(card => {
        const id = card.querySelector(".buy-btn")?.dataset.id;
        const player = id ? playerById(id) : null;
        const score = card.querySelector(".market-total-points");
        if(score && player) score.textContent = Number(player.score || 0).toFixed(1).replace(".0","");
      });
    };
    renderHeader = function(){
      original.renderHeader();
      if(cloud.enabled && cloud.user && cloud.totalPoints != null){
        const numeric = Number(cloud.totalPoints || 0);
        const value = numeric.toFixed(1).replace(".0","");
        const pointsDisplay = document.getElementById("pointsDisplay");
        if(pointsDisplay){
          pointsDisplay.textContent = value;
          pointsDisplay.setAttribute("data-animate-score","1");
          pointsDisplay.setAttribute("data-score-key","header-total");
          pointsDisplay.setAttribute("data-score-value",String(numeric));
          pointsDisplay.setAttribute("data-score-suffix","");
          animateFantasyScoreElement(pointsDisplay);
        }
        const leader = document.getElementById("leaderPoints");
        if(leader){
          leader.textContent = value + " pts";
          leader.setAttribute("data-animate-score","1");
          leader.setAttribute("data-score-key","leader-total");
          leader.setAttribute("data-score-value",String(numeric));
          leader.setAttribute("data-score-suffix"," pts");
          animateFantasyScoreElement(leader);
        }
      }
    };

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
      p_bench_outfield_id: state.benchOutfield,
      p_captain_id: state.captainId
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
        .select("player_id,minutes,fantasy_points,stats,fixtures(id,kickoff,status,gameweeks(number))")
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
    const playerMatchHistory = new Map();
    for(const row of priceRows){
      const fixture = Array.isArray(row.fixtures) ? row.fixtures[0] : row.fixtures;
      if(!fixture || fixture.status !== "FT") continue;

      const playerId = String(row.player_id);
      const kickoff = String(fixture.kickoff || "");

      // De prijswijziging rechts op de marktkaart hoort ALTIJD bij de
      // meest recente afgewerkte wedstrijd van de speler, ook bij 0 minuten.
      // Zo toont een DNP na migratie 021 bijvoorbeeld -€0,3M in plaats van
      // de prijswijziging van zijn vorige wedstrijd met speelminuten.
      const deltaRaw = row.stats?.priceDelta;
      if(deltaRaw != null && Number.isFinite(Number(deltaRaw))){
        const previous = latestPriceChange.get(playerId);
        if(!previous || kickoff > previous.kickoff){
          latestPriceChange.set(playerId,{
            kickoff,
            delta:Number(deltaRaw)
          });
        }
      }

      // De vormgrafiek zelf blijft alleen daadwerkelijk gespeelde wedstrijden
      // tonen; een DNP blijft daar dus een leeg slot zoals afgesproken.
      if(Number(row.minutes || 0) <= 0) continue;

      const history = playerMatchHistory.get(playerId) || [];
      history.push({
        fixtureId:fixture.id == null ? null : String(fixture.id),
        gameweek:Number(fixture.gameweeks?.number || 0) || null,
        kickoff,
        points:Number(row.fantasy_points || 0),
        minutes:Number(row.minutes || 0)
      });
      playerMatchHistory.set(playerId,history);
    }

    PLAYERS.splice(0,PLAYERS.length,...data.map(p => ({
      id:p.id,name:p.name,club:p.club_name,pos:p.position,minutes:p.minutes,
      price:Number(p.price),score:Number(p.total_points || 0),
      lastPriceDelta:latestPriceChange.get(String(p.id))?.delta ?? 0,
      matchHistory:(playerMatchHistory.get(String(p.id)) || []).sort((a,b) => a.kickoff.localeCompare(b.kickoff))
    })));
    if(!marketPriceFilter.touched){
      marketPriceFilter.min = null;
      marketPriceFilter.max = null;
    }
    const clubs = [...new Set(PLAYERS.map(p => p.club))].sort((a,b) => a.localeCompare(b,"nl"));
    CLUBS.splice(0,CLUBS.length,...clubs);
    state.squad = state.squad.filter(id => PLAYERS.some(p => p.id === id));
    renderClubFilter();
  }

  async function loadFixtures(){
    const {data,error} = await cloud.client
      .from("fixtures")
      .select("id,kickoff,status,live_minute,home_team,away_team,home_score,away_score,gameweeks(number)")
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
        liveMinute:Number(f.live_minute || 0) || null,
        date:date.format(new Date(f.kickoff)),
        gameweek,
        week:"Speeldag " + (gameweek || "?"),
        home:f.home_team,away:f.away_team,
        homeScore:f.home_score == null ? "–" : f.home_score,
        awayScore:f.away_score == null ? "–" : f.away_score
      };
    }));

    const statusesByGameweek = new Map();
    data.forEach(fixture => {
      const gameweek = Number(fixture.gameweeks?.number);
      if(!Number.isFinite(gameweek)) return;
      const statuses = statusesByGameweek.get(gameweek) || [];
      statuses.push(String(fixture.status || ""));
      statusesByGameweek.set(gameweek,statuses);
    });

    window.FANTASY_RECENT_GAMEWEEKS = [...statusesByGameweek.entries()]
      .filter(([,statuses]) =>
        statuses.length > 0 &&
        statuses.some(status => status === "FT") &&
        statuses.every(status => status === "FT" || status === "CANC")
      )
      .map(([gameweek]) => gameweek)
      .sort((a,b) => a-b)
      .slice(-5);

    const fixtureSnapshot = JSON.stringify(MATCHES.map(m => [m.id,m.status,m.liveMinute,m.homeScore,m.awayScore,m.kickoff]));
    if(cloud.lastFixtureSnapshot !== fixtureSnapshot){
      cloud.lastFixtureSnapshot = fixtureSnapshot;
      renderMatches();
      // Only refresh the match-dependent admin view if fixture data changed.
      if(typeof window.renderAdminMatches === "function") window.renderAdminMatches();
    }
  }

  function normalizePredictionName(value){
    return String(value || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu,"")
      .toLowerCase()
      .replace(/[^a-z0-9]/g,"");
  }

  function manualPredictionRowsForMatch(match){
    const entries = Array.isArray(window.FANTASY_MANUAL_START_PREDICTIONS)
      ? window.FANTASY_MANUAL_START_PREDICTIONS
      : [];
    const rows = [];

    for(const entry of entries){
      const teams = Array.isArray(entry?.teams) ? entry.teams : [];
      if(teams.length !== 2) continue;

      const matchesFixture =
        (sameClubName(teams[0],match.home) && sameClubName(teams[1],match.away)) ||
        (sameClubName(teams[0],match.away) && sameClubName(teams[1],match.home));
      if(!matchesFixture) continue;

      const predictionGroups = entry.predictions || {};
      for(const [clubLabel,list] of Object.entries(predictionGroups)){
        const actualClub = sameClubName(clubLabel,match.home)
          ? match.home
          : sameClubName(clubLabel,match.away) ? match.away : null;
        if(!actualClub || !Array.isArray(list)) continue;

        for(const item of list){
          if(!Array.isArray(item) || item.length < 2) continue;
          const name = String(item[0] || "");
          const percent = Number(item[1]);
          const requestedZone = ["GK","DEF","MID","FWD"].includes(String(item[2] || ""))
            ? String(item[2])
            : null;
          if(!Number.isFinite(percent)) continue;

          const player = PLAYERS.find(candidate =>
            sameClubName(candidate.club,actualClub) &&
            normalizePredictionName(candidate.name) === normalizePredictionName(name)
          );
          // Bewust niets aanmaken wanneer een voorspelde speler niet in de game zit.
          if(!player) continue;

          rows.push({
            fixture_id:String(match.id),
            player_id:String(player.id),
            start_probability:Math.max(0,Math.min(100,percent)),
            reliability:null,
            source:entry.source || "manual",
            player:{
              id:player.id,
              name:player.name,
              club_name:player.club,
              // Voor bevestigde opstellingen mag de visuele wedstrijdpositie
              // afwijken van de vaste fantasy-positie van de speler.
              position:requestedZone || player.pos
            },
            stats:{
              teamName:actualClub,
              confirmedStarter:entry.source === "confirmed" && percent >= 100
            }
          });
        }
      }
    }
    return rows;
  }

  function rebuildStartPredictionIndexes(databaseRows=[]){
    const byFixture = {};

    for(const row of databaseRows || []){
      const fixtureId = String(row.fixture_id || "");
      const match = MATCHES.find(item => String(item.id) === fixtureId);
      const player = playerById(String(row.player_id || ""));
      const percent = Number(row.starter_probability);
      if(!fixtureId || !match || !player || !Number.isFinite(percent)) continue;

      byFixture[fixtureId] = byFixture[fixtureId] || [];
      byFixture[fixtureId].push({
        fixture_id:fixtureId,
        player_id:String(player.id),
        start_probability:Math.max(0,Math.min(100,percent)),
        reliability:row.reliability ?? null,
        source:row.source || "sorare",
        player:{
          id:player.id,
          name:player.name,
          club_name:player.club,
          position:player.pos
        },
        stats:{
          teamName:player.club,
          confirmedStarter:String(row.source || "") === "sorare-lineup" && percent >= 100
        }
      });
    }

    // Handmatige data overschrijft voor dezelfde speler/wedstrijd de API-waarde.
    for(const match of MATCHES){
      const status = String(match.status || "");
      if(["FT","CANC"].includes(status)) continue;
      const manualRows = manualPredictionRowsForMatch(match);
      if(!manualRows.length) continue;

      const fixtureId = String(match.id);
      const merged = new Map((byFixture[fixtureId] || []).map(row => [String(row.player_id),row]));
      manualRows.forEach(row => {
        const existing = merged.get(String(row.player_id));
        // Een officiële Sorare-XI (100%/confirmed) heeft voorrang op de
        // handmatige voorspelling die eerder voor deze wedstrijd was ingevoerd.
        if(String(existing?.source || "") === "sorare-lineup") return;
        merged.set(String(row.player_id),row);
      });
      byFixture[fixtureId] = [...merged.values()];
    }

    window.FANTASY_FIXTURE_START_PREDICTIONS = byFixture;

    const nextByPlayer = {};
    const futureMatches = MATCHES
      .filter(match => !["LIVE","FT","CANC"].includes(String(match.status || "")))
      .slice()
      .sort((a,b) => new Date(a.kickoff).getTime()-new Date(b.kickoff).getTime());

    for(const match of futureMatches){
      const rows = byFixture[String(match.id)] || [];
      for(const row of rows){
        const playerId = String(row.player_id);
        if(nextByPlayer[playerId]) continue;
        nextByPlayer[playerId] = {
          percent:Number(row.start_probability),
          fixtureId:String(match.id),
          kickoff:match.kickoff,
          opponent:sameClubName(row.player?.club_name,match.home) ? match.away : match.home,
          source:row.source || "sorare",
          reliability:row.reliability ?? null
        };
      }
    }

    window.FANTASY_PLAYER_NEXT_START_ODDS = nextByPlayer;
  }

  async function loadStartPredictions(){
    let rows = [];
    const futureFixtureIds = MATCHES
      .filter(match => !["FT","CANC"].includes(String(match.status || "")))
      .slice()
      .sort((a,b) => new Date(a.kickoff).getTime()-new Date(b.kickoff).getTime())
      .slice(0,36)
      .map(match => Number(match.id))
      .filter(Number.isFinite);

    try{
      if(futureFixtureIds.length){
        const query = cloud.client
          .from("fixture_start_predictions")
          .select("fixture_id,player_id,starter_probability,reliability,source,updated_at");
        const result = await query.in("fixture_id",futureFixtureIds).limit(3000);
        if(result.error) throw result.error;
        rows = result.data || [];
      }
    }catch(error){
      console.warn("Sorare-opstellingsvoorspellingen nog niet beschikbaar",error?.message || error);
    }

    rebuildStartPredictionIndexes(rows);
  }

  function renderNoPrediction(match){
    const target = document.getElementById("matchDetail");
    target.innerHTML =
      '<div class="match-detail-head"><div><p class="eyebrow">' + escapeHtml(match.week || "") + '</p>' +
      '<h2>' + escapeHtml(match.home || "") + ' <span>vs</span> ' + escapeHtml(match.away || "") + '</h2>' +
      '<p>' + escapeHtml(match.date || "") + '</p></div></div>' +
      '<div class="empty-state prediction-empty-state"><strong>Momenteel geen opstelling voorspelling</strong>' +
      '<span>Zodra Sorare of een handmatige voorspelling beschikbaar is, verschijnt hier de verwachte basis en bank.</span></div>';
  }

  async function loadMatchDetail(fixtureId,fallbackMatch){
    const match = fallbackMatch || MATCHES.find(m => String(m.id) === String(fixtureId));
    if(!match) return;

    const status = String(match.status || "");
    if(!["FT","LIVE"].includes(status)){
      // Ook voorspelde/toekomstige wedstrijden gebruiken de door Hugo opgeslagen
      // visuele formatie-override. Zo ziet iedereen exact dezelfde handmatig
      // gecorrigeerde prediction-opstelling.
      let fixtureOverrides = {};
      try{
        const {data:overrideData,error:overrideError} = await cloud.client
          .from("fixture_lineup_overrides")
          .select("fixture_id,side,formation,slots,updated_at")
          .eq("fixture_id",fixtureId);
        if(!overrideError){
          (overrideData || []).forEach(item => {
            if(item && (item.side === "home" || item.side === "away")){
              fixtureOverrides[item.side] = {
                formation:String(item.formation || ""),
                slots:Array.isArray(item.slots) ? item.slots : [],
                updatedAt:item.updated_at || null
              };
            }
          });
        }
      }catch(error){
        console.warn("Prediction-opstelling override kon niet worden geladen",error?.message || error);
      }

      window.FANTASY_MATCH_LAYOUT_OVERRIDES = window.FANTASY_MATCH_LAYOUT_OVERRIDES || {};
      window.FANTASY_MATCH_LAYOUT_OVERRIDES[String(fixtureId)] = fixtureOverrides;

      const predictionRows = window.FANTASY_FIXTURE_START_PREDICTIONS?.[String(fixtureId)] || [];
      if(!predictionRows.length){
        renderNoPrediction(match);
        return;
      }
      renderMatchDetail(match,predictionRows);
      return;
    }

    const [statsResult,overrideResult,predictionResult] = await Promise.all([
      cloud.client
        .from("player_match_stats")
        .select("player_id,minutes,stats,fantasy_points,players(id,name,club_name,position)")
        .eq("fixture_id",fixtureId)
        .limit(100),
      cloud.client
        .from("fixture_lineup_overrides")
        .select("fixture_id,side,formation,slots,updated_at")
        .eq("fixture_id",fixtureId),
      cloud.client
        .from("fixture_start_predictions")
        .select("fixture_id,player_id,starter_probability,reliability,source,updated_at")
        .eq("fixture_id",fixtureId)
        .limit(100)
    ]);

    if(statsResult.error){
      console.error(statsResult.error);
      document.getElementById("matchDetail").innerHTML = '<div class="empty-state">De wedstrijddata kon niet worden geladen.</div>';
      return;
    }

    // Migratie 019 kan nog niet uitgevoerd zijn. In dat geval blijft de normale
    // Sorare-opstelling gewoon werken en wordt alleen de override overgeslagen.
    window.FANTASY_MATCH_LAYOUT_OVERRIDES = window.FANTASY_MATCH_LAYOUT_OVERRIDES || {};
    const fixtureOverrides = {};
    if(!overrideResult.error){
      (overrideResult.data || []).forEach(item => {
        if(item && (item.side === "home" || item.side === "away")){
          fixtureOverrides[item.side] = {
            formation:String(item.formation || ""),
            slots:Array.isArray(item.slots) ? item.slots : [],
            updatedAt:item.updated_at || null
          };
        }
      });
    }
    window.FANTASY_MATCH_LAYOUT_OVERRIDES[String(fixtureId)] = fixtureOverrides;

    const statsRows = (statsResult.data || []).map(row => {
      const player = Array.isArray(row.players) ? row.players[0] : row.players;
      const normalizedPlayer = player || {id:row.player_id,name:"Onbekend",club_name:"",position:"MID"};
      return {
        ...row,
        player:normalizedPlayer,
        fantasy_points:canonicalFantasyScore(
          normalizedPlayer.position || "MID",
          row.stats || {},
          row.minutes
        )
      };
    });

    // Sorare publiceert de officiële XI vaak vóór de live-statregels beschikbaar
    // zijn. Laat die spelers daarom nooit verdwijnen bij de overgang NS -> LIVE.
    // De kaarten starten tijdelijk op 0 punten en echte stats overschrijven ze
    // zodra de API ze doorstuurt.
    const confirmedRows = (predictionResult.data || [])
      .filter(row => String(row.source || "") === "sorare-lineup" || String(row.reliability || "") === "confirmed")
      .map(row => {
        const player = playerById(String(row.player_id || ""));
        if(!player) return null;
        const starter = Number(row.starter_probability || 0) >= 100;
        return {
          player_id:String(player.id),
          minutes:0,
          fantasy_points:0,
          player:{
            id:player.id,
            name:player.name,
            club_name:player.club,
            position:player.pos
          },
          stats:{
            teamName:player.club,
            confirmedStarter:starter,
            lineupPlaceholder:true,
            gameStarted:starter ? 1 : 0,
            onGameSheet:true,
            playedInGame:false,
            fieldStatus:starter ? "ON_FIELD" : "ON_BENCH"
          }
        };
      })
      .filter(Boolean);

    const mergedByPlayer = new Map(
      confirmedRows.map(row => [String(row.player_id),row])
    );
    for(const row of statsRows){
      const previous = mergedByPlayer.get(String(row.player_id));
      mergedByPlayer.set(String(row.player_id),{
        ...(previous || {}),
        ...row,
        stats:{
          ...((previous || {}).stats || {}),
          ...(row.stats || {}),
          lineupPlaceholder:false
        }
      });
    }

    const rows = [...mergedByPlayer.values()];
    renderMatchDetail(match,rows);
  }

  async function loadGameweekBalance(gameweek=window.FANTASY_SELECTED_MATCHWEEK){
    const week = Number(gameweek);
    const requestId = (cloud.balanceRequestId || 0) + 1;
    cloud.balanceRequestId = requestId;

    let result;
    if(Number.isFinite(week) && week > 0){
      // Een expliciet gekozen speeldag mag NOOIT terugvallen op de laatste
      // verwerkte speeldag. Anders kan de titel "speeldag 5" tonen terwijl
      // de cijfers eigenlijk van speeldag 7 zijn.
      result = await cloud.client.rpc("gameweek_balance",{p_gameweek:week});
    }else{
      result = await cloud.client.rpc("latest_gameweek_balance");
    }

    if(requestId !== cloud.balanceRequestId) return;
    if(result.error){
      console.warn("Balansdata nog niet beschikbaar",result.error.message);
      renderGameweekBalance([],Number.isFinite(week) ? week : null);
      return;
    }

    const rows = result.data || [];
    // Extra bescherming: toon alleen data van de aangevraagde speeldag.
    const validRows = Number.isFinite(week) && week > 0
      ? rows.filter(row => Number(row.gameweek_number) === week)
      : rows;
    renderGameweekBalance(validRows,Number.isFinite(week) ? week : null);
  }

  async function loadTeam(){
    if(!cloud.user) return;
    const {data,error} = await cloud.client.from("teams").select("team_name,squad_ids,bench_gk_id,bench_outfield_id,captain_id,budget,total_points,initial_setup_complete,onboarding_seen").eq("user_id",cloud.user.id).maybeSingle();
    if(error) throw error;
    if(!data) return;
    cloud.loadingTeam = true;
    state.teamName = data.team_name || "Mijn Fantasy Team";
    state.cash = Number(data.budget ?? START_BUDGET);
    state.squad = Array.isArray(data.squad_ids) ? data.squad_ids.filter(id => PLAYERS.some(p => p.id === id)) : [];
    state.benchGK = state.squad.includes(data.bench_gk_id) ? data.bench_gk_id : null;
    state.benchOutfield = state.squad.includes(data.bench_outfield_id) ? data.bench_outfield_id : null;
    state.captainId = state.squad.includes(data.captain_id) ? data.captain_id : null;

    // Herstel ook oudere online selecties die nog zonder automatische bank zijn opgeslagen.
    // Bij 2 keepers staat er altijd 1 op de bank; bij alle 6 veldspelers
    // (2 DEF, 2 MID, 2 FWD) staat er altijd precies 1 veldspeler op de bank.
    const remoteKeepers = squadPlayers().filter(player => player.pos === "GK");
    const remoteOutfield = squadPlayers().filter(player => player.pos !== "GK");
    if(remoteKeepers.length === 2 && !remoteKeepers.some(player => player.id === state.benchGK)){
      state.benchGK = remoteKeepers[remoteKeepers.length - 1].id;
    }
    if(remoteOutfield.length === 6 && !remoteOutfield.some(player => player.id === state.benchOutfield)){
      state.benchOutfield = remoteOutfield[remoteOutfield.length - 1].id;
    }
    if(state.captainId === state.benchGK || state.captainId === state.benchOutfield){
      state.captainId = null;
    }

    cloud.initialSetupComplete = Boolean(data.initial_setup_complete);
    cloud.onboardingSeen = Boolean(data.onboarding_seen);
    window.FANTASY_INITIAL_SETUP_LOCK = !cloud.initialSetupComplete;
    if(!cloud.initialSetupComplete && window.activateFantasyTab){
      window.activateFantasyTab("market",true);
    }
    if(!cloud.initialSetupComplete && !cloud.onboardingSeen){
      const onboardingInput = document.getElementById("onboardingTeamName");
      if(onboardingInput && !onboardingInput.value) onboardingInput.placeholder = "Leeg = " + accountDefaultTeamName();
      const onboarding = document.getElementById("onboardingDialog");
      if(onboarding && !onboarding.open) onboarding.showModal();
    }

    original.saveState();
    cloud.loadingTeam = false;
    renderAll();
    cloud.totalPoints = Number(data.total_points || 0);
    updateEditability();
    renderHeader();
  }

  function selectedLeague(){
    return cloud.leagues.find(league => String(league.id) === String(cloud.selectedLeague)) || null;
  }

  function updateCompetitionActions(){
    const league = selectedLeague();
    const inviteButton = document.getElementById("inviteCompetitionBtn");
    const deleteButton = document.getElementById("deleteCompetitionBtn");
    inviteButton.hidden = !league?.is_owner;
    deleteButton.hidden = !league?.is_owner;
    document.getElementById("leaderboardTitle").textContent = league?.name || "Algemeen klassement";
  }

  async function loadCompetitions(){
    const select = document.getElementById("competitionSelect");
    const [{data:leagues,error:leagueError},{data:invites,error:inviteError}] = await Promise.all([
      cloud.client.rpc("my_private_leagues"),
      cloud.client.rpc("my_private_league_invites")
    ]);
    if(leagueError || inviteError){
      console.warn("Privécompetities zijn nog niet geactiveerd. Voer migratie 015 uit.",(leagueError || inviteError).message);
      cloud.leagues = [];
      cloud.selectedLeague = "global";
      select.innerHTML = '<option value="global">Algemeen klassement</option>';
      document.getElementById("competitionInvites").hidden = true;
      updateCompetitionActions();
      return;
    }
    cloud.leagues = leagues || [];
    if(cloud.selectedLeague !== "global" && !cloud.leagues.some(item => String(item.id) === String(cloud.selectedLeague))){
      cloud.selectedLeague = "global";
    }
    select.innerHTML = '<option value="global">Algemeen klassement</option>' + cloud.leagues.map(league =>
      '<option value="' + escapeHtml(String(league.id)) + '">' + escapeHtml(league.name) + ' · ' + Number(league.member_count || 1) + '</option>'
    ).join("");
    select.value = cloud.selectedLeague;
    updateCompetitionActions();

    const target = document.getElementById("competitionInvites");
    target.hidden = !(invites || []).length;
    target.innerHTML = (invites || []).map(invite =>
      '<article class="competition-invite"><div><strong>' + escapeHtml(invite.league_name) + '</strong><small>Uitnodiging van ' + escapeHtml(invite.owner_name) + '</small></div>' +
      '<div><button class="btn primary-btn" type="button" data-invite-action="accept" data-invite-id="' + escapeHtml(String(invite.invite_id)) + '">Accepteren</button>' +
      '<button class="btn secondary-btn" type="button" data-invite-action="decline" data-invite-id="' + escapeHtml(String(invite.invite_id)) + '">Weigeren</button></div></article>'
    ).join("");
    target.querySelectorAll("[data-invite-action]").forEach(button => button.addEventListener("click",async () => {
      button.disabled = true;
      const {error} = await cloud.client.rpc("respond_private_league_invite",{
        p_invite:button.dataset.inviteId,
        p_accept:button.dataset.inviteAction === "accept"
      });
      if(error){ toast(error.message); button.disabled = false; return; }
      toast(button.dataset.inviteAction === "accept" ? "Je bent toegetreden tot de competitie." : "Uitnodiging geweigerd.");
      await loadCompetitions();
      await loadLeaderboard();
    }));
  }

  function leaderboardUsesDialog(){
    return window.matchMedia("(max-width: 1060px)").matches;
  }

  function visibleLineupFixture(player,lineup){
    const gameweek = Number(lineup?.gameweek_number || cloud.currentGameweekNumber || 0);
    const matches = MATCHES.filter(match =>
      (!gameweek || Number(match.gameweek) === gameweek) &&
      (sameClubName(player.club,match.home) || sameClubName(player.club,match.away))
    );
    if(matches.length) return matches[0];

    const next = playerStartPrediction(player.id);
    if(next?.fixtureId){
      return MATCHES.find(match => String(match.id) === String(next.fixtureId)) || null;
    }
    return null;
  }

  function visibleLineupMetric(player,lineup){
    const fixture = visibleLineupFixture(player,lineup);
    const kickoffMs = fixture?.kickoff ? new Date(fixture.kickoff).getTime() : NaN;
    const fixtureStatus = String(fixture?.status || "");
    const started = ["LIVE","FT"].includes(fixtureStatus) || (Number.isFinite(kickoffMs) && Date.now() >= kickoffMs);

    if(!started){
      const fixtureRows = fixture ? (window.FANTASY_FIXTURE_START_PREDICTIONS?.[String(fixture.id)] || []) : [];
      const fixturePrediction = fixtureRows.find(row => String(row.player_id) === String(player.id));
      const fallbackPrediction = playerStartPrediction(player.id);
      const percent = fixturePrediction?.start_probability ?? fallbackPrediction?.percent;
      if(Number.isFinite(Number(percent))){
        const value = Math.max(0,Math.min(100,Number(percent)));
        return {
          text:Math.round(value) + "%",
          className:"prediction-score " + predictionBandClass(value),
          title:"Kans op basis: " + Math.round(value) + "%"
        };
      }
      return null;
    }

    const gameweek = Number(lineup?.gameweek_number || 0);
    let score = null;
    if(gameweek && Number(cloud.currentGameweekNumber) === gameweek){
      const liveScores = window.FANTASY_GAMEWEEK_PLAYER_SCORES || {};
      score = Number(liveScores[String(player.id)] ?? 0);
    }else if(gameweek){
      const history = Array.isArray(player.matchHistory) ? player.matchHistory : [];
      const exact = fixture
        ? history.find(item => Number(item.gameweek) === gameweek && String(item.fixtureId) === String(fixture.id))
        : null;
      const fallback = exact || history.find(item => Number(item.gameweek) === gameweek);
      score = Number(fallback?.points ?? 0);
    }else{
      score = 0;
    }

    const effectiveCaptainId = String(lineup?.effective_captain_id || lineup?.captain_id || "");
    const isCaptain = effectiveCaptainId && effectiveCaptainId === String(player.id);
    const displayScore = isCaptain ? Number(score)*1.5 : Number(score);
    return {
      text:fantasyDisplayNumber(displayScore),
      value:displayScore,
      animated:true,
      className:scoreBandClass(displayScore),
      title:isCaptain
        ? "Captain: " + fantasyDisplayNumber(score) + " × 1,5 = " + fantasyDisplayNumber(displayScore) + " punten"
        : "Fantasy-punten in deze speeldag: " + fantasyDisplayNumber(displayScore)
    };
  }

  function visibleLineupPlayerHtml(player,captainId,lineup){
    const displayedCaptainId = String(lineup?.effective_captain_id || captainId || "");
    const isCaptain = displayedCaptainId === String(player.id || "");
    const metric = visibleLineupMetric(player,lineup);
    const subInfo = lineup?.auto_substitutions || {};
    const playerId = String(player.id || "");
    const entering = (subInfo.incoming || []).includes(playerId);
    const leaving = (subInfo.outgoing || []).includes(playerId);
    const subBadge = entering
      ? '<span class="leaderboard-auto-sub-badge leaderboard-auto-sub-in" title="Automatisch ingevallen; punten tellen mee">↗ IN</span>'
      : leaving
        ? '<span class="leaderboard-auto-sub-badge leaderboard-auto-sub-out" title="Niet gespeeld; vervangen door reserve">↘ UIT</span>'
        : "";
    const metricScope = String(lineup?.team_name || lineup?.manager_name || "team") + ":" + String(lineup?.gameweek_number || "");
    const metricHtml = metric
      ? '<span class="leaderboard-preview-metric ' + escapeHtml(metric.className) + '" title="' + escapeHtml(metric.title) + '"' +
          (metric.animated ? fantasyScoreAnimationAttrs("leaderboard-player:" + metricScope + ":" + player.id,metric.value) : "") +
        '>' + escapeHtml(metric.text) + '</span>'
      : "";
    return '<button type="button" class="leaderboard-preview-player' + (entering ? ' leaderboard-auto-sub-entering' : '') + '" data-preview-player="' + escapeHtml(String(player.id || "")) + '">' +
      subBadge + '<span class="leaderboard-preview-avatar role-ring-' + escapeHtml(player.pos || "MID") + '">' + escapeHtml(initials(player.name || "?")) + '</span>' +
      (isCaptain ? '<span class="leaderboard-preview-captain">C</span>' : '') +
      metricHtml +
      '<strong>' + escapeHtml(player.name || "Onbekend") + '</strong>' +
      '<small>' + escapeHtml(POSITION_LABELS[player.pos] || player.pos || "") + '</small>' +
    '</button>';
  }

  function visibleLineupPitchHtml(starters,captainId,lineup){
    const groups = {GK:[],DEF:[],MID:[],FWD:[]};
    starters.forEach(player => {
      const pos = groups[player.pos] ? player.pos : "MID";
      groups[pos].push(player);
    });
    const row = (pos,players) =>
      '<div class="leaderboard-preview-line ' + (players.length >= 5 ? "five-line" : "") + '">' +
        players.map(player => visibleLineupPlayerHtml(player,captainId,lineup)).join("") +
      '</div>';

    return '<div class="leaderboard-preview-markings" aria-hidden="true"><span class="leaderboard-preview-half"></span><span class="leaderboard-preview-circle"></span><span class="leaderboard-preview-box top"></span><span class="leaderboard-preview-box bottom"></span></div>' +
      '<div class="leaderboard-preview-formation">' +
        row("FWD",groups.FWD) + row("MID",groups.MID) + row("DEF",groups.DEF) + row("GK",groups.GK) +
      '</div>';
  }

  function lineupVisibilityText(lineup){
    const source = String(lineup?.lineup_source || "");
    const number = Number(lineup?.gameweek_number || 0);
    if(source === "own-current") return number ? "Jouw huidige opstelling voor speeldag " + number : "Jouw huidige opstelling";
    if(source === "first-week-current") return "Eerste fantasyweek · huidige ploeg zichtbaar";
    if(source === "locked"){
      if(number && cloud.currentGameweekNumber && number < Number(cloud.currentGameweekNumber)){
        return "Vorige vastgezette opstelling · speeldag " + number + " · nieuwe ploeg zichtbaar na de deadline";
      }
      return number ? "Vastgezette opstelling · speeldag " + number : "Vastgezette opstelling";
    }
    return "Zichtbare opstelling";
  }

  function renderVisibleManagerLineup(target,lineup,managerName,teamName,forDialog=false){
    if(!lineup){
      target.innerHTML =
        '<div class="leaderboard-preview-empty"><strong>' + escapeHtml(teamName || managerName || "Ploeg") + '</strong>' +
        '<span>Deze ploeg is nog niet zichtbaar. Vanaf de deadline verschijnt de nieuwe opstelling.</span></div>';
      return;
    }

    const starters = (lineup.starter_ids || []).map(id => playerById(String(id))).filter(Boolean);
    const bench = [lineup.bench_gk_id,lineup.bench_outfield_id].filter(Boolean).map(id => playerById(String(id))).filter(Boolean);
    const displayTeam = lineup.team_name || teamName || "Ploeg";
    const displayManager = lineup.manager_name || managerName || "Manager";
    const captainId = lineup.captain_id || "";

    const benchHtml = bench.length
      ? bench.map(player => visibleLineupPlayerHtml(player,captainId,lineup)).join("")
      : '<div class="leaderboard-preview-no-bench">Geen bankdata</div>';

    const gameweekPoints = Number(lineup.gameweek_points || 0);
    const totalPoints = Number(lineup.total_points || 0);
    const gameweekLabel = Number(lineup.gameweek_number || 0)
      ? "SD " + Number(lineup.gameweek_number)
      : "Speeldag";
    const scoreText = value => Number(value || 0).toFixed(Number(value || 0) % 1 ? 1 : 0).replace(".",",");

    target.innerHTML =
      '<div class="leaderboard-preview-head">' +
        '<div><p class="eyebrow">' + (forDialog ? "PLOEG" : "GESELECTEERDE PLOEG") + '</p><h3>' + escapeHtml(displayTeam) + '</h3><small>' + escapeHtml(displayManager) + '</small></div>' +
        '<div class="leaderboard-preview-team-score"><span>' + escapeHtml(gameweekLabel) + '</span><strong' +
          fantasyScoreAnimationAttrs("leaderboard-gameweek:" + displayTeam + ":" + Number(lineup.gameweek_number || 0),gameweekPoints," pts") +
        '>' + scoreText(gameweekPoints) + ' pts</strong><small>Totaal <span' +
          fantasyScoreAnimationAttrs("leaderboard-total:" + displayTeam,totalPoints," pts") +
        '>' + scoreText(totalPoints) + ' pts</span></small></div>' +
        '<span class="leaderboard-visibility-pill">' + escapeHtml(lineupVisibilityText(lineup)) + '</span>' +
      '</div>' +
      '<div class="leaderboard-preview-stage">' +
        '<aside class="leaderboard-preview-bench"><span class="eyebrow">BANK</span><div>' + benchHtml + '</div></aside>' +
        '<div class="leaderboard-preview-pitch">' + visibleLineupPitchHtml(starters,captainId,lineup) + '</div>' +
      '</div>';

    target.querySelectorAll("[data-preview-player]").forEach(button => button.addEventListener("click",() => {
      const id = button.dataset.previewPlayer;
      if(!id) return;
      const player = playerById(id);
      const fixture = player ? visibleLineupFixture(player,lineup) : null;
      const kickoffMs = fixture?.kickoff ? new Date(fixture.kickoff).getTime() : NaN;
      const started = ["LIVE","FT"].includes(String(fixture?.status || "")) ||
        (Number.isFinite(kickoffMs) && Date.now() >= kickoffMs);
      const effectiveCaptainId = String(lineup?.effective_captain_id || lineup?.captain_id || "");
      if(forDialog){
        const dialog = document.getElementById("managerDialog");
        if(dialog?.open) dialog.close();
      }
      openPlayerProfile(id,{
        fixtureId:started ? fixture?.id || null : null,
        gameweek:Number(lineup?.gameweek_number || 0) || null,
        captainMultiplier:started && effectiveCaptainId === String(id) ? 1.5 : 1
      });
    }));
  }

  async function fetchVisibleManagerLineup(managerId){
    const {data,error} = await cloud.client.rpc("public_manager_visible_lineup",{p_manager:managerId});
    if(error) throw error;
    const lineup = Array.isArray(data) ? (data[0] || null) : (data || null);
    if(!lineup) return null;

    try{
      let gameweekId = null;
      if(
        Number(lineup.gameweek_number || 0) === Number(cloud.currentGameweekNumber || 0) &&
        cloud.currentGameweekId
      ){
        gameweekId = cloud.currentGameweekId;
      }else if(Number(lineup.gameweek_number || 0) > 0){
        const {data:weeks} = await cloud.client
          .from("gameweeks")
          .select("id,season")
          .eq("number",Number(lineup.gameweek_number))
          .order("season",{ascending:false})
          .limit(1);
        gameweekId = weeks?.[0]?.id || null;
      }

      if(gameweekId){
        const {data:scoreRow} = await cloud.client
          .from("gameweek_scores")
          .select("breakdown")
          .eq("user_id",managerId)
          .eq("gameweek_id",gameweekId)
          .maybeSingle();
        const breakdown = scoreRow?.breakdown || {};
        // Confirmed substitutions for THIS manager (not only the logged-in team).
        // Use the same FT / played-minutes constraints as recalculate_gameweek_scores.
        const ids = [...new Set([...(lineup.starter_ids || []),lineup.bench_gk_id,lineup.bench_outfield_id].filter(Boolean).map(String))];
        const {data:subMinutes,error:subError} = ids.length
          ? await cloud.client.from("player_match_stats")
              .select("player_id,minutes,fixtures!inner(gameweek_id,status)")
              .eq("fixtures.gameweek_id",gameweekId)
              .in("fixtures.status",["FT","LIVE"])
              .in("player_id",ids)
              .limit(100)
          : {data:[],error:null};
        if(subError) console.warn("Automatische wissels konden niet worden geladen",subError.message);
        const minutes = new Map();
        for(const item of subMinutes || []){
          const id = String(item.player_id);
          minutes.set(id,(minutes.get(id)||0)+Number(item.minutes || 0));
        }
        const substitutions = {incoming:[],outgoing:[]};
        if(!subError){
          const completedClubs = new Set();
          for(const match of MATCHES){
            if(Number(match.gameweek) !== Number(lineup.gameweek_number) || match.status !== "FT") continue;
            completedClubs.add(String(match.home || "").trim().toLowerCase());
            completedClubs.add(String(match.away || "").trim().toLowerCase());
          }
          for(const [flag,isKeeper,benchId] of [
            ["keeper_substitution",true,lineup.bench_gk_id],
            ["outfield_substitution",false,lineup.bench_outfield_id]
          ]){
            if(breakdown[flag] !== true || !benchId || (minutes.get(String(benchId)) || 0) <= 0) continue;
            const replaced = (lineup.starter_ids || []).map(id => playerById(String(id))).find(player =>
              player && (player.pos === "GK") === isKeeper &&
              (minutes.get(String(player.id)) || 0) === 0 &&
              completedClubs.has(String(player.club || "").trim().toLowerCase())
            );
            if(replaced){
              substitutions.incoming.push(String(benchId));
              substitutions.outgoing.push(String(replaced.id));
            }
          }
        }
        lineup.auto_substitutions = substitutions;
        lineup.effective_captain_id = breakdown.effective_captain_id || lineup.captain_id || null;
        lineup.captain_multiplier = Number(breakdown.captain_multiplier || 1.5);
      }
    }catch(error){
      console.warn("Effectieve captain kon niet worden geladen",error?.message || error);
      lineup.effective_captain_id = lineup.captain_id || null;
      lineup.captain_multiplier = 1.5;
    }
    return lineup;
  }

  function markSelectedLeaderboardManager(managerId){
    document.querySelectorAll(".leader-row[data-manager-id]").forEach(row => {
      row.classList.toggle("selected-team",String(row.dataset.managerId) === String(managerId));
    });
  }

  async function showLeaderboardManager(managerId,managerName,teamName){
    cloud.selectedLeaderboardManager = String(managerId);
    markSelectedLeaderboardManager(managerId);

    const target = document.getElementById("leaderboardLineupPreview");
    if(target){
      target.innerHTML = '<div class="leaderboard-preview-empty"><strong>' + escapeHtml(teamName || "Ploeg") + '</strong><span>Opstelling laden…</span></div>';
    }
    if(!cloud.user){
      if(target) target.innerHTML = '<div class="leaderboard-preview-empty"><strong>' + escapeHtml(teamName || "Ploeg") + '</strong><span>Log in om opstellingen te bekijken.</span></div>';
      return;
    }

    try{
      const lineup = await fetchVisibleManagerLineup(managerId);
      cloud.selectedLeaderboardLineup = lineup;
      cloud.selectedLeaderboardTeamName = teamName || "";
      cloud.selectedLeaderboardManagerName = managerName || "";
      if(target) renderVisibleManagerLineup(target,lineup,managerName,teamName,false);
    }catch(error){
      console.warn("Zichtbare klassement-opstelling kon niet worden geladen",error?.message || error);
      if(target){
        target.innerHTML = '<div class="leaderboard-preview-empty"><strong>' + escapeHtml(teamName || "Ploeg") + '</strong><span>Voer migratie 025 uit om de klassement-opstelling te activeren.</span></div>';
      }
    }
  }

  async function loadLeaderboard(){
    const rpc = cloud.selectedLeague === "global" ? "public_leaderboard" : "private_league_leaderboard";
    const params = cloud.selectedLeague === "global" ? undefined : {p_league:cloud.selectedLeague};
    const {data,error} = await cloud.client.rpc(rpc,params);
    if(error) throw error;

    cloud.leaderboardRows = data || [];
    const card = document.querySelector(".leaderboard-card");
    card.innerHTML = '<div class="leader-head"><span>#</span><span>Ploeg</span><span>Speeldag</span><span>Totaal</span></div>';

    cloud.leaderboardRows.forEach((row,index) => {
      const mine = cloud.user && row.manager_id === cloud.user.id;
      const line = make("button","leader-row" + (mine ? " current-user" : ""));
      line.type = "button";
      line.dataset.managerId = String(row.manager_id);
      const rank = make("span","rank",String(row.rank || index + 1));
      const info = make("div");
      const teamName = row.team_name || "Ploeg";
      const managerName = row.manager_name || "Manager";
      info.appendChild(make("strong","leader-team-name",teamName));
      if(mine) info.querySelector("strong").id = "leaderTeamName";
      info.appendChild(make("small","leader-manager-subname",managerName));
      const latest = make("strong","gameweek-points",row.latest_gameweek_number
        ? "S" + row.latest_gameweek_number + " · " + Number(row.latest_gameweek_points || 0).toFixed(1).replace(".0","")
        : "—");
      const pointsTotal = make("strong","",Number(row.total_points || 0).toFixed(1).replace(".0","") + " pts");
      if(mine) pointsTotal.id = "leaderPoints";
      line.append(rank,info,latest,pointsTotal);
      line.addEventListener("click",() => {
        if(leaderboardUsesDialog()) loadManagerHistory(row.manager_id,teamName,managerName);
        else showLeaderboardManager(row.manager_id,managerName,teamName);
      });
      card.appendChild(line);
    });

    if(!cloud.leaderboardRows.length){
      card.appendChild(make("div","empty-state","Nog geen teams in het leaderboard."));
      const preview = document.getElementById("leaderboardLineupPreview");
      if(preview) preview.innerHTML = '<div class="leaderboard-preview-empty"><strong>Nog geen ploegen</strong><span>De opstelling verschijnt hier zodra er managers zijn.</span></div>';
      return;
    }

    const own = cloud.leaderboardRows.find(row => cloud.user && String(row.manager_id) === String(cloud.user.id));
    const preserved = cloud.leaderboardRows.find(row => String(row.manager_id) === String(cloud.selectedLeaderboardManager));
    const selected = preserved || own || cloud.leaderboardRows[0];
    if(!leaderboardUsesDialog()){
      await showLeaderboardManager(selected.manager_id,selected.manager_name,selected.team_name);
    }else{
      markSelectedLeaderboardManager(selected.manager_id);
    }
  }

  async function loadManagerHistory(managerId,teamName,managerName){
    const dialog = document.getElementById("managerDialog");
    const target = document.getElementById("managerHistory");
    target.innerHTML = '<p class="eyebrow">PLOEG</p><h2>' + escapeHtml(teamName || "Ploeg") + '</h2><div class="empty-state">Opstelling laden…</div>';
    if(!dialog.open) dialog.showModal();
    if(!cloud.user){
      target.innerHTML = '<p class="eyebrow">PLOEG</p><h2>' + escapeHtml(teamName || "Ploeg") + '</h2><div class="empty-state">Log in om opstellingen te bekijken.</div>';
      return;
    }

    try{
      const lineup = await fetchVisibleManagerLineup(managerId);
      renderVisibleManagerLineup(target,lineup,managerName,teamName,true);
    }catch(error){
      target.innerHTML = '<p class="eyebrow">PLOEG</p><h2>' + escapeHtml(teamName || "Ploeg") + '</h2><div class="empty-state">Deze ploeg wordt zichtbaar zodra de deadline verstreken is. Voer migratie 025 uit als deze functie nog niet actief is.</div>';
    }
  }

  document.querySelector('.tab[data-tab="leaderboard"]')?.addEventListener("click",() => {
    if(leaderboardUsesDialog() || !cloud.user) return;
    const own = cloud.leaderboardRows.find(row => String(row.manager_id) === String(cloud.user.id));
    if(own) showLeaderboardManager(own.manager_id,own.manager_name,own.team_name);
  });

  async function loadPlayerStats(playerId,context={}){
    const player = playerById(playerId);
    if(!player) return;
    const {data,error} = await cloud.client
      .from("player_match_stats")
      .select("fixture_id,player_id,minutes,stats,fantasy_points,fixtures(id,kickoff,status,home_team,away_team,home_score,away_score,gameweeks(number))")
      .eq("player_id",playerId)
      .limit(100);
    if(error){
      console.error(error);
      return;
    }
    const normalizedRows = (data || []).map(row => ({
      ...row,
      fantasy_points:canonicalFantasyScore(player.pos,row.stats || {},row.minutes)
    }));

    const fixtureId = context?.fixtureId == null ? "" : String(context.fixtureId);
    if(fixtureId){
      const exact = normalizedRows.find(row => {
        const fixture = Array.isArray(row.fixtures) ? row.fixtures[0] : row.fixtures;
        return String(row.fixture_id || fixture?.id || "") === fixtureId;
      });
      const fixtureData = exact
        ? (Array.isArray(exact.fixtures) ? exact.fixtures[0] : exact.fixtures)
        : null;
      const match = MATCHES.find(item => String(item.id) === fixtureId) || (fixtureData ? {
        id:fixtureId,
        home:fixtureData.home_team,
        away:fixtureData.away_team,
        status:fixtureData.status,
        kickoff:fixtureData.kickoff,
        gameweek:fixtureData.gameweeks?.number
      } : null);

      if(match){
        const kickoffMs = match.kickoff ? new Date(match.kickoff).getTime() : NaN;
        const started = ["LIVE","FT"].includes(String(match.status || "")) ||
          (Number.isFinite(kickoffMs) && Date.now() >= kickoffMs);
        if(started){
          const playerDialog = document.getElementById("playerDialog");
          if(playerDialog?.open) playerDialog.close();
          renderMatchPlayerDetail(match,{
            ...(exact || {
              fixture_id:fixtureId,
              player_id:playerId,
              minutes:0,
              stats:{},
              fantasy_points:0
            }),
            player:{
              id:player.id,
              name:player.name,
              club_name:player.club,
              position:player.pos
            }
          },{
            captainMultiplier:Number(context?.captainMultiplier || 1)
          });
          return;
        }
      }
    }

    renderPlayerProfile(player,normalizedRows);
  }

  async function loadDeadline(){
    const {data,error} = await cloud.client.rpc("current_edit_window");
    if(error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    cloud.locked = Boolean(row && row.locked);
    cloud.currentGameweekId = row?.gameweek_id ?? null;
    cloud.currentGameweekNumber = row?.gameweek_number ?? null;
    window.FANTASY_CURRENT_GAMEWEEK_NUMBER = cloud.currentGameweekNumber;
    cloud.deadline = row && row.lock_at ? new Date(row.lock_at) : null;
    const card = document.getElementById("deadlineCard");
    card.classList.toggle("is-locked",cloud.locked);
    document.getElementById("deadlineTitle").textContent = row && row.gameweek_number ? "Deadline · SD " + row.gameweek_number : "Deadline";
    if(!row){
      document.getElementById("deadlineText").textContent = "—";
      card.title = "Nog geen speeldag uit de datafeed ontvangen";
    }else if(cloud.locked){
      document.getElementById("deadlineText").textContent = "Gesloten";
      card.title = "Vergrendeld sinds " + formatDateTime(cloud.deadline);
    }else{
      document.getElementById("deadlineText").textContent = formatDateTime(cloud.deadline);
      card.title = "Opstelling sluit op " + formatDateTime(cloud.deadline);
    }
    updateEditability();
  }

  // Only the server-confirmed substitutions change the displayed XI.
  // The manager's saved starting team and bench remain untouched.
  function resolveCurrentAutoSubstitutions(statRows,breakdown){
    const result = {swaps:{},incoming:[],outgoing:[]};
    const starters = lineupPlayers();
    const reserves = benchPlayers();
    const minutes = new Map();
    for(const row of statRows || []){
      const id = String(row.player_id);
      minutes.set(id,(minutes.get(id) || 0) + Number(row.minutes || 0));
    }
    const completeClubs = new Set();
    for(const match of MATCHES){
      if(Number(match.gameweek) !== Number(cloud.currentGameweekNumber) || match.status !== "FT") continue;
      completeClubs.add(String(match.home || "").toLowerCase());
      completeClubs.add(String(match.away || "").toLowerCase());
    }
    for(const [positionKey,reserveType] of [["keeper_substitution","GK"],["outfield_substitution","FIELD"]]){
      if(breakdown[positionKey] !== true) continue;
      const reserve = reserves.find(player => reserveType === "GK" ? player.pos === "GK" : player.pos !== "GK");
      if(!reserve || (minutes.get(String(reserve.id)) || 0) <= 0) continue;
      const outgoing = starters.find(player =>
        (reserveType === "GK" ? player.pos === "GK" : player.pos !== "GK") &&
        (minutes.get(String(player.id)) || 0) === 0 &&
        completeClubs.has(String(player.club || "").toLowerCase())
      );
      if(!outgoing) continue;
      result.swaps[String(outgoing.id)] = String(reserve.id);
      result.incoming.push(String(reserve.id));
      result.outgoing.push(String(outgoing.id));
    }
    return result;
  }

  async function loadCurrentGameweekPlayerScores(){
    const active = Boolean(cloud.locked && cloud.currentGameweekId);

    window.FANTASY_LIVE_SCORE_MODE = active;
    if(!active){
      window.FANTASY_GAMEWEEK_PLAYER_SCORES = {};
      window.FANTASY_AUTO_SUBSTITUTIONS = {swaps:{},incoming:[],outgoing:[]};
      window.FANTASY_EFFECTIVE_CAPTAIN_ID = null;
      renderTeam();
      return;
    }

    const [playerScoreResult,teamScoreResult,totalResult] = await Promise.all([
      cloud.client
        .from("player_match_stats")
        .select("player_id,minutes,stats,fantasy_points,players(position),fixtures!inner(gameweek_id,status)")
        .eq("fixtures.gameweek_id",cloud.currentGameweekId)
        .in("fixtures.status",["LIVE","FT"])
        .limit(1000),
      cloud.client
        .from("gameweek_scores")
        .select("breakdown,points")
        .eq("gameweek_id",cloud.currentGameweekId)
        .eq("user_id",cloud.user.id)
        .maybeSingle(),
      cloud.client
        .from("teams")
        .select("total_points")
        .eq("user_id",cloud.user.id)
        .maybeSingle()
    ]);
    const {data,error} = playerScoreResult;

    if(error){
      console.warn("Speeldagscore kon niet worden geladen",error.message);
      return;
    }

    const ownBreakdown = teamScoreResult.data?.breakdown || {};
    window.FANTASY_EFFECTIVE_CAPTAIN_ID =
      ownBreakdown.effective_captain_id || state.captainId || null;
    if(totalResult.data?.total_points != null){
      cloud.totalPoints = Number(totalResult.data.total_points || 0);
    }

    const scores = {};
    for(const row of data || []){
      const id = String(row.player_id);
      const playerRow = Array.isArray(row.players) ? row.players[0] : row.players;
      const position = playerRow?.position || playerById(id)?.pos || "MID";
      const score = canonicalFantasyScore(position,row.stats || {},row.minutes);
      scores[id] = Number(scores[id] || 0) + Number(score || 0);
    }

    const automaticSubstitutions = resolveCurrentAutoSubstitutions(data,ownBreakdown);
    const liveScoreSnapshot = JSON.stringify({
      scores,
      substitutions:automaticSubstitutions.swaps,
      captain:window.FANTASY_EFFECTIVE_CAPTAIN_ID,
      total:cloud.totalPoints
    });
    if(cloud.lastLiveScoreSnapshot !== liveScoreSnapshot){
      cloud.lastLiveScoreSnapshot = liveScoreSnapshot;
      window.FANTASY_GAMEWEEK_PLAYER_SCORES = scores;
      window.FANTASY_AUTO_SUBSTITUTIONS = automaticSubstitutions;
      renderTeam();
      renderHeader();
    }

    // Op desktop toont het klassement dezelfde live punten. De browser controleert
    // dit elke minuut; vóór de aftrap blijft de basisprognose zichtbaar.
    if(!leaderboardUsesDialog() && cloud.selectedLeaderboardLineup){
      const preview = document.getElementById("leaderboardLineupPreview");
      if(preview){
        renderVisibleManagerLineup(
          preview,
          cloud.selectedLeaderboardLineup,
          cloud.selectedLeaderboardManagerName,
          cloud.selectedLeaderboardTeamName,
          false
        );
      }
    }

    // Wanneer het klassement open staat, vernieuw ook de team-/speeldagpunten.
    // Dit leest alleen Supabase; het veroorzaakt geen extra Sorare API-call.
    if(document.getElementById("leaderboard")?.classList.contains("active")){
      await loadLeaderboard();
    }
  }

  function startLiveScorePolling(){
    clearInterval(cloud.liveScoreTimer);
    cloud.liveScoreTimer = setInterval(async () => {
      if(!cloud.enabled || !cloud.user || cloud.livePollingBusy || document.hidden) return;
      cloud.livePollingBusy = true;
      try{
        await loadFixtures();
        await loadStartPredictions();
        await loadDeadline();
        await loadCurrentGameweekPlayerScores();

        const openMatchDialog = document.getElementById("matchDialog");
        const openFixtureId = openMatchDialog?.dataset?.fixtureId;
        if(openMatchDialog?.open && openFixtureId){
          await loadMatchDetail(
            openFixtureId,
            MATCHES.find(match => String(match.id) === String(openFixtureId))
          );
        }
      }catch(error){
        console.warn("Live speeldagscore verversen mislukt",error);
      }finally{
        cloud.livePollingBusy = false;
      }
    },60000);
  }

  async function resetTransfers(){
    if(!cloud.user || cloud.locked) return;
    if(!confirm("Wil je alle transfers van deze transferperiode ongedaan maken en je vorige vastgezette selectie herstellen?")) return;
    const button = document.getElementById("resetTransfersBtn");
    button.disabled = true;
    button.textContent = "Herstellen…";
    try{
      const {error} = await cloud.client.rpc("reset_my_transfers");
      if(error) throw error;
      await loadTeam();
      await loadTransferStatus();
      toast("Transfers gereset naar je vorige vastgezette selectie.");
    }catch(error){
      console.error(error);
      const missingMigration = /reset_my_transfers|schema cache|function/i.test(error.message || "");
      toast(missingMigration ? "Voer eerst migratie 016 uit in Supabase." : error.message);
      await loadTransferStatus().catch(() => {});
    }finally{
      button.textContent = "Reset transfers";
    }
  }

  async function loadTransferStatus(){
    if(!cloud.user) return;
    const {data,error} = await cloud.client.rpc("my_transfer_status");
    if(error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    const used = Number(row?.transfers_used || 0);
    const free = Number(row?.free_transfers || 2);
    const cost = Number(row?.point_cost || 0);
    const unlimited = Boolean(row?.unlimited);
    const baseline = Array.isArray(row?.baseline_squad_ids) ? row.baseline_squad_ids.map(String) : null;

    cloud.transfersUsed = used;
    cloud.freeTransfers = free;
    cloud.transferCost = cost;
    cloud.unlimitedTransfers = unlimited;
    cloud.baselineSquad = baseline;

    const counter = document.getElementById("transferCounter");
    document.getElementById("transferTitle").textContent = "Transfers";
    counter.textContent = unlimited ? "∞" : String(Math.max(0,free-used));
    counter.classList.toggle("has-cost",cost > 0);
    counter.title = unlimited
      ? "Je eerste gespeelde fantasyweek: onbeperkt wisselen"
      : (cost > 0 ? "Huidige transferkost: −" + cost + " punten" : Math.max(0,free-used) + " gratis transfer(s) over");
    document.getElementById("transferText").textContent = cost > 0 ? "−" + cost + " punten" : "";

    const resetButton = document.getElementById("resetTransfersBtn");
    resetButton.hidden = unlimited;
    resetButton.disabled = unlimited || cloud.locked || used === 0;
    resetButton.title = cloud.locked
      ? "Transfers zijn vergrendeld"
      : unlimited ? "Je hebt nog onbeperkte transfers" : used === 0
        ? "Je ploeg is al gelijk aan het begin van deze transferperiode"
        : "Herstel je vorige vastgezette selectie";
  }

  function openCompetitionDialog(mode){
    if(!cloud.user){
      document.getElementById("authDialog").showModal();
      toast("Log eerst in om een privécompetitie te gebruiken.");
      return;
    }
    const inviteMode = mode === "invite";
    const league = selectedLeague();
    if(inviteMode && !league?.is_owner) return;
    const form = document.getElementById("competitionForm");
    form.dataset.mode = mode;
    document.getElementById("competitionDialogTitle").textContent = inviteMode ? "Manager uitnodigen" : "Nieuwe competitie";
    document.getElementById("competitionDialogText").textContent = inviteMode
      ? "Nodig iemand uit met zijn exacte gebruikersnaam. Alleen genodigden kunnen toetreden."
      : "Maak een privéklassement voor je vrienden.";
    document.getElementById("competitionNameLabel").hidden = inviteMode;
    document.getElementById("competitionInviteLabel").hidden = !inviteMode;
    document.getElementById("competitionSubmit").textContent = inviteMode ? "Uitnodiging sturen" : "Aanmaken";
    document.getElementById("competitionError").textContent = "";
    document.getElementById("competitionNameInput").value = "";
    document.getElementById("competitionInviteInput").value = "";
    document.getElementById("competitionDialog").showModal();
    setTimeout(() => document.getElementById(inviteMode ? "competitionInviteInput" : "competitionNameInput").focus(),0);
  }

  function bindCompetitionUi(){
    document.getElementById("competitionSelect").addEventListener("change",async event => {
      cloud.selectedLeague = event.target.value;
      updateCompetitionActions();
      try{ await loadLeaderboard(); }catch(error){ toast(error.message); }
    });
    document.getElementById("createCompetitionBtn").addEventListener("click",() => openCompetitionDialog("create"));
    document.getElementById("inviteCompetitionBtn").addEventListener("click",() => openCompetitionDialog("invite"));
    document.getElementById("deleteCompetitionBtn").addEventListener("click",async () => {
      const league = selectedLeague();
      if(!league?.is_owner || !confirm('Privécompetitie "' + league.name + '" verwijderen?')) return;
      const {error} = await cloud.client.rpc("delete_private_league",{p_league:league.id});
      if(error){ toast(error.message); return; }
      cloud.selectedLeague = "global";
      toast("Privécompetitie verwijderd.");
      await loadCompetitions();
      await loadLeaderboard();
    });
    document.getElementById("competitionForm").addEventListener("submit",async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const inviteMode = form.dataset.mode === "invite";
      const errorTarget = document.getElementById("competitionError");
      const submit = document.getElementById("competitionSubmit");
      errorTarget.textContent = "";
      submit.disabled = true;
      try{
        const result = inviteMode
          ? await cloud.client.rpc("invite_to_private_league",{p_league:cloud.selectedLeague,p_manager_name:document.getElementById("competitionInviteInput").value.trim()})
          : await cloud.client.rpc("create_private_league",{p_name:document.getElementById("competitionNameInput").value.trim()});
        if(result.error) throw result.error;
        document.getElementById("competitionDialog").close();
        if(!inviteMode){
          cloud.selectedLeague = String(result.data);
          toast("Privécompetitie aangemaakt.");
        }else toast("Uitnodiging verstuurd.");
        await loadCompetitions();
        await loadLeaderboard();
      }catch(error){
        errorTarget.textContent = error.message || "Actie mislukt.";
      }finally{
        submit.disabled = false;
      }
    });
  }

  function formatDateTime(value){
    if(!value) return "onbekend";
    return new Intl.DateTimeFormat("nl-BE",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(value);
  }

  function updateEditability(){
    const disabled = cloud.enabled && (!cloud.user || cloud.locked);
    const nameInput = document.getElementById("settingsTeamName");
    if(nameInput) nameInput.disabled = !cloud.user;
    document.getElementById("autoLineupBtn").disabled = disabled || !isSquadComplete();
    document.getElementById("resetBtn").disabled = disabled;
    if(cloud.locked) setStatus("Speeldag vergrendeld","locked");
  }

  async function refreshCloud(){
    if(!cloud.user) return;
    try{
      setStatus("Gegevens laden…","");
      await loadPlayers();
      await loadFixtures();
      await loadStartPredictions();
      await Promise.all([loadDeadline(),loadTransferStatus(),loadGameweekBalance()]);
      await loadCurrentGameweekPlayerScores();
      await loadTeam();
      await loadCompetitions();
      await loadLeaderboard();
      startLiveScorePolling();
      if(!cloud.locked) setStatus("Online opgeslagen","online");
    }catch(error){
      console.error(error);
      setStatus("Verbindingsfout","");
      toast("Online gegevens konden niet worden geladen.");
    }
  }

  async function refreshAdminAccess(){
    let isAdmin = false;
    if(cloud.user && cloud.client){
      try{
        const {data,error} = await cloud.client.rpc("is_fantasy_admin");
        if(!error) isAdmin = Boolean(data);
      }catch(error){
        console.warn("Adminstatus kon niet worden geladen",error);
      }
    }
    window.FANTASY_IS_ADMIN = isAdmin;
    window.dispatchEvent(new CustomEvent("fantasy:admin-access",{detail:{isAdmin}}));
    return isAdmin;
  }

  window.FANTASY_ADMIN_API = {
    async saveLineupOverride(fixtureId,side,formation,slots){
      if(!cloud.client || !cloud.user) throw new Error("Log eerst in.");
      const {error} = await cloud.client.rpc("admin_save_fixture_lineup_override",{
        p_fixture_id:Number(fixtureId),
        p_side:String(side),
        p_formation:String(formation),
        p_slots:Array.isArray(slots) ? slots : []
      });
      if(error) throw error;
    },
    async resetLineupOverride(fixtureId){
      if(!cloud.client || !cloud.user) throw new Error("Log eerst in.");
      const {error} = await cloud.client.rpc("admin_reset_fixture_lineup_override",{
        p_fixture_id:Number(fixtureId)
      });
      if(error) throw error;
    }
  };

  async function handleSession(session){
    cloud.user = session ? session.user : null;
    const button = document.getElementById("authButton");
    if(cloud.user){
      button.textContent = "Uitloggen";
      await refreshAdminAccess();
      await refreshCloud();
    }else{
      cloud.locked = false;
      cloud.totalPoints = null;
      cloud.currentGameweekId = null;
      cloud.currentGameweekNumber = null;
      window.FANTASY_CURRENT_GAMEWEEK_NUMBER = null;
      clearInterval(cloud.liveScoreTimer);
      window.FANTASY_LIVE_SCORE_MODE = false;
      window.FANTASY_GAMEWEEK_PLAYER_SCORES = {};
      window.FANTASY_AUTO_SUBSTITUTIONS = {swaps:{},incoming:[],outgoing:[]};
      cloud.lastLiveScoreSnapshot = null;
      window.FANTASY_EFFECTIVE_CAPTAIN_ID = null;
      window.FANTASY_IS_ADMIN = false;
      window.FANTASY_FIXTURE_START_PREDICTIONS = {};
      window.FANTASY_PLAYER_NEXT_START_ODDS = {};
      window.dispatchEvent(new CustomEvent("fantasy:admin-access",{detail:{isAdmin:false}}));
      button.textContent = "Inloggen";
      setStatus("Niet ingelogd","");
      document.getElementById("deadlineText").textContent = "Log in om de actuele deadline te zien";
      document.getElementById("transferTitle").textContent = "Transfers";
      document.getElementById("transferCounter").textContent = "—";
      document.getElementById("transferText").textContent = "";
      document.getElementById("resetTransfersBtn").disabled = true;
      document.getElementById("resetTransfersBtn").hidden = true;
      cloud.transfersUsed = 0;
      cloud.freeTransfers = 2;
      cloud.transferCost = 0;
      cloud.unlimitedTransfers = true;
      cloud.baselineSquad = null;
      state.squad = [];
      state.benchGK = null;
      state.benchOutfield = null;
      state.captainId = null;
      state.teamName = "Mijn Fantasy Team";
      cloud.initialSetupComplete = false;
      cloud.onboardingSeen = false;
      cloud.leagues = [];
      cloud.selectedLeague = "global";
      window.FANTASY_INITIAL_SETUP_LOCK = false;
      state.cash = START_BUDGET;
      original.saveState();
      renderAll();
      updateEditability();
      document.getElementById("competitionSelect").innerHTML = '<option value="global">Algemeen klassement</option>';
      document.getElementById("competitionInvites").hidden = true;
      updateCompetitionActions();
      try{
        await loadPlayers();
        await loadFixtures();
        await loadStartPredictions();
        await loadGameweekBalance();
        renderAll();
      }catch(error){
        console.warn("Publieke voetbaldata kon niet worden geladen",error);
      }
    }
  }

  injectUi();
  wrapMutations();
  bindCompetitionUi();
  window.addEventListener("fantasy:player-profile",event => {
    if(cloud.enabled && cloud.client && event.detail?.playerId){
      loadPlayerStats(event.detail.playerId,event.detail || {});
    }
  });
  window.addEventListener("fantasy:match-detail",event => {
    if(cloud.enabled && cloud.client && event.detail?.fixtureId) loadMatchDetail(event.detail.fixtureId,event.detail.match);
  });
  window.addEventListener("fantasy:matchweek-change",event => {
    if(cloud.enabled && cloud.client && Number.isFinite(Number(event.detail?.gameweek))){
      loadGameweekBalance(Number(event.detail.gameweek));
    }
  });

  if(!cloud.enabled){
    showSetupBanner();
    return;
  }

  cloud.client = window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
  });
  cloud.client.auth.getSession().then(({data}) => handleSession(data.session));
  // TOKEN_REFRESHED mag de gehele pagina niet opnieuw opbouwen.
  // Alleen echte sessiewijzigingen leiden tot opnieuw laden van de ploeg.
  let authenticatedUserId = null;
  cloud.client.auth.onAuthStateChange((event,session) => {
    if(event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    const nextUserId = session?.user?.id || null;
    if(event === "INITIAL_SESSION" && cloud.user?.id === nextUserId) return;
    if(event === "SIGNED_IN" && authenticatedUserId === nextUserId && cloud.user?.id === nextUserId) return;
    authenticatedUserId = nextUserId;
    void handleSession(session);
  });
})();

