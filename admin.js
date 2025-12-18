import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rvtaogqygqanshxpjrer.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g2tgBXMQmNHj0UNSf5MGuA_whabxtE_";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function $(id){ return document.getElementById(id); }

function fmtTime(ts) {
  try { return new Date(ts).toUTCString(); } catch { return String(ts); }
}

async function loadTurnStatus() {
  const { data, error } = await supabase.rpc("turn_status");
  if (error) {
    $("statusBox").textContent = `ERROR: ${error.message}`;
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
  if (!arr || arr.length === 0) return "<div>No submissions yet.</div>";

  // Group by faction_id
  const byFaction = new Map();
  for (const s of arr) {
    const k = s.faction_id || "unknown";
    if (!byFaction.has(k)) byFaction.set(k, []);
    byFaction.get(k).push(s);
  }

  let html = "";
  for (const [factionId, items] of byFaction.entries()) {
    const latest = items[0]; // function returns newest first
    const p = latest.payload || {};

    const hasEvent = !!(p.event_response && p.event_response.event_id && p.event_response.choice);
    const hasImp = !!(p.improvement && p.improvement.settlement_id && p.improvement.building);
    const hasCamp = !!(p.campaign && p.campaign.target_settlement_id);

    const impChance = hasCamp ? "50%" : "100%";

    html += `
      <div class="leaderboard-item">
        <b>${factionId}</b>
        <div class="lb-sub">Updated: ${escapeHtml(latest.updated_at || latest.submitted_at || "")}</div>

        <div style="margin-top:10px;">
          <div>🎭 <b>Event:</b> ${hasEvent ? escapeHtml(p.event_response.event_id) + " (" + escapeHtml(p.event_response.choice) + ")" : "—"}</div>
          <div style="margin-top:6px;">🏗 <b>Improve:</b> ${hasImp ? escapeHtml(p.improvement.settlement_id) + " → " + escapeHtml(p.improvement.building) : "—"} <span style="opacity:0.85">(Chance: ${impChance})</span></div>
          <div style="margin-top:6px;">⚔ <b>Campaign:</b> ${hasCamp ? escapeHtml(p.campaign.target_settlement_id) : "—"}</div>
          ${hasCamp && p.campaign.note ? `<div style="margin-top:6px; opacity:0.9;"><i>${escapeHtml(p.campaign.note)}</i></div>` : ""}
        </div>
      </div>
    `;
  }

  return html;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// NOTE: To list submissions we need an RPC. If you used my latest SQL, you might NOT have admin_list_submissions yet.
// So we’ll use a direct table read as the fallback if your RLS allows it.
// If it errors, tell me and I’ll give you a tiny RPC to add.
async function loadSubmissions() {
  const status = await loadTurnStatus();
  if (!status) return;

  const pass = $("adminPass").value;

  const { data, error } = await supabase.rpc("admin_list_submissions", { p_passcode: pass });

  if (error) {
    $("subs").innerHTML = `<div><b>ERROR:</b> ${escapeHtml(error.message)}</div>`;
    return;
  }

  $("subs").innerHTML = renderSubmissions(data);
}


  $("subs").innerHTML = renderSubmissions(data);
}

async function lockTurn() {
  $("adminOut").textContent = "";
  const pass = $("adminPass").value;
  const { error } = await supabase.rpc("admin_lock_turn", { p_passcode: pass });
  $("adminOut").textContent = error ? `ERROR: ${error.message}` : "Locked ✓";
  await loadSubmissions();
}

async function publishNextTurn() {
  $("adminOut").textContent = "";
  const pass = $("adminPass").value;
  const { error } = await supabase.rpc("admin_publish_next_turn", { p_passcode: pass });
  $("adminOut").textContent = error ? `ERROR: ${error.message}` : "Published next turn ✓";
  await loadSubmissions();
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadTurnStatus();

  $("refreshBtn").addEventListener("click", loadSubmissions);
  $("lockBtn").addEventListener("click", lockTurn);
  $("publishBtn").addEventListener("click", publishNextTurn);
});
