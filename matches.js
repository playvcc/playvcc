// VCC Matches page: league schedule + rooms
(function(){
  let supabase=null,user=null,myTeamIds=[];
  const statusBox=document.getElementById('matchesStatus');
  const tournamentBox=document.getElementById('tournamentMatchesBox');
  const scrimBox=document.getElementById('scrimRoomsBox');
  function setStatus(m){ if(statusBox)statusBox.textContent=m; }
  function safe(v){ return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
  async function getSupabase(){ const c=await import('./supabase-config.js'); const lib=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'); return lib.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY); }
  async function loadTeams(){ const s=await supabase.auth.getSession(); user=s?.data?.session?.user||null; if(!user)return; const m=await supabase.from('team_memberships').select('*').or(`user_id.eq.${user.id},player_id.eq.${user.id}`).eq('status','active'); myTeamIds=(m.data||[]).map(x=>x.team_id); }
  function canOpen(a,b){ return myTeamIds.includes(a)||myTeamIds.includes(b); }

  async function loadTournamentMatches(){
    const r=await supabase.from('tournament_matches').select('*').neq('status','completed').order('scheduled_at',{ascending:true,nullsFirst:false}).order('created_at',{ascending:false});
    if(r.error){ tournamentBox.innerHTML=`<div class="log">Tournament matches error: ${safe(r.error.message)}</div>`; return; }
    const data=r.data||[];
    if(!data.length){ tournamentBox.innerHTML='<div class="log">No tournament or league matches yet.</div>'; return; }
    const grouped={};
    data.forEach(m=>{ const w=m.week_number?`Week ${m.week_number}`:'Bracket / Unscheduled'; (grouped[w] ||= []).push(m); });
    tournamentBox.innerHTML=Object.entries(grouped).map(([week,rows])=>`
      <section class="vcc-card">
        <div class="vcc-panel-title"><h2>${safe(week)}</h2><span>${rows.length} Matches</span></div>
        ${rows.map(m=>{
          const when=m.scheduled_at?new Date(m.scheduled_at).toLocaleString():'Time TBD';
          return `<article class="identity-row" style="margin-bottom:10px">
            <span><strong>${safe(m.team_a_id)} vs ${safe(m.team_b_id)}</strong><br><small>${safe(when)} ${m.match_day?' · '+safe(m.match_day):''}</small></span>
            <strong>${safe(m.status||'scheduled')}</strong>
            ${canOpen(m.team_a_id,m.team_b_id)?`<a class="btn" href="tournament-match.html?id=${safe(m.id)}">Open Room</a>`:`<span class="pill">Private Room</span>`}
          </article>`;
        }).join('')}
      </section>`).join('');
  }

  async function loadScrims(){
    if(!scrimBox)return;
    const r=await supabase.from('match_rooms').select('*').eq('room_type','scrim').neq('status','completed').order('created_at',{ascending:false});
    if(r.error){ scrimBox.innerHTML=`<div class="log">Scrim rooms error: ${safe(r.error.message)}</div>`; return; }
    scrimBox.innerHTML=(r.data||[]).length ? (r.data||[]).map(x=>`<article class="vcc-card"><h2>Scrim Room</h2><p>${safe(x.team_a_id)} vs ${safe(x.team_b_id)}</p>${canOpen(x.team_a_id,x.team_b_id)?`<a class="btn" href="match-room.html?id=${safe(x.id)}">Open Scrim Room</a>`:`<span class="pill">Private Room</span>`}</article>`).join('') : '<div class="log">No scrim rooms yet.</div>';
  }

  async function init(){ try{ supabase=await getSupabase(); await loadTeams(); await loadTournamentMatches(); await loadScrims(); setStatus(user?'Matches loaded.':'Sign in to open private rooms.'); }catch(e){ setStatus('Matches error: '+e.message); } }
  init();
})();
