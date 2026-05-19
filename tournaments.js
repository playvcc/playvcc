// VCC Tournament Signup + Check-In Fix
// Replace tournaments.js with this.
// Fixes:
// - Sign Up button only showing alert
// - Team not registering
// - Check-in button not showing during check-in window
// - Registered status not updating

(async function(){
  let supabase = null;
  let user = null;
  let myProfile = null;
  let myTeams = [];
  let tournaments = [];

  const box =
    document.getElementById('tournamentsBox') ||
    document.getElementById('eventsBox') ||
    document.querySelector('[data-tournaments-box]') ||
    document.querySelector('.list');

  const statusBox =
    document.getElementById('tournamentStatus') ||
    document.getElementById('status') ||
    document.querySelector('.log');

  function setStatus(msg){
    if(statusBox) statusBox.textContent = msg;
    console.log('[VCC Tournaments]', msg);
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

  function trueStart(t){
    return t.start_date || t.start_time || t.starts_at || t.start_at || t.event_start || null;
  }

  function dateText(value){
    if(!value) return 'Not set';
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleString();
  }

  function checkInOpenIso(startIso){
    if(!startIso) return null;
    const d = new Date(startIso);
    if(Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() - 30 * 60 * 1000).toISOString();
  }

  function checkInWindow(startIso){
    if(!startIso) return false;
    const start = new Date(startIso).getTime();
    const now = Date.now();
    return now >= start - 30 * 60 * 1000 && now < start;
  }

  function checkInClosed(startIso){
    if(!startIso) return false;
    return Date.now() >= new Date(startIso).getTime();
  }

  function checkInStatus(startIso){
    if(!startIso) return 'No start time';

    const start = new Date(startIso).getTime();
    if(Number.isNaN(start)) return 'Invalid start time';

    const mins = Math.floor((start - Date.now()) / 60000);

    if(mins > 30) return `Check-in opens in ${mins - 30} min`;
    if(mins > 0) return 'Check-in OPEN';
    return 'Check-in closed';
  }

  function isWccTournament(t){
    const text = [
      t.name,
      t.division,
      t.tournament_category,
      t.format,
      t.gender_restriction
    ].join(' ').toLowerCase();

    return (
      t.gender_restriction === 'female_only' ||
      text.includes('wcc') ||
      text.includes('women') ||
      text.includes('female')
    );
  }

  function isWccTeam(team){
    const text = [
      team.name,
      team.tag,
      team.division,
      team.team_type,
      team.category
    ].join(' ').toLowerCase();

    return (
      team.division === 'wcc' ||
      team.team_type === 'wcc' ||
      text.includes('wcc') ||
      text.includes('women') ||
      text.includes('female')
    );
  }

  async function loadUserAndTeams(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      setStatus('Not signed in.');
      myTeams = [];
      return;
    }

    const profileRes = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    myProfile = profileRes.data || null;

    const memberships = await supabase
      .from('team_memberships')
      .select('*, teams(*)')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`)
      .eq('status','active');

    myTeams = (memberships.data || [])
      .map(row => ({
        ...(row.teams || {}),
        membership_role: row.role,
        membership_id: row.id
      }))
      .filter(team => team.id);

    setStatus(`Signed in as ${user.email}.`);
  }

  async function loadRegistrations(tournamentId){
    const res = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tournamentId);

    if(res.error){
      console.error(res.error);
      return [];
    }

    return res.data || [];
  }

  function eligibleTeamsFor(tournament){
    if(!user) return [];

    const wcc = isWccTournament(tournament);

    if(wcc && myProfile?.gender === 'male') return [];

    return myTeams.filter(team => wcc ? isWccTeam(team) : !isWccTeam(team));
  }

  async function chooseTeam(tournament){
    const teams = eligibleTeamsFor(tournament);

    if(!teams.length){
      throw new Error(isWccTournament(tournament) ? 'You need an eligible WCC team.' : 'You need an eligible regular team.');
    }

    if(teams.length === 1) return teams[0];

    const list = teams.map((team, index) => `${index + 1}. ${team.name || team.tag || team.id}`).join('\n');
    const choice = prompt(`Choose team to register:\n${list}`);

    const index = Number(choice) - 1;

    if(!Number.isInteger(index) || !teams[index]){
      throw new Error('Invalid team choice.');
    }

    return teams[index];
  }

  async function registerTournament(tournamentId){
    try{
      if(!user){
        location.href = 'auth.html?mode=login';
        return;
      }

      const tournament = tournaments.find(t => t.id === tournamentId);

      if(!tournament){
        throw new Error('Tournament not found.');
      }

      const team = await chooseTeam(tournament);

      const existing = await supabase
        .from('tournament_registrations')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('team_id', team.id)
        .maybeSingle();

      if(existing.error && existing.error.code !== 'PGRST116'){
        throw existing.error;
      }

      if(existing.data){
        setStatus(`${team.name || 'Team'} is already registered.`);
        await loadTournaments();
        return;
      }

      const insert = await supabase
        .from('tournament_registrations')
        .insert({
          tournament_id: tournamentId,
          team_id: team.id,
          profile_id: user.id,
          captain_id: user.id,
          status: 'registered',
          checked_in: false
        })
        .select()
        .single();

      if(insert.error) throw insert.error;

      setStatus(`${team.name || 'Team'} registered successfully.`);
      await loadTournaments();

    }catch(error){
      setStatus('Signup error: ' + error.message);
      alert('Signup error: ' + error.message);
    }
  }

  async function checkInTeam(tournamentId, teamId){
    try{
      if(!user){
        location.href = 'auth.html?mode=login';
        return;
      }

      const tournament = tournaments.find(t => t.id === tournamentId);
      const start = trueStart(tournament);

      if(!checkInWindow(start)){
        throw new Error('Check-in is only open during the 30 minutes before tournament start.');
      }

      const result = await supabase
        .from('tournament_registrations')
        .update({
          status: 'checked_in',
          checked_in: true,
          checked_in_at: new Date().toISOString()
        })
        .eq('tournament_id', tournamentId)
        .eq('team_id', teamId)
        .select()
        .single();

      if(result.error) throw result.error;

      setStatus('Team checked in successfully.');
      await loadTournaments();

    }catch(error){
      setStatus('Check-in error: ' + error.message);
      alert('Check-in error: ' + error.message);
    }
  }

  function myRegistration(regs){
    if(!user) return null;
    const teamIds = myTeams.map(t => t.id);
    return regs.find(r => r.profile_id === user.id || r.captain_id === user.id || teamIds.includes(r.team_id)) || null;
  }

  async function loadTournaments(){
    try{
      if(!box){
        setStatus('Missing tournamentsBox.');
        return;
      }

      box.innerHTML = '<div class="log">Loading tournaments...</div>';

      const res = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending:false });

      if(res.error) throw res.error;

      const seen = new Set();
      tournaments = (res.data || []).filter(t => {
        if(!t.id || seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      if(!tournaments.length){
        box.innerHTML = '<div class="log">No tournaments created yet.</div>';
        setStatus('No tournaments found.');
        return;
      }

      const htmlParts = [];

      for(const tournament of tournaments){
        const start = trueStart(tournament);
        const regs = await loadRegistrations(tournament.id);
        const mine = myRegistration(regs);
        const eligible = eligibleTeamsFor(tournament);
        const wcc = isWccTournament(tournament);
        const checkOpen = checkInWindow(start);
        const missed = mine && checkInClosed(start) && mine.status !== 'checked_in' && mine.checked_in !== true;

        htmlParts.push(`
          <article class="vcc-card">
            <div class="vcc-panel-title">
              <h2>${safe(tournament.name || 'Tournament')}</h2>
              <span>${safe(tournament.status || 'open')}</span>
            </div>

            <p>${safe(tournament.description || 'No description posted yet.')}</p>

            <p>
              <span class="pill">${safe(tournament.status || 'open')}</span>
              <span class="pill">Division: ${safe(tournament.division || 'open')}</span>
              <span class="pill">Format: ${safe(tournament.format || 'TBD')}</span>
              <span class="pill">Teams: ${safe(regs.length)}</span>
              <span class="pill">${safe(checkInStatus(start))}</span>
            </p>

            <p>Start: ${safe(dateText(start))}</p>
            <p>Check-in: ${safe(dateText(checkInOpenIso(start)))} → ${safe(dateText(start))}</p>

            ${mine ? `<p><span class="pill">Your team status: ${safe(mine.status || 'registered')}</span></p>` : ''}

            ${!user ? `<a class="btn" href="auth.html?mode=login">Sign In to Register</a>` : ''}

            ${user && !mine && eligible.length > 0
              ? `<button class="signupBtn" data-id="${safe(tournament.id)}">Sign Up</button>`
              : ''}

            ${user && !mine && eligible.length === 0
              ? `<span class="pill">${wcc && myProfile?.gender === 'male' ? 'Not eligible for WCC' : 'No eligible team'}</span>`
              : ''}

            ${mine && checkOpen && mine.status !== 'checked_in' && mine.checked_in !== true
              ? `<button class="checkInBtn gold" data-id="${safe(tournament.id)}" data-team="${safe(mine.team_id)}">Check In</button>`
              : ''}

            ${mine && (mine.status === 'checked_in' || mine.checked_in === true)
              ? `<span class="pill">Checked In</span>`
              : ''}

            ${missed ? `<span class="pill">Missed Check-In</span>` : ''}
          </article>
        `);
      }

      box.innerHTML = htmlParts.join('');

      document.querySelectorAll('.signupBtn').forEach(btn => {
        btn.addEventListener('click', () => registerTournament(btn.dataset.id));
      });

      document.querySelectorAll('.checkInBtn').forEach(btn => {
        btn.addEventListener('click', () => checkInTeam(btn.dataset.id, btn.dataset.team));
      });

      setStatus(`Loaded ${tournaments.length} tournaments.`);

    }catch(error){
      console.error(error);
      box.innerHTML = `<div class="log">Tournament load error: ${safe(error.message)}</div>`;
      setStatus('Tournament load error: ' + error.message);
    }
  }

  async function init(){
    try{
      supabase = await getSupabase();
      await loadUserAndTeams();
      await loadTournaments();
    }catch(error){
      console.error(error);
      setStatus('Tournaments page error: ' + error.message);
    }
  }

  init();
})();
