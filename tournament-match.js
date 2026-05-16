// VCC Tournament Match Room: FACEIT-style private room + chat + score

(function(){
  const params = new URLSearchParams(location.search);
  const matchId = params.get('id');

  let supabase = null;
  let user = null;
  let match = null;
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
      && (m.team_id === match.team_a_id || m.team_id === match.team_b_id)
    );
  }

  async function loadMatch(){
    const result = await supabase
      .from('tournament_matches')
      .select('*, tournaments(*), team_a:teams!tournament_matches_team_a_id_fkey(*), team_b:teams!tournament_matches_team_b_id_fkey(*)')
      .eq('id', matchId)
      .maybeSingle();

    if(result.error){
      const fallback = await supabase.from('tournament_matches').select('*').eq('id', matchId).maybeSingle();
      if(fallback.error) throw fallback.error;
      match = fallback.data;
    }else{
      match = result.data;
    }

    if(!match) throw new Error('Match not found.');

    await loadUserTeams();

    isAllowed = myTeamIds.includes(match.team_a_id) || myTeamIds.includes(match.team_b_id);

    if(!isAllowed){
      document.body.innerHTML = `<main class="vcc-wrap"><section class="vcc-card"><h1>Access Denied</h1><p class="lead">Only players from the two teams in this match can view this room.</p><a class="btn" href="matches.html">Back to Matches</a></section></main>`;
      return false;
    }

    document.getElementById('teamAName').textContent = match.team_a?.name || 'Team A';
    document.getElementById('teamBName').textContent = match.team_b?.name || 'Team B';
    document.getElementById('teamALogo').src = match.team_a?.logo_url || 'assets/vcc-logo.png';
    document.getElementById('teamBLogo').src = match.team_b?.logo_url || 'assets/vcc-logo.png';

    document.getElementById('teamAScoreTop').textContent = match.team_a_score ?? 0;
    document.getElementById('teamBScoreTop').textContent = match.team_b_score ?? 0;
    document.getElementById('matchStatus').textContent = match.status || 'scheduled';
    document.getElementById('tournamentText').textContent = match.tournaments?.name || 'VCC Tournament';
    document.getElementById('matchTypeText').textContent = `Round ${match.round_number || 1}`;
    document.getElementById('matchInfo').innerHTML =
      `Match ID: ${safe(match.id)}<br>Round: ${safe(match.round_number || 1)}<br>Match: ${safe(match.match_number || 1)}<br>Captain Access: ${isCaptain ? 'Yes' : 'No'}<br>Status: ${safe(match.status || 'scheduled')}`;

    await loadRoster(match.team_a_id, 'teamARoster');
    await loadRoster(match.team_b_id, 'teamBRoster');

    if(!isCaptain){
      document.getElementById('submitScoreBtn').disabled = true;
      document.getElementById('scoreStatus').textContent = 'Only captains can submit scores.';
    }

    return true;
  }

  async function loadChat(){
    const result = await supabase.from('match_room_chat').select('*').eq('tournament_match_id', matchId).order('created_at', { ascending:true });
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
      if(!body){ document.getElementById('chatStatus').textContent = 'Type a message first.'; return; }

      const result = await supabase.from('match_room_chat').insert({
        tournament_match_id:matchId,
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
    try{
      if(!isCaptain){ document.getElementById('scoreStatus').textContent = 'Only captains can submit scores.'; return; }

      const a = Number(document.getElementById('teamAScore').value);
      const b = Number(document.getElementById('teamBScore').value);

      if(!Number.isFinite(a) || !Number.isFinite(b)){
        document.getElementById('scoreStatus').textContent = 'Enter both scores.';
        return;
      }

      const myTeamId = myTeamIds.includes(match.team_a_id) ? match.team_a_id : match.team_b_id;

      const result = await supabase.rpc('submit_tournament_match_score', {
        p_match_id:matchId,
        p_submitter_user_id:user.id,
        p_submitter_team_id:myTeamId,
        p_team_a_score:a,
        p_team_b_score:b,
        p_note:document.getElementById('scoreNote').value.trim()
      });

      if(result.error) throw result.error;

      document.getElementById('scoreStatus').textContent = result.data || 'Score submitted.';
      await loadMatch();
    }catch(error){
      document.getElementById('scoreStatus').textContent = 'Score submit error: ' + error.message;
    }
  }

  async function init(){
    try{
      if(!matchId) throw new Error('No match ID in URL.');
      supabase = await getSupabase();

      const session = await supabase.auth.getSession();
      user = session?.data?.session?.user || null;
      if(!user){ location.href = 'auth.html?mode=login'; return; }

      const allowed = await loadMatch();
      if(!allowed) return;

      await loadChat();

      document.getElementById('sendChatBtn').addEventListener('click', sendChat);
      document.getElementById('chatInput').addEventListener('keydown', e => { if(e.key === 'Enter') sendChat(); });
      document.getElementById('submitScoreBtn').addEventListener('click', submitScore);

      setInterval(loadChat, 4000);
    }catch(error){
      document.getElementById('matchInfo').textContent = 'Match room error: ' + error.message;
    }
  }

  init();
})();
