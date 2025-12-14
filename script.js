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

// ---- UI: move buttons (simple placeholder behaviour) ----
function wireMoves() {
  const btns = document.querySelectorAll(".move-btn");
  btns.forEach(btn => {
    btn.addEventListener("click", () => {
      const n = btn.getAttribute("data-move");
      const out = document.getElementById(`move-outcome-${n}`);
      if (out) out.textContent = `Outcome for Move ${n}`;
    });
  });
}

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

    // ---- Players panel ----
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
      const levies = (p.levies ?? 0);

      div.innerHTML = `
        <b>${escapeHtml(p.name ?? key)}</b><br>
        Gold: ${escapeHtml(p.gold ?? 0)}<br>
        Levies/Patrols: ${escapeHtml(levies)}<br>
        Capital: ${escapeHtml(capitalName)}
      `;
      playersDiv.appendChild(div);
    }

    // ---- Map ----
    if (typeof L === "undefined") throw new Error("Leaflet not loaded (L undefined).");

    const w = Number(state.map?.width);
    const h = Number(state.map?.height);
    const img = state.map?.image;

    if (!img) throw new Error("state.map.image missing (e.g. map.jpg)");
    if (!Number.isFinite(w) || !Number.isFinite(h)) throw new Error("state.map.width/height must be numbers");

    setStatus("initialising map…");

    const map = L.map("map", { crs: L.CRS.Simple, minZoom: -2, maxZoom: 2 });
    const bounds = [[0, 0], [h, w]];
    L.imageOverlay(img, bounds).addTo(map);
    map.fitBounds(bounds);

    // Coordinate picker (click map to get x/y)
    map.on("click", (e) => {
      const x = Math.round(e.latlng.lng);
      const y = Math.round(e.latlng.lat);

      L.popup()
        .setLatLng(e.latlng)
        .setContent(`<b>x:</b> ${x} <b>y:</b> ${y}<br><small>Put these in state.json markers</small>`)
        .openOn(map);

      console.log(`COORDS: { "x": ${x}, "y": ${y} }`);
    });

    // ---- Markers ----
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

    // ---- Moves panel ----
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
