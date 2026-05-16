// VCC Scrim Match Room: private access + chat + captain score submission + cleanup

(function(){
  const params = new URLSearchParams(location.search);
  const roomId = params.get('id');

  let supabase = null;
  let user = null;
  let room = null;
  let myTeamIds = [];
  let isAllowed = false;
  let isCaptain = false;

  const roomTitle = document.getElementById('roomTitle');
  const roomStatus = document.getElementById('roomStatus');
  const roomInfo = document.getElementById('roomInfo');
  const chatBox = document.getElementById('chatBox');
  const chatStatus = document.getElementById('chatStatus');

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

  async function loadUserTeams(){
    const memberships = await supabase
      .from('team_memberships')
      .select('*, teams(*)')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`)
      .eq('status','active');

    if(memberships.error) throw memberships.error;

    myTeamIds = (memberships.data || []).map(m => m.team_id);
    isCaptain = (memberships.data || []).some(m =>
      (m.role === 'captain' || m.teams?.captain_id === user.id)
      && (m.team_id === room.team_a_id || m.team_id === room.team_b_id)
    );
  }

  async function loadRoom(){
    const result = await supabase
      .from('match_rooms')
      .select('*')
      .eq('id', roomId)
      .maybeSingle();

    if(result.error) throw result.error;
    room = result.data;

    if(!room) throw new Error('Room not found.');

    await loadUserTeams();

    isAllowed = myTeamIds.includes(room.team_a_id) || myTeamIds.includes(room.team_b_id);

    if(!isAllowed){
      document.body.innerHTML = `
        <main class="vcc-wrap">
          <section class="vcc-card">
            <h1>Access Denied</h1>
            <p class="lead">Only the two scrim teams can view this room.</p>
            <a class="btn" href="matches.html">Back to Matches</a>
          </section>
        </main>
      `;
      return false;
    }

    roomTitle.textContent = `Scrim Room`;
    roomStatus.textContent = room.status || 'open';
    roomInfo.innerHTML =
      `Room ID: ${safe(room.id)}<br>` +
      `Team A: ${safe(room.team_a_id)}<br>` +
      `Team B: ${safe(room.team_b_id)}<br>` +
      `Captain Access: ${isCaptain ? 'Yes' : 'No'}<br>` +
      `<br><strong>Captain Score Submission</strong><br>` +
      `<input id="scrimTeamAScore" type="number" min="0" placeholder="Team A Score">` +
      `<input id="scrimTeamBScore" type="number" min="0" placeholder="Team B Score">` +
      `<textarea id="scrimScoreNote" rows="2" placeholder="Optional note"></textarea>` +
      `<button id="submitScrimScoreBtn" ${isCaptain ? '' : 'disabled'}>Submit Score</button>` +
      `<div id="scrimScoreStatus" class="log">Matching captain scores complete the scrim. Different scores create a dispute.</div>`;

    document.getElementById('submitScrimScoreBtn')?.addEventListener('click', submitScore);

    return true;
  }

  async function loadChat(){
    const result = await supabase
      .from('match_room_chat')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending:true });

    if(result.error){
      chatBox.textContent = 'Chat load error: ' + result.error.message;
      return;
    }

    const messages = result.data || [];

    chatBox.innerHTML = messages.length ? messages.map(m => `
      <div style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">
        <strong>${safe(m.sender_email || m.sender_user_id || 'Player')}</strong>
        <p>${safe(m.body || '')}</p>
      </div>
    `).join('') : 'No messages yet.';

    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendChat(){
    try{
      const body = document.getElementById('chatInput').value.trim();

      if(!body){
        chatStatus.textContent = 'Type a message first.';
        return;
      }

      const result = await supabase
        .from('match_room_chat')
        .insert({
          room_id:roomId,
          sender_user_id:user.id,
          sender_email:user.email || null,
          body
        });

      if(result.error) throw result.error;

      document.getElementById('chatInput').value = '';
      chatStatus.textContent = 'Message sent.';
      await loadChat();
    }catch(error){
      chatStatus.textContent = 'Send chat error: ' + error.message;
    }
  }

  async function submitScore(){
    const status = document.getElementById('scrimScoreStatus');

    try{
      if(!isCaptain){
        status.textContent = 'Only captains can submit scores.';
        return;
      }

      const a = Number(document.getElementById('scrimTeamAScore').value);
      const b = Number(document.getElementById('scrimTeamBScore').value);

      if(!Number.isFinite(a) || !Number.isFinite(b)){
        status.textContent = 'Enter both scores.';
        return;
      }

      const myTeamId = myTeamIds.includes(room.team_a_id) ? room.team_a_id : room.team_b_id;

      const result = await supabase.rpc('submit_scrim_match_score', {
        p_room_id:roomId,
        p_submitter_user_id:user.id,
        p_submitter_team_id:myTeamId,
        p_team_a_score:a,
        p_team_b_score:b,
        p_note:document.getElementById('scrimScoreNote').value.trim()
      });

      if(result.error) throw result.error;

      status.textContent = result.data || 'Score submitted.';
    }catch(error){
      status.textContent = 'Score submit error: ' + error.message;
    }
  }

  async function init(){
    try{
      if(!roomId){
        roomInfo.textContent = 'No room ID in URL.';
        return;
      }

      supabase = await getSupabase();

      const session = await supabase.auth.getSession();
      user = session?.data?.session?.user || null;

      if(!user){
        location.href = 'auth.html?mode=login';
        return;
      }

      const allowed = await loadRoom();
      if(!allowed) return;

      await loadChat();

      document.getElementById('sendChatBtn').addEventListener('click', sendChat);
      document.getElementById('chatInput').addEventListener('keydown', e => {
        if(e.key === 'Enter') sendChat();
      });

      setInterval(loadChat, 4000);
    }catch(error){
      roomInfo.textContent = 'Room error: ' + error.message;
    }
  }

  init();
})();
