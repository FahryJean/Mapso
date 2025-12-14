function setTurn(value) {
  const el = document.getElementById("turn");
  if (el) el.textContent = value;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

fetch("state.json", { cache: "no-store" })
  .then((r) => {
    if (!r.ok) throw new Error("Failed to load state.json");
    return r.json();
  })
  .then((state) => {
    setTurn(state.turn ?? "?");

    /* ---------------- PLAYERS LIST ---------------- */
    const playersDiv = document.getElementById("players");
    if (!playersDiv) throw new Error("Missing <div id='players'> in index.html");
    playersDiv.innerHTML = "";

    const players = state.players || {};
    const provinces = state.provinces || {};

    for (const [key, p] of Object.entries(players)) {
      const colour = p.colour || "#000000";
      const capitalName = provinces[p.capital]?.name ?? p.capital ?? "-";

      const div = document.createElement("div");
      div.style.borderLeft = `10px solid ${colour}`;
      div.style.padding = "6px 8px";
      div.style.marginBottom = "20px"; // <-- extra space between players
      div.style.background = "rgba(255,255,255,0.35)";
      div.style.borderRadius = "8px";

      div.innerHTML = `
        <b>${escapeHtml(p.name || key)}</b><br>
        Gold: ${escapeHtml(p.gold ?? 0)}<br>
        Capital: ${escapeHtml(capitalName)}
      `;

      playersDiv.appendChild(div);
    }

    /* ---------------- MAP ---------------- */
    if (typeof L === "undefined") {
      throw new Error("Leaflet didn't load (L is undefined). Check Leaflet <script> tag in index.html.");
    }

    const mapEl = document.getElementById("map");
    if (!mapEl) throw new Error("Missing <div id='map'> in index.html");

    const w = Number(state.map?.width);
    const h = Number(state.map?.height);
    const img = state.map?.image;

    if (!img) throw new Error("state.json missing map.image (e.g. 'map.jpg')");
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("state.json map.width/height must be numbers");

    const map = L.map("map", { crs: L.CRS.Simple, minZoom: -2, maxZoom: 2 });
    const bounds = [[0, 0], [h, w]];

    L.imageOverlay(img, bounds).addTo(map);
    map.fitBounds(bounds);

    /* ---------------- MARKERS ---------------- */
    const markers = state.markers || [];

    for (const m of markers) {
      const prov = provinces[m.provinceId];
      if (!prov) continue;

      const owner = players[prov.owner];
      const fill = owner?.colour || "#777777";

      const type = prov.type || "Site";
      const income = prov.income ?? 0;
      const buildings = Array.isArray(prov.buildings) ? prov.buildings : [];

      const radius =
        type === "City" ? 10 :
        type === "Keep" ? 8 :
        7;

      // Make white visible: keep strong black stroke
      L.circleMarker([Number(m.y), Number(m.x)], {
        radius,
        weight: 3,
        color: "#000",
        fillColor: fill,
        fillOpacity: 0.95
      })
        .addTo(map)
        .bindPopup(`
          <b>${escapeHtml(prov.name || m.provinceId)}</b><br>
          Type: ${escapeHtml(type)}<br>
          Owner: ${escapeHtml(owner?.name || prov.owner || "Unclaimed")}<br>
          Income: ${escapeHtml(income)}<br>
          Buildings: ${escapeHtml(buildings.join(", ") || "-")}
        `);
    }

    /* --------- COORDINATE PICKER (click map to get x/y) --------- */
    map.on("click", (e) => {
      const x = Math.round(e.latlng.lng);
      const y = Math.round(e.latlng.lat);

      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<b>x:</b> ${x} &nbsp; <b>y:</b> ${y}<br><small>Copy these into state.json → markers</small>`)
        .openOn(map);

      console.log(`COORDS: { "x": ${x}, "y": ${y} }`);
    });
  })
  .catch((err) => {
    console.error(err);
    setTurn("ERR");
  });
