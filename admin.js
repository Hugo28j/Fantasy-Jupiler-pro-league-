(function(){
  const FORMATIONS = ["3-4-3","3-5-2","4-3-3","4-4-2","4-5-1","5-3-2","5-4-1"];
  let selectedAdminMatchweek = null;

  const naturalInferredFormation = inferredFormation;
  const naturalInferredMatchStarters = inferredMatchStarters;
  const naturalOpenFixtureDetail = openFixtureDetail;
  const naturalRenderMatchDetail = renderMatchDetail;

  function getOverride(match,side){
    if(!match || !side) return null;
    return window.FANTASY_MATCH_LAYOUT_OVERRIDES?.[String(match.id)]?.[side] || null;
  }

  function sideFromRows(rows,match){
    if(!match) return "home";
    const sample = (rows || []).find(Boolean);
    if(!sample) return "home";
    const teamName = (sample.stats || {}).teamName || sample.player?.club_name || "";
    return sameClubName(teamName,match.away) ? "away" : "home";
  }

  function confirmedStarterRows(rows){
    const confirmed = (rows || []).filter(row => Boolean((row.stats || {}).confirmedStarter));
    if(confirmed.length !== 11) return null;

    return confirmed.map((row,index) => ({
      ...row,
      _layoutZone:String(row.player?.position || matchVisualZone(row) || "MID"),
      _layoutOrder:index
    }));
  }

  function overrideStarterRows(rows,match,side){
    // Zodra we een echte bevestigde XI hebben, mag een oudere handmatige
    // prediction-layout nooit nog een 0%-bankspeler op het veld houden.
    const confirmed = confirmedStarterRows(rows);
    if(confirmed) return confirmed;

    const override = getOverride(match,side);
    const slots = Array.isArray(override?.slots) ? override.slots : [];
    if(slots.length !== 11) return null;

    const byId = new Map((rows || []).map(row => [String(row.player_id),row]));
    const mapped = slots
      .slice()
      .sort((a,b) => Number(a.order || 0)-Number(b.order || 0))
      .map(slot => {
        const row = byId.get(String(slot.player_id));
        if(!row) return null;
        return {
          ...row,
          _layoutZone:String(slot.zone || row.player?.position || "MID"),
          _layoutOrder:Number(slot.order || 0)
        };
      })
      .filter(Boolean);

    return mapped.length === 11 ? mapped : null;
  }

  function layoutStarters(rows,match,side){
    return overrideStarterRows(rows,match,side) || naturalInferredMatchStarters(rows).map((row,index) => ({
      ...row,
      _layoutZone:matchVisualZone(row),
      _layoutOrder:index
    }));
  }

  function effectiveFormation(rows,match,side){
    // Een bevestigde basiself heeft voorrang op een opgeslagen prediction-override.
    // Zo verdwijnt bv. een oude 3-5-2 zodra de echte 4-5-1 bekend is.
    if(confirmedStarterRows(rows)) return naturalInferredFormation(rows);
    const override = getOverride(match,side);
    return override?.formation || naturalInferredFormation(rows);
  }

  // The ordinary match renderer calls inferredFormation(rows) without match/side.
  // While one match is being rendered we keep that match in a temporary context.
  inferredFormation = function(rows){
    const match = window.FANTASY_ACTIVE_MATCH_RENDER;
    if(!match) return naturalInferredFormation(rows);
    const side = sideFromRows(rows,match);
    return effectiveFormation(rows,match,side);
  };

  renderMatchTeamPlayers = function(rows,match,side){
    const starters = layoutStarters(rows,match,side);
    const groups = {GK:[],DEF:[],MID:[],FWD:[]};

    starters.forEach(row => {
      const zone = row._layoutZone || row.player?.position || "MID";
      (groups[zone] || groups.MID).push(row);
    });

    return ["GK","DEF","MID","FWD"].flatMap(zone => {
      const group = groups[zone];
      const hasOverride = Boolean(getOverride(match,side));
      group.sort((a,b) => {
        if(hasOverride) return Number(a._layoutOrder || 0)-Number(b._layoutOrder || 0);
        const rankDiff = formationSideRank(a,zone,group.length)-formationSideRank(b,zone,group.length);
        if(rankDiff) return rankDiff;
        return String(a.player?.name || "").localeCompare(String(b.player?.name || ""),"nl");
      });
      return group.map((row,index) => matchPlayerButton(row,match,side,index,group.length,zone));
    }).join("");
  };

  renderMatchMobileTeam = function(rows,match){
    const side = sideFromRows(rows,match);
    const starters = layoutStarters(rows,match,side);
    const groups = {GK:[],DEF:[],MID:[],FWD:[]};

    starters.forEach(row => {
      const zone = row._layoutZone || row.player?.position || "MID";
      (groups[zone] || groups.MID).push(row);
    });

    return ["GK","DEF","MID","FWD"].flatMap(zone => {
      const group = groups[zone];
      const hasOverride = Boolean(getOverride(match,side));
      group.sort((a,b) => hasOverride
        ? Number(a._layoutOrder || 0)-Number(b._layoutOrder || 0)
        : formationSideRank(a,zone,group.length)-formationSideRank(b,zone,group.length)
      );
      return group.map((row,index) => matchMobilePlayerButton(row,match,index,group.length,zone));
    }).join("");
  };

  renderMatchBench = function(rows,match,side){
    const overridden = overrideStarterRows(rows,match,side);
    const starterIds = new Set(
      (overridden || naturalInferredMatchStarters(rows)).map(row => String(row.player_id))
    );
    const predictedRows = rows.filter(row => predictionPercent(row) != null);

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
        ? rows.filter(row => Boolean((row.stats || {}).onGameSheet) && !starterIds.has(String(row.player_id)))
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
  };

  function formationZones(formation){
    const parts = String(formation || "").split("-").map(Number);
    if(parts.length !== 3 || parts.some(n => !Number.isFinite(n)) || parts.reduce((a,b) => a+b,0) !== 10){
      return ["GK","DEF","DEF","DEF","DEF","MID","MID","MID","MID","FWD","FWD"];
    }
    const [def,mid,fwd] = parts;
    return ["GK",...Array(def).fill("DEF"),...Array(mid).fill("MID"),...Array(fwd).fill("FWD")];
  }

  function naturalSlots(rows){
    const starters = naturalInferredMatchStarters(rows);
    const groups = {GK:[],DEF:[],MID:[],FWD:[]};
    starters.forEach(row => {
      const zone = matchVisualZone(row);
      (groups[zone] || groups.MID).push(row);
    });

    const slots = [];
    ["GK","DEF","MID","FWD"].forEach(zone => {
      const group = groups[zone];
      group.sort((a,b) => {
        const rankDiff = formationSideRank(a,zone,group.length)-formationSideRank(b,zone,group.length);
        if(rankDiff) return rankDiff;
        return String(a.player?.name || "").localeCompare(String(b.player?.name || ""),"nl");
      });
      group.forEach(row => slots.push({
        player_id:String(row.player_id),
        zone,
        order:slots.length
      }));
    });
    return slots;
  }

  function sidePlayers(rows){
    const starters = new Set(naturalInferredMatchStarters(rows).map(row => String(row.player_id)));
    return rows.slice().sort((a,b) => {
      const aStarter = starters.has(String(a.player_id)) ? 0 : 1;
      const bStarter = starters.has(String(b.player_id)) ? 0 : 1;
      if(aStarter !== bStarter) return aStarter-bStarter;
      return String(a.player?.name || "").localeCompare(String(b.player?.name || ""),"nl");
    });
  }

  function currentEditorSlots(rows,match,side){
    const override = getOverride(match,side);
    const overrideSlots = Array.isArray(override?.slots) ? override.slots : [];
    if(overrideSlots.length === 11){
      return overrideSlots.slice().sort((a,b) => Number(a.order || 0)-Number(b.order || 0));
    }
    return naturalSlots(rows);
  }

  function formationOptions(current){
    const options = FORMATIONS.includes(current) ? FORMATIONS : [current,...FORMATIONS].filter(Boolean);
    return [...new Set(options)].map(value =>
      '<option value="' + escapeHtml(value) + '"' + (value === current ? " selected" : "") + '>' + escapeHtml(value) + '</option>'
    ).join("");
  }

  function selectedIds(editor){
    return [...editor.querySelectorAll(".admin-slot select")].map(select => select.value).filter(Boolean);
  }

  function renderEditorSlots(editor,rows,match,side,preferredIds){
    const formation = editor.querySelector(".admin-formation-select").value;
    const zones = formationZones(formation);
    const players = sidePlayers(rows);
    const current = preferredIds?.length ? preferredIds.slice() : currentEditorSlots(rows,match,side).map(slot => String(slot.player_id));

    const target = editor.querySelector(".admin-slot-grid");
    const zoneCounters = {GK:0,DEF:0,MID:0,FWD:0};
    target.innerHTML = zones.map((zone,index) => {
      zoneCounters[zone] += 1;
      const currentId = current[index] || "";
      const options = players.map(row => {
        const id = String(row.player_id);
        const player = row.player || {};
        return '<option value="' + escapeHtml(id) + '"' + (id === currentId ? " selected" : "") + '>' +
          escapeHtml((player.name || "Onbekend") + " · " + (player.position || "?")) + '</option>';
      }).join("");

      return '<label class="admin-slot" data-zone="' + zone + '" data-order="' + index + '">' +
        '<span>' + zone + " " + zoneCounters[zone] + '</span>' +
        '<select aria-label="' + zone + " " + zoneCounters[zone] + '">' + options + '</select>' +
      '</label>';
    }).join("");
  }

  function closestStandardFormation(currentFormation){
    if(FORMATIONS.includes(currentFormation)) return currentFormation;

    const current = String(currentFormation || "").split("-").map(Number);
    if(current.length !== 3 || current.some(value => !Number.isFinite(value))){
      return "4-3-3";
    }

    return FORMATIONS
      .map(formation => {
        const parts = formation.split("-").map(Number);
        const distance =
          Math.abs(parts[0]-current[0]) +
          Math.abs(parts[1]-current[1]) +
          Math.abs(parts[2]-current[2]);
        return {formation,distance};
      })
      .sort((a,b) => a.distance-b.distance)[0].formation;
  }

  function buildTeamEditor(match,rows,side,label){
    const rawFormation = effectiveFormation(rows,match,side);
    const currentFormation = closestStandardFormation(rawFormation);
    const wrapper = document.createElement("article");
    wrapper.className = "admin-team-editor";
    wrapper.dataset.side = side;
    wrapper.innerHTML =
      '<h4>' + escapeHtml(label) + '</h4>' +
      '<label><span>Formatie</span><select class="admin-formation-select">' + formationOptions(currentFormation) + '</select></label>' +
      '<div class="admin-slot-grid"></div>';

    renderEditorSlots(wrapper,rows,match,side);
    wrapper.querySelector(".admin-formation-select").addEventListener("change",() => {
      const ids = selectedIds(wrapper);
      renderEditorSlots(wrapper,rows,match,side,ids);
    });
    return wrapper;
  }

  function collectEditor(editor){
    const formation = editor.querySelector(".admin-formation-select").value;
    if(!FORMATIONS.includes(formation)){
      throw new Error("Kies een geldige formatie.");
    }
    const slots = [...editor.querySelectorAll(".admin-slot")].map((slot,index) => ({
      player_id:slot.querySelector("select").value,
      zone:slot.dataset.zone,
      order:index
    }));

    const ids = slots.map(slot => slot.player_id);
    if(ids.some(id => !id)) throw new Error("Kies voor elk vak een speler.");
    if(new Set(ids).size !== 11) throw new Error("Elke speler mag maar één keer in de basis staan.");
    return {formation,slots};
  }

  async function reloadAdminMatch(match){
    const detail = document.getElementById("matchDetail");
    detail.innerHTML = '<div class="empty-state match-loading">Wedstrijdopstelling opnieuw laden…</div>';
    window.dispatchEvent(new CustomEvent("fantasy:match-detail",{detail:{fixtureId:String(match.id),match}}));
  }

  function injectAdminEditor(match,rows){
    if(!window.FANTASY_IS_ADMIN || String(window.FANTASY_ADMIN_MATCH_EDIT || "") !== String(match.id)) return;

    const allRows = Array.isArray(rows) ? rows : [];
    const homeRows = allRows.filter(row => sameClubName((row.stats || {}).teamName,match.home) || sameClubName(row.player?.club_name,match.home));
    const awayRows = allRows.filter(row => sameClubName((row.stats || {}).teamName,match.away) || sameClubName(row.player?.club_name,match.away));
    if(homeRows.length < 11 || awayRows.length < 11) return;

    const predictionMode = allRows.some(row => predictionPercent(row) != null);
    const editor = document.createElement("section");
    editor.className = "admin-lineup-editor";
    editor.innerHTML =
      '<div class="admin-lineup-editor-head"><div><p class="eyebrow">ADMIN</p><h3>' +
        (predictionMode ? "Pas de voorspelde opstelling aan" : "Werk de echte opstelling bij") +
      '</h3><p class="admin-editor-context">' +
        (predictionMode
          ? "Verplaats spelers handmatig naar de juiste linie/positie. Dit verandert hun vaste DEF/MID/FWD-klasse niet."
          : "Pas de visuele wedstrijdopstelling aan zonder de vaste spelerklasse te wijzigen.") +
      '</p></div>' +
      '<div class="admin-lineup-actions"><span class="admin-save-status">Niet opgeslagen wijzigingen worden alleen lokaal getoond.</span>' +
      '<button class="btn secondary-btn admin-reset-lineup" type="button">Reset to normal</button>' +
      '<button class="btn primary-btn admin-save-lineup" type="button">Save changes</button></div></div>' +
      '<div class="admin-team-editors"></div>';

    const teams = editor.querySelector(".admin-team-editors");
    teams.append(
      buildTeamEditor(match,homeRows,"home",match.home),
      buildTeamEditor(match,awayRows,"away",match.away)
    );

    const status = editor.querySelector(".admin-save-status");
    const save = editor.querySelector(".admin-save-lineup");
    const reset = editor.querySelector(".admin-reset-lineup");

    save.addEventListener("click",async () => {
      save.disabled = true;
      reset.disabled = true;
      status.className = "admin-save-status";
      status.textContent = "Opslaan…";
      try{
        const home = collectEditor(editor.querySelector('[data-side="home"]'));
        const away = collectEditor(editor.querySelector('[data-side="away"]'));
        const api = window.FANTASY_ADMIN_API;
        if(!api) throw new Error("Admin-API is niet beschikbaar.");

        await api.saveLineupOverride(match.id,"home",home.formation,home.slots);
        await api.saveLineupOverride(match.id,"away",away.formation,away.slots);

        status.className = "admin-save-status ok";
        status.textContent = "Opgeslagen voor iedereen.";
        await reloadAdminMatch(match);
      }catch(error){
        status.className = "admin-save-status error";
        status.textContent = error.message || "Opslaan mislukt.";
      }finally{
        save.disabled = false;
        reset.disabled = false;
      }
    });

    reset.addEventListener("click",async () => {
      reset.disabled = true;
      save.disabled = true;
      status.className = "admin-save-status";
      status.textContent = predictionMode ? "Automatische prediction-opstelling herstellen…" : "Originele Sorare-opstelling herstellen…";
      try{
        const api = window.FANTASY_ADMIN_API;
        if(!api) throw new Error("Admin-API is niet beschikbaar.");
        await api.resetLineupOverride(match.id);
        status.className = "admin-save-status ok";
        status.textContent = predictionMode ? "Prediction teruggezet naar automatisch." : "Teruggezet naar normaal.";
        await reloadAdminMatch(match);
      }catch(error){
        status.className = "admin-save-status error";
        status.textContent = error.message || "Reset mislukt.";
      }finally{
        reset.disabled = false;
        save.disabled = false;
      }
    });

    const detail = document.getElementById("matchDetail");
    const head = detail.querySelector(".match-detail-head");
    if(head) head.insertAdjacentElement("afterend",editor);
    else detail.prepend(editor);
  }

  renderMatchDetail = function(match,rows=[]){
    window.FANTASY_ACTIVE_MATCH_RENDER = match;
    try{
      naturalRenderMatchDetail(match,rows);
    }finally{
      window.FANTASY_ACTIVE_MATCH_RENDER = null;
    }
    injectAdminEditor(match,rows);
  };

  openFixtureDetail = function(fixtureId,fallbackMatch){
    window.FANTASY_ADMIN_MATCH_EDIT = null;
    return naturalOpenFixtureDetail(fixtureId,fallbackMatch);
  };

  function chooseAdminWeek(){
    const weeks = [...new Set(MATCHES.map(matchweekNumber).filter(Number.isFinite))].sort((a,b) => a-b);
    if(!weeks.length) return weeks;
    if(weeks.includes(Number(selectedAdminMatchweek))) return weeks;

    const live = weeks.find(week => MATCHES.some(m => matchweekNumber(m) === week && m.status === "LIVE"));
    const next = weeks.find(week => MATCHES.some(m => matchweekNumber(m) === week && !["FT","CANC"].includes(String(m.status || ""))));
    const played = weeks.filter(week => MATCHES.some(m => matchweekNumber(m) === week && m.status === "FT"));
    selectedAdminMatchweek = live ?? next ?? (played.length ? played[played.length-1] : weeks[0]);
    return weeks;
  }

  function openAdminFixture(fixtureId){
    if(!window.FANTASY_IS_ADMIN) return;
    const id = String(fixtureId || "");
    const match = MATCHES.find(item => String(item.id) === id);
    if(!match) return;

    window.FANTASY_ADMIN_MATCH_EDIT = id;
    const dialog = document.getElementById("matchDialog");
    document.getElementById("matchDetail").innerHTML = '<div class="empty-state match-loading">Admin-opstelling laden…</div>';
    if(!dialog.open) dialog.showModal();
    window.dispatchEvent(new CustomEvent("fantasy:match-detail",{detail:{fixtureId:id,match}}));
  }

  function renderAdminMatches(){
    const list = document.getElementById("adminMatchesList");
    const select = document.getElementById("adminMatchweekSelect");
    if(!list || !select) return;

    const weeks = chooseAdminWeek();
    select.innerHTML = weeks.map(week => '<option value="' + week + '">Speeldag ' + week + '</option>').join("");
    if(selectedAdminMatchweek != null) select.value = String(selectedAdminMatchweek);

    const visible = MATCHES
      .filter(match => !weeks.length || matchweekNumber(match) === Number(selectedAdminMatchweek))
      .slice()
      .sort((a,b) => String(a.kickoff || "").localeCompare(String(b.kickoff || "")));

    list.innerHTML = visible.map(match => {
      const status = String(match.status || "");
      const editable = Boolean(match.id) && status !== "CANC";
      const tag = status === "LIVE"
        ? '<span class="match-live-badge">LIVE</span>'
        : !["FT","CANC"].includes(status) ? '<span class="match-upcoming-badge">KOMEND</span>' : "";
      const score = ["FT","LIVE"].includes(status)
        ? escapeHtml(String(match.homeScore)) + "–" + escapeHtml(String(match.awayScore))
        : "vs";
      const content = '<span class="date">' + escapeHtml(match.date || "") + '</span>' +
        '<strong class="home">' + escapeHtml(match.home || "") + '</strong>' +
        '<span class="match-score' + (!["FT","LIVE"].includes(status) ? " future" : "") + '">' + score + tag + '</span>' +
        '<strong>' + escapeHtml(match.away || "") + '</strong>' +
        '<span class="matchweek">' + escapeHtml(match.week || "") + '</span>';

      return editable
        ? '<button class="match-row match-row-button admin-match-row" type="button" data-admin-fixture-id="' + escapeHtml(String(match.id)) + '">' + content + '</button>'
        : '<div class="match-row match-row-future">' + content + '</div>';
    }).join("") || '<div class="empty-state">Geen wedstrijden gevonden.</div>';

    list.querySelectorAll("[data-admin-fixture-id]").forEach(button =>
      button.addEventListener("click",() => openAdminFixture(button.dataset.adminFixtureId))
    );
  }

  function createAdminUi(){
    if(document.getElementById("adminTabButton")) return;

    const tab = document.createElement("button");
    tab.id = "adminTabButton";
    tab.className = "tab";
    tab.dataset.tab = "admin";
    tab.type = "button";
    tab.textContent = "Admin";
    tab.hidden = true;
    (document.querySelector(".tab-links") || document.querySelector(".tabs")).appendChild(tab);

    const panel = document.createElement("section");
    panel.id = "admin";
    panel.className = "panel tab-panel";
    panel.innerHTML =
      '<div class="section-head"><div><p class="eyebrow">ADMIN</p><h2>Wedstrijdopstellingen</h2></div></div>' +
      '<p class="admin-panel-note">Alleen jouw vaste adminaccount ziet deze tab. Wijzig hier de visuele formatie en plaats spelers handmatig in de juiste linie. Hun echte GK/DEF/MID/FWD-klasse verandert niet.</p>' +
      '<div class="matchweek-toolbar"><label for="adminMatchweekSelect"><span>Speeldag kiezen</span><select id="adminMatchweekSelect" aria-label="Admin speeldag kiezen"></select></label></div>' +
      '<div id="adminMatchesList" class="matches-list"></div>';
    document.querySelector("main").appendChild(panel);

    tab.addEventListener("click",() => {
      if(!window.FANTASY_IS_ADMIN) return;
      activateFantasyTab("admin",true);
      renderAdminMatches();
    });

    panel.querySelector("#adminMatchweekSelect").addEventListener("change",event => {
      selectedAdminMatchweek = Number(event.target.value);
      renderAdminMatches();
    });
  }

  function applyAdminAccess(isAdmin){
    createAdminUi();
    const tab = document.getElementById("adminTabButton");
    if(!tab) return;
    tab.hidden = !isAdmin;
    if(isAdmin){
      tab.classList.remove("setup-locked");
      tab.setAttribute("aria-disabled","false");
      renderAdminMatches();
    }else if(document.getElementById("admin")?.classList.contains("active")){
      activateFantasyTab("team",true);
    }
  }

  window.addEventListener("fantasy:admin-access",event => {
    applyAdminAccess(Boolean(event.detail?.isAdmin));
  });

  createAdminUi();
  applyAdminAccess(Boolean(window.FANTASY_IS_ADMIN));
  window.renderAdminMatches = renderAdminMatches;
})();