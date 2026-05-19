// VCC Admin Start Input Reader Fix
// Replace admin.js with this.
// Fixes Start Time input not being read, causing tournaments to save as 7PM.

(function(){
  const ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';
  let supabase = null;
  let unlockedCode = sessionStorage.getItem('vcc_admin_code') || '';
  let tournamentsCache = [];

  function $(id){ return document.getElementById(id); }

  const adminCodeInput = $('adminCode');
  const adminLockScreen = $('adminLockScreen');
  const adminPageContent = $('adminPageContent');
  const lockStatus = $('adminLockStatus');
  const statusBox = $('adminStatus');
  const tournamentsBox = $('adminTournamentsBox');

  function setStatus(msg){
    if(statusBox) statusBox.textContent = msg;
    console.log('[Admin]', msg);
  }

  function setLock(msg){
    if(lockStatus) lockStatus.textContent = msg;
  }

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

  function normalize(v){
    return String(v || '').trim().toLowerCase();
  }

  // Finds inputs even if your HTML ID is not what the script expected.
  function findInput(possibleIds, words){
    for(const id of possibleIds){
      const el = $(id);
      if(el) return el;
    }

    const wanted = words.map(normalize);
    const inputs = [...document.querySelectorAll('input, select, textarea')];

    // Match placeholder, name, id, aria-label.
    for(const input of inputs){
      const text = [
        input.id,
        input.name,
        input.placeholder,
        input.getAttribute('aria-label')
      ].map(normalize).join(' ');

      if(wanted.some(w => text.includes(w))){
        return input;
      }
    }

    // Match nearby label/parent text.
    for(const input of inputs){
      const parentText = normalize(input.closest('label, div, section, article, form')?.innerText || '');
      if(wanted.some(w => parentText.includes(w))){
        return input;
      }
    }

    return null;
  }

  function inputValue(ids, words){
    const el = findInput(ids, words);
    return el ? el.value : '';
  }

  function setInputValue(ids, words, value){
    const el = findInput(ids, words);
    if(el) el.value = value || '';
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
    return $(id)?.value || '';
  }

  function n(id){
    const value = Number(getValue(id) || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function parseLocalDateTime(raw, fieldName){
    if(!raw){
      throw new Error(`${fieldName} is required.`);
    }

    // datetime-local usually gives YYYY-MM-DDTHH:mm.
    // Some browsers may display MM/DD/YYYY, HH:MM AM but value is still parseable.
    const date = new Date(raw);

    if(Number.isNaN(date.getTime())){
      throw new Error(`${fieldName} has invalid date/time: ${raw}`);
    }

    return date.toISOString();
  }

  function getStartIso(){
    const raw = inputValue(
      ['tStart','startTime','startDate','tournamentStart','start_date','start_time'],
      ['start time','start date','tournament start']
    );

    console.log('[Admin] raw start input:', raw);
    return parseLocalDateTime(raw, 'Start Time');
  }

  function getRosterLockIso(){
    const raw = inputValue(
      ['tRosterLock','rosterLock','rosterLockAt','roster_lock_at'],
      ['roster lock']
    );

    if(!raw) return null;

    console.log('[Admin] raw roster lock input:', raw);
    return parseLocalDateTime(raw, 'Roster Lock');
  }

  function isoToDateTimeLocal(iso){
    if(!iso) return '';
    const date = new Date(iso);
    if(Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,16);
  }

  function checkInOpenIso(startIso){
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
    const div = $('tDivision');
    const gender = $('tGenderRestriction');
    const cat = $('tCategory');

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

    const startIso = getStartIso();
    const rosterIso = getRosterLockIso();

    return {
      name:getValue('tName').trim(),
      description:getValue('tDesc').trim(),
      tournament_category:getValue('tCategory') || 'Open Qualifier',
      format:getValue('tFormat') || 'Single Elimination',
      status:getValue('tStatus') || 'open',
      division:getValue('tDivision') || 'open',
      gender_restriction:getValue('tGenderRestriction') || 'none',

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

      setStatus(`Creating tournament with start: ${dateText(payload.start_date)}`);

      const db = await getSupabase();

      const result = await db
        .from('tournaments')
        .insert(payload)
        .select()
        .single();

      if(result.error) throw result.error;

      setStatus(`Tournament created. Saved start: ${dateText(result.data.start_date)}`);
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

      setStatus(`Saving tournament with start: ${dateText(payload.start_date)}`);

      const db = await getSupabase();

      const result = await db
        .from('tournaments')
        .update(payload)
        .eq('id', tournamentId)
        .select()
        .single();

      if(result.error) throw result.error;

      setStatus(`Tournament updated. Saved start: ${dateText(result.data.start_date)}`);
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

  function trueStart(t){
    return t.start_date || t.start_time || t.starts_at || t.start_at || t.event_start || null;
  }

  function editTournament(id){
    const t = tournamentsCache.find(x => x.id === id);
    if(!t) return;

    const start = trueStart(t);

    $('editingTournamentId').value = t.id;
    $('tName').value = t.name || '';
    $('tDesc').value = t.description || '';
    $('tCategory').value = t.tournament_category || 'Open Qualifier';
    $('tFormat').value = t.format || 'Single Elimination';
    $('tStatus').value = t.status || 'open';
    $('tDivision').value = t.division || 'open';
    $('tGenderRestriction').value = t.gender_restriction || 'none';

    setInputValue(['tStart','startTime','startDate','tournamentStart','start_date','start_time'], ['start time','start date','tournament start'], isoToDateTimeLocal(start));
    setInputValue(['tRosterLock','rosterLock','rosterLockAt','roster_lock_at'], ['roster lock'], isoToDateTimeLocal(t.roster_lock_at));

    $('groupCount').value = t.group_count || 0;
    $('teamsPerGroup').value = t.teams_per_group || 0;
    $('advancePerGroup').value = t.advance_per_group || 0;

    $('formTitle').textContent = 'Edit Tournament';
    $('createTournamentBtn').classList.add('hidden');
    $('updateTournamentBtn').classList.remove('hidden');
    $('cancelEditBtn').classList.remove('hidden');

    setStatus('Editing tournament. Change Start Time, then click Save Edits.');
    window.scrollTo({ top:0, behavior:'smooth' });
  }

  function clearForm(){
    const editing = $('editingTournamentId');
    if(editing) editing.value = '';

    $('formTitle').textContent = 'Create Tournament';
    $('createTournamentBtn').classList.remove('hidden');
    $('updateTournamentBtn').classList.add('hidden');
    $('cancelEditBtn').classList.add('hidden');
  }

  function checkInWindowText(t){
    const startIso = trueStart(t);

    if(!startIso) return 'No start time';

    const start = new Date(startIso).getTime();
    const mins = Math.round((start - Date.now()) / 60000);

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
        const start = trueStart(t);
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

  $('unlockAdminBtn')?.addEventListener('click', unlockIfValid);
  $('lockAdminBtn')?.addEventListener('click', lockAdmin);
  adminCodeInput?.addEventListener('keydown', e => { if(e.key === 'Enter') unlockIfValid(); });
  $('createTournamentBtn')?.addEventListener('click', createTournament);
  $('updateTournamentBtn')?.addEventListener('click', updateTournament);
  $('cancelEditBtn')?.addEventListener('click', clearForm);
  $('refreshTournamentsBtn')?.addEventListener('click', loadTournaments);
  $('tDivision')?.addEventListener('change', syncWcc);
  $('tGenderRestriction')?.addEventListener('change', syncWcc);
  $('tCategory')?.addEventListener('change', syncWcc);

  initLock();
})();
