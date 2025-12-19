import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rvtaogqygqanshxpjrer.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g2tgBXMQmNHj0UNSf5MGuA_whabxtE_";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fallback only if DB read fails (keeps page usable even if RLS breaks temporarily)
const FALLBACK_FACTIONS = [
  { id: "imperial_core", display_name: "Imperial Core" },
  { id: "southport", display_name: "Southport" },
  { id: "flatland_tribes", display_name: "Flatland Tribes" }
];

function $(id){ return document.getElementById(id); }

function fmtTime(ts) {
  try { return new Date(ts).toUTCString(); } catch { return String(ts); }
}

/* ---------------- DB: factions + turn status ---------------- */

async function loadFactions() {
  const sel = $("faction");
  sel.innerHTML = "";

  const { data, error } = await supabase
    .from("factions")
    .select("id, display_name")
    .order("display_name", { ascending: true });

  const factions = (!error && Array.isArray(data) && data.length) ? data : FALLBACK_FACTIONS;
  if (error) console.warn("Failed to load factions from DB, using fallback:", error);

  for (const f of factions) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.display_name || f.id;
    sel.appendChild(opt);
  }
}

async function loadTurnStatus() {
  const { data, error } = await supabase.rpc("turn_status");
  if (error) {
    $("statusBox").textContent = `ERROR: ${error.message}`;
    return;
  }
  $("statusBox").innerHTML = `
    <div><b>Turn:</b> ${data.turn_number}</div>
    <div><b>Phase:</b> ${data.phase}</div>
    <div><b>Faction submissions:</b> ${data.submitted_count} / ${data.faction_count}</div>
    <div><b>Closes:</b> ${fmtTime(data.closes_at)}</div>
  `;
}

/* ---------------- Payload + submit ---------------- */

function buildPayload() {
  const eventId = $("event_id").value.trim();
  const eventChoice = $("event_choice").value.trim();

  const improveSettlement = $("improve_settlement").value.trim();
  const improveBuilding = $("improve_building").value.trim();

  const campaignTarget = $("campaign_target").value.trim();
  const campaignNote = $("campaign_note").value.trim();

  return {
    event_response: eventId || eventChoice ? { event_id: eventId, choice: eventChoice } : null,
    improvement: improveSettlement || improveBuilding ? { settlement_id: improveSettlement, building: improveBuilding } : null,
    campaign: campaignTarget || campaignNote ? { target_settlement_id: campaignTarget, note: campaignNote } : null
  };
}

function validatePayload(payload) {
  const errs = [];
  if (!payload.event_response || !payload.event_response.event_id || !payload.event_response.choice) {
    errs.push("Event response is required: fill Event ID + Choice.");
  }
  if (!payload.improvement || !payload.improvement.settlement_id || !payload.improvement.building) {
    errs.push("Improvement is required: fill Settlement ID + Building.");
  }
  if (payload.campaign && payload.campaign.note && !payload.campaign.target_settlement_id) {
    errs.push("Campaign: if you write Notes, please include a Target settlement ID.");
  }
  return errs;
}

function updateChecklist(payload) {
  let done = 0;
  if (payload.event_response && payload.event_response.event_id && payload.event_response.choice) done++;
  if (payload.improvement && payload.improvement.settlement_id && payload.improvement.building) done++;
  const campaignChosen = !!(payload.campaign && payload.campaign.target_settlement_id);
  if (campaignChosen) done++;

  const successChance = campaignChosen ? "50% (campaign chosen)" : "100% (no campaign)";
  $("checkBox").innerHTML = `
    <div><b>Completed actions:</b> ${done} / 3</div>
    <div style="margin-top:8px;"><b>Improvement success chance:</b> ${successChance}</div>
  `;
}

async function submitTurn() {
  $("out").textContent = "";

  const faction = $("faction").value;
  const passcode = $("passcode").value;

  const payload = buildPayload();
  updateChecklist(payload);

  const errs = validatePayload(payload);
  if (errs.length) {
    $("out").innerHTML = `<div style="color:#7a1f1f;"><b>Fix these:</b><br>${errs.map(e => `• ${e}`).join("<br>")}</div>`;
    return;
  }

  const { error } = await supabase.rpc("submit_turn", {
    p_faction_id: faction,
    p_passcode: passcode,
    p_payload: payload
  });

  if (error) {
    $("out").textContent = `ERROR: ${error.message}`;
  } else {
    $("out").textContent = "Submitted ✓";
    await loadTurnStatus();
  }
}

/* ---------------- MAP → ACTION SHORTCUTS (#5) ---------------- */

let selected = null; // { kind: 'settlement'|'event', id, name }

function setSelected(next) {
  selected = next;
  const label = $("selectedLabel");

  if (!selected) {
    label.textContent = "—";
  } else {
    const kind = selected.kind === "event" ? "Event" : "Settlement";
    label.innerHTML = `${kind}: <b>${escapeHtml(selected.name || selected.id)}</b> <code>${escapeHtml(selected.id)}</code>`;
  }

  const isSettlement = selected && selected.kind === "settlement";
  const isEvent = selected && selected.kind === "event";

  $("btnImproveHere").disabled = !isSettlement;
  $("btnCampaignHere").disabled = !isSettlement;
  $("btnRespondEvent").disabled = !isEvent;
  $("btnClearSel").disabled = !selected;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wireSelectionButtons() {
  $("btnImproveHere").addEventListener("click", () => {
    if (!selected || selected.kind !== "settlement") return;
    $("improve_settlement").value = selected.id;
    $("improve_building").focus();
    updateChecklist(buildPayload());
  });

  $("btnCampaignHere").addEventListener("click", () => {
    if (!selected || selected.kind !== "settlement") return;
    $("campaign_target").value = selected.id;
    $("campaign_note").focus();
    updateChecklist(buildPayload());
  });

  $("btnRespondEvent").addEventListener("click", () => {
    if (!selected || selected.kind !== "event") return;
    $("event_id").value = selected.id;
    $("event_choice").focus();
    updateChecklist(buildPayload());
  });

  $("btnClearSel").addEventListener("click", () => setSelected(null));
}

async function initPlayerMap() {
  // Leaflet is loaded as a classic script and exposes window.L
  if (!window.L) {
    console.warn("Leaflet not loaded; map shortcuts disabled.");
    return;
  }

  const res = await fetch(`state.json?v=${Date.now()}`, { cache: "no-store" });
  const state = await res.json();

  const w = Number(state?.map?.width || 1);
  const h = Number(state?.map?.height || 1);
  const img = state?.map?.image || "map.jpg";

  const map = L.map("playerMap", {
    crs: L.CRS.Simple,
    zoomControl: true,
    minZoom: -3,
    maxZoom: 2
  });

  const bounds = [[0, 0], [h, w]];
  L.imageOverlay(img, bounds).addTo(map);
  map.fitBounds(bounds);

  // Settlements / markers
  const provinces = state.provinces || {};
  const markers = Array.isArray(state.markers) ? state.markers : [];

  for (const m of markers) {
    const x = Number(m.x);
    const y = Number(m.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const provId = m.provinceId || m.id;
    const prov = provinces[provId] || {};
    const name = prov.name || provId || m.id;

    const cm = L.circleMarker([y, x], {
      radius: 4,
      color: "#000",
      weight: 1,
      fillColor: "#ffffff",
      fillOpacity: 0.9
    }).addTo(map);

    cm.bindTooltip(name, { direction: "top", offset: [0, -6] });

    cm.on("click", (e) => {
      // Prevent the map's click handler from clearing selection immediately.
      if (e) L.DomEvent.stopPropagation(e);
      setSelected({ kind: "settlement", id: provId, name });
    });
  }

  // Events
  const events = Array.isArray(state.events) ? state.events : [];
  for (const ev of events) {
    const x = Number(ev.x);
    const y = Number(ev.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const id = ev.id || "event";
    const name = ev.title || id;

    const em = L.circleMarker([y, x], {
      radius: 5,
      color: "#000",
      weight: 1,
      fillColor: "#ffd37a",
      fillOpacity: 0.95
    }).addTo(map);

    em.bindTooltip(`EVENT: ${name}`, { direction: "top", offset: [0, -8] });

    em.on("click", (e) => {
      if (e) L.DomEvent.stopPropagation(e);
      setSelected({ kind: "event", id, name });
    });
  }

  // Clicking empty map clears selection (nice UX)
  map.on("click", () => setSelected(null));
}

/* ---------------- boot ---------------- */

window.addEventListener("DOMContentLoaded", async () => {
  await loadFactions();
  await loadTurnStatus();

  wireSelectionButtons();
  setSelected(null);

  const ids = ["event_id","event_choice","improve_settlement","improve_building","campaign_target","campaign_note"];
  for (const id of ids) $(id).addEventListener("input", () => updateChecklist(buildPayload()));
  $("event_choice").addEventListener("change", () => updateChecklist(buildPayload()));

  $("submitBtn").addEventListener("click", submitTurn);
  updateChecklist(buildPayload());

  // Map in centre; form at bottom; status left; checklist right
  initPlayerMap().catch(err => console.warn("Map init failed:", err));
});
