// VCC Tournaments Page - Show Created Tournaments Fix
// Replace tournaments.js with this.

(function(){
  if(window.__VCC_TOURNAMENTS_PAGE_LOADED__){
    console.warn('VCC tournaments page already loaded once.');
    return;
  }
  window.__VCC_TOURNAMENTS_PAGE_LOADED__ = true;

  let supabase = null;
  let currentUser = null;
  let profile = null;
  let myTeams = [];

  const box =
    document.getElementById('tournamentsBox') ||
    document.getElementById('eventsBox') ||
    document.querySelector('[data-tournaments-box]') ||
    document.querySelector('.list');

  const statusBox =
    document.getElementById('tournamentStatus') ||
    document.getElementById('status') ||
    document.querySelector('.log');

  function setStatus(message){
    if(statusBox) statusBox.textContent = message;
    console.log('[VCC Tournaments]', message);
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

  function checkInOpen(startIso){
    if(!startIso) return null;
    const d = new Date(startIso);
    if(Number.isNaN(d.getTime())) return null;
    return new Date(d.getTime() - 30 * 60 * 1000).toISOString();
  }

  function dateText(iso){
    if(!iso) return 'Not set';
    const d = new Date(iso);
    if(Number.isNaN(d.getTime())) return 'Invalid date';
    return d.toLocaleString();
  }

  function checkInStatus(startIso){
    if(!startIso) return 'No start time';

    const start = new Date(startIso).getTime();
    if(Number.isNaN(start)) return 'Invalid start time';

    const diffMin = Math.floor((start - Date.now()) / 60000);

    if(diffMin > 30) return `Check-in opens in ${diffMin - 30} min`;
    if(diffMin > 0) return 'Check-in OPEN';
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

  async function loadUser(){
    const session = await supabase.auth.getSession();
    currentUser = session?.data?.session?.user || null;

    if(!currentUser){
      setStatus('Sign in to register/check in.');
      return;
    }

    const profileRes = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    profile = profileRes.data || null;

    const teamsRes = await supabase
      .from('team_memberships')
      .select('*, teams(*)')
      .or(`user_id.eq.${currentUser.id},player_id.eq.${currentUser.id}`)
      .eq('status','active');

    myTeams = (teamsRes.data || []).map(row => row.teams).filter(Boolean);

    setStatus(`Signed in as ${currentUser.email}.`);
  }

  async function loadRegistrations(tournamentId){
    const res = await supabase
      .from('tournament_registrations')
      .select('*')
      .eq('tournament_id', tournamentId);

    return res.data || [];
  }

  function eligibleTeamsFor(tournament){
    const wcc = isWccTournament(tournament);

    if(!currentUser) return [];
    if(wcc && profile?.gender === 'male') return [];

    return myTeams.filter(team => wcc ? isWccTeam(team) : !isWccTeam(team));
  }

  async function registerTournament(tournamentId){
    try{
      if(!currentUser){
        location.href = 'auth.html?mode=login';
        return;
      }

      const t = window.__VCC_TOURNAMENT_CACHE__.find(x => x.id === tournamentId);
      if(!t){
        alert('Tournament not found.');
        return;
      }

      if(isWccTournament(t) && profile?.gender === 'male'){
        alert('Male users cannot register for WCC tournaments.');
        return;
      }

      const teams = eligibleTeamsFor(t);
      if(!teams.length){
        alert(isWccTournament(t) ? 'You need a WCC team to register.' : 'You need a regular team to register.');
        return;
      }

      const team = teams[0];

      const insert = await supabase
        .from('tournament_registrations')
        .insert({
          tournament_id:tournamentId,
          team_id:team.id,
          profile_id:currentUser.id,
          status:'registered'
        });

      if(insert.error) throw insert.error;

      alert(`${team.name} registered.`);
      await loadTournaments();

    }catch(error){
      alert('Register error: ' + error.message);
    }
  }

  async function loadTournaments(){
    try{
      if(!box){
        setStatus('Missing tournamentsBox on page.');
        return;
      }

      box.innerHTML = '<div class="log">Loading tournaments...</div>';

      const res = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending:false });

      if(res.error) throw res.error;

      const unique = [];
      const seen = new Set();

      (res.data || []).forEach(t => {
        if(!t.id || seen.has(t.id)) return;
        seen.add(t.id);
        unique.push(t);
      });

      window.__VCC_TOURNAMENT_CACHE__ = unique;

      if(!unique.length){
        box.innerHTML = '<div class="log">No tournaments have been created yet.</div>';
        setStatus('No tournaments found.');
        return;
      }

      const cards = [];

      for(const t of unique){
        const start = trueStart(t);
        const regs = await loadRegistrations(t.id);
        const mine = currentUser
          ? regs.find(r => r.profile_id === currentUser.id || myTeams.some(team => team.id === r.team_id))
          : null;

        const checkOpen = checkInOpen(start);
        const teams = eligibleTeamsFor(t);
        const wcc = isWccTournament(t);
        const canSignUp = currentUser && !mine && teams.length > 0;

        cards.push(`
          <article class="vcc-card">
            <div class="vcc-panel-title">
              <h2>${safe(t.name || 'Tournament')}</h2>
              <span>${safe(wcc ? 'WCC Event' : 'Open Event')}</span>
            </div>

            <p>${safe(t.description || 'No description posted yet.')}</p>

            <p>
              <span class="pill">${safe(t.status || 'open')}</span>
              <span class="pill">Division: ${safe(t.division || 'open')}</span>
              <span class="pill">Format: ${safe(t.format || 'TBD')}</span>
              <span class="pill">Teams: ${safe(regs.length)}</span>
              <span class="pill">${safe(checkInStatus(start))}</span>
            </p>

            <p>Start: ${safe(dateText(start))}</p>
            <p>Check-in: ${safe(dateText(checkOpen))} → ${safe(dateText(start))}</p>

            ${mine ? `<p><span class="pill">Your team status: ${safe(mine.status || 'registered')}</span></p>` : ''}

            ${canSignUp ? `<button class="signupBtn" data-id="${safe(t.id)}">Sign Up</button>` : ''}
            ${!currentUser ? `<a class="btn" href="auth.html?mode=login">Sign In to Register</a>` : ''}
            ${currentUser && !mine && !canSignUp ? `<span class="pill">${wcc && profile?.gender === 'male' ? 'Not eligible for WCC' : 'No eligible team'}</span>` : ''}
          </article>
        `);
      }

      box.innerHTML = cards.join('');

      document.querySelectorAll('.signupBtn').forEach(btn => {
        btn.addEventListener('click', () => registerTournament(btn.dataset.id));
      });

      setStatus(`Loaded ${unique.length} tournaments.`);

    }catch(error){
      if(box) box.innerHTML = `<div class="log">Tournament load error: ${safe(error.message)}</div>`;
      setStatus('Tournament load error: ' + error.message);
    }
  }

  async function init(){
    try{
      supabase = await getSupabase();
      await loadUser();
      await loadTournaments();
    }catch(error){
      setStatus('Tournaments page error: ' + error.message);
    }
  }

  init();
})();
