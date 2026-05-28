// VCC Match Room Team Names + Bracket Header + BO3 Veto Fix
(function(){
  const SERVERS = ['US West (Oregon)','US West (N. California)','US East (N. Virginia)','US Central (Texas)','US Central (Illinois)','US Central (Georgia)'];
  const MAPS = ['Abyss','Bind','Breeze','Corrode','Haven','Pearl','Split'];

  let supabase=null,user=null,room=null,teamA=null,teamB=null,myTeamId=null,chatSub=null,vetoSub=null,sending=false;
  const roomId = new URLSearchParams(location.search).get('id');
  const $ = id => document.getElementById(id);
  const safe = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const status = msg => { const b=$('matchRoomStatus')||$('chatStatus')||document.querySelector('.log'); if(b)b.textContent=msg; console.log('[Match Room]',msg); };

  async function getSupabase(){
    if(supabase) return supabase;
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    supabase = lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return supabase;
  }

  async function loadUser(){
    const s = await supabase.auth.getSession();
    user = s?.data?.session?.user || null;
    if(!user){ location.href='auth.html?mode=login'; return false; }
    return true;
  }

  async function loadRoom(){
    const r = await supabase.from('match_rooms').select('*').eq('id',roomId).maybeSingle();
    if(r.error) throw r.error;
    if(!r.data) throw new Error('Room not found.');
    room = r.data;
  }

  async function loadTeams(){
    const ids=[room.team_a_id,room.team_b_id].filter(Boolean);
    const r = await supabase.from('teams').select('*').in('id',ids);
    const map={};
    (r.data||[]).forEach(t=>map[t.id]=t);
    teamA = map[room.team_a_id] || {id:room.team_a_id,name:'Team A',logo_url:'assets/vcc-logo.png'};
    teamB = map[room.team_b_id] || {id:room.team_b_id,name:'Team B',logo_url:'assets/vcc-logo.png'};
  }

  async function verifyAccess(){
    const m = await supabase.from('team_memberships').select('team_id')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`).eq('status','active');
    const ids=(m.data||[]).map(x=>x.team_id);
    myTeamId = ids.includes(room.team_a_id) ? room.team_a_id : ids.includes(room.team_b_id) ? room.team_b_id : null;
    if(!myTeamId){
      document.body.innerHTML='<main class="vcc-page"><section class="vcc-card"><h1>Access Denied</h1><p>Only teams in this match can access this room.</p></section></main>';
      return false;
    }
    return true;
  }

  function isBo3(){
    const f = String(room.format || room.match_format || room.series_type || 'bo1').toLowerCase();
    return f.includes('bo3') || f.includes('best of 3') || f.includes('best-of-3');
  }

  function injectStyles(){
    if($('vccMatchRoomStyles')) return;
    const s=document.createElement('style');
    s.id='vccMatchRoomStyles';
    s.textContent=`
      .veto-top-panel{margin-bottom:20px;border:1px solid rgba(255,210,63,.25)}
      .veto-action-grid{display:flex;gap:10px;flex-wrap:wrap}
      .veto-disabled{opacity:.45;pointer-events:none}
      .scoreboard-title,.match-title{text-transform:uppercase}
    `;
    document.head.appendChild(s);
  }

  function moveVetoTop(){
    let p=$('vetoPanel');
    const main=document.querySelector('main')||document.body;
    if(!p){ p=document.createElement('section'); p.id='vetoPanel'; p.className='vcc-card veto-top-panel'; }
    main.insertBefore(p, main.firstChild);
  }

  function updateHeader(){
    document.querySelectorAll('.scoreboard-title,.match-title,h1').forEach(el=>{
      if(/scoreboard/i.test(el.textContent)) el.textContent='Bracket';
    });
    ['teamAName','homeTeamName'].forEach(id=>{ if($(id)) $(id).textContent=teamA.name||'Team A'; });
    ['teamBName','awayTeamName'].forEach(id=>{ if($(id)) $(id).textContent=teamB.name||'Team B'; });
    if($('teamALogo')) $('teamALogo').src=teamA.logo_url||teamA.logo||'assets/vcc-logo.png';
    if($('teamBLogo')) $('teamBLogo').src=teamB.logo_url||teamB.logo||'assets/vcc-logo.png';
    if($('scoreA')) $('scoreA').textContent=room.team_a_score ?? room.score_a ?? 0;
    if($('scoreB')) $('scoreB').textContent=room.team_b_score ?? room.score_b ?? 0;
    if($('serverDisplay')) $('serverDisplay').textContent=room.server_pick||room.server||'Server TBD';
    if($('mapDisplay')) $('mapDisplay').textContent=room.map_pick||room.map||'Map TBD';
  }

  async function loadRoster(teamId){
    const r=await supabase.from('team_memberships').select('*, profiles(*)').eq('team_id',teamId).eq('status','active');
    return r.data||[];
  }
  const pName = r => (r.profiles||{}).display_name || (r.profiles||{}).username || (r.profiles||{}).riot_id || (r.profiles||{}).email || 'Player';
  const pImg = r => (r.profiles||{}).avatar_url || (r.profiles||{}).profile_picture_url || (r.profiles||{}).pfp_url || 'assets/vcc-logo.png';

  async function renderRosters(){
    const a=await loadRoster(room.team_a_id), b=await loadRoster(room.team_b_id);
    const html=rows=>rows.length?rows.map(r=>`<div class="player-card" style="display:flex;gap:10px;align-items:center;margin-bottom:10px"><img src="${safe(pImg(r))}" onerror="this.src='assets/vcc-logo.png'" style="width:42px;height:42px;border-radius:10px;object-fit:cover"><div><strong>${safe(pName(r))}</strong><br><small>${safe(r.role||'player')}</small></div></div>`).join(''):'<div class="log">No roster loaded.</div>';
    const ab=$('teamAPlayers')||$('playersA')||document.querySelector('[data-team-a-players]');
    const bb=$('teamBPlayers')||$('playersB')||document.querySelector('[data-team-b-players]');
    if(ab) ab.innerHTML=html(a);
    if(bb) bb.innerHTML=html(b);
  }

  function steps(){
    if(isBo3()) return [
      ['a','ban_server','Team A ban server'],['b','ban_server','Team B ban server'],
      ['a','pick_map','Team A pick map'],['b','pick_map','Team B pick map'],
      ['a','ban_map','Team A ban map'],['b','ban_map','Team B ban map'],
      [null,'decider','Last map is decider']
    ];
    return [
      ['a','ban_server','Team A ban server'],['b','ban_server','Team B ban server'],
      ['a','ban_map','Team A ban map'],['b','ban_map','Team B ban map'],
      [null,'decider','Last map is decider']
    ];
  }
  const teamFor = st => st?.[0]==='a'?room.team_a_id:st?.[0]==='b'?room.team_b_id:null;

  async function ensureVeto(){
    const r=await supabase.from('match_veto_state').select('*').eq('room_id',roomId).maybeSingle();
    if(r.error && r.error.code!=='PGRST116') throw r.error;
    if(!r.data){
      const ins=await supabase.from('match_veto_state').insert({
        room_id:roomId,phase:'server_ban',step_index:0,available_servers:SERVERS,banned_servers:[],
        available_maps:MAPS,banned_maps:[],picked_maps:[],turn_team_id:room.team_a_id,
        turn_started_at:new Date().toISOString(),status:'active'
      });
      if(ins.error) throw ins.error;
    }
  }

  async function getVeto(){
    const r=await supabase.from('match_veto_state').select('*').eq('room_id',roomId).maybeSingle();
    if(r.error) throw r.error;
    return r.data;
  }

  async function renderVeto(){
    moveVetoTop();
    await ensureVeto();
    const state=await getVeto(), st=steps()[state.step_index||0] || steps().at(-1);
    const turn=teamFor(st), myTurn=turn===myTeamId;
    const panel=$('vetoPanel');
    if(state.status==='complete'){
      panel.innerHTML=`<div class="vcc-panel-title"><h2>VETO COMPLETE</h2><span>Ready</span></div><p><strong>Server:</strong> ${safe(state.final_server||room.server_pick||'TBD')}</p><p><strong>Maps:</strong> ${safe(((state.picked_maps||[]).length?state.picked_maps:[state.final_map||room.map_pick||'TBD']).join(' / '))}</p>`;
      return;
    }
    let items=[];
    if(st[1]==='ban_server') items=(state.available_servers||SERVERS).map(x=>['ban_server',x,`Ban ${x}`]);
    if(st[1]==='pick_map') items=(state.available_maps||MAPS).map(x=>['pick_map',x,`Pick ${x}`]);
    if(st[1]==='ban_map') items=(state.available_maps||MAPS).map(x=>['ban_map',x,`Ban ${x}`]);

    panel.innerHTML=`
      <div class="vcc-panel-title"><h2>SERVER / MAP VETO</h2><span>${safe(isBo3()?'BO3':'BO1')}</span></div>
      <p><strong>Current Step:</strong> ${safe(st[2])}</p>
      <p><strong>Turn:</strong> ${safe(myTurn?'Your team':turn===room.team_a_id?teamA.name:turn===room.team_b_id?teamB.name:'System')}</p>
      <div class="veto-action-grid">${items.map(i=>`<button class="vetoActionBtn secondary ${myTurn?'':'veto-disabled'}" data-action="${i[0]}" data-value="${safe(i[1])}">${safe(i[2])}</button>`).join('') || '<div class="log">Calculating decider...</div>'}</div>
      <p><strong>Banned Servers:</strong> ${safe((state.banned_servers||[]).join(' / ')||'None')}</p>
      <p><strong>Picked Maps:</strong> ${safe((state.picked_maps||[]).join(' / ')||'None')}</p>
      <p><strong>Banned Maps:</strong> ${safe((state.banned_maps||[]).join(' / ')||'None')}</p>`;
    document.querySelectorAll('.vetoActionBtn').forEach(btn=>btn.onclick=()=>doVeto(btn.dataset.action,btn.dataset.value));
    if(st[1]==='decider') await finishDecider(state);
  }

  async function doVeto(action,value){
    const state=await getVeto(), st=steps()[state.step_index||0];
    if(teamFor(st)!==myTeamId){ alert('It is not your team turn.'); return; }
    let avs=state.available_servers||SERVERS, bs=state.banned_servers||[], avm=state.available_maps||MAPS, bm=state.banned_maps||[], pm=state.picked_maps||[];
    if(action==='ban_server'){ avs=avs.filter(x=>x!==value); bs.push(value); }
    if(action==='pick_map'){ avm=avm.filter(x=>x!==value); pm.push(value); }
    if(action==='ban_map'){ avm=avm.filter(x=>x!==value); bm.push(value); }
    const ni=(state.step_index||0)+1, ns=steps()[ni];
    const u=await supabase.from('match_veto_state').update({
      available_servers:avs,banned_servers:bs,available_maps:avm,banned_maps:bm,picked_maps:pm,
      step_index:ni,phase:ns?.[1]||'complete',turn_team_id:teamFor(ns),turn_started_at:new Date().toISOString()
    }).eq('room_id',roomId);
    if(u.error) throw u.error;
    await renderVeto();
  }

  async function finishDecider(state){
    const avm=state.available_maps||[], pm=state.picked_maps||[], decider=avm[0]||null, finalMaps=decider?[...pm,decider]:pm;
    const finalServer=(state.available_servers||[])[0]||null;
    let u=await supabase.from('match_veto_state').update({status:'complete',final_server:finalServer,final_map:decider||pm[0]||null,picked_maps:finalMaps}).eq('room_id',roomId);
    if(u.error) throw u.error;
    await supabase.from('match_rooms').update({server_pick:finalServer,map_pick:finalMaps.join(' / ')}).eq('id',roomId);
    await loadRoom(); updateHeader(); await renderVeto();
  }

  async function loadChat(){
    const box=$('chatMessages')||$('chatBox'); if(!box)return;
    const r=await supabase.from('match_room_chat').select('*').eq('room_id',roomId).order('created_at',{ascending:true});
    if(r.error)return;
    box.innerHTML=(r.data||[]).length?(r.data||[]).map(m=>`<div style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)"><strong>${safe(m.sender_name||m.sender_email||'Player')}</strong><span style="float:right;opacity:.65">${m.created_at?new Date(m.created_at).toLocaleTimeString():''}</span><p>${safe(m.message||m.body||'')}</p></div>`).join(''):'<div class="log">No messages yet.</div>';
    box.scrollTop=box.scrollHeight;
  }

  async function sendChat(e){
    if(e)e.preventDefault(); if(sending)return;
    const input=$('chatInput'), text=input?.value?.trim()||''; if(!text)return;
    sending=true;
    const r=await supabase.from('match_room_chat').insert({room_id:roomId,sender_user_id:user.id,sender_id:user.id,sender_email:user.email,sender_name:user.email,message:text,body:text});
    sending=false;
    if(r.error){status('Send chat error: '+r.error.message);return;}
    input.value=''; await loadChat();
  }

  function bindChat(){
    if($('sendChatBtn')&&!$('sendChatBtn').dataset.bound){ $('sendChatBtn').dataset.bound='yes'; $('sendChatBtn').addEventListener('click',sendChat); }
    if($('chatInput')&&!$('chatInput').dataset.bound){ $('chatInput').dataset.bound='yes'; $('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendChat(e);}}); }
    if(chatSub) supabase.removeChannel(chatSub);
    chatSub=supabase.channel('chat-'+roomId).on('postgres_changes',{event:'INSERT',schema:'public',table:'match_room_chat',filter:`room_id=eq.${roomId}`},loadChat).subscribe();
  }

  function bindRealtime(){
    if(vetoSub) supabase.removeChannel(vetoSub);
    vetoSub=supabase.channel('veto-'+roomId).on('postgres_changes',{event:'*',schema:'public',table:'match_veto_state',filter:`room_id=eq.${roomId}`},renderVeto).subscribe();
  }

  async function init(){
    try{
      if(!roomId) throw new Error('Missing room ID.');
      await getSupabase(); if(!await loadUser())return; await loadRoom(); await loadTeams(); if(!await verifyAccess())return;
      injectStyles(); updateHeader(); await renderRosters(); await renderVeto(); bindRealtime(); await loadChat(); bindChat();
      status('Match room loaded.');
    }catch(e){ status('Match room error: '+e.message); console.error(e); }
  }
  init();
})();
