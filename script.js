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

/* ---------------- MOVE OUTCOMES (EDIT HERE) ----------------
   This is where the outcome texts are "kept".
   Add more moves by adding keys: 4, 5, 6...
------------------------------------------------------------ */
const MOVE_TEXT = {
  1: "You attempt to improve one of your fiefs. (Event REF: IMP14)",
  2: "You arrange an expedition - Specify target to administrator. (Modifier REF: EXP08)",
  3: "You can not yet plan any offensive campaigns!"
  // 4: "…",
  // 5: "…"
};

/* ---------------- MOVE BUTTONS ---------------- */
let activeMoveTimers = []; // holds timeouts so we can cancel on next click

function clearAllMoveOutcomes() {
  // Cancel any pending fade/clear timers
  activeMoveTimers.forEach(t => clearTimeout(t));
  activeMoveTimers = [];

  // Clear all outcome elements
  const outs = document.querySelectorAll("[id^='move-outcome-']");
  outs.forEach(out => {
    out.textContent = "";
    out.style.opacity = "1";
    out.style.transition = "opacity 1s linear";
  });
}

function showMoveOutcome(moveNumber) {
  clearAllMoveOutcomes();

  const out = document.getElementById(`move-outcome-${moveNumber}`);
  if (!out) return;

  out.style.opacity = "1";
  out.style.transition = "opacity 1s linear";

  // Use custom text, fallback if missing
  const text = MOVE_TEXT[moveNumber] ?? `Outcome for Move ${moveNumber}`;
  out.textContent = text;

  // After 5 seconds, fade out
  const t1 = setTimeout(() => {
    out.style.opacity = "0";
  }, 5000);

  // After fade completes, clear text + reset opacity
  const t2 = setTimeout(() => {
    out.textContent = "";
    out.style.opacity = "1";
  }, 8000);

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

    /* ---------------- PLAYERS PANEL ---------------- */
    const playersDiv = document.getElementById("players");
    if (!playersDiv) throw new Error("Missing #players in index.html");
    playersDiv.innerHTML = "";

    for (const [key, p] of Object.entries(state.players || {})) {
      const div = document.createElement("div");
      div.className = "player";
      div.style.borderLeft = `8px solid ${p.colour || "#000"}`;
      div.style.paddingLeft = "10px";
      div.style.marginBottom = "18px";

      const capitalName =
        state.provinces?.[p.capital]?.name ?? p.capital ?? "-";
      const levies = p.levies ?? 0;

      div.innerHTML = `
        <b>${escapeHtml(p.name ?? key)}</b><br>
        Gold: ${escapeHtml(p.gold ?? 0)}<br>
        Levies/Patrols: ${escapeHtml(levies)}<br>
        Capital: ${escapeHtml(capitalName)}
      `;
      playersDiv.appendChild(div);
    }

    /* ---------------- MAP ---------------- */
    if (typeof L === "undefined")
      throw new Error("Leaflet not loaded (L undefined).");

    const w = Number(state.map?.width);
    const h = Number(state.map?.height);
    const img = state.map?.image;

    if (!img) throw new Error("state.map.image missing (e.g. map.jpg)");
    if (!Number.isFinite(w) || !Number.isFinite(h))
      throw new Error("state.map.width/height must be numbers");

    setStatus("initialising map…");

    const bounds = [[0, 0], [h, w]];

    const map = L.map("map", {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,

      // Lock map panning to the image bounds
      maxBounds: bounds,
      maxBoundsViscosity: 1.0
    });

    L.imageOverlay(img, bounds).addTo(map);
    map.fitBounds(bounds);

    /* ---- COORDINATE PICKER (click map to get x/y) ---- */
    map.on("click", e => {
      const x = Math.round(e.latlng.lng); // lng = x in CRS.Simple
      const y = Math.round(e.latlng.lat); // lat = y in CRS.Simple

      L.popup()
        .setLatLng(e.latlng)
        .setContent(
          `<b>x:</b> ${x} <b>y:</b> ${y}<br><small>Put these in state.json markers</small>`
        )
        .openOn(map);

      console.log(`COORDS: { "x": ${x}, "y": ${y} }`);
    });

    /* ---------------- MARKERS ---------------- */
    for (const m of state.markers || []) {
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

    /* ---------------- MOVES PANEL ---------------- */
    wireMoves();
    setStatus("ready ✓");
  })
  .catch(err => {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
    setTurn("ERR");
    // still wire moves so buttons do something even if map fails
    wireMoves();
  });
