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
  return '<div class="lineup-player ' + (isBench ? "benched":"") + '">' +
    '<div class="player-avatar">' + initials(p.name) + '</div>' +
    '<div class="info"><strong>' + p.name + '</strong><small>' + p.club + ' · ' + (isBench ? benchLabel : POSITION_LABELS[p.pos]) + '</small></div>' +
    '<span class="role-badge role-' + p.pos + '">' + p.pos + '</span>' +
    '<div class="lineup-actions"><button class="icon-btn bench-toggle" data-id="' + p.id + '">' + buttonText + '</button></div>' +
  '</div>';
}

function renderTeam(){
  const starting = document.getElementById("startingXI");
  const bench = document.getElementById("bench");
  const auto = document.getElementById("autoLineupBtn");
  auto.disabled = !isSquadComplete();

  if(!state.squad.length){
    starting.className = "pitch-list empty-state";
    starting.textContent = "Koop spelers op de transfermarkt om je team te bouwen.";
    bench.className = "bench-list empty-state";
    bench.textContent = "Je bank wordt zichtbaar zodra je spelers hebt gekocht.";
    return;
  }

  if(!isSquadComplete()){
    starting.className = "pitch-list";
    starting.innerHTML = squadPlayers().map(p => lineupPlayerHtml(p,false)).join("");
    bench.className = "bench-list empty-state";
    bench.textContent = "Voltooi eerst de 2-2-2-2 selectie. Daarna kies je je bank.";
  }else{
    starting.className = "pitch-list";
    const starters = lineupPlayers();
    starting.innerHTML = starters.length ? starters.map(p => lineupPlayerHtml(p,false)).join("") : '<div class="empty-state">Kies je bankspelers.</div>';
    bench.className = "bench-list";
    const bp = benchPlayers();
    bench.innerHTML = bp.length ? bp.map(p => lineupPlayerHtml(p,true)).join("") : '<div class="empty-state">Kies één keeper en één veldspeler voor de bank.</div>';
  }

  document.querySelectorAll(".bench-toggle").forEach(btn => btn.addEventListener("click", () => setBench(btn.dataset.id)));
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
    return '<article class="player-card ' + (owned ? "owned":"") + '">' +
      '<div class="player-card-head"><span class="role-badge role-' + p.pos + '">' + p.pos + '</span><span class="price">' + money(p.price) + '</span></div>' +
      '<h3>' + p.name + '</h3><div class="club">' + p.club + '</div>' +
      '<div class="player-meta"><div><span>Minuten 26/27</span><strong>' + (p.minutes == null ? "Actief" : p.minutes) + '</strong></div><div><span>Fantasy score</span><strong>0</strong></div></div>' +
      '<button class="buy-btn ' + (owned ? "remove":"") + '" data-action="' + (owned ? "sell":"buy") + '" data-id="' + p.id + '" ' + (disabled ? "disabled":"") + '>' +
        (owned ? "Verkopen" : (disabled ? "Niet beschikbaar" : "Kopen")) +
      '</button>' +
    '</article>';
  }).join("");

  grid.querySelectorAll(".buy-btn").forEach(btn => btn.addEventListener("click", () => {
    btn.dataset.action === "sell" ? sellPlayer(btn.dataset.id) : buyPlayer(btn.dataset.id);
  }));
}

function renderMatches(){
  document.getElementById("matchesList").innerHTML = MATCHES.map(m =>
    '<div class="match-row"><span class="date">' + m.date + '</span><strong class="home">' + m.home + '</strong><span class="match-score">' + m.homeScore + "–" + m.awayScore + '</span><strong>' + m.away + '</strong><span class="matchweek">' + m.week + '</span></div>'
  ).join("");
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
