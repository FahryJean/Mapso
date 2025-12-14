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

function safeJoin(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "-";
  return arr.join(", ");
}

fetch("state.json", { cache: "no-store" })
  .then(r => {
    if (!r.ok) throw new Error(`Failed to load state.json (HTTP ${r.status})`);
    return r.json();
  })
  .then(state => {
    setTurn(state.turn ?? "?");

    /* ---------------- PLAYERS LIST ---------------- */
    const playersDiv = document.getElementById("players");
    if (!playersDiv) throw new Error("Missing <div id='players'> in index.html");
    playersDiv.innerHTML = "";

    for (const [key, p] of Object.entries(state.players || {})) {
      const div = document.createElement("div");
      div.className = "player";
      div.style.borderLeft = `10px solid ${p.colour || "#000"}`;
      div.style.paddingLeft = "10px";
      div.style.marginBottom = "22px"; // extra space between players

      const capitalName = state.provinces?.[p.capital]?.name ?? p.capital ?? "-";

      div.innerHTML = `
        <div style="font-weight:700">${escapeHtml(p.name ?? key)}</div>
        <div style="margin-top:6px; line-height:1.3">
          Gold: <b>${escapeHtml(p.gold ?? 0)}</b><br>
          Capital: ${escapeHtml(capitalName)}
        </div>
      `;
      playersDiv.appendChild(div);
    }

    /* ---------------- MAP ---------------- */
    if (typeof L === "undefined") {
      throw new Error("Leaflet didn't load (L is undefined). Check the Leaflet <script> tag in index.html.");
    }

    const mapDiv = document.getElementById("map");
    if (!mapDiv) throw new Error("Missing <div id='map'> in index.html");

    const w = Number(state.map?.width);
    const h = Number(state.map?.height);
    const img = state.map?.image;

    if (!img) throw new Error("state.json missing map.image (e.g. 'map.jpg')");
    if (!Number.isFinite(w) || !Number.isFinite(h)) {
      throw new Error("state.json map.width and map.height must be numbers");
    }

    const map = L.map("map", {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,
      zoomSnap: 0.25
    });

    const bounds = [[0, 0], [h, w]];
    L.imageOverlay(img, bounds).addTo(map);
    map.fitBounds(bounds);

    /* ---------------- COORDINATE PICKER (fixed) ---------------- */
    map.on("click", (e) => {
      const x = Math.round(e.latlng.lng); // x = lng in CRS.Simple
      const y = Math.round(e.latlng.lat); // y = lat in CRS.Simple

      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<b>x:</b> ${x} &nbsp; <b>y:</b> ${y}<br><small>Put these in state.json → markers</small>`)
        .openOn(map);

      console.log(`COORDS: { "x": ${x}, "y": ${y} }`);
    });

    /* ---------------- MARKERS ---------------- */
    for (const m of (state.markers || [])) {
      const prov = state.provinces?.[m.provinceId];
      if (!prov) continue;

      const ownerKey = prov.owner;
      const owner = state.players?.[ownerKey];
      const fill = owner?.colour ?? "#777777";

      const type = prov.type || "Province";
      const radius =
        type === "City" ? 9 :
        type === "Keep" ? 7 :
        6;

      L.circleMarker([Number(m.y), Number(m.x)], {
        radius: radius,
        weight: 2,
        color: "#000",
        fillColor: fill,
        fillOpacity: 0.9
      })
        .addTo(map)
        .bindPopup(`
          <b>${escapeHtml(prov.name || m.provinceId)}</b><br>
          Type: ${escapeHtml(type)}<br>
          Owner: ${escapeHtml(owner?.name || ownerKey || "Unclaimed")}<br>
          Income: ${escapeHtml(prov.income ?? 0)}<br>
          Buildings: ${escapeHtml(safeJoin(prov.buildings))}
        `);
    }
  })
  .catch(err => {
    console.error(err);
    setTurn("ERR");
    // If you have a status element, this won't hurt; otherwise it silently does nothing.
    const statusEl = document.getElementById("status");
    if (statusEl) statusEl.textContent = `ERROR: ${err.message}`;
  });
