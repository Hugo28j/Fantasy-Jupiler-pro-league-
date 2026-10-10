const STORAGE_KEY = "fantasy-jpl-2026-v1";
const START_BUDGET = 125;
const REQUIRED_BY_POS = {GK:2,DEF:2,MID:2,FWD:2};

const state = {
  squad: [],
  benchGK: null,
  benchOutfield: null,
  captainId: null,
  teamName: "Mijn Fantasy Team",
  cash: START_BUDGET,
  budgetBase: START_BUDGET
};

let selectedMatchweek = null;
let matchweekManuallySelected = false;

const marketPriceFilter = {
  min:null,
  max:null,
  boundMin:1,
  boundMax:50,
  touched:false
};

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if(Array.isArray(saved.squad)) state.squad = saved.squad.filter(id => PLAYERS.some(p => p.id === id));
    if(saved.benchGK && state.squad.includes(saved.benchGK)) state.benchGK = saved.benchGK;
    if(saved.benchOutfield && state.squad.includes(saved.benchOutfield)) state.benchOutfield = saved.benchOutfield;
    if(saved.captainId && state.squad.includes(saved.captainId)) state.captainId = saved.captainId;
    if(typeof saved.teamName === "string" && saved.teamName.trim()) state.teamName = saved.teamName.slice(0,28);
    const savedBudgetBase = Number(saved.budgetBase || 100);
    if(Number.isFinite(Number(saved.cash))){
      state.cash = Math.max(0,Number(saved.cash) + (START_BUDGET-savedBudgetBase));
    }else{
      state.cash = Math.max(0,START_BUDGET-state.squad.map(playerById).filter(Boolean).reduce((sum,p)=>sum+Number(p.price||0),0));
    }
    state.budgetBase = START_BUDGET;

    // Oude/opgeslagen selecties kunnen nog 6 veldspelers zonder bankspeler bevatten.
    // Zodra alle 6 veldspelers gekozen zijn, gaat de laatst gekozen veldspeler
    // automatisch naar de bank zodat er altijd maar 5 veldspelers starten.
    const loadedOutfield = squadPlayers().filter(player => player.pos !== "GK");
    if(loadedOutfield.length === 6 && !loadedOutfield.some(player => player.id === state.benchOutfield)){
      state.benchOutfield = loadedOutfield[loadedOutfield.length - 1].id;
    }
  }catch(e){ console.warn("Could not load saved fantasy team",e); }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function playerById(id){ return PLAYERS.find(p => p.id === id); }
function squadPlayers(){ return state.squad.map(playerById).filter(Boolean); }
function countPos(pos){ return squadPlayers().filter(p => p.pos === pos).length; }
function spent(){ return squadPlayers().reduce((sum,p) => sum + Number(p.price || 0),0); }
function budgetLeft(){ return Math.max(0,Number(state.cash || 0)); }
function lineupPlayers(){
  return squadPlayers().filter(p => p.id !== state.benchGK && p.id !== state.benchOutfield);
}
function benchPlayers(){
  return [playerById(state.benchGK),playerById(state.benchOutfield)].filter(Boolean);
}
function isSquadComplete(){
  return state.squad.length === 8 && Object.entries(REQUIRED_BY_POS).every(([pos,n]) => countPos(pos) === n);
}
function isLineupComplete(){
  if(!isSquadComplete()) return false;
  const bench = benchPlayers();
  return bench.length === 2 && bench.filter(p => p.pos === "GK").length === 1 && bench.filter(p => p.pos !== "GK").length === 1 && lineupPlayers().length === 6;
}

function money(v){ return "€" + v.toFixed(1).replace(".",",") + "M"; }
function initials(name){ return name.split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase(); }
function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g,char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}
function points(value){
  return Number(value || 0).toFixed(1).replace(".0","").replace(".",",") + " pts";
}

function canonicalFantasyScore(position,stats={},minutesOverride=null){
  const weights = SCORING.rows[position] || {};
  const merged = {...(stats || {})};
  if(minutesOverride != null) merged.minutes = Number(minutesOverride) || 0;
  const total = Object.entries(weights).reduce((sum,[key,weight]) => {
    if(weight == null || Number(weight) === 0) return sum;
    return sum + (Number(merged[key]) || 0) * Number(weight);
  },0);
  return Math.round(total*100)/100;
}

function scoreBandClass(value){
  const score = Number(value || 0);
  if(score < 5) return "score-negative";
  if(score < 15) return "score-orange";
  if(score < 25) return "score-yellow";
  if(score < 40) return "score-green";
  return "score-blue";
}

function toast(message){
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("show"),2600);
}

function canBuy(player){
  if(state.squad.includes(player.id)) return {ok:false,reason:"owned"};
  if(state.squad.length >= 8) return {ok:false,reason:"Je selectie zit vol."};
  if(countPos(player.pos) >= REQUIRED_BY_POS[player.pos]) return {ok:false,reason:"Je hebt al 2 spelers op deze positie."};
  if(player.price > budgetLeft() + 1e-9) return {ok:false,reason:"Onvoldoende budget."};
  return {ok:true};
}

function buyPlayer(id){
  const p = playerById(id);
  if(!p) return;
  const check = canBuy(p);
  if(!check.ok){ if(check.reason !== "owned") toast(check.reason); return; }

  const samePositionBefore = squadPlayers().filter(player => player.pos === p.pos).length;
  state.squad.push(id);

  // De tweede gekochte keeper is automatisch de reservekeeper.
  // De eerste keeper blijft dus zonder extra klik in de basis staan.
  if(p.pos === "GK" && samePositionBefore === 1 && !state.benchGK){
    state.benchGK = p.id;
  }

  // De selectie bevat 6 veldspelers (2 DEF, 2 MID, 2 FWD), maar er mogen
  // er maar 5 tegelijk op het veld staan. Zodra de zesde veldspeler wordt
  // gekocht, gaat die automatisch naar de bank als er nog geen bankspeler is.
  if(p.pos !== "GK"){
    const outfieldAfterBuy = squadPlayers().filter(player => player.pos !== "GK");
    if(outfieldAfterBuy.length === 6 && !state.benchOutfield){
      state.benchOutfield = p.id;
    }
  }

  state.cash = Math.round((Number(state.cash || 0)-Number(p.price || 0))*10)/10;
  saveState();
  renderAll();
  toast(p.name + " gekocht voor " + money(p.price));
}

function sellPlayer(id){
  const p = playerById(id);
  if(!state.squad.includes(id)) return;
  state.squad = state.squad.filter(x => x !== id);
  if(p) state.cash = Math.round((Number(state.cash || 0)+Number(p.price || 0))*10)/10;
  if(state.benchGK === id) state.benchGK = null;
  if(state.benchOutfield === id) state.benchOutfield = null;
  if(state.captainId === id) state.captainId = null;
  saveState();
  renderAll();
  if(p) toast(p.name + " verkocht.");
}

function transferCaptainWithBenchSwap(outgoingId,incomingId){
  if(state.captainId !== outgoingId) return;
  state.captainId = incomingId || null;
}

function setBench(id){
  const p = playerById(id);
  if(!p || !state.squad.includes(id)) return;

  if(p.pos === "GK"){
    const keepers = squadPlayers().filter(player => player.pos === "GK");
    if(keepers.length < 2){
      toast("Koop eerst een tweede keeper om te kunnen wisselen.");
      return;
    }

    if(state.benchGK === id){
      const otherKeeper = keepers.find(player => player.id !== id);
      if(otherKeeper) transferCaptainWithBenchSwap(otherKeeper.id,id);
      state.benchGK = otherKeeper ? otherKeeper.id : null;
    }else{
      const incomingKeeper = state.benchGK;
      transferCaptainWithBenchSwap(id,incomingKeeper);
      state.benchGK = id;
    }
  }else{
    const outfield = squadPlayers().filter(player => player.pos !== "GK");
    if(outfield.length < 2){
      toast("Je hebt nog geen andere veldspeler om mee te wisselen.");
      return;
    }

    if(state.benchOutfield === id){
      const samePositionStarter = outfield.find(player =>
        player.id !== id &&
        player.pos === p.pos &&
        player.id !== state.benchOutfield
      );
      const fallbackStarter = outfield.find(player =>
        player.id !== id &&
        player.id !== state.benchOutfield
      );
      const replacement = samePositionStarter || fallbackStarter;
      if(replacement) transferCaptainWithBenchSwap(replacement.id,id);
      state.benchOutfield = replacement ? replacement.id : null;
    }else{
      const incomingOutfield = state.benchOutfield;
      transferCaptainWithBenchSwap(id,incomingOutfield);
      state.benchOutfield = id;
    }
  }

  saveState();
  renderAll();
}

function setCaptain(id){
  if(!state.squad.includes(id)) return;
  if(id === state.benchGK || id === state.benchOutfield){
    toast("Een bankspeler kan geen captain zijn.");
    return;
  }
  state.captainId = id;
  saveState();
  renderAll();
  const player = playerById(id);
  if(player) toast(player.name + " is nu captain.");
}

function autoLineup(){
  if(!isSquadComplete()){ toast("Je hebt eerst exact 8 geldige spelers nodig."); return; }
  const keepers = squadPlayers().filter(p => p.pos === "GK").sort((a,b) => a.price - b.price);
  const outfield = squadPlayers().filter(p => p.pos !== "GK").sort((a,b) => a.price - b.price);
  state.benchGK = keepers[0].id;
  state.benchOutfield = outfield[0].id;
  if(state.captainId === state.benchGK || state.captainId === state.benchOutfield){
    state.captainId = null;
  }
  saveState();
  renderAll();
  toast("Automatische opstelling gemaakt.");
}

function resetSquad(){
  if(!confirm("Wil je je volledige selectie wissen?")) return;
  state.cash = Math.round((Number(state.cash || 0)+spent())*10)/10;
  state.squad = [];
  state.benchGK = null;
  state.benchOutfield = null;
  state.captainId = null;
  saveState();
  renderAll();
}

function renderHeader(){
  document.getElementById("budgetDisplay").textContent = money(budgetLeft());
  document.getElementById("squadDisplay").textContent = state.squad.length + " / 8";
  const pts = lineupPlayers().reduce((sum,p) => sum + (p.score || 0),0);
  document.getElementById("pointsDisplay").textContent = pts.toFixed(1).replace(".0","");
  document.getElementById("leaderPoints").textContent = pts.toFixed(1).replace(".0","") + " pts";
}

function renderRequirements(){
  const wrap = document.getElementById("requirements");
  wrap.innerHTML = Object.entries(REQUIRED_BY_POS).map(([pos,needed]) => {
    const n = countPos(pos);
    return '<div class="requirement ' + (n === needed ? "complete":"") + '"><strong>' + POSITION_LABELS[pos] + '</strong><span>' + n + " / " + needed + '</span></div>';
  }).join("");
}

function playerStartPrediction(id){
  const item = window.FANTASY_PLAYER_NEXT_START_ODDS?.[String(id)] || null;
  if(!item || !Number.isFinite(Number(item.percent))) return null;
  return {...item,percent:Math.max(0,Math.min(100,Number(item.percent)))};
}

function playerCurrentGameweekPrediction(player){
  if(!player) return null;
  const currentGameweek = Number(window.FANTASY_CURRENT_GAMEWEEK_NUMBER || 0);
  if(!Number.isFinite(currentGameweek) || currentGameweek <= 0) return playerStartPrediction(player.id);

  const fixture = MATCHES.find(match =>
    Number(match.gameweek) === currentGameweek &&
    (sameClubName(player.club,match.home) || sameClubName(player.club,match.away))
  );
  if(!fixture) return playerStartPrediction(player.id);

  const status = String(fixture.status || "");
  if(["LIVE","FT","CANC"].includes(status)) return null;

  const rows = window.FANTASY_FIXTURE_START_PREDICTIONS?.[String(fixture.id)] || [];
  const row = rows.find(item => String(item.player_id) === String(player.id));
  if(row && Number.isFinite(Number(row.start_probability))){
    return {
      fixtureId:String(fixture.id),
      kickoff:fixture.kickoff,
      opponent:sameClubName(player.club,fixture.home) ? fixture.away : fixture.home,
      source:row.source || "sorare",
      reliability:row.reliability ?? null,
      percent:Math.max(0,Math.min(100,Number(row.start_probability)))
    };
  }

  const fallback = playerStartPrediction(player.id);
  return fallback && String(fallback.fixtureId) === String(fixture.id) ? fallback : null;
}

function predictionBandClass(percent){
  const value = Number(percent);
  if(value < 40) return "prediction-red";
  if(value <= 70) return "prediction-yellow";
  return "prediction-green";
}

function predictionPercent(row){
  const value = Number(row?.start_probability);
  return Number.isFinite(value) ? Math.max(0,Math.min(100,value)) : null;
}

function lineupPlayerHtml(p,isBench){
  const benchLabel = p.pos === "GK" ? "Reservekeeper" : "Reserve veldspeler";
  const buttonText = isBench ? "Naar basis" : "Op bank";
  const liveScoreMode = Boolean(window.FANTASY_LIVE_SCORE_MODE);
  const liveScores = window.FANTASY_GAMEWEEK_PLAYER_SCORES || {};
  const score = liveScoreMode
    ? Number(liveScores[p.id] || 0)
    : Number(p.score || 0);
  // Ook wanneer speeldagpunten al live zijn, blijft een speler wiens eigen
  // wedstrijd nog niet begonnen is zijn startkans tonen.
  const nextPrediction = playerCurrentGameweekPrediction(p);
  const scoreClass = nextPrediction
    ? "prediction-score " + predictionBandClass(nextPrediction.percent)
    : scoreBandClass(score);
  const scoreText = nextPrediction ? Math.round(nextPrediction.percent) + "%" : score.toFixed(0);
  const scoreTitle = nextPrediction
    ? ' title="Kans op basis volgende wedstrijd: ' + Math.round(nextPrediction.percent) + '%"'
    : "";
  const isCaptain = !isBench && state.captainId === p.id;
  const captainControl = isBench ? "" :
    '<button class="captain-toggle ' + (isCaptain ? "selected":"") + '" data-id="' + escapeHtml(p.id) + '" type="button" aria-label="' +
      (isCaptain ? "Captain" : "Maak captain") + '" title="' + (isCaptain ? "Captain" : "Maak captain") + '">C</button>';

  return '<article class="sorare-player ' + (isBench ? "is-bench":"") + (isCaptain ? " is-captain":"") + '">' +
    captainControl +
    '<button class="sorare-player-main player-name-link" data-player-id="' + escapeHtml(p.id) + '" type="button">' +
      '<span class="sorare-avatar role-ring-' + p.pos + '">' + initials(p.name) + '</span>' +
      '<span class="sorare-score ' + scoreClass + '"' + scoreTitle + '>' + scoreText + '</span>' +
      '<span class="sorare-player-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="sorare-player-meta">' + escapeHtml(p.club) + ' · ' + (isBench ? benchLabel : POSITION_LABELS[p.pos]) + '</span>' +
    '</button>' +
    '<div class="sorare-player-footer">' +
      '<span class="role-badge role-' + p.pos + '">' + p.pos + '</span>' +
      '<span class="sorare-price">' + money(p.price) + '</span>' +
      '<button class="bench-toggle mini-action" data-id="' + escapeHtml(p.id) + '" type="button">' + buttonText + '</button>' +
      '<button class="sell-direct mini-action danger-mini-action" data-id="' + escapeHtml(p.id) + '" type="button">Verkopen</button>' +
    '</div>' +
  '</article>';
}

function pitchRowHtml(position,players){
  const rowClass = "pitch-row pitch-row-" + position.toLowerCase();
  if(!players.length){
    return '<div class="' + rowClass + '"><div class="pitch-slot-empty"><span>' + POSITION_LABELS[position] + '</span></div></div>';
  }
  return '<div class="' + rowClass + '">' + players.map(p =>
    '<div class="pitch-player-wrap">' + lineupPlayerHtml(p,false) + '</div>'
  ).join("") + '</div>';
}

function renderPitch(players){
  const groups = {GK:[],DEF:[],MID:[],FWD:[]};
  players.forEach(p => { if(groups[p.pos]) groups[p.pos].push(p); });
  return '<div class="pitch-markings" aria-hidden="true"><span class="pitch-halfway"></span><span class="pitch-circle"></span><span class="pitch-box top"></span><span class="pitch-box bottom"></span><span class="pitch-goal top"></span><span class="pitch-goal bottom"></span></div>' +
    '<div class="pitch-formation">' +
      pitchRowHtml("FWD",groups.FWD) +
      pitchRowHtml("MID",groups.MID) +
      pitchRowHtml("DEF",groups.DEF) +
      pitchRowHtml("GK",groups.GK) +
    '</div>';
}

function renderTeam(){
  const starting = document.getElementById("startingXI");
  const bench = document.getElementById("bench");
  const auto = document.getElementById("autoLineupBtn");
  const lineupTitle = document.getElementById("lineupTitle");
  const lineupPill = document.getElementById("lineupPill");
  auto.disabled = !isSquadComplete();

  if(!state.squad.length){
    starting.className = "fantasy-pitch pitch-empty";
    starting.innerHTML = '<div class="pitch-markings" aria-hidden="true"><span class="pitch-halfway"></span><span class="pitch-circle"></span><span class="pitch-box top"></span><span class="pitch-box bottom"></span><span class="pitch-goal top"></span><span class="pitch-goal bottom"></span></div><div class="pitch-empty-message"><strong>Bouw je ploeg</strong><span>Koop spelers op de transfermarkt en ze verschijnen hier op het veld.</span></div>';
    bench.className = "sorare-bench empty-state";
    bench.textContent = "Je bank verschijnt hier zodra je selectie volledig is.";
    if(lineupTitle) lineupTitle.textContent = "Basis · 6 spelers";
    if(lineupPill) lineupPill.textContent = "1 GK + 5 veldspelers";
    return;
  }

  if(!isSquadComplete()){
    const starters = lineupPlayers();
    const bp = benchPlayers();
    starting.className = "fantasy-pitch";
    starting.innerHTML = renderPitch(starters);

    if(bp.length){
      bench.className = "sorare-bench";
      bench.innerHTML = bp.map(player => lineupPlayerHtml(player,true)).join("");
    }else{
      bench.className = "sorare-bench empty-state";
      bench.textContent = "Je reservekeeper verschijnt hier automatisch zodra je een tweede keeper koopt.";
    }

    if(lineupTitle) lineupTitle.textContent = "Selectie · " + state.squad.length + " / 8";
    if(lineupPill) lineupPill.textContent = bp.length ? "Bank wordt automatisch opgebouwd" : "Nog bezig met bouwen";
  }else{
    const starters = lineupPlayers();
    starting.className = "fantasy-pitch";
    starting.innerHTML = renderPitch(starters);
    bench.className = "sorare-bench";
    const bp = benchPlayers();
    bench.innerHTML = bp.length
      ? bp.map(p => lineupPlayerHtml(p,true)).join("")
      : '<div class="empty-state bench-empty">Kies één keeper en één veldspeler voor de bank.</div>';
    if(lineupTitle) lineupTitle.textContent = "Basis · " + starters.length + " spelers";
    if(lineupPill) lineupPill.textContent = isLineupComplete() ? "Opstelling klaar ✓" : "Kies nog je bank";
  }

  document.querySelectorAll("#team .bench-toggle").forEach(btn => btn.addEventListener("click", () => setBench(btn.dataset.id)));
  document.querySelectorAll("#team .captain-toggle").forEach(btn => btn.addEventListener("click", () => setCaptain(btn.dataset.id)));
  document.querySelectorAll("#team .sell-direct").forEach(btn => btn.addEventListener("click", () => sellPlayer(btn.dataset.id)));
  document.querySelectorAll("#team .player-name-link").forEach(btn => btn.addEventListener("click", () => openPlayerProfile(btn.dataset.playerId)));
}

function renderClubFilter(){
  const select = document.getElementById("clubFilter");
  const current = select.value || "ALL";
  select.innerHTML = '<option value="ALL">Alle clubs</option>' + CLUBS.map(c => '<option value="' + c.replace(/"/g,"&quot;") + '">' + c + '</option>').join("");
  select.value = CLUBS.includes(current) ? current : "ALL";
}

function roundHalf(value){
  return Math.round(Number(value || 0)*2)/2;
}

function priceFilterMoney(value){
  return "€" + Number(value || 0).toFixed(1).replace(".",",") + "M";
}

function syncPriceFilterBounds(){
  const minInput = document.getElementById("priceMinFilter");
  const maxInput = document.getElementById("priceMaxFilter");
  const label = document.getElementById("priceRangeValue");
  const fill = document.getElementById("priceRangeFill");
  if(!minInput || !maxInput) return;

  const prices = PLAYERS.map(p => Number(p.price || 0)).filter(Number.isFinite);
  const rawMin = prices.length ? Math.min(...prices) : 1;
  const rawMax = prices.length ? Math.max(...prices) : 50;
  const boundMin = Math.max(1,Math.floor(rawMin*2)/2);
  const boundMax = Math.max(boundMin+0.5,Math.ceil(rawMax*2)/2);

  marketPriceFilter.boundMin = boundMin;
  marketPriceFilter.boundMax = boundMax;

  if(marketPriceFilter.min == null) marketPriceFilter.min = boundMin;
  if(marketPriceFilter.max == null) marketPriceFilter.max = boundMax;

  marketPriceFilter.min = Math.max(boundMin,Math.min(Number(marketPriceFilter.min),boundMax));
  marketPriceFilter.max = Math.max(boundMin,Math.min(Number(marketPriceFilter.max),boundMax));
  if(marketPriceFilter.min > marketPriceFilter.max){
    marketPriceFilter.min = marketPriceFilter.max;
  }

  minInput.min = String(boundMin);
  minInput.max = String(boundMax);
  minInput.step = "0.5";
  maxInput.min = String(boundMin);
  maxInput.max = String(boundMax);
  maxInput.step = "0.5";
  minInput.value = String(marketPriceFilter.min);
  maxInput.value = String(marketPriceFilter.max);

  if(label){
    label.textContent = priceFilterMoney(marketPriceFilter.min) + " – " + priceFilterMoney(marketPriceFilter.max);
  }

  if(fill){
    const span = Math.max(0.5,boundMax-boundMin);
    const left = ((marketPriceFilter.min-boundMin)/span)*100;
    const right = 100-((marketPriceFilter.max-boundMin)/span)*100;
    fill.style.left = left + "%";
    fill.style.right = right + "%";
  }
}

function updatePriceFilter(changed){
  const minInput = document.getElementById("priceMinFilter");
  const maxInput = document.getElementById("priceMaxFilter");
  if(!minInput || !maxInput) return;

  let min = Number(minInput.value);
  let max = Number(maxInput.value);

  if(changed === "min" && min > max){
    min = max;
    minInput.value = String(min);
  }else if(changed === "max" && max < min){
    max = min;
    maxInput.value = String(max);
  }

  marketPriceFilter.min = roundHalf(min);
  marketPriceFilter.max = roundHalf(max);
  marketPriceFilter.touched = true;
  syncPriceFilterBounds();
  renderMarket();
}

function filteredPlayers(){
  const q = document.getElementById("playerSearch").value.trim().toLowerCase();
  const pos = document.getElementById("positionFilter").value;
  const club = document.getElementById("clubFilter").value;
  const sort = document.getElementById("sortFilter").value;
  const minPrice = Number(marketPriceFilter.min ?? marketPriceFilter.boundMin);
  const maxPrice = Number(marketPriceFilter.max ?? marketPriceFilter.boundMax);
  const list = PLAYERS.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q)) &&
    (pos === "ALL" || p.pos === pos) &&
    (club === "ALL" || p.club === club) &&
    (p.pos === "GK" || Number(p.minutes || 0) > 0) &&
    Number(p.price || 0) >= minPrice &&
    Number(p.price || 0) <= maxPrice
  );
  list.sort((a,b) => {
    if(sort === "price-asc") return a.price - b.price;
    if(sort === "minutes-desc") return (b.minutes ?? -1) - (a.minutes ?? -1);
    if(sort === "points-desc") return Number(b.score || 0) - Number(a.score || 0);
    if(sort === "per90-desc"){
      const a90 = Number(a.minutes || 0) > 0 ? Number(a.score || 0) * 90 / Number(a.minutes) : -Infinity;
      const b90 = Number(b.minutes || 0) > 0 ? Number(b.score || 0) * 90 / Number(b.minutes) : -Infinity;
      return b90-a90 || Number(b.minutes || 0)-Number(a.minutes || 0);
    }
    if(sort === "points-asc") return Number(a.score || 0) - Number(b.score || 0);
    if(sort === "name") return a.name.localeCompare(b.name,"nl");
    return b.price - a.price;
  });
  return list;
}

function recentFormGameweeks(){
  const supplied = (Array.isArray(window.FANTASY_RECENT_GAMEWEEKS) ? window.FANTASY_RECENT_GAMEWEEKS : [])
    .map(Number)
    .filter(Number.isFinite);

  const fromHistory = [...new Set(PLAYERS.flatMap(player =>
    (Array.isArray(player.matchHistory) ? player.matchHistory : [])
      .map(item => Number(item.gameweek))
      .filter(Number.isFinite)
  ))];

  const source = (supplied.length ? supplied : fromHistory)
    .sort((a,b) => a-b)
    .slice(-5);

  while(source.length < 5) source.unshift(null);
  return source;
}

function renderMarket(){
  const grid = document.getElementById("playerGrid");
  syncPriceFilterBounds();
  const list = filteredPlayers();
  document.getElementById("marketCount").textContent = list.length + " spelers zichtbaar · " + PLAYERS.length + " in huidige 2026/27 seed";
  const missing = Object.entries(REQUIRED_BY_POS).filter(([pos,n]) => countPos(pos) < n).map(([pos,n]) => (n-countPos(pos)) + "× " + pos);
  document.getElementById("selectionWarning").textContent = missing.length ? "Nog nodig: " + missing.join(", ") : (isLineupComplete() ? "Team klaar ✓" : "Selectie compleet — kies je bank");

  const formGameweeks = recentFormGameweeks();

  grid.innerHTML = list.map(p => {
    const owned = state.squad.includes(p.id);
    const check = canBuy(p);
    const disabled = !owned && !check.ok;
    const nextPrediction = playerStartPrediction(p.id);
    const predictionBadge = nextPrediction
      ? '<span class="market-start-odds ' + predictionBandClass(nextPrediction.percent) + '" title="Kans op basis in de volgende wedstrijd">Basis ' + Math.round(nextPrediction.percent) + '%</span>'
      : "";
    const scorePer90 = Number(p.minutes || 0) > 0 ? Number(p.score || 0) / Number(p.minutes) * 90 : 0;

    // Vijf vaste chronologische speeldagslots:
    // links = vijf speeldagen geleden, rechts = de laatste afgewerkte speeldag.
    const byGameweek = new Map();
    (Array.isArray(p.matchHistory) ? p.matchHistory : []).forEach(item => {
      const gameweek = Number(item.gameweek);
      if(!Number.isFinite(gameweek)) return;
      const previous = byGameweek.get(gameweek) || {gameweek,points:0,minutes:0,kickoff:""};
      previous.points += Number(item.points || 0);
      previous.minutes += Number(item.minutes || 0);
      if(String(item.kickoff || "") > previous.kickoff) previous.kickoff = String(item.kickoff || "");
      byGameweek.set(gameweek,previous);
    });

    const chartMatches = formGameweeks.map(gameweek =>
      gameweek == null ? null : (byGameweek.get(gameweek) || null)
    );
    const playedMatches = chartMatches.filter(Boolean);
    const maxChartScore = Math.max(15,...playedMatches.map(item => Math.abs(Number(item.points || 0))));

    const profileBars = chartMatches.map((item,index) => {
      const gameweek = formGameweeks[index];
      if(!item){
        const emptyTitle = gameweek == null ? "Nog geen speeldag" : "Speeldag " + gameweek + " · niet gespeeld";
        return '<span class="market-form-slot is-empty" title="' + escapeHtml(emptyTitle) + '"></span>';
      }

      const score = Number(item.points || 0);
      const height = score === 0
        ? 0
        : Math.max(8,Math.round(Math.abs(score) / maxChartScore * 100));
      const directionClass = score < 0 ? "is-negative" : score > 0 ? "is-positive" : "is-zero";
      const title = "Speeldag " + gameweek + " · " + points(score) + " · " + Number(item.minutes || 0) + " min";

      return '<span class="market-form-slot ' + directionClass + '" title="' + escapeHtml(title) + '">' +
        '<i class="' + scoreBandClass(score) + '" style="--bar:' + height + '%"></i></span>';
    }).join("");
    return '<article class="player-card market-player-row ' + (owned ? "owned":"") + '" data-player-id="' + escapeHtml(p.id) + '">' +
      '<button class="market-player-avatar role-ring-' + p.pos + ' player-title-link" data-player-id="' + escapeHtml(p.id) + '" type="button" aria-label="Bekijk ' + escapeHtml(p.name) + '">' + initials(p.name) + '</button>' +
      '<div class="market-player-identity"><div><span class="role-badge role-' + p.pos + '">' + p.pos + '</span><h3><button class="player-title-link" data-player-id="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</button></h3></div><div class="market-player-club-row"><span class="club">' + escapeHtml(p.club) + '</span>' + predictionBadge + '</div></div>' +
      '<div class="market-form"><span>Laatste speeldagen</span><div class="market-form-bars" aria-label="Recente wedstrijdscores met scorekleuren">' + profileBars + '</div><small>' + scorePer90.toFixed(1).replace(".",",") + ' pts/90</small></div>' +
      '<div class="market-player-numbers"><strong class="market-total-points">' + points(p.score).replace(" pts","") + '</strong><small>' + Number(p.minutes || 0) + ' min</small></div>' +
      '<div class="market-player-price"><strong>' + money(p.price) + '</strong><small class="market-price-change ' +
        (Number(p.lastPriceDelta || 0) > 0 ? "positive" : Number(p.lastPriceDelta || 0) < 0 ? "negative" : "neutral") + '">' +
        (p.lastPriceDelta == null ? "—" : (Number(p.lastPriceDelta) > 0 ? "+" : Number(p.lastPriceDelta) < 0 ? "−" : "±") + "€" + Math.abs(Number(p.lastPriceDelta || 0)).toFixed(1).replace(".",",") + "M") + '</small></div>' +
      '<div class="player-actions"><button class="details-btn" data-player-id="' + escapeHtml(p.id) + '">Info</button>' +
      '<button class="buy-btn ' + (owned ? "remove":"") + '" data-action="' + (owned ? "sell":"buy") + '" data-id="' + escapeHtml(p.id) + '" ' + (disabled ? "disabled":"") + '>' +
        (owned ? "Verkopen" : (disabled ? "Niet beschikbaar" : "Kopen")) + '</button></div>' +
    '</article>';
  }).join("");

  grid.querySelectorAll(".buy-btn").forEach(btn => btn.addEventListener("click", () => {
    btn.dataset.action === "sell" ? sellPlayer(btn.dataset.id) : buyPlayer(btn.dataset.id);
  }));
  grid.querySelectorAll(".details-btn,.player-title-link").forEach(btn => btn.addEventListener("click", () => openPlayerProfile(btn.dataset.playerId)));
}

const STAT_GROUP_KEYS = {
  general:["minutes","goal","assist","cleanSheet","goalsConceded","errorLeadToGoal","foulsMade","foulsDrawn","yellow","red"],
  keeper:["save","savesInsideBox","punches"],
  defending:["clearances","successfulTackles","duelWon","duelLost","interceptions"],
  possession:["successfulPass","successfulLongPass","passMissed","successfulFinalThirdPasses","bigChanceCreated","possessionWon","possessionLost"],
  attack:["shotOnTarget","totalScoringAtt","bigChanceMissed","penAreaEntries","successfulDribble","penaltyWon"]
};

function statGroupDefinitions(position,availableKeys=[]){
  const available = new Set(availableKeys);
  const used = new Set();
  const make = (label,keys) => {
    const filtered = keys.filter(key => available.has(key));
    filtered.forEach(key => used.add(key));
    return {label,keys:filtered};
  };

  if(position === "GK"){
    const groups = [
      make("Keeper",STAT_GROUP_KEYS.keeper),
      make("Algemeen",STAT_GROUP_KEYS.general)
    ];
    const remaining = availableKeys.filter(key => !used.has(key));
    if(remaining.length) groups.push(make("Resterende",remaining));
    return groups.filter(group => group.keys.length);
  }

  const defendingKeys = position === "FWD"
    ? STAT_GROUP_KEYS.defending.filter(key => key !== "duelWon" && key !== "duelLost")
    : STAT_GROUP_KEYS.defending;
  const attackKeys = position === "FWD"
    ? [...STAT_GROUP_KEYS.attack,"duelWon","duelLost"]
    : STAT_GROUP_KEYS.attack;

  const groups = [
    make("Algemeen",STAT_GROUP_KEYS.general),
    make("Defending",defendingKeys),
    make("Possession",STAT_GROUP_KEYS.possession),
    make("Aanval",attackKeys)
  ];
  const remaining = availableKeys.filter(key => !used.has(key));
  if(remaining.length) groups.push(make("Resterende",remaining));
  return groups.filter(group => group.keys.length);
}

function scoreContributionClass(value){
  const n = Number(value || 0);
  if(n < 0) return "negative";
  if(n > 0) return "positive";
  return "neutral";
}

function renderSeasonStatGroups(metrics,position){
  const byKey = new Map(metrics.map(metric => [metric.key,metric]));
  return statGroupDefinitions(position,metrics.map(metric => metric.key)).map(group => {
    const groupMetrics = group.keys.map(key => byKey.get(key)).filter(Boolean);
    const groupPoints = Math.round(groupMetrics.reduce((sum,metric) => sum + Number(metric.contribution || 0),0) * 100) / 100;
    const cards = groupMetrics.map(metric =>
      '<div class="profile-stat-card"><span>' + escapeHtml(metric.label) + '</span><strong>' +
      metric.value + ' <small class="stat-contribution ' + scoreContributionClass(metric.contribution) + '">(' +
      scoreLabel(metric.contribution) + ' pts)</small></strong></div>'
    ).join("");
    return '<details class="stat-group"><summary><span>' + escapeHtml(group.label) +
      '</span><span class="stat-group-summary-meta"><strong class="stat-group-total ' + scoreContributionClass(groupPoints) + '">' +
      scoreLabel(groupPoints) + ' pts</strong><small>' + group.keys.length + ' stats</small></span></summary><div class="profile-stats stat-group-grid">' +
      cards + '</div></details>';
  }).join("");
}

function renderMatchStatGroups(breakdown,position){
  const byKey = new Map(breakdown.map(item => [item.key,item]));
  return statGroupDefinitions(position,breakdown.map(item => item.key)).map(group => {
    const groupItems = group.keys.map(key => byKey.get(key)).filter(Boolean);
    const groupPoints = Math.round(groupItems.reduce((sum,item) => sum + Number(item.contribution || 0),0) * 100) / 100;
    const rows = groupItems.map(item =>
      '<div class="match-stat-line"><span>' + escapeHtml(MATCH_STAT_LABELS[item.key] || item.key) +
      ' <small>(' + item.amount + ')</small></span><strong class="' +
      scoreContributionClass(item.contribution) + '">' + scoreLabel(item.contribution) + ' pts</strong></div>'
    ).join("");
    return '<details class="stat-group match-stat-group"><summary><span>' + escapeHtml(group.label) +
      '</span><span class="stat-group-summary-meta"><strong class="stat-group-total ' + scoreContributionClass(groupPoints) + '">' +
      scoreLabel(groupPoints) + ' pts</strong><small>' + group.keys.length + ' stats</small></span></summary><div class="match-stat-breakdown">' +
      rows + '</div></details>';
  }).join("");
}

function renderPlayerProfile(player,matchRows=[]){
  const rows = Array.isArray(matchRows) ? matchRows : [];
  const total = key => rows.reduce((sum,row) => sum + Number((row.stats || {})[key] || 0),0);
  const totalMinutes = rows.length ? rows.reduce((sum,row) => sum + Number(row.minutes || 0),0) : Number(player.minutes || 0);
  const totalPoints = rows.length ? rows.reduce((sum,row) => sum + Number(row.fantasy_points || 0),0) : Number(player.score || 0);
  const scoreKeys = [
    ...SCORING.columns.map(([key]) => key),
    ...Object.keys(SCORING.rows[player.pos] || {}).filter(key => !SCORING.columns.some(([columnKey]) => columnKey === key))
  ];
  const metrics = [...new Set(scoreKeys)].map(key => {
    const value = key === "minutes" ? totalMinutes : total(key);
    const weight = SCORING.rows[player.pos]?.[key];
    const contribution = weight == null ? 0 : Math.round(value * Number(weight) * 100) / 100;
    const label = MATCH_STAT_LABELS[key] || SCORING.columns.find(([columnKey]) => columnKey === key)?.[1] || key;
    return {label,key,value,contribution,weight};
  }).filter(metric =>
    metric.weight != null &&
    Number(metric.weight) !== 0 &&
    (metric.key !== "keyPass" || Number(metric.value) !== 0)
  );
  const chartRows = rows.slice().sort((a,b) => {
    const af = Array.isArray(a.fixtures) ? a.fixtures[0] : (a.fixtures || {});
    const bf = Array.isArray(b.fixtures) ? b.fixtures[0] : (b.fixtures || {});
    const agw = Number(af.gameweeks?.number || 0);
    const bgw = Number(bf.gameweeks?.number || 0);
    return agw === bgw ? String(af.kickoff || "").localeCompare(String(bf.kickoff || "")) : agw-bgw;
  });
  const maxMatchScore = Math.max(15,...chartRows.map(row => Math.abs(Number(row.fantasy_points || 0))));
  const matches = chartRows.map(row => {
    const fixture = Array.isArray(row.fixtures) ? row.fixtures[0] : (row.fixtures || {});
    const gameweek = fixture.gameweeks?.number || "?";
    const score = Number(row.fantasy_points || 0);
    const minutes = Number(row.minutes || 0);
    // Zelfde grafiekregel in het spelersprofiel:
    // 0 en negatieve scores tonen als een bijna platte balk.
    const height = score <= 0
      ? 4
      : Math.max(8,Math.round(score / maxMatchScore * 100));
    const fixtureId = fixture.id == null ? "" : String(fixture.id);
    const title = "Speeldag " + gameweek + ": " + points(score) + ", " + minutes + " minuten";
    return '<button class="gameweek-chart-item" type="button" data-fixture-id="' + escapeHtml(fixtureId) +
      '" title="' + escapeHtml(title) + '" ' + (fixtureId ? "" : "disabled") + '>' +
      '<strong class="gameweek-chart-points">' + points(score).replace(" pts","") + '</strong>' +
      '<span class="gameweek-chart-track"><i class="' + scoreBandClass(score) + '" style="--bar-height:' + height + '%"></i></span>' +
      '<span class="gameweek-chart-label">SD ' + escapeHtml(String(gameweek)) + '<small>' + minutes + ' min</small></span>' +
    '</button>';
  }).join("");
  document.getElementById("playerProfile").innerHTML =
    '<p class="eyebrow">SPELERSFICHE</p><div class="profile-hero"><div><span class="role-badge role-' + player.pos + '">' + player.pos + '</span><h2>' + escapeHtml(player.name) + '</h2><p>' + escapeHtml(player.club) + ' · ' + escapeHtml(POSITION_LABELS[player.pos]) + '</p></div><strong class="profile-price">' + money(Number(player.price)) + '</strong></div>' +
    '<div class="profile-highlights"><article><span>Totale score</span><strong>' + points(totalPoints) + '</strong></article><article><span>Speelminuten</span><strong>' + totalMinutes + '</strong></article><article><span>Wedstrijden</span><strong>' + rows.length + '</strong></article></div>' +
    '<section class="profile-performance-card">' +
      '<div class="profile-stat-groups"><h4>Seizoenstatistieken</h4><div class="stat-groups">' + renderSeasonStatGroups(metrics,player.pos) + '</div></div>' +
      '<div class="profile-chart-section"><div class="profile-section-head"><div><h3>Prestaties per speeldag</h3><small>Klik op een speeldagbalk voor de volledige wedstrijd</small></div></div>' +
      '<div class="gameweek-chart-scroll"><div class="gameweek-chart">' + (matches || '<div class="empty-state">Nog geen verwerkte wedstrijdstatistieken.</div>') + '</div></div></div>' +
    '</section>';
  document.querySelectorAll("#playerProfile .gameweek-chart-item[data-fixture-id]:not([disabled])").forEach(button => {
    button.addEventListener("click",() => {
      const playerDialog = document.getElementById("playerDialog");
      if(playerDialog.open) playerDialog.close();
      openFixtureDetail(button.dataset.fixtureId);
    });
  });
}

function openPlayerProfile(id){
  const player = playerById(id);
  if(!player) return;
  renderPlayerProfile(player,[]);
  const dialog = document.getElementById("playerDialog");
  if(!dialog.open) dialog.showModal();
  window.dispatchEvent(new CustomEvent("fantasy:player-profile",{detail:{playerId:id}}));
}

function matchweekNumber(match){
  const direct = Number(match?.gameweek);
  if(Number.isFinite(direct) && direct > 0) return direct;
  const parsed = String(match?.week || "").match(/\d+/);
  return parsed ? Number(parsed[0]) : null;
}

function openFixtureDetail(fixtureId,fallbackMatch){
  const id = String(fixtureId || "");
  if(!id) return;
  const match = fallbackMatch || MATCHES.find(item => String(item.id) === id);
  const dialog = document.getElementById("matchDialog");
  document.getElementById("matchDetail").innerHTML = '<div class="empty-state match-loading">Wedstrijdopstelling laden…</div>';
  if(!dialog.open) dialog.showModal();
  window.dispatchEvent(new CustomEvent("fantasy:match-detail",{detail:{fixtureId:id,match}}));
}

function automaticMatchweekForNow(weeks){
  if(!weeks.length) return null;
  const now = Date.now();
  const starts = weeks.map(week => {
    const kickoffs = MATCHES
      .filter(match => matchweekNumber(match) === week)
      .map(match => match.kickoff ? new Date(match.kickoff).getTime() : Number.NaN)
      .filter(value => Number.isFinite(value) && value > 0);
    return {
      week,
      firstKickoff:kickoffs.length ? Math.min(...kickoffs) : Number.POSITIVE_INFINITY
    };
  }).filter(item => Number.isFinite(item.firstKickoff));

  if(!starts.length){
    const liveWeek = weeks.find(week => MATCHES.some(match => matchweekNumber(match) === week && String(match.status) === "LIVE"));
    const nextWeek = weeks.find(week => MATCHES.some(match =>
      matchweekNumber(match) === week && !["FT","CANC"].includes(String(match.status || ""))
    ));
    const played = weeks.filter(week => MATCHES.some(match => matchweekNumber(match) === week && String(match.status) === "FT"));
    return liveWeek ?? nextWeek ?? (played.length ? played[played.length-1] : weeks[0]);
  }

  const activeWindow = starts
    .filter(item => now >= item.firstKickoff - 24*60*60*1000)
    .sort((a,b) => b.firstKickoff-a.firstKickoff);

  if(activeWindow.length) return activeWindow[0].week;

  return starts.sort((a,b) => a.firstKickoff-b.firstKickoff)[0].week;
}

function renderMatches(){
  const target = document.getElementById("matchesList");
  const select = document.getElementById("matchweekSelect");
  const weeks = [...new Set(MATCHES.map(matchweekNumber).filter(Number.isFinite))].sort((a,b) => a-b);

  if(weeks.length){
    const stillValid = weeks.includes(Number(selectedMatchweek));
    if(!matchweekManuallySelected || !stillValid){
      selectedMatchweek = automaticMatchweekForNow(weeks);
      matchweekManuallySelected = false;
    }
  }

  const resolvedWeek = Number(selectedMatchweek);
  if(Number.isFinite(resolvedWeek)){
    const previousWeek = Number(window.FANTASY_SELECTED_MATCHWEEK);
    window.FANTASY_SELECTED_MATCHWEEK = resolvedWeek;
    if(previousWeek !== resolvedWeek){
      window.dispatchEvent(new CustomEvent("fantasy:matchweek-change",{detail:{gameweek:resolvedWeek}}));
    }
  }

  if(select){
    select.innerHTML = weeks.map(week => '<option value="' + week + '">Speeldag ' + week + '</option>').join("");
    if(selectedMatchweek != null) select.value = String(selectedMatchweek);
    select.onchange = () => {
      selectedMatchweek = Number(select.value);
      matchweekManuallySelected = true;
      renderMatches();
    };
  }

  const visible = MATCHES
    .filter(m => !weeks.length || matchweekNumber(m) === Number(selectedMatchweek))
    .slice()
    .sort((a,b) => String(a.kickoff || "").localeCompare(String(b.kickoff || "")));

  target.innerHTML = visible.map(m => {
    const status = String(m.status || "");
    const clickable = Boolean(m.id) && status !== "CANC";
    const tag = status === "LIVE"
      ? '<span class="match-live-badge">LIVE</span>'
      : !["FT","CANC"].includes(status) ? '<span class="match-upcoming-badge">KOMEND</span>' : "";
    const scoreText = ["FT","LIVE"].includes(status)
      ? escapeHtml(String(m.homeScore)) + "–" + escapeHtml(String(m.awayScore))
      : "vs";
    const liveMinute = status === "LIVE" && Number(m.liveMinute || 0) > 0
      ? Math.max(1,Math.round(Number(m.liveMinute))) + "′"
      : null;
    const dateText = liveMinute || (m.date || "");
    const content = '<span class="date' + (liveMinute ? ' live-minute' : '') + '">' + escapeHtml(dateText) + '</span>' +
      '<strong class="home">' + escapeHtml(m.home || "") + '</strong>' +
      '<span class="match-score' + (!["FT","LIVE"].includes(status) ? " future" : "") + '">' + scoreText + tag + '</span>' +
      '<strong>' + escapeHtml(m.away || "") + '</strong><span class="matchweek">' + escapeHtml(m.week || "") + '</span>';
    return clickable
      ? '<button class="match-row match-row-button" type="button" data-fixture-id="' + escapeHtml(String(m.id)) + '">' + content + '</button>'
      : '<div class="match-row match-row-future">' + content + '</div>';
  }).join("") || '<div class="empty-state">Geen wedstrijden gevonden voor deze speeldag.</div>';

  target.querySelectorAll(".match-row-button").forEach(button => button.addEventListener("click",() => {
    openFixtureDetail(button.dataset.fixtureId);
  }));
}

function matchEventBadge(type,icon,label,count){
  const n = Number(count || 0);
  if(n <= 0) return "";
  return '<span class="match-event-icon event-' + type + '" title="' + escapeHtml(label + (n > 1 ? " ×" + n : "")) + '">' +
    icon + (n > 1 ? '<b>' + n + '</b>' : '') + '</span>';
}

function matchCardBadges(row){
  const stats = row.stats || {};
  return matchEventBadge("yellow","","Gele kaart",stats.yellow) +
    matchEventBadge("red","","Rode kaart",stats.red);
}

function matchNameBadges(row){
  const stats = row.stats || {};
  return matchEventBadge("goal","⚽","Goal",stats.goal) +
    matchEventBadge("assist","A","Assist",stats.assist) +
    matchEventBadge("error","!","Fout leidend tot goal",stats.errorLeadToGoal);
}

function matchEventBadges(row){
  return matchCardBadges(row) + matchNameBadges(row);
}

function matchSubstitutionLabel(row,match){
  if(predictionPercent(row) != null) return "";
  const stats = row.stats || {};
  const minutes = Number(row.minutes || stats.minutes || 0);
  const started = Number(stats.gameStarted || 0) > 0;
  const fieldStatus = String(stats.fieldStatus || "");
  const currentMinute = Math.max(0,Number(stats.gameMinute || 0));
  const referenceMinute = match?.status === "LIVE" && currentMinute > 0 ? currentMinute : 90;

  if(started && fieldStatus === "SUBSTITUTED" && minutes < referenceMinute){
    return '<span class="sub-event sub-off">↓ ' + Math.max(1,Math.round(minutes)) + "′</span>";
  }
  if(!started && minutes > 0){
    const onMinute = Math.max(1,Math.round(referenceMinute-minutes));
    return '<span class="sub-event sub-on">↑ ' + onMinute + "′</span>";
  }
  return "";
}

const FORMATION_SIDE_ORDER = {
  GK:{default:[1]},
  DEF:{
    3:[4,5,6],
    4:[3,6,5,2],
    5:[3,4,5,6,2],
    default:[3,4,5,6,2]
  },
  MID:{
    2:[4,8],
    3:[8,4,7],
    4:[11,8,4,7],
    5:[11,8,4,7,2],
    default:[11,8,4,10,7,2]
  },
  FWD:{
    1:[9],
    2:[9,10],
    3:[11,9,10],
    4:[11,9,10,7],
    default:[11,9,10,7]
  }
};

function matchFormationPlace(row){
  const stats = row.stats || {};
  const actual = Number(stats.formationPlace || 0);
  if(actual > 0) return actual;
  const preferred = Number(stats.preferredFormationPlace || 0);
  return preferred > 0 ? preferred : 0;
}

function naturalMatchVisualZone(row){
  const declared = row.player?.position || "MID";
  const place = matchFormationPlace(row);

  // formationPlace beschrijft waar iemand in deze wedstrijd werkelijk stond.
  // Alleen de ondubbelzinnige plaatsen overschrijven de vaste spelersklasse.
  // Zo kan bv. een MID/FWD die als spits start visueel gewoon in de spitsenlijn
  // staan, zonder zijn permanente fantasy-positie te veranderen.
  if(declared === "GK" || place === 1) return "GK";
  if(place === 9 || place === 10) return "FWD";
  if(place === 3 || place === 5 || place === 6) return "DEF";
  if(place === 8) return "MID";
  return declared;
}

function matchVisualZone(row){
  return row._layoutZone || naturalMatchVisualZone(row);
}

function formationSideRank(row,position,total){
  const place = matchFormationPlace(row);
  const config = FORMATION_SIDE_ORDER[position] || {};
  const order = config[total] || config.default || [];
  const rank = order.indexOf(place);
  if(rank >= 0) return rank;
  return 50 + String(row.player?.name || row.player_id || "").charCodeAt(0);
}

function lineY(index,total,side,zone){
  if(total <= 1) return 50;

  // Compacte centrale linies.
  // 2 middenvelders: dubbele pivot centraal.
  if(zone === "MID" && total === 2){
    const compact = [40,60];
    const base = compact[index] ?? 50;
    return side === "away" ? 100-base : base;
  }

  // 2 verdedigers: compact centraal rond het strafschopgebied.
  if(zone === "DEF" && total === 2){
    const compact = [40,60];
    const base = compact[index] ?? 50;
    return side === "away" ? 100-base : base;
  }

  // 3 middenvelders: centrale driehoek/linie, vooral voor 5-3-2 en 4-3-3.
  if(zone === "MID" && total === 3){
    const compact = [34,50,66];
    const base = compact[index] ?? 50;
    return side === "away" ? 100-base : base;
  }

  // 2 aanvallers: twee spitsen dichter bij elkaar rond het centrum.
  if(zone === "FWD" && total === 2){
    const compact = [40,60];
    const base = compact[index] ?? 50;
    return side === "away" ? 100-base : base;
  }

  const min = 18;
  const max = 82;
  const base = min + ((max-min)*index)/(total-1);
  return side === "away" ? 100-base : base;
}

function inferredFormation(rows){
  const starters = inferredMatchStarters(rows);
  const counts = {DEF:0,MID:0,FWD:0};
  starters.forEach(row => {
    const pos = matchVisualZone(row);
    if(counts[pos] != null) counts[pos] += 1;
  });
  return counts.DEF + "-" + counts.MID + "-" + counts.FWD;
}

function matchPlayerButton(row,match,side,index,total,zone){
  const player = row.player || {};
  const stats = row.stats || {};
  const pos = player.position || zone || "MID";
  const score = Number(row.fantasy_points || 0);
  const startPct = predictionPercent(row);
  const scoreClass = startPct != null
    ? "prediction-chip " + predictionBandClass(startPct)
    : scoreBandClass(score);
  const scoreText = startPct != null
    ? Math.round(startPct) + "%"
    : score.toFixed(score % 1 ? 1 : 0).replace(".",",");

  const xByPosition = side === "home"
    ? {GK:7,DEF:20,MID:33,FWD:43}
    : {GK:93,DEF:80,MID:67,FWD:57};

  let x = xByPosition[zone || pos] || (side === "home" ? 33 : 67);

  // Bij een vijfmansdefensie zijn de buitenste twee wingbacks.
  // Die staan iets hoger dan de drie centrale verdedigers.
  if(zone === "DEF" && total === 5 && (index === 0 || index === total-1)){
    x += side === "home" ? 5 : -5;
  }

  const y = lineY(index,total,side,zone || pos);

  return '<button class="match-pitch-player" type="button" data-match-player="' + escapeHtml(String(row.player_id)) + '" style="--mx:' + x + '%;--my:' + y + '%">' +
    '<span class="match-card-strip">' + matchCardBadges(row) + '</span>' +
    '<span class="match-sub-strip">' + matchSubstitutionLabel(row,match) + '</span>' +
    '<span class="match-avatar role-ring-' + escapeHtml(pos) + '">' + initials(player.name || "?") + '</span>' +
    '<span class="match-score-chip ' + scoreClass + '">' + scoreText + '</span>' +
    '<span class="match-player-name-row"><span class="match-player-name" title="' + escapeHtml(player.name || "Onbekend") + '">' + escapeHtml(desktopMatchDisplayName(player.name)) + '</span>' +
      '<span class="match-name-events">' + matchNameBadges(row) + '</span></span>' +
  '</button>';
}

function inferredMatchStarters(rows){
  const predicted = rows.filter(row => predictionPercent(row) != null);
  if(predicted.length){
    const byPosition = {GK:[],DEF:[],MID:[],FWD:[]};
    predicted.forEach(row => {
      const pos = row.player?.position || "MID";
      if(byPosition[pos]) byPosition[pos].push(row);
    });
    Object.values(byPosition).forEach(group => group.sort((a,b) => {
      const pctDiff = predictionPercent(b)-predictionPercent(a);
      if(pctDiff) return pctDiff;
      return String(a.player?.name || "").localeCompare(String(b.player?.name || ""),"nl");
    }));

    // Kies de sterkste verwachte XI binnen een geldige standaardformatie.
    // Dit voorkomt automatische vormen zoals 6-2-2 of 2-4-4 die de admin-RPC
    // terecht niet accepteerde.
    const standardFormations = [
      [4,3,3],[4,4,2],[3,4,3],[3,5,2],[5,3,2],[4,5,1],[5,4,1]
    ];
    let best = null;

    for(const [defCount,midCount,fwdCount] of standardFormations){
      if(
        byPosition.GK.length < 1 ||
        byPosition.DEF.length < defCount ||
        byPosition.MID.length < midCount ||
        byPosition.FWD.length < fwdCount
      ) continue;

      const selected = [
        byPosition.GK[0],
        ...byPosition.DEF.slice(0,defCount),
        ...byPosition.MID.slice(0,midCount),
        ...byPosition.FWD.slice(0,fwdCount)
      ];
      const totalProbability = selected.reduce((sum,row) => sum + predictionPercent(row),0);

      if(!best || totalProbability > best.totalProbability){
        best = {selected,totalProbability};
      }
    }

    if(best) return best.selected;

    // Alleen als de beschikbare prediction-data geen enkele standaardformatie
    // kan vormen, vallen we terug op de 11 hoogste kansen.
    const sorted = predicted.slice().sort((a,b) => {
      const pctDiff = predictionPercent(b)-predictionPercent(a);
      if(pctDiff) return pctDiff;
      const posOrder = {GK:0,DEF:1,MID:2,FWD:3};
      const posDiff = (posOrder[a.player?.position] ?? 9)-(posOrder[b.player?.position] ?? 9);
      if(posDiff) return posDiff;
      return String(a.player?.name || "").localeCompare(String(b.player?.name || ""),"nl");
    });
    const keeper = sorted.find(row => row.player?.position === "GK");
    if(!keeper) return sorted.slice(0,11);
    return [keeper,...sorted.filter(row => row !== keeper && row.player?.position !== "GK").slice(0,10)];
  }

  const explicit = rows.filter(row => Number((row.stats || {}).gameStarted || 0) > 0);
  if(explicit.length >= 7) return explicit;

  const played = rows.filter(row => Number(row.minutes || 0) > 0)
    .slice().sort((a,b) => Number(b.minutes || 0)-Number(a.minutes || 0));
  const chosen = [];
  const keeper = played.find(row => row.player?.position === "GK");
  if(keeper) chosen.push(keeper);
  for(const row of played){
    if(chosen.length >= 11) break;
    if(!chosen.includes(row)) chosen.push(row);
  }
  return chosen;
}

function renderMatchTeamPlayers(rows,match,side){
  const starters = inferredMatchStarters(rows);
  const groups = {GK:[],DEF:[],MID:[],FWD:[]};
  starters.forEach(row => {
    const zone = matchVisualZone(row);
    (groups[zone] || groups.MID).push(row);
  });

  return ["GK","DEF","MID","FWD"].flatMap(zone => {
    const group = groups[zone];
    group.sort((a,b) => {
      const rankDiff = formationSideRank(a,zone,group.length)-formationSideRank(b,zone,group.length);
      if(rankDiff) return rankDiff;
      return String(a.player?.name || "").localeCompare(String(b.player?.name || ""),"nl");
    });
    return group.map((row,index) => matchPlayerButton(row,match,side,index,group.length,zone));
  }).join("");
}

function desktopMatchDisplayName(name){
  const fullName = String(name || "").trim();
  if(!fullName) return "Onbekend";
  // Korte namen blijven volledig zichtbaar; langere namen krijgen op desktop
  // alleen de achternaam zodat aangrenzende spelers niet overlappen.
  return fullName.length > 15 ? mobileMatchSurname(fullName) : fullName;
}

function mobileMatchSurname(name){
  const fullName = String(name || "").trim();
  if(!fullName) return "Onbekend";

  const parts = fullName.split(/\s+/).filter(Boolean);
  if(parts.length <= 1) return fullName;

  // Houd gangbare tussenvoegsels bij de achternaam, bv.
  // "Siebe Van der Heyden" -> "Van der Heyden".
  const particles = new Set([
    "van","von","de","den","der","del","della","di","da","do","dos","das",
    "le","la","du","des","ten","ter","te","mac","mc","st.","st"
  ]);

  let start = parts.length - 1;
  while(start > 0 && particles.has(parts[start - 1].toLowerCase())){
    start -= 1;
  }

  return parts.slice(start).join(" ");
}

function matchMobilePlayerButton(row,match,index,total,zone){
  const player = row.player || {};
  const pos = player.position || zone || "MID";
  const score = Number(row.fantasy_points || 0);
  const startPct = predictionPercent(row);
  const scoreClass = startPct != null
    ? "prediction-chip " + predictionBandClass(startPct)
    : scoreBandClass(score);
  const scoreText = startPct != null
    ? Math.round(startPct) + "%"
    : score.toFixed(score % 1 ? 1 : 0).replace(".",",");
  const x = lineY(index,total,"home",zone || pos);
  const yByPosition = {GK:88,DEF:68,MID:45,FWD:21};
  let y = yByPosition[zone || pos] || 45;
  if(zone === "DEF" && total === 5 && (index === 0 || index === total-1)) y -= 6;

  return '<button class="match-pitch-player mobile-pitch-player" type="button" data-match-player="' + escapeHtml(String(row.player_id)) + '" style="--mx:' + x + '%;--my:' + y + '%">' +
    '<span class="match-card-strip">' + matchCardBadges(row) + '</span>' +
    '<span class="match-sub-strip">' + matchSubstitutionLabel(row,match) + '</span>' +
    '<span class="match-avatar role-ring-' + escapeHtml(pos) + '">' + initials(player.name || "?") + '</span>' +
    '<span class="match-score-chip ' + scoreClass + '">' + scoreText + '</span>' +
    '<span class="match-player-name-row"><span class="match-player-name" title="' + escapeHtml(player.name || "Onbekend") + '">' + escapeHtml(mobileMatchSurname(player.name)) + '</span><span class="match-name-events">' + matchNameBadges(row) + '</span></span>' +
  '</button>';
}

function renderMatchMobileTeam(rows,match){
  const starters = inferredMatchStarters(rows);
  const groups = {GK:[],DEF:[],MID:[],FWD:[]};
  starters.forEach(row => {
    const zone = matchVisualZone(row);
    (groups[zone] || groups.MID).push(row);
  });
  return ["GK","DEF","MID","FWD"].flatMap(zone => {
    const group = groups[zone];
    group.sort((a,b) => formationSideRank(a,zone,group.length)-formationSideRank(b,zone,group.length));
    return group.map((row,index) => matchMobilePlayerButton(row,match,index,group.length,zone));
  }).join("");
}

function renderMatchBench(rows,match,side){
  const predictedRows = rows.filter(row => predictionPercent(row) != null);
  const starterIds = new Set(inferredMatchStarters(rows).map(row => String(row.player_id)));

  let bench;
  if(predictedRows.length){
    bench = predictedRows
      .filter(row => !starterIds.has(String(row.player_id)))
      .slice()
      .sort((a,b) => predictionPercent(b)-predictionPercent(a));
  }else{
    const hasLineupMetadata = rows.some(row => {
      const stats = row.stats || {};
      return stats.gameStarted != null || stats.onGameSheet != null;
    });
    bench = hasLineupMetadata
      ? rows.filter(row => {
          const stats = row.stats || {};
          return Boolean(stats.onGameSheet) && Number(stats.gameStarted || 0) === 0;
        })
      : rows.filter(row => !starterIds.has(String(row.player_id)) && Number(row.minutes || 0) > 0);
    bench.sort((a,b) => Number(b.minutes || 0)-Number(a.minutes || 0));
  }

  return bench.map(row => {
    const player = row.player || {};
    const score = Number(row.fantasy_points || 0);
    const startPct = predictionPercent(row);
    const played = Number(row.minutes || 0) > 0;
    const scoreClass = startPct != null
      ? "prediction-chip " + predictionBandClass(startPct)
      : scoreBandClass(score);
    const scoreText = startPct != null
      ? Math.round(startPct) + "%"
      : score.toFixed(score % 1 ? 1 : 0).replace(".",",");
    const meta = startPct != null
      ? '<span class="prediction-bench-label">Kans op basis</span>'
      : (played ? matchSubstitutionLabel(row,match) : '<span class="dnp-label">DNP</span>');

    return '<button class="match-bench-player" type="button" data-match-player="' + escapeHtml(String(row.player_id)) + '">' +
      '<span class="match-bench-avatar">' + initials(player.name || "?") + '</span>' +
      '<span><strong class="match-bench-name-row">' + escapeHtml(player.name || "Onbekend") +
        '<span class="match-name-events bench-name-events">' + (startPct != null ? "" : matchNameBadges(row) + matchCardBadges(row)) + '</span></strong>' +
        '<small class="match-bench-meta">' + meta + '</small></span>' +
      '<span class="match-bench-score ' + scoreClass + '">' + scoreText + '</span>' +
    '</button>';
  }).join("") || '<div class="empty-state">Geen bankdata beschikbaar.</div>';
}

function normalizeClubName(value){
  let normalized = String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const aliases = {
    stvv:"stvv",
    sinttruiden:"stvv",
    sinttruidensevv:"stvv",
    krcgenk:"genk",
    kaagent:"gent",
    gent:"gent",
    skbeveren:"waaslandbeveren",
    waaslandbeveren:"waaslandbeveren",
    clubbruggekv:"clubbrugge",
    standardliege:"standardliege",
    standarddeliege:"standardliege",
    royalcharleroisc:"charleroi",
    royalcharleroisportingclub:"charleroi",
    sportingcharleroi:"charleroi",
    charleroi:"charleroi",
    royantwerpfc:"royalantwerp",
    royalantwerpfc:"royalantwerp",
    royalantwerp:"royalantwerp",
    antwerp:"royalantwerp",
    kvcwesterlo:"westerlo",
    westerlo:"westerlo",
    yrkvmechelen:"mechelen",
    kvmechelen:"mechelen",
    mechelen:"mechelen",
    royalunionsaintgilloise:"unionsaintgilloise",
    royaleunionsaintgilloise:"unionsaintgilloise",
    unionsaintgilloise:"unionsaintgilloise",
    rusg:"unionsaintgilloise"
  };
  return aliases[normalized] || normalized;
}

function sameClubName(a,b){
  const left = normalizeClubName(a);
  const right = normalizeClubName(b);
  if(!left || !right) return false;
  return left === right || (Math.min(left.length,right.length) >= 5 && (left.includes(right) || right.includes(left)));
}

function renderMatchDetail(match,rows=[]){
  const allRows = Array.isArray(rows) ? rows : [];
  const homeRows = allRows.filter(row => sameClubName((row.stats || {}).teamName,match.home) || sameClubName(row.player?.club_name,match.home));
  const awayRows = allRows.filter(row => sameClubName((row.stats || {}).teamName,match.away) || sameClubName(row.player?.club_name,match.away));
  const predictionMode = allRows.some(row => predictionPercent(row) != null);
  const middle = predictionMode
    ? "vs"
    : escapeHtml(String(match.homeScore)) + " – " + escapeHtml(String(match.awayScore));
  const currentMinute = Math.max(0,...allRows.map(row => Number((row.stats || {}).gameMinute || 0)),Number(match.liveMinute || 0));
  const liveMinuteText = match.status === "LIVE" && currentMinute > 0
    ? Math.max(1,Math.round(currentMinute)) + "′"
    : null;
  const detailStatus = predictionMode
    ? ' · <strong class="prediction-detail-label">Opstellingsvoorspelling</strong>'
    : (match.status === "LIVE" ? ' · <strong class="live-text">LIVE</strong>' : "");
  const detailTime = liveMinuteText || (match.date || "");

  document.getElementById("matchDetail").innerHTML =
    '<div class="match-detail-head"><div><p class="eyebrow">' + escapeHtml(match.week || "") + '</p><h2>' + escapeHtml(match.home) + ' <span>' + middle + '</span> ' + escapeHtml(match.away) + '</h2><p>' + escapeHtml(detailTime) + detailStatus + '</p></div></div>' +
    '<div class="match-desktop-layout"><div class="real-match-pitch"><div class="real-pitch-lines"><span class="real-half"></span><span class="real-circle"></span><span class="real-box left"></span><span class="real-box right"></span></div>' +
        '<span class="team-pitch-label home">' + escapeHtml(match.home) + '<small>' + escapeHtml(inferredFormation(homeRows)) + '</small></span><span class="team-pitch-label away">' + escapeHtml(match.away) + '<small>' + escapeHtml(inferredFormation(awayRows)) + '</small></span>' +
        renderMatchTeamPlayers(homeRows,match,"home") + renderMatchTeamPlayers(awayRows,match,"away") +
      '</div><section class="match-bench-section"><h3>Bank</h3><div class="match-benches"><div><h4>' + escapeHtml(match.home) + '</h4>' + renderMatchBench(homeRows,match,"home") + '</div><div><h4>' + escapeHtml(match.away) + '</h4>' + renderMatchBench(awayRows,match,"away") + '</div></div></section></div>' +
    '<div class="match-mobile-layout"><div class="match-team-tabs" role="tablist" aria-label="Kies een ploeg">' +
      '<button class="match-team-tab active" type="button" role="tab" aria-selected="true" data-match-side="home">' + escapeHtml(match.home) + '</button>' +
      '<button class="match-team-tab" type="button" role="tab" aria-selected="false" data-match-side="away">' + escapeHtml(match.away) + '</button></div>' +
      '<section class="match-mobile-team active" data-match-panel="home"><div class="mobile-team-heading"><strong>' + escapeHtml(match.home) + '</strong><span>' + escapeHtml(inferredFormation(homeRows)) + '</span></div><div class="real-match-pitch mobile-team-pitch"><div class="real-pitch-lines mobile-pitch-lines"><span class="mobile-half"></span><span class="mobile-circle"></span><span class="mobile-box top"></span><span class="mobile-box bottom"></span></div>' + renderMatchMobileTeam(homeRows,match) + '</div><div class="mobile-team-bench"><h3>Bank</h3>' + renderMatchBench(homeRows,match,"home") + '</div></section>' +
      '<section class="match-mobile-team" data-match-panel="away" hidden><div class="mobile-team-heading"><strong>' + escapeHtml(match.away) + '</strong><span>' + escapeHtml(inferredFormation(awayRows)) + '</span></div><div class="real-match-pitch mobile-team-pitch"><div class="real-pitch-lines mobile-pitch-lines"><span class="mobile-half"></span><span class="mobile-circle"></span><span class="mobile-box top"></span><span class="mobile-box bottom"></span></div>' + renderMatchMobileTeam(awayRows,match) + '</div><div class="mobile-team-bench"><h3>Bank</h3>' + renderMatchBench(awayRows,match,"away") + '</div></section>' +
    '</div>';

  document.querySelectorAll("#matchDetail .match-team-tab").forEach(tab => tab.addEventListener("click",() => {
    const side = tab.dataset.matchSide;
    document.querySelectorAll("#matchDetail .match-team-tab").forEach(item => {
      const selected = item === tab;
      item.classList.toggle("active",selected);
      item.setAttribute("aria-selected",selected ? "true" : "false");
    });
    document.querySelectorAll("#matchDetail .match-mobile-team").forEach(panel => {
      const selected = panel.dataset.matchPanel === side;
      panel.hidden = !selected;
      panel.classList.toggle("active",selected);
    });
  }));

  const rowByPlayer = new Map(allRows.map(row => [String(row.player_id),row]));
  document.querySelectorAll("#matchDetail [data-match-player]").forEach(button => button.addEventListener("click",() => {
    const row = rowByPlayer.get(String(button.dataset.matchPlayer));
    if(!row) return;
    if(predictionPercent(row) != null){
      toast("Kans op basis: " + Math.round(predictionPercent(row)) + "%");
      return;
    }
    renderMatchPlayerDetail(match,row);
  }));
}

const MATCH_STAT_LABELS = {
  minutes:"Speelminuten",save:"Reddingen",cleanSheet:"Clean sheet",savesInsideBox:"Reddingen in strafschopgebied",
  punches:"Punches",goalsConceded:"Tegendoelpunten",foulsMade:"Overtredingen gemaakt",foulsDrawn:"Overtredingen meegekregen",
  yellow:"Gele kaarten",red:"Rode kaarten",goal:"Goals",assist:"Assists",successfulTackles:"Tackles gewonnen",
  duelWon:"Duels gewonnen",duelLost:"Duels verloren",clearances:"Clearances",interceptions:"Intercepties",
  possessionWon:"Bal gewonnen",possessionLost:"Bal verloren",successfulPass:"Geslaagde passes",
  successfulLongPass:"Geslaagde lange passes",passMissed:"Gemiste passes",successfulDribble:"Geslaagde dribbels",
  shotOnTarget:"Schoten op doel",bigChanceCreated:"Grote kansen gecreëerd",
  successfulFinalThirdPasses:"Geslaagde passes laatste derde",bigChanceMissed:"Grote kansen gemist",
  penaltyWon:"Penalty afgedwongen",totalScoringAtt:"Doelpogingen",
  penAreaEntries:"Penalty area entries",errorLeadToGoal:"Fout leidend tot goal"
};

function renderMatchPlayerDetail(match,row){
  const player = row.player || {};
  const position = player.position || "MID";
  const stats = {...(row.stats || {}),minutes:Number(row.minutes || 0)};
  const weights = SCORING.rows[position] || {};
  const orderedKeys = [...new Set([
    ...SCORING.columns.map(([key]) => key),
    ...Object.keys(weights)
  ])].filter(key => key !== "keyPass" || Number(stats[key] || 0) !== 0);
  const breakdown = orderedKeys.map(key => {
    const rawWeight = weights[key];
    if(rawWeight == null || Number(rawWeight) === 0) return null;
    const amount = Number(stats[key] || 0);
    const weight = Number(rawWeight);
    const contribution = Math.round(amount*weight*100)/100;
    return {key,amount,contribution};
  }).filter(item => item && (item.amount !== 0 || item.key === "minutes"));

  const rowsHtml = renderMatchStatGroups(breakdown,position);
  const calculatedScore = Math.round(
    breakdown.reduce((sum,item) => sum + Number(item.contribution || 0),0) * 100
  ) / 100;
  const totalScoreClass = scoreContributionClass(calculatedScore);

  const dialog = document.getElementById("matchPlayerDialog");
  document.getElementById("matchPlayerDetail").innerHTML =
    '<p class="eyebrow">WEDSTRIJDSTATISTIEKEN</p>' +
    '<div class="match-player-profile-head"><div><span class="role-badge role-' + escapeHtml(position) + '">' + escapeHtml(position) + '</span><h2><button type="button" class="match-player-profile-link" data-profile-player="' + escapeHtml(String(row.player_id || player.id || "")) + '">' + escapeHtml(player.name || "Onbekend") + '</button></h2><p>' + escapeHtml(match.home + " – " + match.away) + '</p></div><strong class="' + totalScoreClass + '">' + points(calculatedScore) + '</strong></div>' +
    '<div class="stat-groups match-stat-groups">' + rowsHtml + '</div>' +
    '<div class="match-stat-total"><span>Totaal deze wedstrijd</span><strong class="' + totalScoreClass + '">' + points(calculatedScore) + '</strong></div>';
  const profileLink = document.querySelector("#matchPlayerDetail [data-profile-player]");
  profileLink?.addEventListener("click",() => {
    const playerId = profileLink.dataset.profilePlayer;
    if(!playerId) return;
    if(dialog.open) dialog.close();
    openPlayerProfile(playerId);
  });
  if(!dialog.open) dialog.showModal();
}

function renderGameweekBalance(balanceRows=[],requestedGameweek=null){
  const rows = (Array.isArray(balanceRows) ? balanceRows : [])
    .filter(row => Number(row.minutes || 0) > 0)
    .sort((a,b) => Number(b.fantasy_points || 0)-Number(a.fantasy_points || 0));
  const source = document.getElementById("balanceSource");
  const summary = document.getElementById("balanceSummary");
  const positions = document.getElementById("positionBalance");
  const notice = document.getElementById("balanceNotice");
  const table = document.getElementById("balanceTable");
  if(!source || !summary || !positions || !notice || !table) return;

  const requestedWeek = Number(requestedGameweek || rows[0]?.gameweek_number || window.FANTASY_SELECTED_MATCHWEEK || 0);
  const fixtureCount = Number.isFinite(requestedWeek) && requestedWeek > 0
    ? MATCHES.filter(match => matchweekNumber(match) === requestedWeek).length
    : 0;
  const title = document.getElementById("balanceTitle");
  if(title && Number.isFinite(requestedWeek) && requestedWeek > 0){
    title.textContent = "Puntenbalans van speeldag " + requestedWeek;
  }

  if(!rows.length){
    source.textContent = Number.isFinite(requestedWeek) && requestedWeek > 0
      ? "Speeldag " + requestedWeek + " · nog geen spelerstats"
      : "Wacht op API-data";
    source.classList.remove("live");
    summary.innerHTML =
      '<article><span>Wedstrijden</span><strong>' + (fixtureCount || "—") + '</strong></article>' +
      '<article><span>Spelers met minuten</span><strong>0</strong></article>' +
      '<article><span>Gemiddelde score</span><strong>—</strong></article>' +
      '<article><span>Hoogste score</span><strong>—</strong></article>';
    positions.innerHTML = "";
    notice.textContent = Number.isFinite(requestedWeek) && requestedWeek > 0
      ? "Voor speeldag " + requestedWeek + " zijn nog geen verwerkte spelerstatistieken beschikbaar."
      : "Kies een speeldag om de puntenbalans te bekijken.";
    notice.classList.remove("warning");
    table.querySelector("thead").innerHTML = "";
    table.querySelector("tbody").innerHTML = '<tr><td>Nog geen verwerkte spelerstatistieken voor deze speeldag.</td></tr>';
    return;
  }

  const average = values => values.length ? values.reduce((sum,value) => sum+value,0)/values.length : 0;
  const scoreValues = rows.map(row => Number(row.fantasy_points || 0));
  const top = rows[0];
  const gameweek = Number(rows[0].gameweek_number || requestedWeek);
  source.textContent = "Sorare · speeldag " + gameweek;
  source.classList.add("live");
  summary.innerHTML =
    '<article><span>Wedstrijden</span><strong>' + (fixtureCount || 9) + '</strong></article>' +
    '<article><span>Spelers met minuten</span><strong>' + rows.length + '</strong></article>' +
    '<article><span>Gemiddelde score</span><strong>' + points(average(scoreValues)) + '</strong></article>' +
    '<article><span>Hoogste score</span><strong>' + points(top.fantasy_points) + '</strong><small>' + escapeHtml(top.player_name) + '</small></article>';

  const positionAverages = {};
  positions.innerHTML = Object.keys(POSITION_LABELS).map(position => {
    const group = rows.filter(row => row.position === position);
    const values = group.map(row => Number(row.fantasy_points || 0));
    const avg = average(values);
    positionAverages[position] = avg;
    const minimum = values.length ? Math.min(...values) : 0;
    const maximum = values.length ? Math.max(...values) : 0;
    return '<article><span class="role-badge role-' + position + '">' + position + '</span><div><strong>' + points(avg) + ' gemiddeld</strong><small>' + group.length + ' spelers · ' + points(minimum) + ' tot ' + points(maximum) + '</small></div></article>';
  }).join("");

  const averages = Object.values(positionAverages);
  const spread = Math.max(...averages)-Math.min(...averages);
  const negative = rows.filter(row => Number(row.fantasy_points || 0) < 0).length;
  notice.textContent = "Positieverschil in gemiddelde: " + points(spread) + " · " + negative + " spelers eindigen onder 0. " +
    (spread > 10 ? "Dit wijst op een mogelijke scheeftrekking die we na meerdere speeldagen moeten bijsturen." : "Voor deze speeldag liggen de positie-gemiddelden redelijk dicht bij elkaar.");
  notice.classList.toggle("warning",spread > 10);

  const statColumns = SCORING.columns.filter(([key]) => key !== "minutes");
  table.querySelector("thead").innerHTML = '<tr><th>Speler</th><th>Pos.</th><th>Club</th><th>Prijs</th><th>Min.</th><th>Score</th>' +
    statColumns.map(([,label]) => '<th>' + escapeHtml(label) + '</th>').join("") + '</tr>';
  table.querySelector("tbody").innerHTML = rows.map(row => {
    const stats = row.stats || {};
    return '<tr><td><button class="balance-player-link" data-player-id="' + escapeHtml(row.player_id) + '">' + escapeHtml(row.player_name) + '</button></td>' +
      '<td><span class="role-badge role-' + escapeHtml(row.position) + '">' + escapeHtml(row.position) + '</span></td>' +
      '<td>' + escapeHtml(row.club_name) + '</td><td>' + money(Number(row.price || 0)) + '</td><td>' + Number(row.minutes || 0) + '</td>' +
      '<td class="' + (Number(row.fantasy_points || 0) < 0 ? "negative" : "positive") + '"><strong>' + points(row.fantasy_points) + '</strong></td>' +
      statColumns.map(([key]) => '<td>' + Number(stats[key] || 0) + '</td>').join("") + '</tr>';
  }).join("");
  table.querySelectorAll(".balance-player-link").forEach(button => button.addEventListener("click",() => openPlayerProfile(button.dataset.playerId)));
}

function scoreLabel(v){
  if(v == null) return "—";
  const str = String(v).replace(".",",");
  return v > 0 ? "+" + str : str;
}

function renderScoring(){
  const table = document.getElementById("scoringTable");
  const head = table.querySelector("thead");
  const body = table.querySelector("tbody");
  head.innerHTML = '<tr><th>Positie</th>' + SCORING.columns.map(c => '<th>' + c[1] + '</th>').join("") + '</tr>';
  body.innerHTML = Object.entries(SCORING.rows).map(([pos,row]) =>
    '<tr><td>' + POSITION_LABELS[pos] + '</td>' + SCORING.columns.map(([key]) => {
      const v = row[key];
      const cls = v > 0 ? "positive" : v < 0 ? "negative" : "";
      return '<td class="' + cls + '">' + scoreLabel(v) + '</td>';
    }).join("") + '</tr>'
  ).join("");
}

function renderTeamName(){
  const input = document.getElementById("settingsTeamName");
  if(input) input.value = state.teamName;
}

function renderAll(){
  renderHeader();
  renderRequirements();
  renderTeam();
  renderMarket();
  renderTeamName();
  if(typeof updateInitialSetupTabs === "function") updateInitialSetupTabs();
}

function resolveAutomaticSubstitution(starters,bench,didPlay){
  const resolved = starters.slice();
  const keeperBench = bench.find(p => p.pos === "GK");
  const outfieldBench = bench.find(p => p.pos !== "GK");

  const gkIndex = resolved.findIndex(p => p.pos === "GK" && !didPlay[p.id]);
  if(gkIndex >= 0 && keeperBench && didPlay[keeperBench.id]) resolved[gkIndex] = keeperBench;

  const outIndex = resolved.findIndex(p => p.pos !== "GK" && !didPlay[p.id]);
  if(outIndex >= 0 && outfieldBench && didPlay[outfieldBench.id]) resolved[outIndex] = outfieldBench;

  return resolved;
}

function calculatePlayerScore(position,stats){
  return canonicalFantasyScore(position,stats,stats?.minutes);
}

loadState();
renderClubFilter();
renderMatches();
renderGameweekBalance();
renderScoring();
renderAll();

window.FANTASY_INITIAL_SETUP_LOCK = false;

function updateInitialSetupTabs(){
  const locked = Boolean(window.FANTASY_INITIAL_SETUP_LOCK) && !isSquadComplete();
  document.querySelectorAll(".tab").forEach(button => {
    const blocked = locked && button.dataset.tab !== "team";
    button.classList.toggle("setup-locked",blocked);
    button.setAttribute("aria-disabled",blocked ? "true" : "false");
  });
}

function activateFantasyTab(tabId,force=false){
  const requestedId = tabId === "market" ? "team" : tabId;
  const locked = Boolean(window.FANTASY_INITIAL_SETUP_LOCK) && !isSquadComplete();
  const targetId = (!force && locked && requestedId !== "team") ? "team" : requestedId;
  if(tabId === "market" || (locked && targetId === "team")) setMarketOpen(true);
  if(!force && locked && requestedId !== "team") toast("Kies eerst je 8 spelers.");
  document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active",button.dataset.tab === targetId));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active",panel.id === targetId));
  if(targetId === "matches"){
    matchweekManuallySelected = false;
    renderMatches();
  }
  updateInitialSetupTabs();
}

function setMarketOpen(open){
  const workspace = document.getElementById("teamWorkspace");
  const drawer = document.getElementById("marketDrawer");
  const toggle = document.getElementById("marketToggle");
  if(!workspace || !drawer || !toggle) return;
  workspace.classList.toggle("market-collapsed",!open);
  drawer.hidden = !open;
  toggle.setAttribute("aria-expanded",open ? "true" : "false");
  toggle.textContent = open ? "Transfermarkt sluiten" : "Transfermarkt openen";
}

window.activateFantasyTab = activateFantasyTab;

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => activateFantasyTab(btn.dataset.tab)));

["playerSearch","positionFilter","clubFilter","sortFilter"].forEach(id => {
  document.getElementById(id).addEventListener(id === "playerSearch" ? "input" : "change", renderMarket);
});

document.getElementById("priceMinFilter")?.addEventListener("input",() => updatePriceFilter("min"));
document.getElementById("priceMaxFilter")?.addEventListener("input",() => updatePriceFilter("max"));

document.getElementById("marketToggle")?.addEventListener("click",() => {
  const expanded = document.getElementById("marketToggle").getAttribute("aria-expanded") === "true";
  setMarketOpen(!expanded);
});
document.getElementById("marketClose")?.addEventListener("click",() => setMarketOpen(false));
document.getElementById("autoLineupBtn").addEventListener("click",autoLineup);
document.getElementById("resetBtn").addEventListener("click",resetSquad);
document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click",() => {
  document.getElementById(button.dataset.closeDialog).close();
}));
document.querySelectorAll("dialog.detail-dialog").forEach(dialog => dialog.addEventListener("click",event => {
  if(event.target === dialog) dialog.close();
}));
document.querySelector("[data-demo-history]")?.addEventListener("click",() => {
  document.getElementById("managerHistory").innerHTML = '<p class="eyebrow">TEAMHISTORIEK</p><h2>' + escapeHtml(state.teamName) + '</h2><div class="empty-state">Log in en speel een speeldag om hier je vastgezette teams en scores te zien.</div>';
  document.getElementById("managerDialog").showModal();
});

