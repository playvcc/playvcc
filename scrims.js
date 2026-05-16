// VCC Scrims Queue Join Fix
// Robust queue join/leave + match found redirect.
// Fixes missing division errors, button ID mismatch, and stale completed rooms.

(function(){
  let supabase = null;
  let user = null;
  let myTeams = [];

  function byId(id){ return document.getElementById(id); }

  const statusBox =
    byId('scrimStatus') ||
    byId('status') ||
    document.querySelector('.log');

  const teamSelect =
    byId('teamSelect') ||
    byId('scrimTeamSelect') ||
    document.querySelector('select');

  const regionSelect =
    byId('regionSelect') ||
    byId('scrimRegion') ||
    document.querySelector('select[name="region"]');

  const typeSelect =
    byId('typeSelect') ||
    byId('scrimType') ||
    byId('formatSelect') ||
    document.querySelector('select[name="type"]');

  const queueBox =
    byId('queueBox') ||
    byId('currentQueueBox') ||
    byId('currentQueue') ||
    document.querySelector('[data-queue-box]');

  const roomsBox =
    byId('roomsBox') ||
    byId('recentRoomsBox') ||
    byId('recentRooms') ||
    document.querySelector('[data-rooms-box]');

  function setStatus(message){
    if(statusBox) statusBox.textContent = message;
    else console.log(message);
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

  async function loadUser(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      setStatus('Log in first.');
      setTimeout(() => location.href = 'auth.html?mode=login', 700);
      return false;
    }

    return true;
  }

  async function loadTeams(){
    const result = await supabase
      .from('team_memberships')
      .select('*, teams(*)')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`)
      .eq('status','active');

    if(result.error) throw result.error;

    myTeams = (result.data || [])
      .map(row => row.teams)
      .filter(Boolean);

    if(teamSelect){
      teamSelect.innerHTML = myTeams.length
        ? myTeams.map(t => `<option value="${safe(t.id)}">${safe(t.name)} (${safe(t.division || t.team_type || 'open')})</option>`).join('')
        : '<option value="">No teams found</option>';
    }

    if(!myTeams.length){
      setStatus('You are not on a team yet. Create or join a team before queueing.');
    }
  }

  function getSelectedTeamId(){
    return teamSelect?.value || '';
  }

  function getRegion(){
    return regionSelect?.value || 'NA';
  }

  function getScrimType(){
    return typeSelect?.value || 'BO1';
  }

  function findButtons(){
    const enterButtons = [];
    const leaveButtons = [];

    ['enterQueueBtn','joinQueueBtn','queueBtn','scrimQueueBtn'].forEach(id => {
      const btn = byId(id);
      if(btn) enterButtons.push(btn);
    });

    ['leaveQueueBtn','cancelQueueBtn'].forEach(id => {
      const btn = byId(id);
      if(btn) leaveButtons.push(btn);
    });

    document.querySelectorAll('button,a').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();

      if(text.includes('enter queue') || text.includes('join queue')){
        enterButtons.push(el);
      }

      if(text.includes('leave queue')){
        leaveButtons.push(el);
      }
    });

    return {
      enter:[...new Set(enterButtons)],
      leave:[...new Set(leaveButtons)]
    };
  }

  async function enterQueue(event){
    if(event) event.preventDefault();

    try{
      const teamId = getSelectedTeamId();

      if(!teamId){
        setStatus('Select a team first.');
        return;
      }

      setStatus('Entering scrim queue...');

      const result = await supabase.rpc('vcc_enter_scrim_queue', {
        p_team_id:teamId,
        p_region:getRegion(),
        p_scrim_type:getScrimType()
      });

      if(result.error) throw result.error;

      const data = result.data || {};

      if(data.matched && data.room_id){
        setStatus('Match found. Opening match room...');
        setTimeout(() => location.href = `match-room.html?id=${data.room_id}`, 700);
        return;
      }

      setStatus(data.message || 'Entered queue. Waiting for opponent...');
      await refresh();

    }catch(error){
      setStatus('Enter queue error: ' + error.message);
    }
  }

  async function leaveQueue(event){
    if(event) event.preventDefault();

    try{
      const teamId = getSelectedTeamId();

      if(!teamId){
        setStatus('Select a team first.');
        return;
      }

      setStatus('Leaving queue...');

      const result = await supabase.rpc('vcc_leave_scrim_queue', {
        p_team_id:teamId
      });

      if(result.error) throw result.error;

      setStatus('Left queue.');
      await refresh();

    }catch(error){
      setStatus('Leave queue error: ' + error.message);
    }
  }

  async function loadQueue(){
    if(!queueBox) return;

    const result = await supabase
      .from('scrim_queue')
      .select('*')
      .eq('status','queued')
      .order('created_at', { ascending:true });

    if(result.error){
      queueBox.innerHTML = `<div class="log">Queue error: ${safe(result.error.message)}</div>`;
      return;
    }

    const rows = result.data || [];

    queueBox.innerHTML = rows.length
      ? rows.map(q => `
        <div class="identity-row">
          <span>${safe(q.team_name || q.team_id)}</span>
          <strong>${safe(q.region || 'NA')} · ${safe(q.scrim_type || 'BO1')}</strong>
        </div>
      `).join('')
      : '<div class="log">No teams waiting right now.</div>';
  }

  async function cleanupClosedRooms(){
    try{
      await supabase.rpc('vcc_cleanup_scrim_rooms');
    }catch(error){
      console.warn('cleanup skipped:', error.message);
    }
  }

  async function loadRooms(){
    if(!roomsBox) return;

    const ids = myTeams.map(t => t.id);

    if(!ids.length){
      roomsBox.innerHTML = '<div class="log">No team rooms.</div>';
      return;
    }

    const result = await supabase
      .from('match_rooms')
      .select('*')
      .eq('room_type','scrim')
      .in('status', ['open','active','awaiting_confirmation','disputed'])
      .or(ids.map(id => `team_a_id.eq.${id},team_b_id.eq.${id}`).join(','))
      .order('created_at', { ascending:false })
      .limit(10);

    if(result.error){
      roomsBox.innerHTML = `<div class="log">Rooms error: ${safe(result.error.message)}</div>`;
      return;
    }

    const rooms = result.data || [];

    roomsBox.innerHTML = rooms.length
      ? rooms.map(r => `
        <article class="vcc-card">
          <div class="vcc-panel-title">
            <h2>Match Found</h2>
            <span>${safe(r.status || 'active')}</span>
          </div>
          <p>${safe(r.team_a_id)} vs ${safe(r.team_b_id)}</p>
          <a class="btn" href="match-room.html?id=${safe(r.id)}">Open Match Room</a>
        </article>
      `).join('')
      : '<div class="log">No active match rooms.</div>';
  }

  async function refresh(){
    await cleanupClosedRooms();
    await loadQueue();
    await loadRooms();
  }

  async function init(){
    try{
      supabase = await getSupabase();

      if(!await loadUser()) return;

      await loadTeams();

      const buttons = findButtons();
      buttons.enter.forEach(btn => btn.addEventListener('click', enterQueue));
      buttons.leave.forEach(btn => btn.addEventListener('click', leaveQueue));

      await refresh();

      setInterval(refresh, 7000);

      setStatus('Scrim queue ready.');

    }catch(error){
      setStatus('Scrims error: ' + error.message);
    }
  }

  init();
})();
