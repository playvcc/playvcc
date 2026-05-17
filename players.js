// VCC Players Page Fix
// View buttons now open the actual player's public profile:
// profile.html?id=PLAYER_ID

(function(){
  let supabase = null;
  let players = [];

  const playersBox =
    document.getElementById('playersBox') ||
    document.getElementById('playerList') ||
    document.querySelector('[data-players-box]');

  const statusBox =
    document.getElementById('playersStatus') ||
    document.getElementById('status') ||
    document.querySelector('.log');

  const searchInput =
    document.getElementById('playerSearch') ||
    document.getElementById('searchPlayers') ||
    document.querySelector('input[type="search"]') ||
    document.querySelector('input[placeholder*="Search"]');

  const rankFilter =
    document.getElementById('rankFilter') ||
    document.querySelector('select[name="rank"]');

  const platformFilter =
    document.getElementById('platformFilter') ||
    document.querySelector('select[name="platform"]');

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

  function profileName(p){
    return p.display_name || p.username || p.riot_id || p.email || 'VCC Player';
  }

  function avatar(p){
    return p.avatar_url || p.profile_picture_url || p.pfp_url || 'VCC.png';
  }

  function filterPlayers(){
    const search = (searchInput?.value || '').trim().toLowerCase();
    const rank = (rankFilter?.value || '').trim().toLowerCase();
    const platform = (platformFilter?.value || '').trim().toLowerCase();

    return players.filter(p => {
      const text = [
        p.display_name,
        p.username,
        p.riot_id,
        p.rank,
        p.role,
        p.main_role,
        p.platform,
        p.region
      ].join(' ').toLowerCase();

      if(search && !text.includes(search)) return false;

      if(rank && rank !== 'all ranks' && rank !== 'all' && (p.rank || '').toLowerCase() !== rank){
        return false;
      }

      if(platform && platform !== 'all platforms' && platform !== 'all' && (p.platform || '').toLowerCase() !== platform){
        return false;
      }

      return true;
    });
  }

  function render(){
    if(!playersBox) return;

    const rows = filterPlayers();

    if(!rows.length){
      playersBox.innerHTML = '<div class="empty-box">No players found.</div>';
      return;
    }

    playersBox.innerHTML = rows.map(p => `
      <article class="player-row vcc-card" style="display:grid;grid-template-columns:64px 1fr 120px 120px 150px 120px;gap:18px;align-items:center;margin-bottom:12px;">
        <img src="${safe(avatar(p))}" alt="${safe(profileName(p))}" style="width:56px;height:56px;border-radius:12px;object-fit:cover;">
        <div>
          <strong>${safe(profileName(p))}</strong>
          <br>
          <small>${safe(p.riot_id || p.email || '')}</small>
        </div>
        <span class="pill">${safe(p.rank || 'N/A')}</span>
        <span>${safe(p.platform || 'Console')}</span>
        <span>${safe(p.main_role || p.role || 'Flex')}</span>
        <a class="btn secondary" href="profile.html?id=${encodeURIComponent(p.id)}">View</a>
      </article>
    `).join('');
  }

  async function loadPlayers(){
    try{
      supabase = await getSupabase();

      const result = await supabase
        .from('profiles')
        .select('*')
        .order('display_name', { ascending:true, nullsFirst:false });

      if(result.error) throw result.error;

      players = result.data || [];
      render();
      setStatus(`Loaded ${players.length} players.`);
    }catch(error){
      setStatus('Players load error: ' + error.message);
    }
  }

  searchInput?.addEventListener('input', render);
  rankFilter?.addEventListener('change', render);
  platformFilter?.addEventListener('change', render);

  loadPlayers();
})();
