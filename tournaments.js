import { supabase, safe } from './app.js';

const box = document.getElementById('tournamentsBox');
const statusBox = document.getElementById('tournamentStatus');

let currentUser = null;
let currentProfile = null;
let myTeams = [];
let tournaments = [];

function setStatus(message){
  statusBox.textContent = message;
}

function isWccTournament(t){
  const text = [
    t.name,
    t.tournament_category,
    t.format,
    t.division,
    t.gender_restriction
  ].join(' ').toLowerCase();

  return (
    t.gender_restriction === 'female_only' ||
    text.includes('wcc') ||
    text.includes('women') ||
    text.includes('women’s') ||
    text.includes("women's") ||
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
    team.gender_restriction === 'female_only' ||
    text.includes('wcc') ||
    text.includes('women') ||
    text.includes('female')
  );
}

async function getUser(){
  const session = await supabase.auth.getSession();
  return session?.data?.session?.user || null;
}

async function loadProfile(user){
  if(!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if(error && error.code !== 'PGRST116') throw error;
  return data;
}

async function loadMyTeams(user){
  if(!user) return [];

  const { data, error } = await supabase
    .from('team_memberships')
    .select('team_id, role, status, teams(*)')
    .eq('user_id', user.id)
    .eq('status', 'active');

  if(error) throw error;

  return (data || [])
    .map(row => row.teams)
    .filter(Boolean);
}

async function loadTournaments(){
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('start_date', { ascending:true, nullsFirst:false });

  if(error) throw error;
  return data || [];
}

async function loadRegistrations(tournamentId){
  const { data, error } = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournamentId);

  if(error) return [];
  return data || [];
}

function eligibilityMessage(tournament){
  const wcc = isWccTournament(tournament);

  if(!currentUser){
    return { ok:false, message:'Sign in to register.', action:'login' };
  }

  if(!currentProfile){
    return { ok:false, message:'Complete your profile before registering.', action:'profile' };
  }

  if(!currentProfile.gender){
    return { ok:false, message:'Select and save gender on your profile before registering.', action:'profile' };
  }

  if(wcc && currentProfile.gender === 'male'){
    return { ok:false, message:'Male users cannot register for WCC / Women’s Console Circuit events.' };
  }

  const eligibleTeams = myTeams.filter(team => {
    if(wcc) return isWccTeam(team);
    return !isWccTeam(team);
  });

  if(!eligibleTeams.length){
    if(wcc){
      return { ok:false, message:'You need to be on a WCC team to register for this event.', action:'teams' };
    }
    return { ok:false, message:'You need to be on a regular VCC team to register for this event.', action:'teams' };
  }

  return { ok:true, message:'Eligible to register.', teams:eligibleTeams };
}

async function registerForTournament(tournamentId){
  const tournament = tournaments.find(t => t.id === tournamentId);
  if(!tournament){
    alert('Tournament not found.');
    return;
  }

  const check = eligibilityMessage(tournament);

  if(!check.ok){
    alert(check.message);

    if(check.action === 'login') location.href = 'auth.html?mode=login';
    if(check.action === 'profile') location.href = 'profile.html';
    if(check.action === 'teams') location.href = 'teams.html';

    return;
  }

  const team = check.teams[0];

  const already = await supabase
    .from('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournament.id)
    .eq('team_id', team.id)
    .maybeSingle();

  if(already.data){
    alert('This team is already registered for this tournament.');
    return;
  }

  const { error } = await supabase
    .from('tournament_registrations')
    .insert({
      tournament_id:tournament.id,
      team_id:team.id,
      profile_id:currentUser.id,
      status:'registered'
    });

  if(error){
    alert(error.message);
    return;
  }

  alert(`Registered ${team.name} for ${tournament.name}.`);
  await render();
}

async function render(){
  box.innerHTML = '';

  if(!tournaments.length){
    box.innerHTML = '<div class="vcc-card"><h2>No tournaments available yet.</h2></div>';
    setStatus('No tournaments found.');
    return;
  }

  const cards = [];

  for(const t of tournaments){
    const wcc = isWccTournament(t);
    const check = eligibilityMessage(t);
    const registrations = await loadRegistrations(t.id);
    const teamsCount = registrations.length;

    cards.push(`
      <article class="vcc-card">
        <div class="vcc-panel-title">
          <h2>${safe(t.name || 'VCC Tournament')}</h2>
          <span>${wcc ? 'WCC / Female Only' : 'Open VCC Event'}</span>
        </div>

        <p>${safe(t.description || 'No description posted yet.')}</p>

        <div>
          <span class="pill">${safe(t.status || 'upcoming')}</span>
          <span class="pill">Division: ${safe(t.division || (wcc ? 'WCC' : 'Open'))}</span>
          <span class="pill">Format: ${safe(t.format || 'TBD')}</span>
          <span class="pill">Teams: ${teamsCount}</span>
        </div>

        <br>

        <div class="identity-row">
          <span>Eligibility</span>
          <strong>${safe(check.message)}</strong>
        </div>

        <button class="joinTournamentBtn ${check.ok ? 'green' : 'secondary'}"
          data-tournament-id="${safe(t.id)}">
          ${check.ok ? 'Sign Up' : 'Not Eligible'}
        </button>
      </article>
    `);
  }

  box.innerHTML = cards.join('');

  document.querySelectorAll('.joinTournamentBtn').forEach(btn => {
    btn.addEventListener('click', () => {
      registerForTournament(btn.dataset.tournamentId);
    });
  });

  setStatus(currentUser
    ? `Signed in as ${currentUser.email || currentUser.id}.`
    : 'You can view events, but must sign in to register.');
}

async function init(){
  try{
    currentUser = await getUser();
    currentProfile = await loadProfile(currentUser);
    myTeams = await loadMyTeams(currentUser);
    tournaments = await loadTournaments();

    await render();
  }catch(error){
    setStatus('Tournament page error: ' + error.message);
  }
}

init();
