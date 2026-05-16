// VCC Tournament Match Room: private access + chat + captain score confirmation/dispute

(function(){
  const params = new URLSearchParams(location.search);
  const matchId = params.get('id');

  let supabase = null;
  let user = null;
  let match = null;
  let myTeamIds = [];
  let isAllowed = false;
  let isCaptain = false;
  let poll = null;

  const matchTitle = document.getElementById('matchTitle');
  const matchStatus = document.getElementById('matchStatus');
  const matchInfo = document.getElementById('matchInfo');
  const scoreStatus = document.getElementById('scoreStatus');
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
      const fallback = await supabase
        .from('tournament_matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle();
      if(fallback.error) throw fallback.error;
      match = fallback.data;
    }else{
      match = result.data;
    }

    if(!match) throw new Error('Match not found.');

    await loadUserTeams();

    isAllowed = myTeamIds.includes(match.team_a_id) || myTeamIds.includes(match.team_b_id);

    if(!isAllowed){
      document.body.innerHTML = `
        <main class="vcc-wrap">
          <section class="vcc-card">
            <h1>Access Denied</h1>
            <p class="lead">Only players from the two teams in this match can view this room.</p>
            <a class="btn" href="matches.html">Back to Matches</a>
          </section>
        </main>
      `;
      return false;
    }

    const aName = match.team_a?.name || match.team_a_id || 'Team A';
    const bName = match.team_b?.name || match.team_b_id || 'Team B';

    matchTitle.textContent = `${aName} vs ${bName}`;
    matchStatus.textContent = match.status || 'scheduled';

    matchInfo.textContent =
      `Tournament: ${match.tournaments?.name || match.tournament_id || 'VCC Tournament'}\n` +
      `Round: ${match.round_number || 1}\nMatch: ${match.match_number || 1}\n` +
      `Team A: ${aName}\nTeam B: ${bName}\n` +
      `Captain Access: ${isCaptain ? 'Yes' : 'No'}\n` +
      `Status: ${match.status || 'scheduled'}`;

    if(!isCaptain){
      document.getElementById('submitScoreBtn').disabled = true;
      scoreStatus.textContent = 'Only captains for the two teams can submit scores.';
    }

    return true;
  }

  async function loadChat(){
    const result = await supabase
      .from('match_room_chat')
      .select('*')
      .eq('tournament_match_id', matchId)
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
          tournament_match_id:matchId,
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
    try{
      if(!isCaptain){
        scoreStatus.textContent = 'Only team captains can submit scores.';
        return;
      }

      const a = Number(document.getElementById('teamAScore').value);
      const b = Number(document.getElementById('teamBScore').value);

      if(!Number.isFinite(a) || !Number.isFinite(b)){
        scoreStatus.textContent = 'Enter both scores.';
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

      scoreStatus.textContent = result.data || 'Score submitted.';
      await loadScoreSubmissions();
      await loadMatch();
    }catch(error){
      scoreStatus.textContent = 'Score submit error: ' + error.message;
    }
  }

  async function loadScoreSubmissions(){
    const result = await supabase
      .from('match_score_submissions')
      .select('*')
      .eq('tournament_match_id', matchId)
      .order('created_at', { ascending:false });

    if(result.error) return;

    const subs = result.data || [];

    if(subs.length){
      scoreStatus.textContent =
        `Submissions: ${subs.length}\n` +
        subs.map(s => `${s.team_a_score}-${s.team_b_score} by ${s.submitter_team_id} (${s.status})`).join('\n');
    }
  }

  async function init(){
    try{
      if(!matchId){
        matchInfo.textContent = 'No match ID in URL.';
        return;
      }

      supabase = await getSupabase();

      const session = await supabase.auth.getSession();
      user = session?.data?.session?.user || null;

      if(!user){
        location.href = 'auth.html?mode=login';
        return;
      }

      const allowed = await loadMatch();
      if(!allowed) return;

      await loadChat();
      await loadScoreSubmissions();

      document.getElementById('sendChatBtn').addEventListener('click', sendChat);
      document.getElementById('chatInput').addEventListener('keydown', e => {
        if(e.key === 'Enter') sendChat();
      });

      document.getElementById('submitScoreBtn').addEventListener('click', submitScore);

      poll = setInterval(async () => {
        await loadChat();
        await loadScoreSubmissions();
      }, 4000);
    }catch(error){
      matchInfo.textContent = 'Match room error: ' + error.message;
    }
  }

  init();
})();
