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

/* ---------------- MOVES (TEXTS EDIT HERE) ---------------- */
const MOVE_TEXT = {
  1: "You attempt to improve one of your fiefs. (Event REF: IMP14)",
  2: "You arrange an expedition — specify target to administrator. (Modifier REF: EXP08)",
  3: "You cannot yet plan any offensive campaigns!"
};

let moveTimers = [];

function clearAllMoveOutcomes() {
  moveTimers.forEach(t => clearTimeout(t));
  moveTimers = [];

  document.querySelectorAll("[id^='move-outcome-']").forEach(out => {
    out.textContent = "";
    out.style.opacity = "1";
    out.style.transition = "opacity 0.6s linear";
  });
}

function showMoveOutcome(n) {
  clearAllMoveOutcomes();

  const out = document.getElementById(`move-outcome-${n}`);
  if (!out) return;

  out.style.opacity = "1";
  out.style.transition = "opacity 0.6s linear";
  out.textContent = MOVE_TEXT[n] ?? `Outcome for Move ${n}`;

  // fade after 10s
  moveTimers.push(setTimeout(() => { out.style.opacity = "0"; }, 10000));
  // clear after fade
  moveTimers.push(setTimeout(() => {
    out.textContent = "";
    out.style.opacity = "1";
  }, 11000));
}

function wireMoves() {
  document.querySelectorAll(".move-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const n = Number(btn.getAttribute("data-move"));
      if (!Number.isFinite(n)) return;
      showMoveOutcome(n);
    });
  });
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

  // populate dropdown
  sel.innerHTML = "";
  const players = state.players || {};
  for (const [key, p] of Object.entries(players)) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = p.name ?? key;
    sel.appendChild(opt);
  }

  // default to first player
  if (sel.options.length > 0) sel.value = sel.options[0].value;

  function renderResult(html) {
    res.innerHTML = html;
  }

  rollBtn.addEventListener("click", () => {
    const factionKey = sel.value;
    const p = players[factionKey];
    const threat = Number(threatEl.value);

    if (!p) {
      renderResult(`<b>Error:</b> unknown faction selected.`);
      return;
    }
    if (!Number.isFinite(threat) || threat <= 0) {
      renderResult(`<b>Error:</b> enter a Threat difficulty (number > 0).`);
      return;
    }

    const gold = Number(p.gold ?? 0);
    const levies = Number(p.levies ?? 0);

    // Roll 1: Training (min 3 if gold > 1000)
    let training = d6();
    const trainingMin = (gold > 1000) ? 3 : 1;
    if (training < trainingMin) training = trainingMin;

    // Roll 2: Manpower
    // - If levies >= 200: minimum 3
    // - If levies > 200: advantage (roll twice, take higher) to “increase chance to be higher”
    let manpowerA = d6();
    let manpowerB = null;
    let manpower = manpowerA;

    if (levies > 200) {
      manpowerB = d6();
      manpower = Math.max(manpowerA, manpowerB);
    }

    const manpowerMin = (levies >= 200) ? 3 : 1;
    if (manpower < manpowerMin) manpower = manpowerMin;

    // Roll 3: Surprise (pure random)
    const surprise = d6();

    const product = training * manpower * surprise;
    const success = product >= threat;

    const manpowerDetail = (manpowerB === null)
      ? `${manpowerA}`
      : `${manpowerA} & ${manpowerB} → <b>${manpower}</b>`;

    renderResult(`
      <div><b>Faction:</b> ${escapeHtml(p.name ?? factionKey)} <span style="opacity:.8">(Gold ${gold}, Levies ${levies})</span></div>
      <div style="margin-top:6px">
        <b>Training</b>: ${training} <span style="opacity:.8">(min ${trainingMin} because Gold ${gold > 1000 ? ">" : "≤"} 1000)</span><br>
        <b>Manpower</b>: ${manpowerDetail} <span style="opacity:.8">(${levies >= 200 ? "min 3" : "min 1"}${levies > 200 ? ", advantage" : ""})</span><br>
        <b>Surprise</b>: ${surprise} <span style="opacity:.8">(random)</span>
      </div>
      <div style="margin-top:8px">
        <b>Total:</b> ${training} × ${manpower} × ${surprise} = <b>${product}</b><br>
        <b>Threat:</b> ${threat}
      </div>
      <div style="margin-top:8px; font-weight:700">
        ${success ? "✅ SUCCESS — mission completes." : "❌ FAILURE — threat overwhelms the mission."}
      </div>
    `);
  });
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

    // ---- Players panel ----
    const playersDiv = document.getElementById("players");
    if (!playersDiv) throw new Error("Missing #players in index.html");
    playersDiv.innerHTML = "";

    for (const [key, p] of Object.entries(state.players || {})) {
      const div = document.createElement("div");
      div.className = "player";
      div.style.borderLeft = `8px solid ${p.colour || "#000"}`;
      div.style.paddingLeft = "10px";
      div.style.marginBottom = "18px";

      const capitalName = state.provinces?.[p.capital]?.name ?? p.capital ?? "-";
      const levies = (p.levies ?? 0);

      div.innerHTML = `
        <b>${escapeHtml(p.name ?? key)}</b><br>
        Gold: ${escapeHtml(p.gold ?? 0)}<br>
        Levies/Patrols: ${escapeHtml(levies)}<br>
        Capital: ${escapeHtml(capitalName)}
      `;
      playersDiv.appendChild(div);
    }

    // ---- Map ----
    if (typeof L === "undefined") {
      throw new Error("Leaflet didn't load (L is undefined). Check Leaflet <script> in index.html.");
    }

    const w = Number(state.map?.width);
    const h = Number(state.map?.height);
    const img = state.map?.image;

    if (!img) throw new Error("state.json missing map.image (e.g. 'map.jpg')");
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("state.json map.width/height must be numbers");

    setStatus("initialising map…");

    const bounds = [[0, 0], [h, w]];

    const map = L.map("map", {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,

      // lock panning to image bounds
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

    // Wire UI panels
    wireMoves();
    wireSkirmish(state);

    setStatus("ready ✓");
  })
  .catch(err => {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
    setTurn("ERR");
    wireMoves(); // still wire moves even if map fails
  });
