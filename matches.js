// VCC Matches page: tournament match rooms + scrims, only show open links for user's teams

(function(){
  let supabase = null;
  let user = null;
  let myTeamIds = [];

  const statusBox = document.getElementById('matchesStatus');
  const tournamentBox = document.getElementById('tournamentMatchesBox');
  const scrimBox = document.getElementById('scrimRoomsBox');

  function setStatus(msg){ statusBox.textContent = msg; }

  function safe(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function loadUserTeams(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user) return;

    const memberships = await supabase
      .from('team_memberships')
      .select('*')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`)
      .eq('status','active');

    myTeamIds = (memberships.data || []).map(m => m.team_id);
  }

  function canOpen(teamA, teamB){
    return myTeamIds.includes(teamA) || myTeamIds.includes(teamB);
  }

  async function loadTournamentMatches(){
    const result = await supabase
      .from('tournament_matches')
      .select('*')
      .neq('status','completed')
      .order('created_at', { ascending:false });

    if(result.error){
      tournamentBox.innerHTML = `<div class="log">Tournament matches error: ${safe(result.error.message)}</div>`;
      return;
    }

    const data = result.data || [];

    tournamentBox.innerHTML = data.length ? data.map(m => {
      const allowed = canOpen(m.team_a_id, m.team_b_id);
      return `
        <article class="vcc-card">
          <div class="vcc-panel-title">
            <h2>Round ${safe(m.round_number)} Match ${safe(m.match_number)}</h2>
            <span>${safe(m.status || 'scheduled')}</span>
          </div>
          <p>${safe(m.team_a_id)} vs ${safe(m.team_b_id)}</p>
          ${allowed
            ? `<a class="btn" href="tournament-match.html?id=${safe(m.id)}">Open Match Room</a>`
            : `<span class="pill">Private Room</span>`}
        </article>
      `;
    }).join('') : '<div class="log">No tournament matches yet.</div>';
  }

  async function loadScrimRooms(){
    const result = await supabase
      .from('match_rooms')
      .select('*')
      .eq('room_type','scrim')
      .neq('status','completed')
      .order('created_at', { ascending:false });

    if(result.error){
      scrimBox.innerHTML = `<div class="log">Scrim rooms error: ${safe(result.error.message)}</div>`;
      return;
    }

    const data = result.data || [];

    scrimBox.innerHTML = data.length ? data.map(r => {
      const allowed = canOpen(r.team_a_id, r.team_b_id);
      return `
        <article class="vcc-card">
          <div class="vcc-panel-title">
            <h2>Scrim Room</h2>
            <span>${safe(r.status || 'open')}</span>
          </div>
          <p>${safe(r.team_a_id)} vs ${safe(r.team_b_id)}</p>
          ${allowed
            ? `<a class="btn" href="match-room.html?id=${safe(r.id)}">Open Scrim Room</a>`
            : `<span class="pill">Private Room</span>`}
        </article>
      `;
    }).join('') : '<div class="log">No scrim rooms yet.</div>';
  }

  async function init(){
    try{
      supabase = await getSupabase();
      await loadUserTeams();
      await loadTournamentMatches();
      await loadScrimRooms();

      setStatus(user ? 'Matches loaded.' : 'Sign in to open your private match rooms.');
    }catch(error){
      setStatus('Matches error: ' + error.message);
    }
  }

  init();
})();
