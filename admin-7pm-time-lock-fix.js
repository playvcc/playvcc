// VCC Admin 7PM Time Lock Fix
// Add AFTER admin.js in admin.html:
// <script src="admin-7pm-time-lock-fix.js"></script>
//
// Fixes the bug where date changes but time always saves as 7:00 PM.
// Cause: browser/database was treating Start Time like a date-only value.
// This forces datetime-local and directly saves the exact selected time.

(function(){
  const ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';
  let supabase = null;

  function $(id){ return document.getElementById(id); }

  function setStatus(msg){
    const box = $('adminStatus') || document.querySelector('.log');
    if(box) box.textContent = msg;
    console.log('[7PM Time Fix]', msg);
  }

  async function getSupabase(){
    if(supabase) return supabase;
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    supabase = lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return supabase;
  }

  function adminCode(){
    return sessionStorage.getItem('vcc_admin_code') || $('adminCode')?.value || '';
  }

  function findByLabelText(text){
    text = text.toLowerCase();

    const inputs = [...document.querySelectorAll('input')];

    for(const input of inputs){
      const ownText = [
        input.id,
        input.name,
        input.placeholder,
        input.getAttribute('aria-label')
      ].join(' ').toLowerCase();

      if(ownText.includes(text)) return input;

      const parentText = (input.closest('label, div, section, form')?.innerText || '').toLowerCase();

      if(parentText.includes(text)) return input;
    }

    return null;
  }

  function startInput(){
    return $('tStart') || $('startTime') || $('startDate') || findByLabelText('start time') || findByLabelText('start');
  }

  function rosterInput(){
    return $('tRosterLock') || $('rosterLock') || $('rosterLockAt') || findByLabelText('roster lock');
  }

  function makeDateTimeLocal(input){
    if(!input) return;

    if(input.type !== 'datetime-local'){
      input.type = 'datetime-local';
    }

    input.step = '60';
  }

  function convertToLocalInputValue(date){
    const d = new Date(date);
    if(Number.isNaN(d.getTime())) return '';
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0,16);
  }

  function getExactIsoFromInput(input, label){
    if(!input) throw new Error(label + ' input was not found.');

    makeDateTimeLocal(input);

    const raw = input.value;

    if(!raw){
      throw new Error(label + ' is required.');
    }

    // datetime-local value example: 2026-05-19T00:50
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)){
      const [datePart, timePart] = raw.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);

      const localDate = new Date(year, month - 1, day, hour, minute, 0);

      if(Number.isNaN(localDate.getTime())){
        throw new Error(label + ' is invalid: ' + raw);
      }

      return localDate.toISOString();
    }

    // If browser still gives a date-only value, refuse instead of silently forcing 7PM.
    if(/^\d{4}-\d{2}-\d{2}$/.test(raw)){
      throw new Error(label + ' is date-only. Re-click the field and select both date AND time.');
    }

    const parsed = new Date(raw);

    if(Number.isNaN(parsed.getTime())){
      throw new Error(label + ' is invalid: ' + raw);
    }

    return parsed.toISOString();
  }

  function checkOpen(startIso){
    const d = new Date(startIso);
    return new Date(d.getTime() - 30 * 60 * 1000).toISOString();
  }

  function currentEditingId(){
    return $('editingTournamentId')?.value || '';
  }

  function field(id, fallback=''){
    return $(id)?.value || fallback;
  }

  function textField(id, fallback=''){
    return ($(id)?.value || fallback || '').trim();
  }

  async function directCreateOrUpdate(mode){
    if(adminCode() !== ADMIN_CODE){
      setStatus('Unlock admin first.');
      return;
    }

    const sInput = startInput();
    const rInput = rosterInput();

    makeDateTimeLocal(sInput);
    makeDateTimeLocal(rInput);

    const startIso = getExactIsoFromInput(sInput, 'Start Time');
    const rosterIso = rInput?.value ? getExactIsoFromInput(rInput, 'Roster Lock') : null;

    const payload = {
      name:textField('tName', 'Tournament'),
      description:textField('tDesc', ''),
      tournament_category:field('tCategory', 'Open Qualifier'),
      format:field('tFormat', 'Single Elimination'),
      status:field('tStatus', 'open'),
      division:field('tDivision', 'open'),
      gender_restriction:field('tGenderRestriction', 'none'),

      start_date:startIso,
      start_time:startIso,
      starts_at:startIso,
      start_at:startIso,
      event_start:startIso,

      roster_lock_at:rosterIso,

      check_in_opens_at:checkOpen(startIso),
      check_in_start:checkOpen(startIso),
      check_in_closes_at:startIso,
      check_in_end:startIso,

      group_count:Number(field('groupCount', 0)) || 0,
      teams_per_group:Number(field('teamsPerGroup', 0)) || 0,
      advance_per_group:Number(field('advancePerGroup', 0)) || 0
    };

    const db = await getSupabase();

    let result;

    if(mode === 'update'){
      const id = currentEditingId();

      if(!id){
        throw new Error('No tournament selected for editing.');
      }

      result = await db
        .from('tournaments')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    }else{
      result = await db
        .from('tournaments')
        .insert(payload)
        .select()
        .single();
    }

    if(result.error) throw result.error;

    setStatus(`Saved exact start time: ${new Date(result.data.start_date).toLocaleString()}`);

    setTimeout(() => location.reload(), 800);
  }

  function patchButtons(){
    const createBtn = $('createTournamentBtn');
    const updateBtn = $('updateTournamentBtn');

    if(createBtn && createBtn.dataset.vcc7pmFixed !== 'yes'){
      createBtn.dataset.vcc7pmFixed = 'yes';

      createBtn.addEventListener('click', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        try{
          await directCreateOrUpdate('create');
        }catch(error){
          setStatus('Create tournament error: ' + error.message);
        }
      }, true);
    }

    if(updateBtn && updateBtn.dataset.vcc7pmFixed !== 'yes'){
      updateBtn.dataset.vcc7pmFixed = 'yes';

      updateBtn.addEventListener('click', async event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        try{
          await directCreateOrUpdate('update');
        }catch(error){
          setStatus('Update tournament error: ' + error.message);
        }
      }, true);
    }
  }

  function patchInputs(){
    const sInput = startInput();
    const rInput = rosterInput();

    makeDateTimeLocal(sInput);
    makeDateTimeLocal(rInput);

    // If input already has an old date-only value, leave blank so user must pick real time.
    if(sInput && /^\d{4}-\d{2}-\d{2}$/.test(sInput.value)){
      sInput.value = '';
      setStatus('Start Time was date-only. Please select date and time again.');
    }
  }

  function init(){
    patchInputs();
    patchButtons();

    setInterval(() => {
      patchInputs();
      patchButtons();
    }, 1000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
