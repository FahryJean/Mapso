function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function safe(text) {
  return String(text ?? "");
}

(async function main() {
  try {
    setStatus("Script started. Fetching state.json…");

    const r = await fetch("state.json?v=2", { cache: "no-store" });
    if (!r.ok) throw new Error(`state.json fetch failed: HTTP ${r.status}`);
    const state = await r.json();

    // Update turn immediately (so you KNOW JS is running)
    const turnEl = document.getElementById("turn");
    if (!turnEl) throw new Error('Missing element: id="turn"');
    turnEl.textContent = state.turn;

    // Render players
    const playersDiv = document.getElementById("players");
    if (!playersDiv) throw new Error('Missing element: id="players"');
    playersDiv.innerHTML = "";

    Object.entries(state.players || {}).forEach(([key, p]) => {
      const div = document.createElement("div");
      div.className = "player";
      div.innerHTML = `<b>${safe(p.name || key)}</b><br>Gold: ${safe(p.gold)}<br>Capital: ${safe(p.capital)}<br>Faction: ${safe(p.faction)}`;
      playersDiv.appendChild(div);
    });

    // Verify Leaflet loaded
    if (typeof L === "undefined") {
      throw new Error("Leaflet failed to load (L is undefined). Check unpkg access / blocked resources.");
    }

    // Map init
    const mapDiv = document.getElementById("map");
    if (!mapDiv) throw new Error('Missing element: id="map"');

    const width = Number(state.map?.width);
    const height = Number(state.map?.height);
    const image = state.map?.image;

    if (!image) throw new Error('Missing state.map.image (e.g. "map.jpg")');
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      throw new Error("Invalid state.map.width/height (must be numbers)");
    }

    const map = L.map("map", { crs: L.CRS.Simple, minZoom: -2, zoomSnap: 0.25 });
    const bounds = [[0, 0], [height, width]];

    setStatus(`State loaded. Turn ${state.turn}. Loading image overlay: ${image} (${width}×${height})…`);

    L.imageOverlay(image + "?v=2", bounds).addTo(map);
    map.fitBounds(bounds);

    // Markers
    (state.markers || []).forEach(m => {
      const prov = (state.provinces || {})[m.provinceId];
      if (!prov) return;

      const ownerKey = prov.owner;
      const owner = (state.players || {})[ownerKey];

      L.circleMarker([Number(m.y), Number(m.x)], { radius: 7, weight: 2 })
        .addTo(map)
        .bindPopup(
          `<b>${safe(prov.name)}</b><br>` +
          `Owner: ${safe(owner?.name || ownerKey)}<br>` +
          `Income: ${safe(prov.income)}<br>` +
          `Buildings: ${safe((prov.buildings || []).join(", "))}`
        );
    });

    setStatus("OK. Map rendered.");
  } catch (e) {
    console.error(e);
    setStatus("ERROR:\n" + (e && e.stack ? e.stack : e));
  }
})();
