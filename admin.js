// VCC Admin Full Page Lock + tournament edit controls
// FULL FIX: start_date is the source of truth.
// Editing Start Time updates the real tournament start_date.
// Check-in always auto-calculates as 30 minutes before start.

(function(){
  const ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';
  let unlockedCode = sessionStorage.getItem('vcc_admin_code') || '';
  let tournamentsCache = [];

  const adminCodeInput = document.getElementById('adminCode');
  const adminLockScreen = document.getElementById('adminLockScreen');
  const adminPageContent = document.getElementById('adminPageContent');
  const lockStatus = document.getElementById('adminLockStatus');
  const statusBox = document.getElementById('adminStatus');
  const tournamentsBox = document.getElementById('adminTournamentsBox');

  function setStatus(msg){ if(statusBox) statusBox.textContent = msg; }
  function setLock(msg){ if(lockStatus) lockStatus.textContent = msg; }

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

  function showLocked(){
    if(adminLockScreen) adminLockScreen.classList.remove('admin-hidden');
    if(adminPageContent) adminPageContent.classList.add('admin-hidden');
  }

  function showUnlocked(){
    if(adminLockScreen) adminLockScreen.classList.add('admin-hidden');
    if(adminPageContent) adminPageContent.classList.remove('admin-hidden');
  }

  async function unlockIfValid(){
    const value = adminCodeInput?.value?.trim() || '';

    if(value !== ADMIN_CODE){
      setLock('Wrong admin code.');
      return;
    }

    unlockedCode = value;
    sessionStorage.setItem('vcc_admin_code', value);
    showUnlocked();
    setStatus('Admin unlocked.');
    await loadTournaments();
  }

  function lockAdmin(){
    sessionStorage.removeItem('vcc_admin_code');
    unlockedCode = '';
    if(adminCodeInput) adminCodeInput.value = '';
    showLocked();
    setLock('Admin locked.');
  }

  function initLock(){
    if(unlockedCode === ADMIN_CODE){
      if(adminCodeInput) adminCodeInput.value = ADMIN_CODE;
      showUnlocked();
      loadTournaments();
    }else{
      showLocked();
    }
  }

  function n(id){
    const value = Number(document.getElementById(id)?.value || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function getValue(id){
    return document.getElementById(id)?.value || '';
  }

  // datetime-local returns local time. This stores it correctly as ISO/UTC.
  function dateOrNull(id){
    const value = getValue(id);
    if(!value) return null;

    const date = new Date(value);
    if(Number.isNaN(date.getTime())) return null;

    return date.toISOString();
  }

  function toLocalInputValue(iso){
    if(!iso) return '';

    const date = new Date(iso);
    if(Number.isNaN(date.getTime())) return '';

    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,16);
  }

  function checkInOpens(startIso){
    if(!startIso) return null;
    const start = new Date(startIso);
    if(Number.isNaN(start.getTime())) return null;
    return new Date(start.getTime() - 30 * 60 * 1000).toISOString();
  }

  function syncWcc(){
    const div = document.getElementById('tDivision');
    const gender = document.getElementById('tGenderRestriction');
    const cat = document.getElementById('tCategory');

    if(!div || !gender || !cat) return;

    if(
      div.value === 'wcc' ||
      gender.value === 'female_only' ||
      cat.value.toLowerCase().includes('wcc') ||
      cat.value.toLowerCase().includes('women')
    ){
      div.value = 'wcc';
      gender.value = 'female_only';
    }
  }

  function getPayload(){
    syncWcc();

    const startIso = dateOrNull('tStart');
    const rosterIso = dateOrNull('tRosterLock');

    return {
      admin_code:unlockedCode,
      name:getValue('tName').trim(),
      description:getValue('tDesc').trim(),
      tournament_category:getValue('tCategory') || 'Open Qualifier',
      format:getValue('tFormat') || 'Single Elimination',
      status:getValue('tStatus') || 'open',
      division:getValue('tDivision') || 'open',
      gender_restriction:getValue('tGenderRestriction') || 'none',

      // IMPORTANT:
      // These are the actual database fields used everywhere.
      start_date:startIso,
      roster_lock_at:rosterIso,
      check_in_opens_at:checkInOpens(startIso),
      check_in_closes_at:startIso,

      group_count:n('groupCount'),
      teams_per_group:n('teamsPerGroup'),
      advance_per_group:n('advancePerGroup')
    };
  }

  async function requireUnlocked(){
    if(unlockedCode !== ADMIN_CODE){
      throw new Error('Admin is locked. Enter the admin code first.');
    }
  }

  async function createTournament(){
    try{
      await requireUnlocked();

      const payload = getPayload();

      if(!payload.name){
        setStatus('Tournament name is required.');
        return;
      }

      if(!payload.start_date){
        setStatus('Start time is required.');
        return;
      }

      setStatus('Creating tournament...');
      const supabase = await getSupabase();

      const result = await supabase.rpc('create_tournament_with_admin_code', payload);
      if(result.error) throw result.error;

      setStatus(`Tournament created.\nID: ${result.data}`);
      await loadTournaments();
      clearForm();
    }catch(error){
      setStatus('Create tournament error: ' + error.message);
    }
  }

  async function updateTournament(){
    try{
      await requireUnlocked();

      const tournamentId = getValue('editingTournamentId');

      if(!tournamentId){
        setStatus('No tournament selected for edit.');
        return;
      }

      const payload = getPayload();
      payload.tournament_id = tournamentId;

      if(!payload.name){
        setStatus('Tournament name is required.');
        return;
      }

      if(!payload.start_date){
        setStatus('Start time is required.');
        return;
      }

      setStatus('Saving tournament edits...');
      const supabase = await getSupabase();

      // First update all tournament details.
      const result = await supabase.rpc('update_tournament_with_admin_code', payload);
      if(result.error) throw result.error;

      // Second force-save the true start_date and auto check-in window.
      // This fixes the issue where roster lock updates but start time stays stuck.
      const forceResult = await supabase.rpc('set_tournament_start_time_admin', {
        admin_code:unlockedCode,
        p_tournament_id:tournamentId,
        p_start_date:payload.start_date
      });

      if(forceResult.error) throw forceResult.error;

      // Roster lock force-save too, so it stays synced.
      const rosterResult = await supabase.rpc('set_tournament_roster_lock_admin', {
        admin_code:unlockedCode,
        p_tournament_id:tournamentId,
        p_roster_lock_at:payload.roster_lock_at
      });

      // Do not hard fail if old SQL does not have roster helper.
      if(rosterResult.error && !String(rosterResult.error.message).includes('function set_tournament_roster_lock_admin')){
        throw rosterResult.error;
      }

      setStatus('Tournament updated. Start time saved. Check-in recalculated.');
      await loadTournaments();
      clearForm();
    }catch(error){
      setStatus('Update tournament error: ' + error.message);
    }
  }

  async function deleteTournament(id){
    try{
      await requireUnlocked();

      if(!confirm('Delete this tournament? This cannot be undone.')) return;

      const supabase = await getSupabase();

      const result = await supabase.rpc('delete_tournament_with_admin_code', {
        admin_code:unlockedCode,
        tournament_id:id
      });

      if(result.error) throw result.error;

      setStatus('Tournament deleted.');
      await loadTournaments();
    }catch(error){
      setStatus('Delete tournament error: ' + error.message);
    }
  }

  async function generateBracket(id){
    try{
      await requireUnlocked();

      const supabase = await getSupabase();

      const result = await supabase.rpc('generate_bracket_with_admin_code', {
        admin_code:unlockedCode,
        tournament_id:id
      });

      if(result.error) throw result.error;

      setStatus(`Bracket generated. Matches created: ${result.data}`);
      await loadTournaments();
    }catch(error){
      setStatus('Generate bracket error: ' + error.message);
    }
  }

  function editTournament(id){
    const t = tournamentsCache.find(x => x.id === id);
    if(!t) return;

    document.getElementById('editingTournamentId').value = t.id;
    document.getElementById('tName').value = t.name || '';
    document.getElementById('tDesc').value = t.description || '';
    document.getElementById('tCategory').value = t.tournament_category || 'Open Qualifier';
    document.getElementById('tFormat').value = t.format || 'Single Elimination';
    document.getElementById('tStatus').value = t.status || 'open';
    document.getElementById('tDivision').value = t.division || 'open';
    document.getElementById('tGenderRestriction').value = t.gender_restriction || 'none';

    // Loads the REAL start time into the edit field.
    document.getElementById('tStart').value = toLocalInputValue(t.start_date);
    document.getElementById('tRosterLock').value = toLocalInputValue(t.roster_lock_at);

    document.getElementById('groupCount').value = t.group_count || 0;
    document.getElementById('teamsPerGroup').value = t.teams_per_group || 0;
    document.getElementById('advancePerGroup').value = t.advance_per_group || 0;

    document.getElementById('formTitle').textContent = 'Edit Tournament';
    document.getElementById('createTournamentBtn').classList.add('hidden');
    document.getElementById('updateTournamentBtn').classList.remove('hidden');
    document.getElementById('cancelEditBtn').classList.remove('hidden');

    setStatus('Editing tournament. Change Start Time, then click Save Edits.');
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function clearForm(){
    const editing = document.getElementById('editingTournamentId');
    if(editing) editing.value = '';

    document.getElementById('formTitle').textContent = 'Create Tournament';
    document.getElementById('createTournamentBtn').classList.remove('hidden');
    document.getElementById('updateTournamentBtn').classList.add('hidden');
    document.getElementById('cancelEditBtn').classList.add('hidden');
  }

  function checkInWindowText(t){
    if(!t.start_date) return 'No start time';

    const start = new Date(t.start_date).getTime();
    const now = Date.now();
    const mins = Math.round((start - now) / 60000);

    if(mins > 30) return `Check-in opens in ${mins - 30} min`;
    if(mins <= 30 && mins > 0) return `Check-in OPEN: ${mins} min until start`;
    return 'Check-in closed';
  }

  function renderTime(iso){
    return iso ? new Date(iso).toLocaleString() : 'Not set';
  }

  async function loadTournaments(){
    try{
      await requireUnlocked();

      const supabase = await getSupabase();
      const result = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending:false });

      if(result.error) throw result.error;

      tournamentsCache = result.data || [];

      if(!tournamentsCache.length){
        tournamentsBox.innerHTML = '<div class="log">No tournaments found.</div>';
        return;
      }

      tournamentsBox.innerHTML = tournamentsCache.map(t => `
        <article class="vcc-card">
          <div class="vcc-panel-title">
            <h2>${safe(t.name)}</h2>
            <span>${safe(t.status || 'upcoming')}</span>
          </div>

          <p>${safe(t.description || 'No description.')}</p>

          <p>
            <span class="pill">Division: ${safe(t.division || 'open')}</span>
            <span class="pill">Restriction: ${safe(t.gender_restriction || 'none')}</span>
            <span class="pill">Format: ${safe(t.format || 'TBD')}</span>
            <span class="pill">${safe(checkInWindowText(t))}</span>
          </p>

          <p class="muted">Start: ${renderTime(t.start_date)}</p>
          <p class="muted">Roster Lock: ${renderTime(t.roster_lock_at)}</p>
          <p class="muted">Check-in: ${renderTime(t.check_in_opens_at)} → ${renderTime(t.check_in_closes_at)}</p>
          <p class="muted">ID: ${safe(t.id)}</p>

          <button class="editBtn" data-id="${safe(t.id)}">Edit</button>
          <button class="deleteBtn secondary" data-id="${safe(t.id)}">Delete</button>
          <button class="generateBtn gold" data-id="${safe(t.id)}">Generate Bracket Now</button>
        </article>
      `).join('');

      document.querySelectorAll('.editBtn').forEach(btn => btn.addEventListener('click', () => editTournament(btn.dataset.id)));
      document.querySelectorAll('.deleteBtn').forEach(btn => btn.addEventListener('click', () => deleteTournament(btn.dataset.id)));
      document.querySelectorAll('.generateBtn').forEach(btn => btn.addEventListener('click', () => generateBracket(btn.dataset.id)));
    }catch(error){
      if(tournamentsBox) tournamentsBox.innerHTML = `<div class="log">Tournament load error: ${safe(error.message)}</div>`;
    }
  }

  document.getElementById('unlockAdminBtn')?.addEventListener('click', unlockIfValid);
  document.getElementById('lockAdminBtn')?.addEventListener('click', lockAdmin);
  adminCodeInput?.addEventListener('keydown', e => { if(e.key === 'Enter') unlockIfValid(); });
  document.getElementById('createTournamentBtn')?.addEventListener('click', createTournament);
  document.getElementById('updateTournamentBtn')?.addEventListener('click', updateTournament);
  document.getElementById('cancelEditBtn')?.addEventListener('click', clearForm);
  document.getElementById('refreshTournamentsBtn')?.addEventListener('click', loadTournaments);
  document.getElementById('tDivision')?.addEventListener('change', syncWcc);
  document.getElementById('tGenderRestriction')?.addEventListener('change', syncWcc);
  document.getElementById('tCategory')?.addEventListener('change', syncWcc);

  initLock();
})();
