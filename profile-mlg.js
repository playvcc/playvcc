// ======================================================
// VCC MLG / GameBattles Style Profile Logic
// Loads URL params, local placeholders, and inbox messages.
// ======================================================

function vccProfileSB(){
  return window.supabaseClient || window.supabase || window.sb || null;
}

function safeText(value, fallback = "") {
  return value && String(value).trim() ? String(value).trim() : fallback;
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setAttr(id, attr, value) {
  const el = document.getElementById(id);
  if (el && value) el.setAttribute(attr, value);
}

function calculateWinRate(wins, losses) {
  const total = wins + losses;
  if (!total) return 0;
  return Math.round((wins / total) * 100);
}

async function getCurrentUser() {
  const sb = vccProfileSB();
  if (!sb?.auth?.getUser) return null;
  const { data } = await sb.auth.getUser();
  return data?.user || null;
}

async function loadInboxPreview(user) {
  const box = document.getElementById("profileMessages");
  if (!box || !user) return;

  const sb = vccProfileSB();
  if (!sb?.from) return;

  try {
    const { data, error } = await sb
      .from("player_messages")
      .select("*")
      .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email}`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!data || !data.length) {
      box.innerHTML = '<div class="gb-empty">No messages yet.</div>';
      return;
    }

    box.innerHTML = data.map(msg => `
      <div class="gb-note ${msg.status === "unread" ? "unread" : ""}">
        <strong>${escapeHTML(msg.title || "VCC Message")}</strong>
        <p>${escapeHTML(msg.body || "")}</p>
      </div>
    `).join("");
  } catch (err) {
    box.innerHTML = `<div class="gb-empty">Messages unavailable: ${escapeHTML(err.message)}</div>`;
  }
}

async function loadRecentMatches(playerName) {
  const box = document.getElementById("recentMatches");
  if (!box) return;

  const sb = vccProfileSB();
  if (!sb?.from) return;

  try {
    const { data, error } = await sb
      .from("matches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) throw error;

    if (!data || !data.length) {
      box.innerHTML = '<div class="gb-empty">No recent matches yet.</div>';
      return;
    }

    box.innerHTML = data.map(m => {
      const score = `${m.score_team_a ?? 0}-${m.score_team_b ?? 0}`;
      const status = m.status || "scheduled";
      return `
        <div class="gb-match">
          <div>
            <strong>${escapeHTML(m.round_name || "VCC Match")}</strong>
            <p>${escapeHTML(status)} · ${escapeHTML(score)}</p>
          </div>
          <a class="gb-btn" href="match-room.html?match=${encodeURIComponent(m.id)}">Open</a>
        </div>
      `;
    }).join("");
  } catch (err) {
    box.innerHTML = `<div class="gb-empty">Recent matches unavailable.</div>`;
  }
}

function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

async function initProfile() {
  const params = getParams();
  const user = await getCurrentUser();

  const name = safeText(params.get("name"), user?.user_metadata?.display_name || user?.email?.split("@")[0] || "VCC Player");
  const email = safeText(params.get("email"), user?.email || "");
  const userId = safeText(params.get("user") || params.get("id"), user?.id || "");
  const avatar = safeText(params.get("avatar"), user?.user_metadata?.avatar_url || "assets/vcc-logo.png");

  const wins = Number(params.get("wins") || localStorage.getItem("vcc_profile_wins") || 0);
  const losses = Number(params.get("losses") || localStorage.getItem("vcc_profile_losses") || 0);
  const mapsWon = Number(params.get("mapsWon") || localStorage.getItem("vcc_profile_maps_won") || 0);
  const mapsLost = Number(params.get("mapsLost") || localStorage.getItem("vcc_profile_maps_lost") || 0);
  const points = Number(params.get("points") || localStorage.getItem("vcc_profile_points") || 0);
  const rating = Number(params.get("rating") || localStorage.getItem("vcc_profile_rating") || 1000);
  const winRate = calculateWinRate(wins, losses);

  setText("profileName", name);
  setText("profileRank", "Rank: " + safeText(params.get("rank"), "Unranked"));
  setText("profilePlatform", "Platform: " + safeText(params.get("platform"), "Console"));
  setText("profileRegion", "Region: " + safeText(params.get("region"), "NA"));
  setText("profileBio", safeText(params.get("bio"), "Competitive console Valorant player competing in the VCC ecosystem."));
  setText("profileRecord", `${wins}-${losses}`);
  setText("profileWinrate", `${winRate}% Win Rate`);

  setText("statWins", wins);
  setText("statLosses", losses);
  setText("statMapsWon", mapsWon);
  setText("statMapsLost", mapsLost);
  setText("statPoints", points);
  setText("statRating", rating);

  setText("infoRiot", safeText(params.get("riot"), "Not set"));
  setText("infoRole", safeText(params.get("role"), "Flex"));
  setText("infoAgents", safeText(params.get("agents"), "Not set"));
  setText("infoTeam", safeText(params.get("team"), "Free Agent"));

  setAttr("profileAvatar", "src", avatar);

  let messageHref = "message-player.html";
  const q = [];
  if (userId) q.push("user=" + encodeURIComponent(userId));
  if (email) q.push("email=" + encodeURIComponent(email));
  if (q.length) messageHref += "?" + q.join("&");
  setAttr("messageBtn", "href", messageHref);

  await loadInboxPreview(user);
  await loadRecentMatches(name);
}

document.addEventListener("DOMContentLoaded", initProfile);
