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

// Prove script.js is executing at all:
setTurn("JS OK");
setStatus("loading state.json…");

fetch("state.json", { cache: "no-store" })
  .then(r => {
    if (!r.ok) throw new Error(`state.json failed: HTTP ${r.status}`);
    return r.json();
  })
  .then(state => {
    setStatus("state loaded ✓");
    setTurn(state.turn ?? "?");

    // Render players
    const playersDiv = document.getElementById("players");
    if (!playersDiv) throw new Error("Missing <div id='players'> in index.html");

    playersDiv.innerHTML = "";
    for (const [key, p] of Object.entries(state.players || {})) {
      const div = document.createElement("div");
      div.className = "player";
      div.innerHTML = `
        <div class="name">${escapeHtml(p.name ?? key)}</div>
        <div class="meta">Gold: <b>${escapeHtml(p.gold ?? 0)}</b><br>
        Capital: ${escapeHtml(p.capital ?? "-")}<br>
        Faction: ${escapeHtml(p.faction ?? "-")}</div>
      `;
      playersDiv.appendChild(div);
    }

    // Check Leaflet loaded
    if (typeof L === "undefined") {
      throw new Error("Leaflet didn't load (L is undefined). Check the Leaflet <script> tag in index.html.");
    }

    // Create map
    const mapDiv = document.getElementById("map");
    if (!mapDiv) throw new Error("Missing <div id='map'> in index.html");

    const w = Number(state.map?.width);
    const h = Number(state.map?.height);
    const img = state.map?.image;

    if (!img) throw new Error("state.json missing map.image (should be 'map.jpg')");
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("state.json map.width/height must be numbers");

    setStatus("initialising map…");

    const map = L.map("map", { crs: L.CRS.Simple, minZoom: -2, maxZoom: 2 });
    const bounds = [[0, 0], [h, w]];

    L.imageOverlay(img, bounds).addTo(map);
    map.fitBounds(bounds);

    // --- COORDINATE PICKER (click map to get x/y) ---
map.on("click", (e) => {
  const x = Math.round(e.latlng.lng); // lng = x in CRS.Simple
  const y = Math.round(e.latlng.lat); // lat = y in CRS.Simple

  // Show a popup where you clicked
  L.popup()
    .setLatLng(e.latlng)
    .setContent(`<b>x:</b> ${x} <b>y:</b> ${y}<br><small>Put these in state.json markers</small>`)
    .openOn(map);

  // Also log to console for easy copy
  console.log(`COORDS: { "x": ${x}, "y": ${y} }`);
});


    // Markers
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
  })
  .catch(err => {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
    // Keep Turn showing something useful
    setTurn("ERR");
  });
