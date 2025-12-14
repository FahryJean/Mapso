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

fetch("state.json", { cache: "no-store" })
  .then(r => {
    if (!r.ok) throw new Error("Failed to load state.json");
    return r.json();
  })
  .then(state => {
    setTurn(state.turn ?? "?");

    /* ---------------- PLAYERS LIST ---------------- */
    const playersDiv = document.getElementById("players");
    playersDiv.innerHTML = "";

    for (const [key, p] of Object.entries(state.players)) {
      const div = document.createElement("div");
      div.style.borderLeft = `8px solid ${p.colour}`;
      div.style.paddingLeft = "8px";
      div.style.marginBottom = "12px";

      div.innerHTML = `
        <b>${escapeHtml(p.name)}</b><br>
        Gold: ${p.gold}<br>
        Capital: ${escapeHtml(
          state.provinces[p.capital]?.name ?? "-"
        )}
      `;
      playersDiv.appendChild(div);
    }

    /* ---------------- MAP ---------------- */
    const map = L.map("map", {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2
    });

    const bounds = [[0, 0], [state.map.height, state.map.width]];
    L.imageOverlay(state.map.image, bounds).addTo(map);
    map.fitBounds(bounds);

    /* ---------------- MARKERS ---------------- */
    for (const m of state.markers) {
      const prov = state.provinces[m.provinceId];
      if (!prov) continue;

      const owner = state.players[prov.owner];
      const colour = owner?.colour ?? "#000000";

      const radius =
        prov.type === "City" ? 9 :
        prov.type === "Keep" ? 7 : 6;

      L.circleMarker([m.y, m.x], {
        radius: radius,
        weight: 2,
        color: "#000",
        fillColor: colour,
        fillOpacity: 0.9
      })
        .addTo(map)
        .bindPopup(`
          <b>${escapeHtml(prov.name)}</b><br>
          Type: ${prov.type}<br>
          Owner: ${escapeHtml(owner?.name ?? "Unclaimed")}<br>
          Income: ${prov.income}<br>
          Buildings: ${escapeHtml(prov.buildings.join(", "))}
        `);
    }

    /* --------- COORDINATE PICKER (optional) --------- */
    map.on("click", e => {
      const x = Math.round(e.latlng.lng);
      const y = Math.round(e.latlng.lat);
      console.log(`{ "x": ${x}, "y": ${y} }`);
    });
  })
  .catch(err => {
    console.error(err);
    setTurn("ERR");
  });
