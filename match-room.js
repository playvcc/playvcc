// VCC Matchroom Full Fix: chat duplicate fix, roster load, score submit, server/map veto.

(function(){
  const MAPS = ['Abyss','Bind','Breeze','Corrode','Haven','Pearl','Split'];
  const SERVERS = ['US West (Oregon)','US West (N. California)','US East (N. Virginia)','US Central (Texas)','US Central (Illinois)','US Central (Georgia)'];

  let supabase, user, room, myTeamId, chatSub, vetoSub;
  let sendingChat = false;
  let submittingScore = false;

  const roomId = new URLSearchParams(location.search).get('id');
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const status = msg => { const b = $('matchRoomStatus') || $('chatStatus') || document.querySelector('.log'); if(b) b.textContent = msg; console.log(msg); };

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function loadUser(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;
    if(!user){ location.href='auth.html?mode=login'; return false; }
    return true;
  }

  async function loadRoom(){
    const r = await supabase.from('match_rooms').select('*').eq('id', roomId).maybeSingle();
    if(r.error) throw r.error;
    if(!r.data) throw new Error('Room not found.');
    room = r.data;
  }

  async function verifyTeam(){
    const m = await supabase.from('team_memberships').select('*, teams(*)')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`).eq('status','active');
    if(m.error) throw m.error;
    const ids = (m.data || []).map(x => x.team_id);
    myTeamId = ids.includes(room.team_a_id) ? room.team_a_id : ids.includes(room.team_b_id) ? room.team_b_id : null;
    if(!myTeamId){
      document.body.innerHTML = '<main class="vcc-page"><section class="vcc-card"><h1>Access Denied</h1><p>Only the two teams in this match can access this room.</p></section></main>';
      return false;
    }
    return true;
  }

  async function loadTeams(){
    const ids = [room.team_a_id, room.team_b_id].filter(Boolean);
    const res = await supabase.from('teams').select('*').in('id', ids);
    const map = {};
    (res.data || []).forEach(t => map[t.id] = t);
    return map;
  }

  async function loadRoster(teamId){
    const r = await supabase.from('team_memberships').select('*, profiles(*)').eq('team_id', teamId).eq('status','active');
    return r.data || [];
  }

  function nameOf(row){
    const p = row.profiles || {};
    return p.display_name || p.username || p.riot_id || p.email || row.user_id || row.player_id || 'Player';
  }

  function avatarOf(row){
    const p = row.profiles || {};
    return p.avatar_url || p.profile_picture_url || p.pfp_url || 'VCC.png';
  }

  async function renderRoom(){
    const teams = await loadTeams();
    const a = teams[room.team_a_id] || {name:'Team A', logo_url:'VCC.png'};
    const b = teams[room.team_b_id] || {name:'Team B', logo_url:'VCC.png'};

    ['teamAName','homeTeamName'].forEach(id => { if($(id)) $(id).textContent = a.name || 'Team A'; });
    ['teamBName','awayTeamName'].forEach(id => { if($(id)) $(id).textContent = b.name || 'Team B'; });
    if($('teamALogo')) $('teamALogo').src = a.logo_url || 'VCC.png';
    if($('teamBLogo')) $('teamBLogo').src = b.logo_url || 'VCC.png';
    if($('scoreA')) $('scoreA').textContent = room.team_a_score ?? 0;
    if($('scoreB')) $('scoreB').textContent = room.team_b_score ?? 0;
    if($('serverDisplay')) $('serverDisplay').textContent = room.server_pick || room.server || room.region || 'Server Veto / TBD';
    if($('mapDisplay')) $('mapDisplay').textContent = room.map_pick || room.map || 'Map Veto / TBD';
    if($('roomInfo')) $('roomInfo').textContent = room.status || 'active';

    await renderRosters();
    await renderVeto();
  }

  async function renderRosters(){
    const ra = await loadRoster(room.team_a_id);
    const rb = await loadRoster(room.team_b_id);
    const html = rows => rows.length ? rows.map(r => `<div class="player-card" style="display:flex;gap:10px;align-items:center;margin-bottom:10px;"><img src="${safe(avatarOf(r))}" style="width:42px;height:42px;border-radius:10px;object-fit:cover;"><div><strong>${safe(nameOf(r))}</strong><br><small>${safe(r.role||'player')}</small></div></div>`).join('') : '<div class="log">No roster loaded.</div>';
    const aBox = $('teamAPlayers') || $('playersA') || document.querySelector('[data-team-a-players]');
    const bBox = $('teamBPlayers') || $('playersB') || document.querySelector('[data-team-b-players]');
    if(aBox) aBox.innerHTML = html(ra);
    if(bBox) bBox.innerHTML = html(rb);
  }

  async function loadChat(){
    const box = $('chatMessages') || $('chatBox');
    if(!box) return;
    const r = await supabase.from('match_room_chat').select('*').eq('room_id', roomId).order('created_at',{ascending:true});
    if(r.error){ box.innerHTML = `<div class="log">Chat error: ${safe(r.error.message)}</div>`; return; }
    const rows = r.data || [];
    box.innerHTML = rows.length ? rows.map(m => `<div style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)"><strong>${safe(m.sender_name||m.sender_email||'Player')}</strong><span style="float:right;opacity:.65">${m.created_at ? new Date(m.created_at).toLocaleTimeString() : ''}</span><p>${safe(m.message||m.body||'')}</p></div>`).join('') : '<div class="log">No messages yet.</div>';
    box.scrollTop = box.scrollHeight;
  }

  async function sendChat(e){
    if(e) e.preventDefault();
    if(sendingChat) return;
    const input = $('chatInput');
    const btn = $('sendChatBtn');
    const text = input?.value?.trim() || '';
    if(!text) return;
    try{
      sendingChat = true;
      if(btn) btn.disabled = true;
      const r = await supabase.from('match_room_chat').insert({room_id:roomId,sender_user_id:user.id,sender_id:user.id,sender_email:user.email,sender_name:user.email||'Player',message:text,body:text});
      if(r.error) throw r.error;
      input.value = '';
      await loadChat();
    }catch(e2){ status('Send chat error: ' + e2.message); }
    finally{ sendingChat=false; if(btn) btn.disabled=false; }
  }

  function bindChat(){
    const old = $('sendChatBtn');
    if(old){
      const clone = old.cloneNode(true);
      old.parentNode.replaceChild(clone, old);
      clone.addEventListener('click', sendChat);
    }
    const input = $('chatInput');
    if(input && !input.dataset.bound){
      input.dataset.bound='yes';
      input.addEventListener('keydown', e => { if(e.key==='Enter'){ e.preventDefault(); sendChat(e); } });
    }
    if(chatSub) supabase.removeChannel(chatSub);
    chatSub = supabase.channel('match-chat-' + roomId).on('postgres_changes',{event:'INSERT',schema:'public',table:'match_room_chat',filter:`room_id=eq.${roomId}`},loadChat).subscribe();
  }

  function ensureScore(){
    if($('submitScrimScoreBtn')) return;
    const target = document.querySelector('main') || document.body;
    const s = document.createElement('section');
    s.className = 'vcc-card';
    s.innerHTML = `<div class="vcc-panel-title"><h2>SUBMIT SCORE</h2><span>Captains</span></div><div class="grid"><input id="scrimTeamAScore" type="number" min="0" placeholder="Team A Score"><input id="scrimTeamBScore" type="number" min="0" placeholder="Team B Score"></div><textarea id="scrimScoreNote" rows="3" placeholder="Optional note"></textarea><button id="submitScrimScoreBtn" class="gold">Submit Score</button><div id="scrimScoreStatus" class="log">Captains submit scores here.</div>`;
    target.appendChild(s);
  }

  async function submitScore(e){
    if(e) e.preventDefault();
    if(submittingScore) return;
    try{
      submittingScore = true;
      const a = Number($('scrimTeamAScore')?.value || 0);
      const b = Number($('scrimTeamBScore')?.value || 0);
      const note = $('scrimScoreNote')?.value || '';
      const r = await supabase.rpc('submit_scrim_match_score',{p_room_id:roomId,p_submitter_user_id:user.id,p_submitter_team_id:myTeamId,p_team_a_score:a,p_team_b_score:b,p_note:note});
      if(r.error) throw r.error;
      if($('scrimScoreStatus')) $('scrimScoreStatus').textContent = r.data || 'Score submitted.';
      await loadRoom(); await renderRoom();
    }catch(e2){ if($('scrimScoreStatus')) $('scrimScoreStatus').textContent = 'Submit score error: ' + e2.message; status('Submit score error: ' + e2.message); }
    finally{ submittingScore = false; }
  }

  function bindScore(){
    ensureScore();
    const btn = $('submitScrimScoreBtn') || $('submitScoreBtn');
    if(btn && !btn.dataset.bound){ btn.dataset.bound='yes'; btn.addEventListener('click', submitScore); }
  }

  async function ensureVeto(){
    const r = await supabase.from('match_veto_state').select('*').eq('room_id',roomId).maybeSingle();
    if(r.error && r.error.code !== 'PGRST116') throw r.error;
    if(!r.data){
      await supabase.from('match_veto_state').insert({room_id:roomId,available_servers:SERVERS,available_maps:MAPS,banned_servers:[],banned_maps:[],turn_team_id:room.team_a_id,turn_started_at:new Date().toISOString(),status:'active'});
    }
  }

  async function renderVeto(){
    if(!$('vetoPanel')){
      const target = document.querySelector('main') || document.body;
      const p = document.createElement('section');
      p.id='vetoPanel'; p.className='vcc-card';
      p.innerHTML = `<div class="vcc-panel-title"><h2>SERVER / MAP VETO</h2><span id="vetoTimer">45s</span></div><div class="grid"><div><h3>Servers</h3><div id="serverVetoList"></div></div><div><h3>Maps</h3><div id="mapVetoList"></div></div></div><div id="vetoStatus" class="log">Loading veto...</div>`;
      target.appendChild(p);
    }
    await ensureVeto();
    await drawVeto();
  }

  async function drawVeto(){
    const r = await supabase.from('match_veto_state').select('*').eq('room_id',roomId).maybeSingle();
    if(r.error || !r.data) return;
    const s = r.data;
    const list = (items,type) => (items||[]).map(item => `<button class="vetoBtn secondary" data-type="${type}" data-value="${safe(item)}" ${s.turn_team_id !== myTeamId || s.status !== 'active' ? 'disabled' : ''}>Ban ${safe(item)}</button>`).join('');
    if($('serverVetoList')) $('serverVetoList').innerHTML = list(s.available_servers,'server');
    if($('mapVetoList')) $('mapVetoList').innerHTML = list(s.available_maps,'map');
    if($('vetoStatus')) $('vetoStatus').textContent = s.status === 'complete' ? `Veto complete. Server: ${s.final_server}. Map: ${s.final_map}.` : (s.turn_team_id === myTeamId ? 'Your ban turn.' : 'Waiting for opponent ban.');
    document.querySelectorAll('.vetoBtn').forEach(b => b.onclick = () => banVeto(b.dataset.type,b.dataset.value));
    if(s.status === 'complete'){ await loadRoom(); }
  }

  async function banVeto(type,value){
    const r = await supabase.rpc('vcc_veto_ban',{p_room_id:roomId,p_team_id:myTeamId,p_type:type,p_value:value});
    if(r.error){ status('Veto error: ' + r.error.message); return; }
    await drawVeto();
  }

  function startVetoTimer(){
    setInterval(async () => {
      const r = await supabase.from('match_veto_state').select('*').eq('room_id',roomId).maybeSingle();
      if(r.error || !r.data) return;
      const s = r.data;
      if(s.status !== 'active'){ if($('vetoTimer')) $('vetoTimer').textContent='Done'; return; }
      const left = Math.max(0,45 - Math.floor((Date.now() - new Date(s.turn_started_at).getTime())/1000));
      if($('vetoTimer')) $('vetoTimer').textContent = left + 's';
      if(left <= 0 && s.turn_team_id === myTeamId){
        const fallback = (s.available_servers||[]).length > 1 ? ['server',s.available_servers[0]] : ((s.available_maps||[]).length > 1 ? ['map',s.available_maps[0]] : null);
        if(fallback) await banVeto(fallback[0],fallback[1]);
      }
    },1000);
    if(vetoSub) supabase.removeChannel(vetoSub);
    vetoSub = supabase.channel('veto-' + roomId).on('postgres_changes',{event:'*',schema:'public',table:'match_veto_state',filter:`room_id=eq.${roomId}`},drawVeto).subscribe();
  }

  async function init(){
    try{
      supabase = await getSupabase();
      if(!await loadUser()) return;
      await loadRoom();
      if(!await verifyTeam()) return;
      await renderRoom();
      await loadChat();
      bindChat();
      bindScore();
      startVetoTimer();
      setInterval(async()=>{ await loadRoom(); await loadChat(); },5000);
      status('Match room loaded.');
    }catch(e){ status('Match room error: ' + e.message); console.error(e); }
  }
  init();
})();
