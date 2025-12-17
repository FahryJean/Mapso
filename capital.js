function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

// For now we only support Iron Pearl, per your request.
// Later we can make this generic (e.g., `${provinceId}.jpg`).
const CAPITAL_IMAGES = {
  iron_pearl: "ironpearl.jpg"
};

function initCapitalMap(imageUrl) {
  if (typeof L === "undefined") throw new Error("Leaflet not loaded (L undefined).");

  // Load image first to use its natural pixel dimensions for CRS.Simple bounds.
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;

      const bounds = [[0, 0], [h, w]];

      const map = L.map("cap-map", {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0
      });

      L.imageOverlay(imageUrl, bounds).addTo(map);
      map.fitBounds(bounds);

      resolve(map);
    };
    img.onerror = () => reject(new Error(`Could not load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}

setStatus("loading state.json…");

const provinceId = getQueryParam("id") || "";
if (!provinceId) {
  setStatus("ERROR: missing ?id=provinceId");
  throw new Error("Missing id query parameter");
}

fetch("state.json", { cache: "no-store" })
  .then(r => {
    if (!r.ok) throw new Error(`state.json failed: HTTP ${r.status}`);
    return r.json();
  })
  .then(async (state) => {
    const prov = state.provinces?.[provinceId];
    if (!prov) throw new Error(`Unknown province id: ${provinceId}`);

    const ownerKey = prov.owner;
    const owner = state.players?.[ownerKey];

    // Header title
    const t = document.getElementById("cap-title");
    if (t) t.textContent = prov.name ?? provinceId;

    // LEFT: repeat the tooltip info from the main map
    const capInfo = document.getElementById("cap-info");
    if (capInfo) {
      capInfo.innerHTML = `
        <div><b>${escapeHtml(prov.name ?? provinceId)}</b></div>
        <div>Type: ${escapeHtml(prov.type ?? "—")}</div>
        <div>Owner: ${escapeHtml(owner?.name || ownerKey || "Unclaimed")}</div>
        <div>Income: ${escapeHtml(prov.income ?? 0)}</div>
        <div style="margin-top:10px;"><b>Buildings</b></div>
        <div>${escapeHtml((prov.buildings || []).join(", ") || "-")}</div>
      `;
    }

    // RIGHT: built buildings + 6 placeholder possible buildings
    const capBuildings = document.getElementById("cap-buildings");
    const existing = prov.buildings || [];
    const possible = [
      "Blacksmith",
      "Administrative Hall",
      "Marketplace",
      "Army Quarters",
      "Armoursmith",
      "Cathedral"
    ];

    if (capBuildings) {
      capBuildings.innerHTML = `
        <div style="margin-bottom:10px;"><b>Built</b></div>
        <ul>
          ${existing.length ? existing.map(b => `<li>${escapeHtml(b)}</li>`).join("") : "<li>-</li>"}
        </ul>

        <div style="margin:12px 0 10px;"><b>Possible Buildings</b></div>
        <ul>
          ${possible.map(b => `<li>${escapeHtml(b)}</li>`).join("")}
        </ul>
      `;
    }

    // CENTRE: the capital image map
    const imgFile = CAPITAL_IMAGES[provinceId];
    if (!imgFile) throw new Error(`No capital image mapped for ${provinceId}. Add it to CAPITAL_IMAGES.`);

    await initCapitalMap(imgFile);

    setStatus("ready ✓");
  })
  .catch(err => {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
  });
