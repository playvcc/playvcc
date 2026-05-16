// VCC Admin Code RPC Fix - admin code alone creates tournaments.

(function(){
  const ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';
  let unlockedCode = sessionStorage.getItem('vcc_admin_code') || '';

  const adminCodeInput = document.getElementById('adminCode');
  const adminTools = document.getElementById('adminTools');
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

    if(!config.SUPABASE_URL || config.SUPABASE_URL.includes('PASTE_')){
      throw new Error('SUPABASE_URL missing in supabase-config.js');
    }
    if(!config.SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY.includes('PASTE_')){
      throw new Error('SUPABASE_ANON_KEY missing in supabase-config.js');
    }

    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  function unlockIfValid(){
    const value = adminCodeInput.value.trim();
    if(value !== ADMIN_CODE){
      setLock('Wrong admin code.');
      return;
    }
    unlockedCode = value;
    sessionStorage.setItem('vcc_admin_code', value);
    adminTools.classList.remove('hidden');
    setLock('Admin unlocked.');
  }

  function initUnlock(){
    if(unlockedCode === ADMIN_CODE){
      if(adminCodeInput) adminCodeInput.value = ADMIN_CODE;
      adminTools.classList.remove('hidden');
      setLock('Admin unlocked.');
    }
  }

  function n(id){
    const value = Number(document.getElementById(id).value || 0);
    return Number.isFinite(value) ? value : 0;
  }

  function dateOrNull(id){
    const value = document.getElementById(id).value;
    return value ? new Date(value).toISOString() : null;
  }

  function syncWcc(){
    const div = document.getElementById('tDivision');
    const gender = document.getElementById('tGenderRestriction');
    const cat = document.getElementById('tCategory');

    if(div.value === 'wcc' || gender.value === 'female_only' || cat.value.toLowerCase().includes('wcc') || cat.value.toLowerCase().includes('women')){
      div.value = 'wcc';
      gender.value = 'female_only';
    }
  }

  async function createTournament(){
    try{
      if(unlockedCode !== ADMIN_CODE){
        setStatus('Enter the correct admin code first.');
        return;
      }

      syncWcc();

      const name = document.getElementById('tName').value.trim();
      if(!name){
        setStatus('Tournament name is required.');
        return;
      }

      const payload = {
        admin_code:unlockedCode,
        name,
        description:document.getElementById('tDesc').value.trim(),
        tournament_category:document.getElementById('tCategory').value,
        format:document.getElementById('tFormat').value,
        status:document.getElementById('tStatus').value,
        division:document.getElementById('tDivision').value,
        gender_restriction:document.getElementById('tGenderRestriction').value,
        start_date:dateOrNull('tStart'),
        roster_lock_at:dateOrNull('tRosterLock'),
        group_count:n('groupCount'),
        teams_per_group:n('teamsPerGroup'),
        advance_per_group:n('advancePerGroup')
      };

      setStatus('Creating tournament with admin code...');

      const supabase = await getSupabase();

      const result = await supabase.rpc('create_tournament_with_admin_code', payload);

      if(result.error) throw result.error;

      setStatus(`Tournament created.\nID: ${result.data}`);
      await loadTournaments();
    }catch(error){
      setStatus('Create tournament error: ' + error.message);
    }
  }

  async function loadTournaments(){
    try{
      const supabase = await getSupabase();
      const result = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending:false });

      if(result.error) throw result.error;

      const data = result.data || [];
      if(!data.length){
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
          <span class="pill">Division: ${safe(t.division || 'open')}</span>
          <span class="pill">Restriction: ${safe(t.gender_restriction || 'none')}</span>
          <span class="pill">Format: ${safe(t.format || 'TBD')}</span>
          <p class="muted">ID: ${safe(t.id)}</p>
        </article>
      `).join('');
    }catch(error){
      tournamentsBox.innerHTML = `<div class="log">Tournament load error: ${safe(error.message)}</div>`;
    }
  }

  document.getElementById('unlockAdminBtn')?.addEventListener('click', unlockIfValid);
  adminCodeInput?.addEventListener('keydown', e => { if(e.key === 'Enter') unlockIfValid(); });

  document.getElementById('createTournamentBtn')?.addEventListener('click', createTournament);
  document.getElementById('refreshTournamentsBtn')?.addEventListener('click', loadTournaments);
  document.getElementById('tDivision')?.addEventListener('change', syncWcc);
  document.getElementById('tGenderRestriction')?.addEventListener('change', syncWcc);
  document.getElementById('tCategory')?.addEventListener('change', syncWcc);

  initUnlock();
  loadTournaments();
})();
