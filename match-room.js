// VCC Scrim Match Room: FACEIT-style private room + chat + score

(function(){
  const params = new URLSearchParams(location.search);
  const roomId = params.get('id');

  let supabase = null;
  let user = null;
  let room = null;
  let myTeamIds = [];
  let isAllowed = false;
  let isCaptain = false;

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

  function playerCard(profile, membership){
    const name = profile?.display_name || profile?.username || profile?.riot_id || 'VCC Player';
    const sub = profile?.riot_id || membership?.role || 'player';
    const avatar = profile?.avatar_url || 'assets/vcc-logo.png';
    const rating = profile?.rating || 1000;
    return `
      <div class="player-card">
        <img src="${safe(avatar)}" alt="${safe(name)}">
        <div>
          <div class="player-name">${safe(name)}</div>
          <div class="player-sub">${safe(sub)}</div>
        </div>
        <div class="player-rating">↗ ${safe(rating)} <span class="player-level">${safe(membership?.role || '')}</span></div>
      </div>
    `;
  }

  async function loadRoster(teamId, targetId){
    const result = await supabase
      .from('team_memberships')
      .select('*, profiles(*)')
      .eq('team_id', teamId)
      .eq('status','active')
      .order('role', { ascending:true });

    const target = document.getElementById(targetId);
    if(result.error){
      target.innerHTML = `<div class="log">Roster error: ${safe(result.error.message)}</div>`;
      return;
    }

    const rows = result.data || [];
    target.innerHTML = rows.length
      ? rows.map(r => playerCard(r.profiles, r)).join('')
      : '<div class="log">No roster listed.</div>';
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

  async function loadTeam(teamId){
    const res = await supabase.from('teams').select('*').eq('id', teamId).maybeSingle();
    return res.data || null;
  }

  async function loadRoom(){
    const result = await supabase.from('match_rooms').select('*').eq('id', roomId).maybeSingle();
    if(result.error) throw result.error;
    room = result.data;
    if(!room) throw new Error('Room not found.');

    await loadUserTeams();

    isAllowed = myTeamIds.includes(room.team_a_id) || myTeamIds.includes(room.team_b_id);

    if(!isAllowed){
      document.body.innerHTML = `<main class="vcc-wrap"><section class="vcc-card"><h1>Access Denied</h1><p class="lead">Only the two scrim teams can view this room.</p><a class="btn" href="matches.html">Back to Matches</a></section></main>`;
      return false;
    }

    const a = await loadTeam(room.team_a_id);
    const b = await loadTeam(room.team_b_id);

    document.getElementById('teamAName').textContent = a?.name || 'Team A';
    document.getElementById('teamBName').textContent = b?.name || 'Team B';
    document.getElementById('teamALogo').src = a?.logo_url || 'assets/vcc-logo.png';
    document.getElementById('teamBLogo').src = b?.logo_url || 'assets/vcc-logo.png';

    document.getElementById('teamAScoreTop').textContent = room.team_a_score ?? 0;
    document.getElementById('teamBScoreTop').textContent = room.team_b_score ?? 0;
    document.getElementById('matchStatus').textContent = room.status || 'open';
    document.getElementById('serverText').textContent = room.region || 'NA';
    document.getElementById('matchTypeText').textContent = `${room.scrim_type || 'BO1'} · ${room.division || 'open'}`;
    document.getElementById('roomInfo').innerHTML =
      `Room ID: ${safe(room.id)}<br>Captain Access: ${isCaptain ? 'Yes' : 'No'}<br>Status: ${safe(room.status || 'open')}`;

    await loadRoster(room.team_a_id, 'teamARoster');
    await loadRoster(room.team_b_id, 'teamBRoster');

    if(!isCaptain){
      document.getElementById('submitScrimScoreBtn').disabled = true;
      document.getElementById('scrimScoreStatus').textContent = 'Only captains can submit scores.';
    }

    return true;
  }

  async function loadChat(){
    const result = await supabase.from('match_room_chat').select('*').eq('room_id', roomId).order('created_at', { ascending:true });
    const chatBox = document.getElementById('chatBox');

    if(result.error){
      chatBox.textContent = 'Chat load error: ' + result.error.message;
      return;
    }

    const messages = result.data || [];
    chatBox.innerHTML = messages.length ? messages.map(m => `
      <div class="chat-message"><strong>${safe(m.sender_email || m.sender_user_id || 'Player')}</strong><p>${safe(m.body || '')}</p></div>
    `).join('') : 'No messages yet.';
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendChat(){
    try{
      const body = document.getElementById('chatInput').value.trim();
      if(!body){
        document.getElementById('chatStatus').textContent = 'Type a message first.';
        return;
      }

      const result = await supabase.from('match_room_chat').insert({
        room_id:roomId,
        sender_user_id:user.id,
        sender_email:user.email || null,
        body
      });

      if(result.error) throw result.error;

      document.getElementById('chatInput').value = '';
      document.getElementById('chatStatus').textContent = 'Message sent.';
      await loadChat();
    }catch(error){
      document.getElementById('chatStatus').textContent = 'Send chat error: ' + error.message;
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
      await loadRoom();
    }catch(error){
      status.textContent = 'Score submit error: ' + error.message;
    }
  }

  async function init(){
    try{
      if(!roomId) throw new Error('No room ID in URL.');
      supabase = await getSupabase();
      const session = await supabase.auth.getSession();
      user = session?.data?.session?.user || null;
      if(!user){ location.href = 'auth.html?mode=login'; return; }

      const allowed = await loadRoom();
      if(!allowed) return;

      await loadChat();
      document.getElementById('sendChatBtn').addEventListener('click', sendChat);
      document.getElementById('chatInput').addEventListener('keydown', e => { if(e.key === 'Enter') sendChat(); });
      document.getElementById('submitScrimScoreBtn').addEventListener('click', submitScore);
      setInterval(loadChat, 4000);
    }catch(error){
      document.getElementById('roomInfo').textContent = 'Room error: ' + error.message;
    }
  }

  init();
})();
