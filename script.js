function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function setTurn(value) {
  const el = document.getElementById("turn");
  if (el) el.textContent = value;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------- MOVE OUTCOMES (EDIT HERE) ---------------- */
const MOVE_TEXT = {
  1: "You attempt to improve one of your fiefs. (Event REF: IMP14)",
  2: "You arrange an expedition - Specify target to administrator. (Event REF: EXP08)",
  3: "You can not yet plan any offensive campaigns!"
};

let activeMoveTimers = [];

function clearAllMoveOutcomes() {
  activeMoveTimers.forEach(t => clearTimeout(t));
  activeMoveTimers = [];
  const outs = document.querySelectorAll("[id^='move-outcome-']");
  outs.forEach(out => { out.textContent = ""; out.style.opacity = "1"; });
}

function showMoveOutcome(moveNumber) {
  clearAllMoveOutcomes();

  const out = document.getElementById(`move-outcome-${moveNumber}`);
  if (!out) return;

  const text = MOVE_TEXT[moveNumber] ?? `Outcome for Move ${moveNumber}`;
  out.textContent = text;
  out.style.opacity = "1";

  const t1 = setTimeout(() => { out.style.opacity = "0"; }, 10000);
  const t2 = setTimeout(() => { out.textContent = ""; out.style.opacity = "1"; }, 11000);
  activeMoveTimers.push(t1, t2);
}

function wireMoves() {
  const btns = document.querySelectorAll(".move-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const n = Number(btn.getAttribute("data-move"));
      if (!Number.isFinite(n)) return;
      showMoveOutcome(n);
    });
  });
}

/* ---------------- LEADERBOARD ---------------- */

function computeIncomeTotals(state) {
  const totals = {};
  const provinces = state.provinces || {};
  for (const prov of Object.values(provinces)) {
    const owner = prov.owner;
    if (!owner) continue;
    const inc = Number(prov.income || 0);
    totals[owner] = (totals[owner] || 0) + (Number.isFinite(inc) ? inc : 0);
  }
  return totals;
}

function maxKeysByValue(obj) {
  let best = -Infinity;
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    if (n > best) { best = n; keys.length = 0; keys.push(k); }
    else if (n === best) { keys.push(k); }
  }
  return { best, keys };
}

function renderLeaderboard(state) {
  const el = document.getElementById("leaderboard");
  if (!el) return;

  const players = state.players || {};
  const incomeTotals = computeIncomeTotals(state);

  const leviesObj = {};
  const goldObj = {};
  for (const [k, p] of Object.entries(players)) {
    leviesObj[k] = Number(p.levies || 0);
    goldObj[k] = Number(p.gold || 0);
    if (incomeTotals[k] === undefined) incomeTotals[k] = 0;
  }

  const incomeBest = maxKeysByValue(incomeTotals);
  const leviesBest = maxKeysByValue(leviesObj);
  const goldBest = maxKeysByValue(goldObj);

  function names(keys) {
    if (!keys || keys.length === 0) return "—";
    return keys.map(k => players[k]?.name ?? k).join(", ");
  }

  el.innerHTML = `
    <div class="leaderboard-item">
      <b>Economic Hegemon</b><br>
      <span>${escapeHtml(names(incomeBest.keys))}</span>
      <div class="lb-sub">Highest total income. Gets unique events and development outcomes.</div>
    </div>

    <div class="leaderboard-item">
      <b>Secure Routes</b><br>
      <span>${escapeHtml(names(leviesBest.keys))}</span>
      <div class="lb-sub">Highest levies/patrols. +20 income per owned fief + unique events.</div>
    </div>

    <div class="leaderboard-item">
      <b>Bank of the Mapso</b><br>
      <span>${escapeHtml(names(goldBest.keys))}</span>
      <div class="lb-sub">Highest gold. Investment/moneylending mechanics + unique events.</div>
    </div>
  `;
}

/* ---------------- TURN LOG (SUPABASE) ---------------- */

// Paste the same values you used in player.js
const SUPABASE_URL = "https://rvtaogqygqanshxpjrer.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g2tgBXMQmNHj0UNSf5MGuA_whabxtE_";

function getSupabaseClient() {
  // UMD build exposes window.supabase
  if (!window.supabase || !window.supabase.createClient) {
    throw new Error("Supabase SDK not loaded. Did you include the CDN script tag?");
  }
  return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function groupByTurn(rows) {
  const map = new Map();
  for (const r of rows) {
    const t = r.turn_number;
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(r);
  }
  return map;
}

function renderTurnLog(rows) {
  const el = document.getElementById("turn-log");
  if (!el) return;

  if (!rows || rows.length === 0) {
    el.innerHTML = `<div>No published history yet.</div>`;
    return;
  }

  const byTurn = groupByTurn(rows);
  const turns = Array.from(byTurn.keys()).sort((a,b) => b - a);

  let html = "";
  for (const turn of turns) {
    const items = byTurn.get(turn) || [];
    html += `
      <div class="turnlog-turn">
        <div class="turnlog-turn-title">
          <b>Turn ${escapeHtml(turn)}</b>
          <span class="lb-sub">${escapeHtml(items.length)} faction(s)</span>
        </div>
    `;

    for (const it of items) {
      const res = it.resolution || {};
      html += `
        <div class="turnlog-faction">
          <b>${escapeHtml(it.faction_id)}</b>
          ${res.event_outcome ? `<div class="turnlog-kv">🎭 <b>Event:</b> ${escapeHtml(res.event_outcome)}</div>` : ""}
          ${res.improvement_result ? `<div class="turnlog-kv">🏗 <b>Improve:</b> ${escapeHtml(res.improvement_result)}${res.improvement_notes ? " — " + escapeHtml(res.improvement_notes) : ""}</div>` : ""}
          ${res.campaign_outcome ? `<div class="turnlog-kv">⚔ <b>Campaign:</b> ${escapeHtml(res.campaign_outcome)}</div>` : ""}
        </div>
      `;
    }

    html += `</div>`;
  }

  el.innerHTML = html;
}

async function loadTurnLog() {
  const el = document.getElementById("turn-log");
  if (el) el.textContent = "Loading…";

  const sb = getSupabaseClient();
  const { data, error } = await sb.rpc("public_turn_log", { p_limit_turns: 10 });

  if (error) {
    if (el) el.textContent = `ERROR: ${error.message}`;
    return;
  }

  renderTurnLog(data);
}

function wireTurnLog() {
  const btn = document.getElementById("log-refresh");
  if (btn) btn.addEventListener("click", loadTurnLog);
}

/* ---------------- SKIRMISHES ---------------- */

function d6() {
  return 1 + Math.floor(Math.random() * 6);
}

function wireSkirmish(state) {
  const sel = document.getElementById("sk-faction");
  const threatEl = document.getElementById("sk-threat");
  const rollBtn = document.getElementById("sk-roll");
  const res = document.getElementById("sk-results");
  if (!sel || !threatEl || !rollBtn || !res) return;

  // dropdown
  sel.innerHTML = "";
  const players = state.players || {};
  for (const [key, p] of Object.entries(players)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = p.name ?? key;
    sel.appendChild(opt);
  }
  if (sel.options.length > 0) sel.value = sel.options[0].value;

  rollBtn.addEventListener("click", () => {
    const factionKey = sel.value;
    const p = players[factionKey];
    if (!p) return;

    const threat = Number(threatEl.value || 0);
    const gold = Number(p.gold || 0);
    const levies = Number(p.levies || 0);

    // Training: min 3 if gold > 1000
    let training = d6();
    const trainingMin = (gold > 1000) ? 3 : 1;
    if (training < trainingMin) training = trainingMin;

    // Manpower: SINGLE roll, min 3 if levies >= 200
    let manpower = d6();
    const manpowerMin = (levies >= 200) ? 3 : 1;
    if (manpower < manpowerMin) manpower = manpowerMin;

    // Surprise: pure random
    const surprise = d6();

    const total = training * manpower * surprise;
    const win = total >= threat;

    res.innerHTML = `
      <div><b>Faction:</b> ${escapeHtml(p.name)} (Gold ${escapeHtml(gold)}, Levies ${escapeHtml(levies)})</div>
      <div><b>Training:</b> ${escapeHtml(training)} (min ${escapeHtml(trainingMin)})</div>
      <div><b>Manpower:</b> ${escapeHtml(manpower)} (min ${escapeHtml(manpowerMin)})</div>
      <div><b>Surprise:</b> ${escapeHtml(surprise)} (random)</div>

      <div style="margin-top:8px;"><b>Total:</b> ${escapeHtml(training)} × ${escapeHtml(manpower)} × ${escapeHtml(surprise)} = <b>${escapeHtml(total)}</b></div>
      <div style="margin-top:6px;"><b>Threat difficulty:</b> ${escapeHtml(threat)}</div>

      <div style="margin-top:8px;"><b>Outcome:</b> ${win ? "✅ Mission succeeds" : "❌ Mission fails (levies perish as per DM ruling)"}</div>
    `;
  });
}

/* ---------------- EVENTS ---------------- */

function addEventMarkers(map, state) {
  const events = state.events || [];
  if (!events.length) return;

  // Reusable Leaflet icon: white circle + exclamation mark
  function makeEventIcon(type) {
    return L.divIcon({
      className: "", // we style the inner HTML instead
      html: `<div class="event-icon" data-type="${escapeHtml(type)}"><span>!</span></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9]
    });
  }

  for (const ev of events) {
    const x = Number(ev.x);
    const y = Number(ev.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const type = ev.type || "Administrative";
    const title = ev.title || "Event";
    const desc = ev.description || "";

    L.marker([y, x], { icon: makeEventIcon(type), keyboard: false })
      .addTo(map)
      .bindPopup(`
        <b>${escapeHtml(title)}</b><br>
        <i>${escapeHtml(type)}</i><br><br>
        ${escapeHtml(desc)}
      `);
  }
}

/* ---------------- MAP ---------------- */

function initMap(state) {
  if (typeof L === "undefined") throw new Error("Leaflet not loaded (L undefined).");

  const w = Number(state.map?.width);
  const h = Number(state.map?.height);
  const img = state.map?.image;

  if (!img) throw new Error("state.map.image missing (e.g. map.jpg)");
  if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("state.map.width/height must be numbers");

  const bounds = [[0, 0], [h, w]];

  const map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: -2,
    maxZoom: 2,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0
  });

  L.imageOverlay(img, bounds).addTo(map);
  map.fitBounds(bounds);

  // Coordinate picker
  map.on("click", (e) => {
    const x = Math.round(e.latlng.lng);
    const y = Math.round(e.latlng.lat);

    L.popup()
      .setLatLng(e.latlng)
      .setContent(`<b>x:</b> ${x} <b>y:</b> ${y}<br><small>Put these in state.json markers</small>`)
      .openOn(map);

    console.log(`COORDS: { "x": ${x}, "y": ${y} }`);
  });

  // Markers
  for (const m of (state.markers || [])) {
    const prov = state.provinces?.[m.provinceId];
    if (!prov) continue;

    const ownerKey = prov.owner;
    const owner = state.players?.[ownerKey];
    const colour = owner?.colour ?? "#777";

    const radius =
      prov.type === "City" ? 9 :
      prov.type === "Keep" ? 7 : 6;

    L.circleMarker([Number(m.y), Number(m.x)], {
      radius,
      weight: 2,
      color: "#000",
      fillColor: colour,
      fillOpacity: 0.9
    })
    .addTo(map)
    .bindPopup(`
      <b>${escapeHtml(prov.name || m.provinceId)}</b><br>
      Type: ${escapeHtml(prov.type || "—")}<br>
      Owner: ${escapeHtml(owner?.name || ownerKey || "Unclaimed")}<br>
      Income: ${escapeHtml(prov.income ?? 0)}<br>
      Buildings: ${escapeHtml((prov.buildings || []).join(", ") || "-")}
    `);
  }

  // Event markers (white circle with "!")
  addEventMarkers(map, state);

  return map;
}

/* ---------------- INIT ---------------- */

setStatus("loading state.json…");
setTurn("?");

fetch("state.json", { cache: "no-store" })
  .then(r => {
    if (!r.ok) throw new Error(`state.json failed: HTTP ${r.status}`);
    return r.json();
  })
  .then(state => {
    setTurn(state.turn ?? "?");
    setStatus("state loaded ✓");

    // Players panel
    const playersDiv = document.getElementById("players");
    if (!playersDiv) throw new Error("Missing #players in index.html");
    playersDiv.innerHTML = "";

    for (const [key, p] of Object.entries(state.players || {})) {
      const div = document.createElement("div");
      div.className = "player";
      div.style.borderLeft = `8px solid ${p.colour || "#000"}`;
      div.style.paddingLeft = "10px";
      div.style.marginBottom = "18px";

      const capitalId = p.capital ?? "";
      const capitalName = state.provinces?.[capitalId]?.name ?? capitalId ?? "-";
      const capitalLink = capitalId
        ? ` <a class="capital-link" href="capital.html?id=${encodeURIComponent(capitalId)}">(Go to Capital)</a>`
        : "";

      const levies = p.levies ?? 0;

      div.innerHTML = `
        <b>${escapeHtml(p.name ?? key)}</b><br>
        Gold: ${escapeHtml(p.gold ?? 0)}<br>
        Levies/Patrols: ${escapeHtml(levies)}<br>
        Capital: ${escapeHtml(capitalName)}${capitalLink}
      `;
      playersDiv.appendChild(div);
    }

    // Leaderboard (replaces left Notes)
    renderLeaderboard(state);

    // Map + UI
    initMap(state);
    wireMoves();
    wireSkirmish(state);
    wireTurnLog();
    loadTurnLog();


    setStatus("ready ✓");
  })
  .catch(err => {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
    setTurn("ERR");
    wireMoves();
  });
