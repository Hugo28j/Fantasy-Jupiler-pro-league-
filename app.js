const STORAGE_KEY = "fantasy-jpl-2026-v1";
const START_BUDGET = 100;
const REQUIRED_BY_POS = {GK:2,DEF:2,MID:2,FWD:2};

const state = {
  squad: [],
  benchGK: null,
  benchOutfield: null,
  teamName: "Mijn Fantasy Team"
};

function loadState(){
  try{
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if(Array.isArray(saved.squad)) state.squad = saved.squad.filter(id => PLAYERS.some(p => p.id === id));
    if(saved.benchGK && state.squad.includes(saved.benchGK)) state.benchGK = saved.benchGK;
    if(saved.benchOutfield && state.squad.includes(saved.benchOutfield)) state.benchOutfield = saved.benchOutfield;
    if(typeof saved.teamName === "string" && saved.teamName.trim()) state.teamName = saved.teamName.slice(0,28);
  }catch(e){ console.warn("Could not load saved fantasy team",e); }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function playerById(id){ return PLAYERS.find(p => p.id === id); }
function squadPlayers(){ return state.squad.map(playerById).filter(Boolean); }
function countPos(pos){ return squadPlayers().filter(p => p.pos === pos).length; }
function spent(){ return squadPlayers().reduce((sum,p) => sum + p.price,0); }
function budgetLeft(){ return Math.max(0, START_BUDGET - spent()); }
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
  state.squad.push(id);
  saveState();
  renderAll();
  toast(p.name + " gekocht voor " + money(p.price));
}

function sellPlayer(id){
  const p = playerById(id);
  state.squad = state.squad.filter(x => x !== id);
  if(state.benchGK === id) state.benchGK = null;
  if(state.benchOutfield === id) state.benchOutfield = null;
  saveState();
  renderAll();
  if(p) toast(p.name + " verkocht.");
}

function setBench(id){
  const p = playerById(id);
  if(!p || !state.squad.includes(id)) return;
  if(!isSquadComplete()){
    toast("Maak eerst je volledige selectie van 8 spelers.");
    return;
  }
  if(p.pos === "GK"){
    state.benchGK = state.benchGK === id ? null : id;
  }else{
    state.benchOutfield = state.benchOutfield === id ? null : id;
  }
  saveState();
  renderAll();
}

function autoLineup(){
  if(!isSquadComplete()){ toast("Je hebt eerst exact 8 geldige spelers nodig."); return; }
  const keepers = squadPlayers().filter(p => p.pos === "GK").sort((a,b) => a.price - b.price);
  const outfield = squadPlayers().filter(p => p.pos !== "GK").sort((a,b) => a.price - b.price);
  state.benchGK = keepers[0].id;
  state.benchOutfield = outfield[0].id;
  saveState();
  renderAll();
  toast("Automatische opstelling gemaakt.");
}

function resetSquad(){
  if(!confirm("Wil je je volledige selectie wissen?")) return;
  state.squad = [];
  state.benchGK = null;
  state.benchOutfield = null;
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

function lineupPlayerHtml(p,isBench){
  const benchLabel = p.pos === "GK" ? "Reservekeeper" : "Reserve veldspeler";
  const buttonText = isBench ? "Naar basis" : "Op bank";
  const score = Number(p.score || 0);
  const scoreClass = score >= 60 ? "hot" : score >= 30 ? "warm" : "cool";
  return '<article class="sorare-player ' + (isBench ? "is-bench":"") + '">' +
    '<button class="sorare-player-main player-name-link" data-player-id="' + escapeHtml(p.id) + '" type="button">' +
      '<span class="sorare-avatar role-ring-' + p.pos + '">' + initials(p.name) + '</span>' +
      '<span class="sorare-score ' + scoreClass + '">' + score.toFixed(0) + '</span>' +
      '<span class="sorare-player-name">' + escapeHtml(p.name) + '</span>' +
      '<span class="sorare-player-meta">' + escapeHtml(p.club) + ' · ' + (isBench ? benchLabel : POSITION_LABELS[p.pos]) + '</span>' +
    '</button>' +
    '<div class="sorare-player-footer">' +
      '<span class="role-badge role-' + p.pos + '">' + p.pos + '</span>' +
      '<span class="sorare-price">' + money(p.price) + '</span>' +
      '<button class="bench-toggle mini-action" data-id="' + escapeHtml(p.id) + '" type="button">' + buttonText + '</button>' +
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
    starting.className = "fantasy-pitch";
    starting.innerHTML = renderPitch(squadPlayers());
    bench.className = "sorare-bench empty-state";
    bench.textContent = "Voltooi eerst de 2-2-2-2 selectie. Daarna kies je 1 reservekeeper en 1 veldreserve.";
    if(lineupTitle) lineupTitle.textContent = "Selectie · " + state.squad.length + " / 8";
    if(lineupPill) lineupPill.textContent = "Nog bezig met bouwen";
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
  document.querySelectorAll("#team .player-name-link").forEach(btn => btn.addEventListener("click", () => openPlayerProfile(btn.dataset.playerId)));
}

function renderClubFilter(){
  const select = document.getElementById("clubFilter");
  const current = select.value || "ALL";
  select.innerHTML = '<option value="ALL">Alle clubs</option>' + CLUBS.map(c => '<option value="' + c.replace(/"/g,"&quot;") + '">' + c + '</option>').join("");
  select.value = CLUBS.includes(current) ? current : "ALL";
}

function filteredPlayers(){
  const q = document.getElementById("playerSearch").value.trim().toLowerCase();
  const pos = document.getElementById("positionFilter").value;
  const club = document.getElementById("clubFilter").value;
  const sort = document.getElementById("sortFilter").value;
  const list = PLAYERS.filter(p =>
    (!q || p.name.toLowerCase().includes(q) || p.club.toLowerCase().includes(q)) &&
    (pos === "ALL" || p.pos === pos) &&
    (club === "ALL" || p.club === club)
  );
  list.sort((a,b) => {
    if(sort === "price-asc") return a.price - b.price;
    if(sort === "minutes-desc") return (b.minutes ?? -1) - (a.minutes ?? -1);
    if(sort === "points-desc") return Number(b.score || 0) - Number(a.score || 0);
    if(sort === "points-asc") return Number(a.score || 0) - Number(b.score || 0);
    if(sort === "name") return a.name.localeCompare(b.name,"nl");
    return b.price - a.price;
  });
  return list;
}

function renderMarket(){
  const grid = document.getElementById("playerGrid");
  const list = filteredPlayers();
  document.getElementById("marketCount").textContent = list.length + " spelers zichtbaar · " + PLAYERS.length + " in huidige 2026/27 seed";
  const missing = Object.entries(REQUIRED_BY_POS).filter(([pos,n]) => countPos(pos) < n).map(([pos,n]) => (n-countPos(pos)) + "× " + pos);
  document.getElementById("selectionWarning").textContent = missing.length ? "Nog nodig: " + missing.join(", ") : (isLineupComplete() ? "Team klaar ✓" : "Selectie compleet — kies je bank");

  grid.innerHTML = list.map(p => {
    const owned = state.squad.includes(p.id);
    const check = canBuy(p);
    const disabled = !owned && !check.ok;
    return '<article class="player-card ' + (owned ? "owned":"") + '" data-player-id="' + escapeHtml(p.id) + '">' +
      '<div class="player-card-head"><span class="role-badge role-' + p.pos + '">' + p.pos + '</span><span class="price">' + money(p.price) + '</span></div>' +
      '<h3><button class="player-title-link" data-player-id="' + escapeHtml(p.id) + '">' + escapeHtml(p.name) + '</button></h3><div class="club">' + escapeHtml(p.club) + '</div>' +
      '<div class="player-meta"><div><span>Minuten 26/27</span><strong>' + (p.minutes == null ? "Actief" : p.minutes) + '</strong></div><div><span>Fantasy score</span><strong>' + points(p.score).replace(" pts","") + '</strong></div></div>' +
      '<div class="player-actions"><button class="details-btn" data-player-id="' + escapeHtml(p.id) + '">Statistieken</button>' +
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

  const groups = [
    make("Algemeen",STAT_GROUP_KEYS.general),
    make("Defending",STAT_GROUP_KEYS.defending),
    make("Possession",STAT_GROUP_KEYS.possession),
    make("Aanval",STAT_GROUP_KEYS.attack)
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
  return statGroupDefinitions(position,metrics.map(metric => metric.key)).map((group,index) => {
    const cards = group.keys.map(key => byKey.get(key)).filter(Boolean).map(metric =>
      '<div class="profile-stat-card"><span>' + escapeHtml(metric.label) + '</span><strong>' +
      metric.value + ' <small class="stat-contribution ' + scoreContributionClass(metric.contribution) + '">(' +
      scoreLabel(metric.contribution) + ' pts)</small></strong></div>'
    ).join("");
    return '<details class="stat-group" open><summary><span>' + escapeHtml(group.label) +
      '</span><small>' + group.keys.length + ' stats</small></summary><div class="profile-stats stat-group-grid">' +
      cards + '</div></details>';
  }).join("");
}

function renderMatchStatGroups(breakdown,position){
  const byKey = new Map(breakdown.map(item => [item.key,item]));
  return statGroupDefinitions(position,breakdown.map(item => item.key)).map(group => {
    const rows = group.keys.map(key => byKey.get(key)).filter(Boolean).map(item =>
      '<div class="match-stat-line"><span>' + escapeHtml(MATCH_STAT_LABELS[item.key] || item.key) +
      ' <small>(' + item.amount + ')</small></span><strong class="' +
      scoreContributionClass(item.contribution) + '">' + scoreLabel(item.contribution) + ' pts</strong></div>'
    ).join("");
    return '<details class="stat-group match-stat-group" open><summary><span>' + escapeHtml(group.label) +
      '</span><small>' + group.keys.length + ' stats</small></summary><div class="match-stat-breakdown">' +
      rows + '</div></details>';
  }).join("");
}

function renderPlayerProfile(player,matchRows=[]){
  const rows = Array.isArray(matchRows) ? matchRows : [];
  const total = key => rows.reduce((sum,row) => sum + Number((row.stats || {})[key] || 0),0);
  const totalMinutes = rows.length ? rows.reduce((sum,row) => sum + Number(row.minutes || 0),0) : Number(player.minutes || 0);
  const totalPoints = rows.length ? rows.reduce((sum,row) => sum + Number(row.fantasy_points || 0),0) : Number(player.score || 0);
  const metrics = [
    ["Goals","goal"],["Assists","assist"],["Schoten op doel","shotOnTarget"],["Doelpogingen","totalScoringAtt"],
    ["Grote kansen gecreëerd","bigChanceCreated"],["Grote kansen gemist","bigChanceMissed"],
    ["Penalty area entries","penAreaEntries"],["Penalty afgedwongen","penaltyWon"],
    ["Fout leidend tot goal","errorLeadToGoal"],["Geslaagde passes laatste derde","successfulFinalThirdPasses"],
    ["Geslaagde dribbels","successfulDribble"],
    ["Tackles gewonnen","successfulTackles"],["Duels gewonnen","duelWon"],["Duels verloren","duelLost"],
    ["Clearances","clearances"],["Intercepties","interceptions"],["Bal gewonnen","possessionWon"],["Bal verloren","possessionLost"],
    ["Geslaagde passes","successfulPass"],["Geslaagde lange passes","successfulLongPass"],["Gemiste passes","passMissed"],
    ["Overtredingen gemaakt","foulsMade"],["Overtredingen meegekregen","foulsDrawn"],["Gele kaarten","yellow"],["Rode kaarten","red"],
    ["Reddingen","save"],["Reddingen in strafschopgebied","savesInsideBox"],["Punches","punches"],
    ["Clean sheets","cleanSheet"],["Tegendoelpunten","goalsConceded"]
  ].map(([label,key]) => {
    const value = total(key);
    const weight = SCORING.rows[player.pos]?.[key];
    const contribution = weight == null ? 0 : Math.round(value * Number(weight) * 100) / 100;
    return {label,key,value,contribution,weight};
  }).filter(metric => metric.weight != null && Number(metric.weight) !== 0);
  const matches = rows.slice().sort((a,b) => {
    const ad = a.fixtures?.kickoff || "";
    const bd = b.fixtures?.kickoff || "";
    return bd.localeCompare(ad);
  }).map(row => {
    const fixture = row.fixtures || {};
    const gameweek = fixture.gameweeks?.number || "?";
    const date = fixture.kickoff ? new Intl.DateTimeFormat("nl-BE",{day:"numeric",month:"short"}).format(new Date(fixture.kickoff)) : "";
    return '<div class="profile-match"><div><strong>Speeldag ' + gameweek + '</strong><small>' + escapeHtml(date + " · " + (fixture.home_team || "") + " – " + (fixture.away_team || "")) + '</small></div><span>' + Number(row.minutes || 0) + ' min</span><strong>' + points(row.fantasy_points) + '</strong></div>';
  }).join("");
  document.getElementById("playerProfile").innerHTML =
    '<p class="eyebrow">SPELERSFICHE</p><div class="profile-hero"><div><span class="role-badge role-' + player.pos + '">' + player.pos + '</span><h2>' + escapeHtml(player.name) + '</h2><p>' + escapeHtml(player.club) + ' · ' + escapeHtml(POSITION_LABELS[player.pos]) + '</p></div><strong class="profile-price">' + money(Number(player.price)) + '</strong></div>' +
    '<div class="profile-highlights"><article><span>Totale score</span><strong>' + points(totalPoints) + '</strong></article><article><span>Speelminuten</span><strong>' + totalMinutes + '</strong></article><article><span>Wedstrijden</span><strong>' + rows.length + '</strong></article></div>' +
    '<h3>Seizoenstatistieken</h3><div class="stat-groups">' + renderSeasonStatGroups(metrics,player.pos) + '</div>' +
    '<div class="profile-section-head"><h3>Score per wedstrijd</h3><small>Inclusief +0,1 punt per minuut</small></div><div class="profile-matches">' + (matches || '<div class="empty-state">Nog geen verwerkte wedstrijdstatistieken.</div>') + '</div>';
}

function openPlayerProfile(id){
  const player = playerById(id);
  if(!player) return;
  renderPlayerProfile(player,[]);
  const dialog = document.getElementById("playerDialog");
  if(!dialog.open) dialog.showModal();
  window.dispatchEvent(new CustomEvent("fantasy:player-profile",{detail:{playerId:id}}));
}

function renderMatches(){
  const target = document.getElementById("matchesList");
  target.innerHTML = MATCHES.map(m => {
    const clickable = Boolean(m.id) && ["FT","LIVE"].includes(String(m.status || ""));
    const tag = m.status === "LIVE" ? '<span class="match-live-badge">LIVE</span>' : "";
    const content = '<span class="date">' + escapeHtml(m.date || "") + '</span>' +
      '<strong class="home">' + escapeHtml(m.home || "") + '</strong>' +
      '<span class="match-score">' + escapeHtml(String(m.homeScore)) + "–" + escapeHtml(String(m.awayScore)) + tag + '</span>' +
      '<strong>' + escapeHtml(m.away || "") + '</strong><span class="matchweek">' + escapeHtml(m.week || "") + '</span>';
    return clickable
      ? '<button class="match-row match-row-button" type="button" data-fixture-id="' + escapeHtml(String(m.id)) + '">' + content + '</button>'
      : '<div class="match-row">' + content + '</div>';
  }).join("");

  target.querySelectorAll(".match-row-button").forEach(button => button.addEventListener("click",() => {
    const id = button.dataset.fixtureId;
    const match = MATCHES.find(m => String(m.id) === String(id));
    const dialog = document.getElementById("matchDialog");
    document.getElementById("matchDetail").innerHTML = '<div class="empty-state match-loading">Wedstrijdopstelling laden…</div>';
    if(!dialog.open) dialog.showModal();
    window.dispatchEvent(new CustomEvent("fantasy:match-detail",{detail:{fixtureId:id,match}}));
  }));
}

function matchEventBadges(row){
  const stats = row.stats || {};
  const badges = [];
  const add = (type,icon,label,count) => {
    const n = Number(count || 0);
    if(n <= 0) return;
    badges.push('<span class="match-event-icon event-' + type + '" title="' + escapeHtml(label + (n > 1 ? " ×" + n : "")) + '">' +
      icon + (n > 1 ? '<b>' + n + '</b>' : '') + '</span>');
  };
  add("goal","⚽","Goal",stats.goal);
  add("assist","A","Assist",stats.assist);
  add("yellow","","Gele kaart",stats.yellow);
  add("red","","Rode kaart",stats.red);
  add("error","!","Fout leidend tot goal",stats.errorLeadToGoal);
  return badges.join("");
}

function matchSubstitutionLabel(row,match){
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

function matchPlayerButton(row,match,side,index,total){
  const player = row.player || {};
  const stats = row.stats || {};
  const pos = player.position || "MID";
  const score = Number(row.fantasy_points || 0);
  const scoreClass = score < 0 ? "score-negative" : score < 15 ? "score-orange" : score < 30 ? "score-yellow" : score < 50 ? "score-green" : "score-blue";

  // Sorare formationPlace gebruikt klassieke veldslots:
  // 1 GK, 2 RB, 3 LB, 5/6 CB, 7 RW, 9 ST, 11 LW, met 4/8/10 op het middenveld.
  const formationPlace = Number(stats.formationPlace || 0);
  const slotMap = {
    1:{zone:"GK",y:50},
    2:{zone:"DEF",y:80},
    3:{zone:"DEF",y:20},
    4:{zone:"MID",y:25},
    5:{zone:"DEF",y:40},
    6:{zone:"DEF",y:60},
    7:{zone:"FWD",y:80},
    8:{zone:"MID",y:75},
    9:{zone:"FWD",y:50},
    10:{zone:"MID",y:50},
    11:{zone:"FWD",y:20}
  };
  const slot = slotMap[formationPlace];
  const zone = slot?.zone || pos;
  const xByPosition = side === "home"
    ? {GK:7,DEF:20,MID:33,FWD:45}
    : {GK:93,DEF:80,MID:67,FWD:55};
  const x = xByPosition[zone] || (side === "home" ? 33 : 67);
  const y = slot?.y ?? Math.round(((index+1)/(total+1))*88+6);
  return '<button class="match-pitch-player" type="button" data-match-player="' + escapeHtml(String(row.player_id)) + '" style="--mx:' + x + '%;--my:' + y + '%">' +
    '<span class="match-player-topline"><span class="match-event-strip">' + matchEventBadges(row) + '</span><span class="match-sub-strip">' + matchSubstitutionLabel(row,match) + '</span></span>' +
    '<span class="match-avatar role-ring-' + escapeHtml(pos) + '">' + initials(player.name || "?") + '</span>' +
    '<span class="match-score-chip ' + scoreClass + '">' + score.toFixed(score % 1 ? 1 : 0).replace(".",",") + '</span>' +
    '<span class="match-player-name">' + escapeHtml(player.name || "Onbekend") + '</span>' +
  '</button>';
}

function inferredMatchStarters(rows){
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
    const pos = row.player?.position || "MID";
    (groups[pos] || groups.MID).push(row);
  });
  Object.values(groups).forEach(group => group.sort((a,b) =>
    Number((a.stats || {}).formationPlace ?? 99)-Number((b.stats || {}).formationPlace ?? 99)
  ));
  return Object.entries(groups).flatMap(([,group]) =>
    group.map((row,index) => matchPlayerButton(row,match,side,index,group.length))
  ).join("");
}

function renderMatchBench(rows,match,side){
  const hasLineupMetadata = rows.some(row => {
    const stats = row.stats || {};
    return stats.gameStarted != null || stats.onGameSheet != null;
  });
  const starterIds = new Set(inferredMatchStarters(rows).map(row => String(row.player_id)));
  const bench = hasLineupMetadata
    ? rows.filter(row => {
        const stats = row.stats || {};
        return Boolean(stats.onGameSheet) && Number(stats.gameStarted || 0) === 0;
      })
    : rows.filter(row => !starterIds.has(String(row.player_id)) && Number(row.minutes || 0) > 0);
  bench.sort((a,b) => Number(b.minutes || 0)-Number(a.minutes || 0));
  return bench.map(row => {
    const player = row.player || {};
    const score = Number(row.fantasy_points || 0);
    const played = Number(row.minutes || 0) > 0;
    const scoreClass = score < 0 ? "score-negative" : score < 15 ? "score-orange" : score < 30 ? "score-yellow" : score < 50 ? "score-green" : "score-blue";
    return '<button class="match-bench-player" type="button" data-match-player="' + escapeHtml(String(row.player_id)) + '">' +
      '<span class="match-bench-avatar">' + initials(player.name || "?") + '</span>' +
      '<span><strong>' + escapeHtml(player.name || "Onbekend") + '</strong><small class="match-bench-meta"><span class="match-event-strip bench-events">' +
        matchEventBadges(row) + '</span>' + (played ? matchSubstitutionLabel(row,match) : '<span class="dnp-label">DNP</span>') +
      '</small></span>' +
      '<span class="match-bench-score ' + scoreClass + '">' + score.toFixed(score % 1 ? 1 : 0).replace(".",",") + '</span>' +
    '</button>';
  }).join("") || '<div class="empty-state">Geen bankdata beschikbaar.</div>';
}

function normalizeClubName(value){
  let normalized = String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]/g,"");
  const aliases = {
    stvv:"sinttruidensevv",
    sinttruiden:"sinttruidensevv",
    krcgenk:"genk",
    clubbruggekv:"clubbrugge",
    royantwerpfc:"royalantwerpfc",
    unionsaintgilloise:"royaleunionsaintgilloise",
    rusg:"royaleunionsaintgilloise"
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

  document.getElementById("matchDetail").innerHTML =
    '<div class="match-detail-head"><div><p class="eyebrow">' + escapeHtml(match.week || "") + '</p><h2>' + escapeHtml(match.home) + ' <span>' + escapeHtml(String(match.homeScore)) + " – " + escapeHtml(String(match.awayScore)) + '</span> ' + escapeHtml(match.away) + '</h2><p>' + escapeHtml(match.date || "") + (match.status === "LIVE" ? ' · <strong class="live-text">LIVE</strong>' : "") + '</p></div></div>' +
    '<div class="real-match-pitch"><div class="real-pitch-lines"><span class="real-half"></span><span class="real-circle"></span><span class="real-box left"></span><span class="real-box right"></span></div>' +
      '<span class="team-pitch-label home">' + escapeHtml(match.home) + '</span><span class="team-pitch-label away">' + escapeHtml(match.away) + '</span>' +
      renderMatchTeamPlayers(homeRows,match,"home") + renderMatchTeamPlayers(awayRows,match,"away") +
      ((!homeRows.length || !awayRows.length) ? '<div class="match-data-hint">Opstellingsmetadata wordt nog aangevuld door de Sorare-sync.</div>' : '') +
    '</div>' +
    '<section class="match-bench-section"><h3>Bank</h3><div class="match-benches"><div><h4>' + escapeHtml(match.home) + '</h4>' + renderMatchBench(homeRows,match,"home") + '</div><div><h4>' + escapeHtml(match.away) + '</h4>' + renderMatchBench(awayRows,match,"away") + '</div></div></section>';

  const rowByPlayer = new Map(allRows.map(row => [String(row.player_id),row]));
  document.querySelectorAll("#matchDetail [data-match-player]").forEach(button => button.addEventListener("click",() => {
    const row = rowByPlayer.get(String(button.dataset.matchPlayer));
    if(row) renderMatchPlayerDetail(match,row);
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
  const orderedKeys = SCORING.columns.map(([key]) => key).filter(key => key !== "keyPass");
  const breakdown = orderedKeys.map(key => {
    const rawWeight = weights[key];
    if(rawWeight == null || Number(rawWeight) === 0) return null;
    const amount = Number(stats[key] || 0);
    const weight = Number(rawWeight);
    const contribution = Math.round(amount*weight*100)/100;
    return {key,amount,contribution};
  }).filter(item => item && (item.amount !== 0 || item.key === "minutes"));

  const rowsHtml = renderMatchStatGroups(breakdown,position);
  const totalScoreClass = scoreContributionClass(row.fantasy_points);

  const dialog = document.getElementById("matchPlayerDialog");
  document.getElementById("matchPlayerDetail").innerHTML =
    '<p class="eyebrow">WEDSTRIJDSTATISTIEKEN</p>' +
    '<div class="match-player-profile-head"><div><span class="role-badge role-' + escapeHtml(position) + '">' + escapeHtml(position) + '</span><h2>' + escapeHtml(player.name || "Onbekend") + '</h2><p>' + escapeHtml(match.home + " – " + match.away) + '</p></div><strong class="' + totalScoreClass + '">' + points(row.fantasy_points) + '</strong></div>' +
    '<div class="stat-groups match-stat-groups">' + rowsHtml + '</div>' +
    '<div class="match-stat-total"><span>Totaal deze wedstrijd</span><strong class="' + totalScoreClass + '">' + points(row.fantasy_points) + '</strong></div>';
  if(!dialog.open) dialog.showModal();
}

function renderGameweekBalance(balanceRows=[]){
  const rows = (Array.isArray(balanceRows) ? balanceRows : [])
    .filter(row => Number(row.minutes || 0) > 0)
    .sort((a,b) => Number(b.fantasy_points || 0)-Number(a.fantasy_points || 0));
  const source = document.getElementById("balanceSource");
  const summary = document.getElementById("balanceSummary");
  const positions = document.getElementById("positionBalance");
  const notice = document.getElementById("balanceNotice");
  const table = document.getElementById("balanceTable");
  if(!source || !summary || !positions || !notice || !table) return;

  if(!rows.length){
    source.textContent = "Wacht op API-data";
    source.classList.remove("live");
    positions.innerHTML = "";
    return;
  }

  const average = values => values.length ? values.reduce((sum,value) => sum+value,0)/values.length : 0;
  const scoreValues = rows.map(row => Number(row.fantasy_points || 0));
  const top = rows[0];
  const gameweek = rows[0].gameweek_number;
  source.textContent = "Sorare · speeldag " + gameweek;
  source.classList.add("live");
  summary.innerHTML =
    '<article><span>Wedstrijden</span><strong>9</strong></article>' +
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
  const input = document.getElementById("teamName");
  input.value = state.teamName;
  document.getElementById("leaderTeamName").textContent = state.teamName;
}

function renderAll(){
  renderHeader();
  renderRequirements();
  renderTeam();
  renderMarket();
  renderTeamName();
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
  const weights = SCORING.rows[position];
  if(!weights) return 0;
  return SCORING.columns.reduce((total,[key]) => {
    const weight = weights[key];
    if(weight == null) return total;
    return total + (Number(stats[key]) || 0) * weight;
  },0);
}

loadState();
renderClubFilter();
renderMatches();
renderGameweekBalance();
renderScoring();
renderAll();

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === btn.dataset.tab));
}));

["playerSearch","positionFilter","clubFilter","sortFilter"].forEach(id => {
  document.getElementById(id).addEventListener(id === "playerSearch" ? "input" : "change", renderMarket);
});

document.getElementById("teamName").addEventListener("input", e => {
  state.teamName = e.target.value.slice(0,28) || "Mijn Fantasy Team";
  document.getElementById("leaderTeamName").textContent = state.teamName;
  saveState();
});
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
