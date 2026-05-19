// VCC Admin Tournament Time Direct Save Fix
// Replace admin.js with this.
// Fixes tournament start time always saving/showing as 7PM.
// This bypasses old broken time RPC logic and directly saves start_date.

(function(){
  const ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';
  let supabase = null;
  let unlockedCode = sessionStorage.getItem('vcc_admin_code') || '';
  let tournamentsCache = [];

  const adminCodeInput = document.getElementById('adminCode');
  const adminLockScreen = document.getElementById('adminLockScreen');
  const adminPageContent = document.getElementById('adminPageContent');
  const lockStatus = document.getElementById('adminLockStatus');
  const statusBox = document.getElementById('adminStatus');
  const tournamentsBox = document.getElementById('adminTournamentsBox');

  function setStatus(msg){ if(statusBox) statusBox.textContent = msg; console.log('[Admin]', msg); }
  function setLock(msg){ if(lockStatus) lockStatus.textContent = msg; }

  function safe(value){
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[c]));
  }

  async function getSupabase(){
    if(supabase) return supabase;
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    supabase = lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return supabase;
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

  function requireUnlocked(){
    if(unlockedCode !== ADMIN_CODE){
      throw new Error('Admin is locked. Enter the admin code first.');
    }
  }

  function getValue(id){
    return document.getElementById(id)?.value || '';
  }

  function n(id){
    const value = Number(getValue(id) || 0);
    return Number.isFinite(value) ? value : 0;
  }

  // IMPORTANT:
  // Reads datetime-local exactly as local time, then converts to ISO for Supabase.
  // If you choose 2026-05-17T03:00, it saves that exact local 3AM instant.
  function dateTimeLocalToIso(id){
    const value = getValue(id);

    if(!value){
      return null;
    }

    const date = new Date(value);

    if(Number.isNaN(date.getTime())){
      throw new Error(`${id} has an invalid date/time.`);
    }

    return date.toISOString();
  }

  function isoToDateTimeLocal(iso){
    if(!iso) return '';

    const date = new Date(iso);
    if(Number.isNaN(date.getTime())) return '';

    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,16);
  }

  function checkInOpenIso(startIso){
    if(!startIso) return null;

    const start = new Date(startIso);
    return new Date(start.getTime() - 30 * 60 * 1000).toISOString();
  }

  function dateText(iso){
    if(!iso) return 'Not set';

    const date = new Date(iso);
    if(Number.isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleString();
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

  function payloadFromForm(){
    syncWcc();

    const startIso = dateTimeLocalToIso('tStart');
    const rosterIso = dateTimeLocalToIso('tRosterLock');

    if(!startIso){
      throw new Error('Start time is required.');
    }

    return {
      name:getValue('tName').trim(),
      description:getValue('tDesc').trim(),
      tournament_category:getValue('tCategory') || 'Open Qualifier',
      format:getValue('tFormat') || 'Single Elimination',
      status:getValue('tStatus') || 'open',
      division:getValue('tDivision') || 'open',
      gender_restriction:getValue('tGenderRestriction') || 'none',

      // Save every possible start column so no old page can read a stale 7PM column.
      start_date:startIso,
      start_time:startIso,
      starts_at:startIso,
      start_at:startIso,
      event_start:startIso,

      roster_lock_at:rosterIso,

      check_in_opens_at:checkInOpenIso(startIso),
      check_in_start:checkInOpenIso(startIso),
      check_in_closes_at:startIso,
      check_in_end:startIso,

      group_count:n('groupCount'),
      teams_per_group:n('teamsPerGroup'),
      advance_per_group:n('advancePerGroup')
    };
  }

  async function createTournament(){
    try{
      requireUnlocked();

      const payload = payloadFromForm();

      if(!payload.name){
        setStatus('Tournament name is required.');
        return;
      }

      setStatus('Creating tournament...');

      const db = await getSupabase();

      const result = await db
        .from('tournaments')
        .insert(payload)
        .select()
        .single();

      if(result.error) throw result.error;

      setStatus('Tournament created.');
      clearForm();
      await loadTournaments();

    }catch(error){
      setStatus('Create tournament error: ' + error.message);
    }
  }

  async function updateTournament(){
    try{
      requireUnlocked();

      const tournamentId = getValue('editingTournamentId');

      if(!tournamentId){
        setStatus('No tournament selected for edit.');
        return;
      }

      const payload = payloadFromForm();

      if(!payload.name){
        setStatus('Tournament name is required.');
        return;
      }

      setStatus('Saving tournament edits...');

      const db = await getSupabase();

      const result = await db
        .from('tournaments')
        .update(payload)
        .eq('id', tournamentId)
        .select()
        .single();

      if(result.error) throw result.error;

      setStatus('Tournament updated. Start time saved exactly.');
      clearForm();
      await loadTournaments();

    }catch(error){
      setStatus('Update tournament error: ' + error.message);
    }
  }

  async function deleteTournament(id){
    try{
      requireUnlocked();

      if(!confirm('Delete this tournament?')) return;

      const db = await getSupabase();

      const result = await db
        .from('tournaments')
        .delete()
        .eq('id', id);

      if(result.error) throw result.error;

      setStatus('Tournament deleted.');
      await loadTournaments();

    }catch(error){
      setStatus('Delete tournament error: ' + error.message);
    }
  }

  async function generateBracket(id){
    try{
      requireUnlocked();

      const db = await getSupabase();

      const result = await db.rpc('generate_bracket_with_admin_code', {
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

    const start = t.start_date || t.start_time || t.starts_at || t.start_at || t.event_start || null;

    document.getElementById('editingTournamentId').value = t.id;
    document.getElementById('tName').value = t.name || '';
    document.getElementById('tDesc').value = t.description || '';
    document.getElementById('tCategory').value = t.tournament_category || 'Open Qualifier';
    document.getElementById('tFormat').value = t.format || 'Single Elimination';
    document.getElementById('tStatus').value = t.status || 'open';
    document.getElementById('tDivision').value = t.division || 'open';
    document.getElementById('tGenderRestriction').value = t.gender_restriction || 'none';

    document.getElementById('tStart').value = isoToDateTimeLocal(start);
    document.getElementById('tRosterLock').value = isoToDateTimeLocal(t.roster_lock_at);

    document.getElementById('groupCount').value = t.group_count || 0;
    document.getElementById('teamsPerGroup').value = t.teams_per_group || 0;
    document.getElementById('advancePerGroup').value = t.advance_per_group || 0;

    document.getElementById('formTitle').textContent = 'Edit Tournament';
    document.getElementById('createTournamentBtn').classList.add('hidden');
    document.getElementById('updateTournamentBtn').classList.remove('hidden');
    document.getElementById('cancelEditBtn').classList.remove('hidden');

    setStatus('Editing tournament. Change the Start Time field, then click Save Edits.');
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
    const startIso = t.start_date || t.start_time || t.starts_at || t.start_at || t.event_start || null;

    if(!startIso) return 'No start time';

    const start = new Date(startIso).getTime();
    const now = Date.now();
    const mins = Math.round((start - now) / 60000);

    if(mins > 30) return `Check-in opens in ${mins - 30} min`;
    if(mins <= 30 && mins > 0) return `Check-in OPEN: ${mins} min until start`;
    return 'Check-in closed';
  }

  async function loadTournaments(){
    try{
      requireUnlocked();

      const db = await getSupabase();

      const result = await db
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending:false });

      if(result.error) throw result.error;

      tournamentsCache = result.data || [];

      if(!tournamentsBox) return;

      if(!tournamentsCache.length){
        tournamentsBox.innerHTML = '<div class="log">No tournaments found.</div>';
        return;
      }

      tournamentsBox.innerHTML = tournamentsCache.map(t => {
        const start = t.start_date || t.start_time || t.starts_at || t.start_at || t.event_start || null;
        const checkOpen = checkInOpenIso(start);

        return `
          <article class="vcc-card">
            <div class="vcc-panel-title">
              <h2>${safe(t.name)}</h2>
              <span>${safe(t.status || 'open')}</span>
            </div>

            <p>${safe(t.description || 'No description.')}</p>

            <p>
              <span class="pill">Division: ${safe(t.division || 'open')}</span>
              <span class="pill">Restriction: ${safe(t.gender_restriction || 'none')}</span>
              <span class="pill">Format: ${safe(t.format || 'TBD')}</span>
              <span class="pill">${safe(checkInWindowText(t))}</span>
            </p>

            <p class="muted">Start: ${dateText(start)}</p>
            <p class="muted">Roster Lock: ${dateText(t.roster_lock_at)}</p>
            <p class="muted">Check-in: ${dateText(checkOpen)} → ${dateText(start)}</p>
            <p class="muted">ID: ${safe(t.id)}</p>

            <button class="editBtn" data-id="${safe(t.id)}">Edit</button>
            <button class="deleteBtn secondary" data-id="${safe(t.id)}">Delete</button>
            <button class="generateBtn gold" data-id="${safe(t.id)}">Generate Bracket Now</button>
          </article>
        `;
      }).join('');

      document.querySelectorAll('.editBtn').forEach(btn => btn.addEventListener('click', () => editTournament(btn.dataset.id)));
      document.querySelectorAll('.deleteBtn').forEach(btn => btn.addEventListener('click', () => deleteTournament(btn.dataset.id)));
      document.querySelectorAll('.generateBtn').forEach(btn => btn.addEventListener('click', () => generateBracket(btn.dataset.id)));

    }catch(error){
      if(tournamentsBox) tournamentsBox.innerHTML = `<div class="log">Tournament load error: ${safe(error.message)}</div>`;
      setStatus('Tournament load error: ' + error.message);
    }
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
