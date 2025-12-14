// ----- tiny UI helpers -----
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

// Prove script executes:
setTurn("JS OK");
setStatus("loading state.json…");

(async function main() {
  try {
    // 1) Load state
    const r = await fetch("state.json", { cache: "no-store" });
    if (!r.ok) throw new Error(`state.json failed: HTTP ${r.status}`);
    const state = await r.json();

    setStatus("state loaded ✓");
    setTurn(state.turn ?? "?");

    // 2) Render players
    const playersDiv = document.getElementById("players");
    if (!playersDiv) throw new Error("Missing <div id='players'> in index.html");

    playersDiv.innerHTML = "";
    for (const [key, p] of Object.entries(state.players || {})) {
      const div = document.createElement("div");
      div.className = "player";
      div.innerHTML = `
        <div class="name">${escapeHtml(p.name ?? key)}</div>
        <div class="meta">
          Gold: <b>${escapeHtml(p.gold ?? 0)}</b><br>
          Capital: ${escapeHtml(p.capital ?? "-")}<br>
          Faction: ${escapeHtml(p.faction ?? "-")}
        </div>
      `;
      playersDiv.appendChild(div);
    }

    // 3) Check Leaflet loaded
    if (typeof L === "undefined") {
      throw new Error("Leaflet didn't load (L is undefined). Check the Leaflet <script> tag comes before script.js in index.html.");
    }

    // 4) Validate map config
    const w = Number(state.map?.width);
    const h = Number(state.map?.height);
    const img = state.map?.image;

    if (!img) throw new Error("state.json missing map.image (e.g. 'map.jpg')");
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("state.json map.width/height must be numbers");

    // 5) Create / recreate map safely
    const mapDiv = document.getElementById("map");
    if (!mapDiv) throw new Error("Missing <div id='map'> in index.html");

    // If a map already exists (script re-run), remove it cleanly
    if (window.__MAPSO_MAP__) {
      try { window.__MAPSO_MAP__.remove(); } catch {}
      window.__MAPSO_MAP__ = null;
    }

    setStatus("initialising map…");

    const map = L.map("map", { crs: L.CRS.Simple, minZoom: -2, maxZoom: 2 });
    window.__MAPSO_MAP__ = map;

    const bounds = [[0, 0], [h, w]];
    L.imageOverlay(img, bounds).addTo(map);
    map.fitBounds(bounds);

    // 6) Coordinate picker: click to get x/y
    map.on("click", (e) => {
      const x = Math.round(e.latlng.lng); // lng = x in CRS.Simple
      const y = Math.round(e.latlng.lat); // lat = y in CRS.Simple

      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<b>x:</b> ${x} &nbsp; <b>y:</b> ${y}<br><small>Put these into state.json → markers</small>`)
        .openOn(map);

      console.log(`COORDS: { "x": ${x}, "y": ${y} }`);
      setStatus(`picked coords: x=${x}, y=${y}`);
    });

    // 7) Draw markers
    for (const m of (state.markers || [])) {
      const prov = (state.provinces || {})[m.provinceId];
      if (!prov) continue;

      const ownerKey = prov.owner;
      const owner = (state.players || {})[ownerKey];

      L.circleMarker([Number(m.y), Number(m.x)], { radius: 7, weight: 2 })
        .addTo(map)
        .bindPopup(`
          <b>${escapeHtml(prov.name || m.provinceId)}</b><br>
          Owner: ${escapeHtml(owner?.name || ownerKey || "Unclaimed")}<br>
          Income: ${escapeHtml(prov.income ?? 0)}<br>
          Buildings: ${escapeHtml((prov.buildings || []).join(", ") || "-")}
        `);
    }

    setStatus("ready ✓ (map loaded)");
  } catch (err) {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
    setTurn("ERR");
  }
})();
