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
  outs.forEach(out => {
    out.textContent = "";
    out.style.opacity = "1";
    out.style.transition = "opacity 0.8s linear";
  });
}

function showMoveOutcome(moveNumber) {
  clearAllMoveOutcomes();

  const out = document.getElementById(`move-outcome-${moveNumber}`);
  if (!out) return;

  const text = MOVE_TEXT[moveNumber] ?? `Outcome for Move ${moveNumber}`;
  out.textContent = text;

  out.style.opacity = "1";
  out.style.transition = "opacity 0.8s linear";

  // fade after 10 seconds
  const t1 = setTimeout(() => {
    out.style.opacity = "0";
  }, 10000);

  // clear after fade
  const t2 = setTimeout(() => {
    out.textContent = "";
    out.style.opacity = "1";
  }, 10850);

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

/* ---------------- SKIRMISH (DICE) ---------------- */
function d6() {
  return 1 + Math.floor(Math.random() * 6);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function populateFactionSelect(state) {
  const sel = document.getElementById("sk-faction");
  if (!sel) return;

  sel.innerHTML = `<option value="">Select…</option>`;
  for (const [key, p] of Object.entries(state.players || {})) {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = p.name ?? key;
    sel.appendChild(opt);
  }
}

function rollTraining(player) {
  let r = d6();
  // If gold > 1000 => minimum 3
  if ((player.gold ?? 0) > 1000) r = Math.max(r, 3);
  return r;
}

function rollManpower(player) {
  const levies = Number(player.levies ?? 0);

  // Base roll (possibly advantage)
  let r = d6();

  // If levies > 200, roll twice keep higher
  if (levies > 200) {
    const r2 = d6();
    r = Math.max(r, r2);
  }

  // If levies >= 200 => minimum 3
  if (levies >= 200) r = Math.max(r, 3);

  return r;
}

function rollSurprise() {
  return d6();
}

function wireSkirmish(state) {
  const btn = document.getElementById("sk-roll");
  const sel = document.getElementById("sk-faction");
  const threatInput = document.getElementById("sk-threat");
  const commitInput = document.getElementById("sk-commit");

  if (!btn || !sel || !threatInput || !commitInput) return;

  btn.addEventListener("click", () => {
    const factionKey = sel.value;
    if (!factionKey) {
      setText("sk-outcome", "Pick a faction first.");
      return;
    }

    const player = state.players?.[factionKey];
    if (!player) {
      setText("sk-outcome", "Invalid faction selection.");
      return;
    }

    const threat = Math.max(1, Number(threatInput.value || 1));
    const committed = Math.max(0, Math.floor(Number(commitInput.value || 0)));

    const r1 = rollTraining(player);
    const r2 = rollManpower(player);
    const r3 = rollSurprise();
    const total = r1 * r2 * r3;

    setText("sk-r1", r1);
    setText("sk-r2", r2);
    setText("sk-r3", r3);
    setText("sk-total", total);

    if (total >= threat) {
      setText(
        "sk-outcome",
        `SUCCESS — Total ${total} vs Threat ${threat}. Mission completed. (Manual: apply rewards/changes in state.json.)`
      );
    } else {
      setText(
        "sk-outcome",
        `FAILURE — Total ${total} vs Threat ${threat}. ${committed} committed levies perish (manual: subtract in state.json).`
      );
    }
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

      const capitalName = state.provinces?.[p.capital]?.name ?? p.capital ?? "-";
      const levies = p.levies ?? 0;

      div.innerHTML = `
        <b>${escapeHtml(p.name ?? key)}</b><br>
        Gold: ${escapeHtml(p.gold ?? 0)}<br>
        Levies/Patrols: ${escapeHtml(levies)}<br>
        Capital: ${escapeHtml(capitalName)}
      `;
      playersDiv.appendChild(div);
    }

    // Map
    if (typeof L === "undefined") throw new Error("Leaflet not loaded (L undefined).");

    const w = Number(state.map?.width);
    const h = Number(state.map?.height);
    const img = state.map?.image;

    if (!img) throw new Error("state.map.image missing (e.g. map.jpg)");
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("state.map.width/height must be numbers");

    setStatus("initialising map…");

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
    map.on("click", e => {
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

    // Moves + Skirmish
    wireMoves();
    populateFactionSelect(state);
    wireSkirmish(state);

    setStatus("ready ✓");
  })
  .catch(err => {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
    setTurn("ERR");

    // Keep moves working even if map fails
    wireMoves();
  });
