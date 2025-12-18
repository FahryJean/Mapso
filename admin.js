import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rvtaogqygqanshxpjrer.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g2tgBXMQmNHj0UNSf5MGuA_whabxtE_";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const FACTIONS = [
  { id: "imperial_core", name: "Imperial Core" },
  { id: "southport", name: "Southport" },
  { id: "flatland_tribes", name: "Flatland Tribes" }
];

function $(id){ return document.getElementById(id); }

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtTime(ts) {
  try { return new Date(ts).toUTCString(); } catch { return String(ts); }
}

function say(msg) {
  const el = $("adminOut");
  if (el) el.textContent = msg;
}

async function loadTurnStatus() {
  const { data, error } = await supabase.rpc("turn_status");
  if (error) {
    $("statusBox").innerHTML = `<div><b>ERROR:</b> ${escapeHtml(error.message)}</div>`;
    return null;
  }

  $("statusBox").innerHTML = `
    <div><b>Turn:</b> ${data.turn_number}</div>
    <div><b>Phase:</b> ${data.phase}</div>
    <div><b>Faction submissions:</b> ${data.submitted_count} / ${data.faction_count}</div>
    <div><b>Closes:</b> ${fmtTime(data.closes_at)}</div>
  `;
  return data;
}

function renderSubmissions(arr) {
  if (!arr || arr.length === 0) return "<div>No submissions found.</div>";

  const byFaction = new Map();
  for (const s of arr) {
    const k = s.faction_id || "unknown";
    if (!byFaction.has(k)) byFaction.set(k, []);
    byFaction.get(k).push(s);
  }

  let html = "";
  for (const [factionId, items] of byFaction.entries()) {
    const latest = items[0];
    const p = latest.payload || {};

    const hasEvent = !!(p.event_response && p.event_response.event_id && p.event_response.choice);
    const hasImp = !!(p.improvement && p.improvement.settlement_id && p.improvement.building);
    const hasCamp = !!(p.campaign && p.campaign.target_settlement_id);
    const impChance = hasCamp ? "50%" : "100%";

    html += `
      <div class="leaderboard-item">
        <b>${escapeHtml(factionId)}</b>
        <div class="lb-sub">Updated: ${escapeHtml(latest.updated_at || latest.submitted_at || "")}</div>

        <div style="margin-top:10px;">
          <div>🎭 <b>Event:</b> ${hasEvent ? `${escapeHtml(p.event_response.event_id)} (${escapeHtml(p.event_response.choice)})` : "—"}</div>
          <div style="margin-top:6px;">🏗 <b>Improve:</b> ${hasImp ? `${escapeHtml(p.improvement.settlement_id)} → ${escapeHtml(p.improvement.building)}` : "—"} <span style="opacity:0.85">(Chance: ${impChance})</span></div>
          <div style="margin-top:6px;">⚔ <b>Campaign:</b> ${hasCamp ? escapeHtml(p.campaign.target_settlement_id) : "—"}</div>
          ${hasCamp && p.campaign.note ? `<div style="margin-top:6px; opacity:0.9;"><i>${escapeHtml(p.campaign.note)}</i></div>` : ""}
        </div>
      </div>
    `;
  }

  return html;
}

async function loadSubmissions() {
  say("Loading submissions…");
  const pass = $("adminPass").value;

  const { data, error } = await supabase.rpc("admin_list_submissions", { p_passcode: pass });
  if (error) {
    $("subs").innerHTML = `<div><b>ERROR:</b> ${escapeHtml(error.message)}</div>`;
    say(`ERROR: ${error.message}`);
    return null;
  }

  $("subs").innerHTML = renderSubmissions(data);
  say("Submissions loaded ✓");
  return data;
}

async function loadResolutions() {
  const pass = $("adminPass").value;
  const { data, error } = await supabase.rpc("admin_list_resolutions", { p_passcode: pass });
  if (error) return [];
  return data || [];
}

function loadFactionSelect() {
  const sel = $("resFaction");
  sel.innerHTML = "";
  for (const f of FACTIONS) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    sel.appendChild(opt);
  }
}

function setResProgress(resolutions, submittedCount, factionCount) {
  const resolvedSet = new Set((resolutions || []).map(r => r.faction_id));
  $("resProgress").innerHTML = `
    <div><b>Resolved:</b> ${resolvedSet.size} / ${factionCount}</div>
    <div><b>Submitted:</b> ${submittedCount} / ${factionCount}</div>
  `;
}

async function fillResolutionFormFromSaved(factionId) {
  const pass = $("adminPass").value;
  const { data, error } = await supabase.rpc("admin_list_resolutions", { p_passcode: pass });
  if (error) return;

  const found = (data || []).find(r => r.faction_id === factionId);
  const res = found?.resolution || {};

  $("resEvent").value = res.event_outcome || "";
  $("resImproveResult").value = res.improvement_result || "";
  $("resImproveNotes").value = res.improvement_notes || "";
  $("resCampaign").value = res.campaign_outcome || "";
}

async function saveResolution() {
  $("resOut").textContent = "";
  const pass = $("adminPass").value;
  const factionId = $("resFaction").value;

  const resolution = {
    event_outcome: $("resEvent").value.trim(),
    improvement_result: $("resImproveResult").value,
    improvement_notes: $("resImproveNotes").value.trim(),
    campaign_outcome: $("resCampaign").value.trim()
  };

  const { error } = await supabase.rpc("admin_save_resolution", {
    p_passcode: pass,
    p_faction_id: factionId,
    p_resolution: resolution
  });

  if (error) {
    $("resOut").textContent = `ERROR: ${error.message}`;
    return;
  }

  $("resOut").textContent = "Saved ✓";
}

async function lockTurn() {
  say("Locking…");
  const pass = $("adminPass").value;
  const { error } = await supabase.rpc("admin_lock_turn", { p_passcode: pass });
  say(error ? `ERROR: ${error.message}` : "Locked ✓");
  await loadTurnStatus();
}

async function publishNextTurn() {
  say("Publishing next turn…");
  const pass = $("adminPass").value;
  const { error } = await supabase.rpc("admin_publish_next_turn", { p_passcode: pass });
  say(error ? `ERROR: ${error.message}` : "Published next turn ✓");
  await loadTurnStatus();
  $("subs").innerHTML = "New turn opened. Click Refresh to load new submissions.";
  $("resOut").textContent = "";
}

async function refreshAll() {
  const status = await loadTurnStatus();
  if (!status) return;

  const subs = await loadSubmissions();
  const resolutions = await loadResolutions();
  setResProgress(resolutions, status.submitted_count, status.faction_count);

  // Fill form for currently selected faction
  await fillResolutionFormFromSaved($("resFaction").value);
}

window.addEventListener("DOMContentLoaded", async () => {
  loadFactionSelect();

  $("refreshBtn").addEventListener("click", refreshAll);
  $("lockBtn").addEventListener("click", lockTurn);
  $("publishBtn").addEventListener("click", publishNextTurn);
  $("saveResBtn").addEventListener("click", saveResolution);

  $("resFaction").addEventListener("change", async () => {
    await fillResolutionFormFromSaved($("resFaction").value);
    $("resOut").textContent = "";
  });

  say("Admin JS running ✓");
  await loadTurnStatus();
});
