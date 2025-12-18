import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rvtaogqygqanshxpjrer.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g2tgBXMQmNHj0UNSf5MGuA_whabxtE_";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DB-driven factions. Fallback only if DB read fails.
const FALLBACK_FACTIONS = [
  { id: "imperial_core", display_name: "Imperial Core" },
  { id: "southport", display_name: "Southport" },
  { id: "flatland_tribes", display_name: "Flatland Tribes" }
];

function $(id){ return document.getElementById(id); }

function fmtTime(ts) {
  try { return new Date(ts).toUTCString(); } catch { return String(ts); }
}

async function loadFactions() {
  const sel = $("faction");
  sel.innerHTML = "";

  const { data, error } = await supabase
    .from("factions")
    .select("id, display_name")
    .order("display_name", { ascending: true });

  const factions = (!error && Array.isArray(data) && data.length)
    ? data
    : FALLBACK_FACTIONS;

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
  if (payload.campaign && !payload.campaign.target_settlement_id) {
    errs.push("Campaign: if you type anything, please include a Target settlement ID.");
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

window.addEventListener("DOMContentLoaded", async () => {
  await loadFactions();
  await loadTurnStatus();

  const ids = ["event_id","event_choice","improve_settlement","improve_building","campaign_target","campaign_note"];
  for (const id of ids) $(id).addEventListener("input", () => updateChecklist(buildPayload()));
  $("event_choice").addEventListener("change", () => updateChecklist(buildPayload()));

  $("submitBtn").addEventListener("click", submitTurn);
  updateChecklist(buildPayload());
});
