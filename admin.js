import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://rvtaogqygqanshxpjrer.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g2tgBXMQmNHj0UNSf5MGuA_whabxtE_"; // <-- paste yours

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  if (el) el.innerHTML = escapeHtml(msg);
}

async function loadTurnStatus() {
  try {
    const { data, error } = await supabase.rpc("turn_status");
    if (error) throw error;

    $("statusBox").innerHTML = `
      <div><b>Turn:</b> ${data.turn_number}</div>
      <div><b>Phase:</b> ${data.phase}</div>
      <div><b>Faction submissions:</b> ${data.submitted_count} / ${data.faction_count}</div>
      <div><b>Closes:</b> ${fmtTime(data.closes_at)}</div>
    `;
    return data;
  } catch (e) {
    $("statusBox").innerHTML = `<div><b>ERROR:</b> ${escapeHtml(e.message || String(e))}</div>`;
    throw e;
  }
}

function renderSubmissions(arr) {
  if (!arr || arr.length === 0) return "<div>No submissions yet (or wrong passcode).</div>";

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
    say(`Admin RPC error: ${error.message}`);
    return;
  }

  $("subs").innerHTML = renderSubmissions(data);
  say("Ready ✓");
}

async function lockTurn() {
  say("Locking…");
  const pass = $("adminPass").value;
  const { error } = await supabase.rpc("admin_lock_turn", { p_passcode: pass });
  if (error) { say(`ERROR: ${error.message}`); return; }
  say("Locked ✓");
  await loadTurnStatus();
}

async function publishNextTurn() {
  say("Publishing next turn…");
  const pass = $("adminPass").value;
  const { error } = await supabase.rpc("admin_publish_next_turn", { p_passcode: pass });
  if (error) { say(`ERROR: ${error.message}`); return; }
  say("Published ✓");
  await loadTurnStatus();
}

window.addEventListener("error", (e) => {
  // shows module load/syntax errors on-page
  try { say(`JS ERROR: ${e.message}`); } catch {}
});

window.addEventListener("DOMContentLoaded", async () => {
  try {
    say("Admin JS running ✓");
    await loadTurnStatus();

    $("refreshBtn").addEventListener("click", loadSubmissions);
    $("lockBtn").addEventListener("click", lockTurn);
    $("publishBtn").addEventListener("click", publishNextTurn);

    say("Enter admin passcode, click Refresh.");
  } catch (e) {
    // loadTurnStatus already prints details
    say(`Init error: ${e.message || e}`);
  }
});
