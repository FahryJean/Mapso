fetch("state.json", { cache: "no-store" })
  .then(r => r.json())
  .then(state => {
    document.getElementById("turn").textContent = state.turn;

    const playersDiv = document.getElementById("players");
    for (const p of Object.values(state.players)) {
      const d = document.createElement("div");
      d.innerHTML = `<b>${p.name}</b><br>Gold: ${p.gold}`;
      playersDiv.appendChild(d);
    }

    const map = L.map("map", { crs: L.CRS.Simple });
    const bounds = [[0, 0], [state.map.height, state.map.width]];
    L.imageOverlay(state.map.image, bounds).addTo(map);
    map.fitBounds(bounds);

    state.markers.forEach(m => {
      const prov = state.provinces[m.provinceId];
      L.circleMarker([m.y, m.x], { radius: 6 })
        .addTo(map)
        .bindPopup(
          `<b>${prov.name}</b><br>
           Owner: ${state.players[prov.owner].name}<br>
           Income: ${prov.income}<br>
           Buildings: ${prov.buildings.join(", ")}`
        );
    });
  });
