import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const statusBox = document.getElementById('adminStatus');
const tournamentsBox = document.getElementById('adminTournamentsBox');

function setStatus(message){
  statusBox.textContent = message;
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

function asNumber(id){
  const value = Number(document.getElementById(id).value || 0);
  return Number.isFinite(value) ? value : 0;
}

function nullableDate(id){
  const value = document.getElementById(id).value;
  return value ? new Date(value).toISOString() : null;
}

function isWccDivision(){
  return document.getElementById('tDivision').value === 'wcc'
    || document.getElementById('tGenderRestriction').value === 'female_only'
    || document.getElementById('tCategory').value.toLowerCase().includes('wcc')
    || document.getElementById('tCategory').value.toLowerCase().includes('women');
}

function syncWccFields(){
  if(document.getElementById('tDivision').value === 'wcc'){
    document.getElementById('tGenderRestriction').value = 'female_only';
  }

  if(document.getElementById('tGenderRestriction').value === 'female_only'){
    document.getElementById('tDivision').value = 'wcc';
  }
}

async function getUser(){
  const session = await supabase.auth.getSession();
  return session?.data?.session?.user || null;
}

async function isAdmin(user){
  if(!user) return false;

  const { data, error } = await supabase
    .from('admins')
    .select('user_id,email')
    .eq('user_id', user.id)
    .maybeSingle();

  if(error){
    console.warn(error);
    return false;
  }

  return !!data;
}

async function requireAdmin(){
  if(!SUPABASE_URL || SUPABASE_URL.includes('PASTE_') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PASTE_')){
    throw new Error('Supabase keys are missing in supabase-config.js');
  }

  const user = await getUser();

  if(!user){
    throw new Error('You must sign in first before using admin tools.');
  }

  const ok = await isAdmin(user);

  if(!ok){
    throw new Error(`Signed in as ${user.email || user.id}, but this account is not in the admins table.`);
  }

  return user;
}

async function createTournament(){
  try{
    setStatus('Checking admin access...');

    const user = await requireAdmin();

    syncWccFields();

    const name = document.getElementById('tName').value.trim();

    if(!name){
      setStatus('Tournament name is required.');
      return;
    }

    const payload = {
      name,
      description:document.getElementById('tDesc').value.trim(),
      tournament_category:document.getElementById('tCategory').value,
      format:document.getElementById('tFormat').value,
      status:document.getElementById('tStatus').value,
      division:document.getElementById('tDivision').value,
      gender_restriction:document.getElementById('tGenderRestriction').value,
      start_date:nullableDate('tStart'),
      roster_lock_at:nullableDate('tRosterLock'),
      group_count:asNumber('groupCount'),
      teams_per_group:asNumber('teamsPerGroup'),
      advance_per_group:asNumber('advancePerGroup'),
      current_week:0
    };

    if(isWccDivision()){
      payload.division = 'wcc';
      payload.gender_restriction = 'female_only';
    }

    setStatus('Creating tournament...');

    const { data, error } = await supabase
      .from('tournaments')
      .insert(payload)
      .select()
      .single();

    if(error) throw error;

    setStatus(`Tournament created successfully by ${user.email || user.id}.\nTournament ID: ${data.id}`);
    await loadTournaments();

  }catch(error){
    setStatus('Create tournament error: ' + error.message);
  }
}

async function loadTournaments(){
  try{
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending:false });

    if(error) throw error;

    if(!data || !data.length){
      tournamentsBox.innerHTML = '<div class="log">No tournaments found.</div>';
      return;
    }

    tournamentsBox.innerHTML = data.map(t => `
      <article class="vcc-card">
        <div class="vcc-panel-title">
          <h2>${safe(t.name)}</h2>
          <span>${safe(t.status || 'upcoming')}</span>
        </div>

        <p>${safe(t.description || 'No description.')}</p>

        <div>
          <span class="pill">Division: ${safe(t.division || 'open')}</span>
          <span class="pill">Restriction: ${safe(t.gender_restriction || 'none')}</span>
          <span class="pill">Format: ${safe(t.format || 'TBD')}</span>
          <span class="pill">Category: ${safe(t.tournament_category || 'Event')}</span>
        </div>

        <p class="muted">ID: ${safe(t.id)}</p>
      </article>
    `).join('');
  }catch(error){
    tournamentsBox.innerHTML = `<div class="log">Load tournament error: ${safe(error.message)}</div>`;
  }
}

document.getElementById('createTournamentBtn')?.addEventListener('click', createTournament);
document.getElementById('refreshTournamentsBtn')?.addEventListener('click', loadTournaments);
document.getElementById('tDivision')?.addEventListener('change', syncWccFields);
document.getElementById('tGenderRestriction')?.addEventListener('change', syncWccFields);

loadTournaments();
