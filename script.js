// Load the game state (no cache so GitHub Pages updates immediately)
fetch("state.json", { cache: "no-store" })
  .then(response => {
    if (!response.ok) {
      throw new Error("Failed to load state.json");
    }
    return response.json();
  })
  .then(state => {
    // -----------------------------
    // Update turn number
    // -----------------------------
    const turnEl = document.getElementById("turn");
    if (turnEl) {
      turnEl.textContent = state.turn;
    }

    // -----------------------------
    // Render players list
    // -----------------------------
    const playersDiv = document.getElementById("players");
    playersDiv.innerHTML = "";

    Object.values(state.players).forEach(player => {
      const div = document.createElement("div");
      div.innerHTML = `
        <b>${player.name}</b><br>
        Gold: ${player.gold}<br>
        Capital: ${player.capital}<br>
        Faction: ${player.faction}
      `;
      div.style.marginBottom = "10px";
      playersDiv.appendChild(div);
    });

    // -----------------------------
    // Create Leaflet map
    // -----------------------------
    const map = L.map("map", {
      crs: L.CRS.Simple,
      minZoom: -2
    });

    const width = state.map.width;
    const height = state.map.height;

    // Leaflet image bounds: [ [y1, x1], [y2, x2] ]
    const bounds = [[0, 0], [height, width]];

    // Add the image overlay (THIS IS YOUR MAP.JPG)
    L.imageOverlay(state.map.image, bounds).addTo(map);
    map.fitBounds(bounds);

    // -----------------------------
    // Add markers (capitals / provinces)
    // --------------------
