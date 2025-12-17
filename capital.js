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

/**
 * Optional manual overrides:
 * If a capital image doesn't follow the default naming convention,
 * map it here.
 */
const CAPITAL_IMAGES = {
  // Example override:
  // iron_pearl: "ironpearl.jpg"
};

function capitalImageFor(provinceId) {
  return CAPITAL_IMAGES[provinceId] || `${provinceId}.jpg`;
}

/* ---------------- ICONS ---------------- */

function slugifyBuildingName(name) {
  // "Imperial Jewel (X)" -> "imperial_jewel"
  // "Army Quarters" -> "army_quarters"
  // "Zbab's Hold" -> "zbabs_hold"
  return String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")          // remove "(X)" "(V)" etc
    .replace(/[^a-z0-9]+/g, "_")        // non-alnum -> _
    .replace(/^_+|_+$/g, "");           // trim _
}

function buildingIconPath(buildingName) {
  const slug = slugifyBuildingName(buildingName);
  return `icons/${slug}.png`;
}

function renderBuildingList(names) {
  if (!names || names.length === 0) return `<div class="building-list"><div class="building-item"><div class="building-name">-</div></div></div>`;

  const items = names.map(n => {
    const src = buildingIconPath(n);
    return `
      <div class="building-item">
        <img class="building-icon" src="${escapeHtml(src)}" alt="">
        <div class="building-name">${escapeHtml(n)}</div>
      </div>
    `;
  }).join("");

  return `<div class="building-list">${items}</div>`;
}

/* ---------------- FLAVOUR TEXT ---------------- */

function hasToken(buildings, token) {
  return (buildings || []).some(b => String(b).includes(token));
}

function cityFlavourText(prov) {
  const buildings = prov.buildings || [];
  const hasX = hasToken(buildings, "X");
  const hasV = hasToken(buildings, "V");

  // Priority: X (legendary) > V (thriving) > default (struggling)
  if (hasX) {
    return (
      `The City of ${prov.name || "this place"} astonishes all that visit. ` +
      `Streets are filled with bustling activity, and the markets spill over with goods from every corner of the Mapso. ` +
      `Fine masonry, proud banners, and the steady rhythm of craftsmen at work make it clear: this is no ordinary city. ` +
      `Even travellers who arrived weary leave with their eyes widened — and with stories worth telling.`
    );
  }

  if (hasV) {
    return (
      `${prov.name || "This city"} feels like a place on the rise. ` +
      `The air carries the sound of hammer and saw, and new faces arrive by road and river — immigrants and opportunists drawn by promise. ` +
      `Old quarters are being renewed, trade grows steadier, and hope spreads quietly through the streets. ` +
      `It is not yet a jewel… but it is moving in the right direction.`
    );
  }

  return (
    `You can see people doing their best to get by — but it is nearly not enough. ` +
    `Houses need repairs, shutters hang crooked, and the poorer lanes feel one hard winter away from collapse. ` +
    `Work is scarce, tempers run thin, and every improvement seems to demand coin the city does not have. ` +
    `Still… there is resilience here, waiting for a stronger hand to guide it.`
  );
}

/* ---------------- MAP ---------------- */

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
        zoomControl: true,
        minZoom: -10,   // temporary; we’ll clamp after we compute best zoom
        maxZoom: 4,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0
      });

      L.imageOverlay(imageUrl, bounds).addTo(map);

      // --- Key bit: “zoom to fill” the panel, so you don’t see loads of empty around the image.
      // getBoundsZoom(bounds, false) returns a zoom that can “cover” the viewport (may crop edges),
      // which is exactly what you want to eliminate blank space.
      map.whenReady(() => {
        const coverZoom = map.getBoundsZoom(bounds, false);
        map.setMinZoom(coverZoom);   // prevents zooming out to see empty nothingness
        map.setZoom(coverZoom, { animate: false });

        // Center and keep view inside bounds (no drifting)
        map.panInsideBounds(bounds, { animate: false });
      });

      resolve(map);
    };
    img.onerror = () => reject(new Error(`Could not load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}

/* ---------------- INIT ---------------- */

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

    const existing = prov.buildings || [];
    const possible = [
      "Blacksmith",
      "Administrative Hall",
      "Marketplace",
      "Army Quarters",
      "Armoursmith",
      "Cathedral"
    ];

    // LEFT: repeat tooltip info + narrative under “Buildings”
    const capInfo = document.getElementById("cap-info");
    if (capInfo) {
      capInfo.innerHTML = `
        <div><b>${escapeHtml(prov.name ?? provinceId)}</b></div>
        <div>Type: ${escapeHtml(prov.type ?? "—")}</div>
        <div>Owner: ${escapeHtml(owner?.name || ownerKey || "Unclaimed")}</div>
        <div>Income: ${escapeHtml(prov.income ?? 0)}</div>

        <div style="margin-top:10px;"><b>Buildings</b></div>
        <div style="margin-top:6px;">${escapeHtml(cityFlavourText(prov))}</div>

        <div style="margin-top:10px;"><b>Existing Buildings</b></div>
        ${renderBuildingList(existing)}
      `;
    }

    // RIGHT: Built + Possible (with icons + spacing)
    const capBuildings = document.getElementById("cap-buildings");
    if (capBuildings) {
      capBuildings.innerHTML = `
        <div style="margin-bottom:6px;"><b>Built</b></div>
        ${renderBuildingList(existing)}

        <div style="margin:14px 0 6px;"><b>Possible Buildings</b></div>
        ${renderBuildingList(possible)}
      `;
    }

    // CENTRE: the capital image map
    const imgFile = capitalImageFor(provinceId);
    await initCapitalMap(imgFile);

    // If icons are missing, don’t hard-fail; they’ll just show broken images in the UI.
    // Optional: we can add a JS onerror fallback to a default “unknown.png” later.

    setStatus("ready ✓");
  })
  .catch(err => {
    console.error(err);
    setStatus(`ERROR: ${err.message}`);
  });
