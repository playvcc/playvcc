// VCC Teams membership compatibility fix: supports user_id and old player_id.

(function(){
  const statusBox = document.getElementById('teamStatus');
  const myTeamsBox = document.getElementById('myTeamsBox');
  const teamsBox = document.getElementById('teamsBox');

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

  function teamCard(team, extra=''){
    return `
      <article class="vcc-card">
        <img class="vcc-avatar" src="${safe(team.logo_url || 'assets/vcc-logo.png')}" alt="${safe(team.name)} logo">
        <h2>${safe(team.name || 'Unnamed Team')}</h2>
        <p>
          <span class="pill">${safe(team.tag || 'VCC')}</span>
          <span class="pill">${safe((team.division || 'open').toUpperCase())}</span>
          <span class="pill">${safe(team.gender_restriction || 'none')}</span>
        </p>
        <p>${safe(team.bio || '')}</p>
        ${extra}
        <p class="muted">Team ID: ${safe(team.id)}</p>
      </article>
    `;
  }

  async function load(){
    try{
      setStatus('Loading Supabase...');
      const supabase = await getSupabase();

      const session = await supabase.auth.getSession();
      const user = session?.data?.session?.user || null;

      const allTeams = await supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending:false });

      if(allTeams.error) throw allTeams.error;

      let memberships = [];

      if(user){
        const mine = await supabase
          .from('team_memberships')
          .select('*, teams(*)')
          .or(`user_id.eq.${user.id},player_id.eq.${user.id}`)
          .eq('status', 'active');

        if(mine.error) throw mine.error;
        memberships = mine.data || [];
      }

      myTeamsBox.innerHTML = memberships.length
        ? memberships.map(m => teamCard(m.teams || {}, `<p><span class="pill">You are: ${safe(m.role || 'player')}</span></p>`)).join('')
        : '<div class="log">You are not on a team yet.</div>';

      teamsBox.innerHTML = (allTeams.data || []).length
        ? allTeams.data.map(t => {
            const mine = memberships.find(m => m.team_id === t.id);
            const extra = mine
              ? `<p><span class="pill">Your team / ${safe(mine.role || 'member')}</span></p>`
              : '';
            return teamCard(t, extra);
          }).join('')
        : '<div class="log">No teams created yet.</div>';

      setStatus(user ? `Signed in as ${user.email || user.id}.` : 'Viewing teams as guest.');
    }catch(error){
      setStatus('Teams error: ' + error.message);
    }
  }

  load();
})();
