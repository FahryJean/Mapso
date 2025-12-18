import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// TODO: paste your values here in Step 5C
const SUPABASE_URL = "https://rvtaogqygqanshxpjrer.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g2tgBXMQmNHj0UNSf5MGuA_whabxtE_";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function $(id) {
  return document.getElementById(id);
}

function fmtTime(ts) {
  try {
    return new Date(ts).toUTCString();
  } catch {
    return String(ts);
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
    <div><b>Submissions:</b> ${data.submitted_count} / ${data.faction_count}</div>
    <div><b>Closes:</b> ${fmtTime(data.closes_at)}</div>
  `;
}

window.addEventListener("DOMContentLoaded", () => {
  loadTurnStatus();
});
