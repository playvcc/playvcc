// VCC Leaderboard Profile + PFP Fix
// Fixes leaderboard rows so PFPs show and View opens profile.html?id=PLAYER_ID.

(function(){
  let supabase = null;
  let players = [];

  const box =
    document.getElementById('leaderboardBox') ||
    document.getElementById('leaderboardList') ||
    document.getElementById('rankingsBox') ||
    document.querySelector('[data-leaderboard-box]') ||
    document.querySelector('.leaderboard-list');

  const statusBox =
    document.getElementById('leaderboardStatus') ||
    document.getElementById('rankingStatus') ||
    document.getElementById('status') ||
    document.querySelector('.log');

  function setStatus(message){
    if(statusBox) statusBox.textContent = message;
  }

  function safe(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#039;'
    }[c]));
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  function nameOf(p){
    return p.display_name || p.username || p.riot_id || p.email || 'VCC Player';
  }

  function avatarOf(p){
    const url =
      p.avatar_url ||
      p.profile_picture_url ||
      p.profile_pic_url ||
      p.profile_image_url ||
      p.pfp_url ||
      p.photo_url ||
      p.image_url ||
      '';

    return url && !url.includes('undefined') && !url.includes('null')
      ? url
      : 'assets/vcc-logo.png';
  }

  function scoreOf(p){
    return Number(
      p.pro_points ??
      p.points ??
      p.vcc_points ??
      p.rating ??
      p.vcc_rating ??
      0
    );
  }

  function winsOf(p){
    return Number(p.wins ?? 0);
  }

  function lossesOf(p){
    return Number(p.losses ?? 0);
  }

  function render(){
    if(!box) return;

    const rows = [...players].sort((a,b) => {
      const scoreDiff = scoreOf(b) - scoreOf(a);
      if(scoreDiff !== 0) return scoreDiff;
      return winsOf(b) - winsOf(a);
    });

    if(!rows.length){
      box.innerHTML = '<div class="empty-box">No leaderboard players found.</div>';
      return;
    }

    box.innerHTML = rows.map((p, index) => {
      const wins = winsOf(p);
      const losses = lossesOf(p);
      const total = wins + losses;
      const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

      return `
        <article class="vcc-card leaderboard-row" style="display:grid;grid-template-columns:60px 64px 1fr 110px 110px 120px 120px;gap:16px;align-items:center;margin-bottom:12px;">
          <strong style="font-size:22px;">#${index + 1}</strong>

          <img
            src="${safe(avatarOf(p))}"
            alt="${safe(nameOf(p))}"
            onerror="this.onerror=null;this.src='assets/vcc-logo.png';"
            style="width:56px;height:56px;border-radius:12px;object-fit:cover;background:#111;border:1px solid rgba(255,215,0,.35);"
          >

          <div>
            <strong>${safe(nameOf(p))}</strong>
            <br>
            <small>${safe(p.riot_id || p.email || '')}</small>
          </div>

          <span class="pill">${safe(p.rank || 'N/A')}</span>
          <span>${safe(wins)}-${safe(losses)}</span>
          <strong>${safe(scoreOf(p))} pts</strong>
          <a class="btn secondary" href="profile.html?id=${encodeURIComponent(p.id)}">View</a>
        </article>
      `;
    }).join('');
  }

  async function loadLeaderboard(){
    try{
      supabase = await getSupabase();

      const result = await supabase
        .from('profiles')
        .select('*');

      if(result.error) throw result.error;

      players = result.data || [];
      render();
      setStatus(`Loaded ${players.length} leaderboard players.`);
    }catch(error){
      setStatus('Leaderboard load error: ' + error.message);
    }
  }

  loadLeaderboard();
})();
