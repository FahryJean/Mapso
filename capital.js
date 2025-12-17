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
  // Example:
  // iron_pearl: "ironpearl.jpg"
};

/* ---------------- ICONS ---------------- */

function slugifyBuildingName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")   // remove "(X)" "(V)" etc
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildingIconPath(buildingName) {
  const slug = slugifyBuildingName(buildingName);
  return `icons/${slug}.png`;
}

function renderBuildingList(names) {
  if (!names || names.length === 0) {
    return `<div class="building-list"><div class="building-item"><div class="building-name">-</div></div></div>`;
  }

  const items = names.map(n => {
    const src = buildingIconPath(n);
    return `
      <div class="building-item">
        <img class="building-icon" src="${escapeHtml(src)}" alt=""
             onerror="this.style.display='none'">
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

  if (hasX) {
    return (
      `The City of ${prov.name || "this place"} astonishes all that visit. ` +
      `Streets are filled with bustling activity, and the markets spill over with goods from every corner of the Mapso. ` +
      `Craftsmen work late by lantern-light, envoys come and go, and even weary travellers leave with their eyes widened — and with stories worth telling.`
    );
  }

  if (hasV) {
    return (
      `${prov.name || "This city"} feels like a place on the rise. ` +
      `New faces arrive by road and river — immigrants and opportunists drawn by promise. ` +
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

/* ---------------- IMAGE PICKING ---------------- */

async function urlExists(url) {
  try {
    const r = await fetch(url, { method: "GET", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

async function pickCapitalImage(provinceId) {
  const override = CAPITAL_IMAGES[provinceId];
  const candidates = [
    override,
    `${provinceId}.jpg`,                    // iron_pearl.jpg
    `${provinceId.replaceAll("_", "")}.jpg` // ironpearl.jpg
  ].filter(Boolean);

  for (const c of candidates) {
    if (await urlExists(c)) return c;
  }

  throw new Error(`No capital image found. Tried: ${candidates.join(", ")}`);
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
    const owner = state.players?.[o]()
