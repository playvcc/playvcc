// VCC Scrims queue + leave queue + division fix

(function(){
  let supabase = null;
  let user = null;
  let myTeams = [];
  let queuePoll = null;
  let lastRoomId = null;

  const teamSelect = document.getElementById('teamSelect');
  const statusBox = document.getElementById('scrimStatus');
  const queueBox = document.getElementById('queueBox');
  const roomsBox = document.getElementById('roomsBox');

  function setStatus(msg){ statusBox.textContent = msg; }

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

  function playMatchSound(){
    try{
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.16);
        gain.gain.exponentialRampToValueAtTime(0.35, now + i * 0.16 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.14);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.16);
        osc.stop(now + i * 0.16 + 0.16);
      });
    }catch(error){
      console.warn('sound failed', error);
    }
  }

  async function requireLogin(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      setStatus('Log in first.');
      setTimeout(() => location.href = 'auth.html?mode=login', 800);
      return false;
    }

    return true;
  }

  async function loadMyTeams(){
    const result = await supabase
      .from('team_memberships')
      .select('*, teams(*)')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`)
      .eq('status', 'active');

    if(result.error) throw result.error;

    myTeams = (result.data || []).map(r => r.teams).filter(Boolean);

    if(!myTeams.length){
      teamSelect.innerHTML = '<option value="">You are not on a team yet</option>';
      setStatus('You need to create or join a team before entering scrim queue.');
      return;
    }

    teamSelect.innerHTML = myTeams.map(t => `
      <option value="${safe(t.id)}">${safe(t.name)} (${safe((t.division || 'open').toUpperCase())})</option>
    `).join('');

    setStatus(`Loaded ${myTeams.length} team(s). Choose a team and enter queue.`);
  }

  async function enterQueue(){
    try{
      if(!await requireLogin()) return;

      const teamId = teamSelect.value;
      if(!teamId){
        setStatus('Select a team first.');
        return;
      }

      const team = myTeams.find(t => t.id === teamId);
      if(!team){
        setStatus('Selected team not found.');
        return;
      }

      const region = document.getElementById('region').value;
      const scrimType = document.getElementById('scrimType').value;
      const division = team.division || 'open';

      setStatus('Searching for another team...');

      const opponentRes = await supabase
        .from('scrim_queue')
        .select('*, teams(*)')
        .eq('region', region)
        .eq('scrim_type', scrimType)
        .eq('division', division)
        .eq('status', 'waiting')
        .neq('team_id', teamId)
        .limit(1)
        .maybeSingle();

      if(opponentRes.error && opponentRes.error.code !== 'PGRST116'){
        throw opponentRes.error;
      }

      if(opponentRes.data){
        const opponent = opponentRes.data;

        setStatus('Opponent found. Creating match room...');

        const roomRes = await supabase
          .from('match_rooms')
          .insert({
            room_type:'scrim',
            status:'open',
            region,
            division,
            scrim_type:scrimType,
            team_a_id:opponent.team_id,
            team_b_id:teamId,
            created_by:user.id
          })
          .select()
          .single();

        if(roomRes.error) throw roomRes.error;

        await supabase.from('scrim_queue').update({ status:'matched', match_room_id:roomRes.data.id }).eq('id', opponent.id);
        await supabase.from('scrim_queue').delete().eq('team_id', teamId).eq('status','waiting');

        lastRoomId = roomRes.data.id;
        playMatchSound();

        alert('Scrim found! Match room created.');
        location.href = `match-room.html?id=${encodeURIComponent(roomRes.data.id)}`;
        return;
      }

      const existing = await supabase
        .from('scrim_queue')
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'waiting')
        .maybeSingle();

      if(existing.error && existing.error.code !== 'PGRST116') throw existing.error;

      if(existing.data){
        setStatus('Your team is already in queue. Waiting for opponent...');
      }else{
        const insert = await supabase
          .from('scrim_queue')
          .insert({
            team_id:teamId,
            captain_user_id:user.id,
            region,
            division,
            scrim_type:scrimType,
            status:'waiting'
          });

        if(insert.error) throw insert.error;

        setStatus('Entered queue. Waiting for opponent...');
      }

      await loadQueue();
      startPolling();

    }catch(error){
      setStatus('Enter queue error: ' + error.message);
    }
  }

  async function leaveQueue(){
    try{
      if(!await requireLogin()) return;

      const teamId = teamSelect.value;

      if(!teamId){
        setStatus('Select a team first.');
        return;
      }

      setStatus('Leaving queue...');

      const result = await supabase
        .from('scrim_queue')
        .delete()
        .eq('team_id', teamId)
        .eq('status', 'waiting');

      if(result.error) throw result.error;

      setStatus('You left the scrim queue.');
      await loadQueue();

    }catch(error){
      setStatus('Leave queue error: ' + error.message);
    }
  }

  async function checkForMatchedRoom(){
    if(!user || !teamSelect.value) return;

    const teamId = teamSelect.value;

    const result = await supabase
      .from('match_rooms')
      .select('*')
      .eq('room_type','scrim')
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .order('created_at', { ascending:false })
      .limit(1)
      .maybeSingle();

    if(result.error && result.error.code !== 'PGRST116') return;

    if(result.data && result.data.id !== lastRoomId){
      lastRoomId = result.data.id;
      playMatchSound();
      alert('Scrim found! Opening match room.');
      location.href = `match-room.html?id=${encodeURIComponent(result.data.id)}`;
    }
  }

  function startPolling(){
    if(queuePoll) clearInterval(queuePoll);
    queuePoll = setInterval(async () => {
      await checkForMatchedRoom();
      await loadQueue();
      await loadRooms();
    }, 5000);
  }

  async function loadQueue(){
    try{
      const result = await supabase
        .from('scrim_queue')
        .select('*, teams(*)')
        .eq('status','waiting')
        .order('created_at', { ascending:true });

      if(result.error) throw result.error;

      const data = result.data || [];

      queueBox.innerHTML = data.length ? data.map(q => `
        <div class="identity-row">
          <span>${safe(q.teams?.name || q.team_id)}</span>
          <strong>${safe(q.region)} / ${safe(q.division || 'open')} / ${safe(q.scrim_type)}</strong>
        </div>
      `).join('') : '<div class="log">No teams waiting right now.</div>';
    }catch(error){
      queueBox.innerHTML = `<div class="log">Queue error: ${safe(error.message)}</div>`;
    }
  }

  async function loadRooms(){
    try{
      const result = await supabase
        .from('match_rooms')
        .select('*')
        .eq('room_type','scrim')
        .order('created_at', { ascending:false })
        .limit(8);

      if(result.error) throw result.error;

      const data = result.data || [];
      roomsBox.innerHTML = data.length ? data.map(r => `
        <article class="vcc-card">
          <div class="vcc-panel-title">
            <h2>Scrim Room</h2>
            <span>${safe(r.status || 'open')}</span>
          </div>
          <p>${safe(r.team_a_id)} vs ${safe(r.team_b_id)}</p>
          <p>${safe(r.region || '')} / ${safe(r.division || 'open')} / ${safe(r.scrim_type || '')}</p>
          <a class="btn" href="match-room.html?id=${safe(r.id)}">Open Room</a>
        </article>
      `).join('') : '<div class="log">No rooms yet.</div>';
    }catch(error){
      roomsBox.innerHTML = `<div class="log">Rooms error: ${safe(error.message)}</div>`;
    }
  }

  async function init(){
    try{
      supabase = await getSupabase();
      if(!await requireLogin()) return;

      await loadMyTeams();
      await loadQueue();
      await loadRooms();
      startPolling();

      document.getElementById('queueBtn').addEventListener('click', enterQueue);
      document.getElementById('leaveQueueBtn').addEventListener('click', leaveQueue);
    }catch(error){
      setStatus('Scrims page error: ' + error.message);
    }
  }

  init();
})();
