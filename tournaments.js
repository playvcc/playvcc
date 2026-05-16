// VCC Tournament Check-In Window Fix
// Opens check-in 30 minutes before start.
// Closes check-in exactly at start time.
// Window example: 7:30:00 PM through 7:59:59 PM for an 8:00 PM start.

(function(){
  const box = document.getElementById('tournamentsBox');
  const statusBox = document.getElementById('tournamentStatus');

  let supabase = null;
  let currentUser = null;
  let currentProfile = null;
  let myTeams = [];
  let tournaments = [];

  function setStatus(message){
    if(statusBox) statusBox.textContent = message;
  }

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

  function isWccTournament(t){
    const text = [t.name,t.tournament_category,t.format,t.division,t.gender_restriction].join(' ').toLowerCase();
    return t.gender_restriction === 'female_only' || text.includes('wcc') || text.includes('women') || text.includes('female');
  }

  function isWccTeam(team){
    const text = [team.name,team.tag,team.division,team.team_type,team.category].join(' ').toLowerCase();
    return team.division === 'wcc' || team.team_type === 'wcc' || team.gender_restriction === 'female_only' || text.includes('wcc') || text.includes('women') || text.includes('female');
  }

  function checkInState(item){
    // Supports tournament.start_date and match.scheduled_at
    const rawStart = item.start_date || item.scheduled_at;

    if(!rawStart){
      return {
        open:false,
        closed:false,
        label:'No start time set'
      };
    }

    const start = new Date(rawStart).getTime();
    const now = Date.now();
    const opens = start - 30 * 60 * 1000;

    if(now < opens){
      const mins = Math.ceil((opens - now) / 60000);
      return {
        open:false,
        closed:false,
        label:`Check-in opens in ${mins} min`,
        opensAt:new Date(opens),
        closesAt:new Date(start)
      };
    }

    if(now >= opens && now < start){
      const mins = Math.ceil((start - now) / 60000);
      return {
        open:true,
        closed:false,
        label:`Check-in open — closes in ${mins} min`,
        opensAt:new Date(opens),
        closesAt:new Date(start)
      };
    }

    return {
      open:false,
      closed:true,
      label:'Check-in closed',
      opensAt:new Date(opens),
      closesAt:new Date(start)
    };
  }

  async function loadProfile(){
    const session = await supabase.auth.getSession();
    currentUser = session?.data?.session?.user || null;

    if(!currentUser) return;

    const profile = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    currentProfile = profile.data || null;

    const teams = await supabase
      .from('team_memberships')
      .select('*, teams(*)')
      .or(`user_id.eq.${currentUser.id},player_id.eq.${currentUser.id}`)
      .eq('status','active');

    myTeams = (teams.data || []).map(x => x.teams).filter(Boolean);
  }

  async function loadTournaments(){
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('start_date', { ascending:true, nullsFirst:false });

    if(error) throw error;
    tournaments = data || [];
  }

  async function loadRegistrations(tournamentId){
    const { data } = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tournamentId);

    return data || [];
  }

  function eligibility(t){
    const wcc = isWccTournament(t);

    if(!currentUser) return { ok:false, msg:'Sign in to register.', action:'login' };
    if(!currentProfile?.gender) return { ok:false, msg:'Complete profile gender before registering.', action:'profile' };

    if(wcc && currentProfile.gender === 'male'){
      return { ok:false, msg:'Male users cannot register for WCC tournaments.' };
    }

    const eligibleTeams = myTeams.filter(team => wcc ? isWccTeam(team) : !isWccTeam(team));

    if(!eligibleTeams.length){
      return { ok:false, msg:wcc ? 'You need a WCC team.' : 'You need a regular VCC team.' };
    }

    return { ok:true, msg:'Eligible', teams:eligibleTeams };
  }

  async function registerTournament(tournamentId){
    const t = tournaments.find(x => x.id === tournamentId);
    const check = eligibility(t);

    if(!check.ok){
      alert(check.msg);
      if(check.action === 'login') location.href = 'auth.html?mode=login';
      if(check.action === 'profile') location.href = 'profile.html';
      return;
    }

    const team = check.teams[0];

    const result = await supabase
      .from('tournament_registrations')
      .insert({
        tournament_id:t.id,
        team_id:team.id,
        profile_id:currentUser.id,
        status:'registered'
      });

    if(result.error){
      alert(result.error.message);
      return;
    }

    alert(`${team.name} registered.`);
    await render();
  }

  async function checkIn(tournamentId, teamId){
    const result = await supabase.rpc('check_in_team_for_tournament', {
      p_tournament_id:tournamentId,
      p_team_id:teamId
    });

    if(result.error){
      alert(result.error.message);
      return;
    }

    alert('Team checked in.');
    await render();
  }

  async function render(){
    if(!tournaments.length){
      box.innerHTML = '<div class="vcc-card"><h2>No tournaments available yet.</h2></div>';
      setStatus('No tournaments found.');
      return;
    }

    const cards = [];

    for(const t of tournaments){
      const regs = await loadRegistrations(t.id);
      const state = checkInState(t);
      const check = eligibility(t);
      const myRegistration = currentUser
        ? regs.find(r => r.profile_id === currentUser.id || myTeams.some(tm => tm.id === r.team_id))
        : null;

      cards.push(`
        <article class="vcc-card">
          <div class="vcc-panel-title">
            <h2>${safe(t.name || 'VCC Tournament')}</h2>
            <span>${safe(isWccTournament(t) ? 'WCC / Female Only' : 'Open Event')}</span>
          </div>

          <p>${safe(t.description || 'No description posted yet.')}</p>

          <p>
            <span class="pill">${safe(t.status || 'upcoming')}</span>
            <span class="pill">Division: ${safe(t.division || 'open')}</span>
            <span class="pill">Format: ${safe(t.format || 'TBD')}</span>
            <span class="pill">Teams: ${regs.length}</span>
            <span class="pill">${safe(state.label)}</span>
          </p>

          <p class="muted">Start: ${t.start_date ? new Date(t.start_date).toLocaleString() : 'Not set'}</p>
          ${state.opensAt ? `<p class="muted">Check-in: ${state.opensAt.toLocaleString()} → ${state.closesAt.toLocaleString()}</p>` : ''}

          ${myRegistration ? `<p><span class="pill">Your team status: ${safe(myRegistration.status)}</span></p>` : ''}

          ${!myRegistration ? `<button class="signupBtn ${check.ok ? 'green' : 'secondary'}" data-id="${safe(t.id)}">${check.ok ? 'Sign Up' : 'Not Eligible'}</button>` : ''}

          ${myRegistration && state.open && myRegistration.status !== 'checked_in'
            ? `<button class="checkInBtn gold" data-id="${safe(t.id)}" data-team="${safe(myRegistration.team_id)}">Check In</button>`
            : ''}

          ${myRegistration && state.closed && myRegistration.status !== 'checked_in'
            ? `<span class="pill">Missed Check-In</span>`
            : ''}

          ${myRegistration && myRegistration.status === 'checked_in' ? '<span class="pill">Checked In</span>' : ''}
        </article>
      `);
    }

    box.innerHTML = cards.join('');

    document.querySelectorAll('.signupBtn').forEach(btn => {
      btn.addEventListener('click', () => registerTournament(btn.dataset.id));
    });

    document.querySelectorAll('.checkInBtn').forEach(btn => {
      btn.addEventListener('click', () => checkIn(btn.dataset.id, btn.dataset.team));
    });

    setStatus(currentUser ? `Signed in as ${currentUser.email || currentUser.id}.` : 'Sign in to register/check in.');
  }

  async function init(){
    try{
      supabase = await getSupabase();
      await loadProfile();
      await loadTournaments();
      await render();

      // Refresh once per minute so button appears/disappears correctly.
      setInterval(render, 60000);
    }catch(error){
      setStatus('Tournament page error: ' + error.message);
    }
  }

  init();
})();
