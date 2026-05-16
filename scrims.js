// VCC Scrims Queue Fix
// Removes both teams from queue when a match is found.
// Stops completed matches from showing as "match found" when returning to scrims.

(function(){
  let supabase = null;
  let user = null;
  let myTeams = [];

  const statusBox = document.getElementById('scrimStatus') || document.getElementById('status') || document.querySelector('.log');
  const teamSelect = document.getElementById('teamSelect');
  const regionSelect = document.getElementById('regionSelect');
  const typeSelect = document.getElementById('typeSelect');
  const queueBox = document.getElementById('queueBox') || document.getElementById('currentQueueBox');
  const roomsBox = document.getElementById('roomsBox') || document.getElementById('recentRoomsBox');
  const enterBtn = document.getElementById('enterQueueBtn');
  const leaveBtn = document.getElementById('leaveQueueBtn');

  function setStatus(msg){
    if(statusBox) statusBox.textContent = msg;
  }

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

  async function loadUser(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      setStatus('Log in first.');
      setTimeout(() => location.href = 'auth.html?mode=login', 800);
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

    myTeams = (result.data || []).map(x => x.teams).filter(Boolean);

    if(teamSelect){
      teamSelect.innerHTML = myTeams.length
        ? myTeams.map(t => `<option value="${safe(t.id)}">${safe(t.name)} (${safe(t.division || 'OPEN')})</option>`).join('')
        : '<option value="">No teams found</option>';
    }
  }

  async function cleanupMyCompletedRooms(){
    if(!myTeams.length) return;

    const ids = myTeams.map(t => t.id);

    // Mark old completed rooms as deleted/hidden for cleanup if DB supports it.
    await supabase
      .from('match_rooms')
      .update({ room_deleted_at:new Date().toISOString() })
      .in('status', ['completed','cancelled','closed'])
      .or(ids.map(id => `team_a_id.eq.${id},team_b_id.eq.${id}`).join(','));
  }

  async function enterQueue(){
    try{
      const teamId = teamSelect?.value;
      const region = regionSelect?.value || 'NA';
      const scrimType = typeSelect?.value || 'BO1';

      if(!teamId){
        setStatus('Select a team first.');
        return;
      }

      setStatus('Entering queue...');

      const result = await supabase.rpc('enter_scrim_queue_and_match', {
        p_team_id:teamId,
        p_region:region,
        p_scrim_type:scrimType
      });

      if(result.error) throw result.error;

      if(result.data && result.data.room_id){
        setStatus('Match found. Opening room...');
        setTimeout(() => location.href = `match-room.html?id=${result.data.room_id}`, 700);
      }else{
        setStatus('Entered queue. Waiting for opponent...');
        await refresh();
      }

    }catch(error){
      setStatus('Enter queue error: ' + error.message);
    }
  }

  async function leaveQueue(){
    try{
      const teamId = teamSelect?.value;

      if(!teamId){
        setStatus('Select a team first.');
        return;
      }

      setStatus('Leaving queue...');

      const result = await supabase.rpc('leave_scrim_queue', {
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
      ? rows.map(q => `<div class="identity-row"><span>${safe(q.team_id)}</span><strong>${safe(q.region || 'NA')} ${safe(q.scrim_type || 'BO1')}</strong></div>`).join('')
      : '<div class="log">No teams waiting right now.</div>';
  }

  async function loadRooms(){
    if(!roomsBox) return;

    const teamIds = myTeams.map(t => t.id);

    if(!teamIds.length){
      roomsBox.innerHTML = '<div class="log">No team rooms.</div>';
      return;
    }

    const result = await supabase
      .from('match_rooms')
      .select('*')
      .eq('room_type','scrim')
      .in('status', ['open','active','awaiting_confirmation','disputed'])
      .or(teamIds.map(id => `team_a_id.eq.${id},team_b_id.eq.${id}`).join(','))
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
            <h2>${r.status === 'open' || r.status === 'active' ? 'Match Found' : 'Scrim Room'}</h2>
            <span>${safe(r.status || 'active')}</span>
          </div>
          <p>${safe(r.team_a_id)} vs ${safe(r.team_b_id)}</p>
          <a class="btn" href="match-room.html?id=${safe(r.id)}">Open Match Room</a>
        </article>
      `).join('')
      : '<div class="log">No active match rooms.</div>';
  }

  async function refresh(){
    await cleanupMyCompletedRooms();
    await loadQueue();
    await loadRooms();
  }

  async function init(){
    try{
      supabase = await getSupabase();

      if(!await loadUser()) return;

      await loadTeams();
      await refresh();

      enterBtn?.addEventListener('click', enterQueue);
      leaveBtn?.addEventListener('click', leaveQueue);

      setInterval(refresh, 7000);

      setStatus('Scrims loaded.');

    }catch(error){
      setStatus('Scrims error: ' + error.message);
    }
  }

  init();
})();
