// VCC Phase 1 League Scheduler Add-On
// Add before </body> on admin.html after admin.js:
// <script src="admin-league-scheduler.js"></script>

(function(){
  const ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';
  let supabase = null;

  function code(){ return sessionStorage.getItem('vcc_admin_code') || document.getElementById('adminCode')?.value || ''; }
  function status(msg){ const b=document.getElementById('adminStatus')||document.getElementById('leagueSchedulerStatus'); if(b)b.textContent=msg; else alert(msg); }
  function safe(v){ return String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }

  async function getSupabase(){
    const c = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  }

  function addPanel(){
    if(document.getElementById('leagueSchedulerPanel')) return;
    const panel=document.createElement('section');
    panel.id='leagueSchedulerPanel';
    panel.className='vcc-card';
    panel.innerHTML=`
      <div class="vcc-panel-title">
        <h2>Preseason Premier League Scheduler</h2>
        <span>Phase 1</span>
      </div>
      <p class="lead">Generate the 5-week / 2-match-days-per-week league schedule from registered teams.</p>
      <div class="grid">
        <select id="leagueTournamentSelect"><option value="">Loading tournaments...</option></select>
        <input id="leagueWeeks" type="number" min="1" max="12" value="5" placeholder="Weeks">
        <select id="leagueDayOne"><option value="2">Tuesday</option><option value="1">Monday</option><option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option></select>
        <select id="leagueDayTwo"><option value="4">Thursday</option><option value="1">Monday</option><option value="2">Tuesday</option><option value="3">Wednesday</option><option value="5">Friday</option><option value="6">Saturday</option><option value="0">Sunday</option></select>
        <input id="leagueTimeOne" type="time" value="20:00">
        <input id="leagueTimeTwo" type="time" value="20:00">
        <input id="playoffTeams" type="number" min="2" max="16" value="8" placeholder="Playoff Teams">
      </div>
      <button id="generateLeagueScheduleBtn" class="gold">Generate League Schedule</button>
      <button id="refreshLeagueTournamentsBtn" class="secondary">Refresh League List</button>
      <div id="leagueSchedulerStatus" class="log">Ready.</div>`;
    (document.getElementById('adminPageContent')||document.querySelector('main')||document.body).appendChild(panel);
    document.getElementById('generateLeagueScheduleBtn').addEventListener('click', generate);
    document.getElementById('refreshLeagueTournamentsBtn').addEventListener('click', load);
  }

  async function load(){
    try{
      if(!supabase) supabase=await getSupabase();
      const sel=document.getElementById('leagueTournamentSelect'); if(!sel)return;
      const r=await supabase.from('tournaments').select('*').order('created_at',{ascending:false});
      if(r.error) throw r.error;
      sel.innerHTML=(r.data||[]).length ? (r.data||[]).map(t=>`<option value="${safe(t.id)}">${safe(t.name)} — ${safe(t.format||'format')} — ${safe(t.division||'open')}</option>`).join('') : '<option value="">No tournaments found</option>';
      document.getElementById('leagueSchedulerStatus').textContent='League tournament list loaded.';
    }catch(e){ document.getElementById('leagueSchedulerStatus').textContent='League list error: '+e.message; }
  }

  async function generate(){
    try{
      if(code()!==ADMIN_CODE){ status('Unlock admin first with the correct code.'); return; }
      const tournamentId=document.getElementById('leagueTournamentSelect').value;
      if(!tournamentId){ status('Select a tournament first.'); return; }
      if(!supabase) supabase=await getSupabase();
      status('Generating league schedule...');
      const r=await supabase.rpc('generate_preseason_league_schedule',{
        admin_code:code(),
        p_tournament_id:tournamentId,
        p_weeks:Number(document.getElementById('leagueWeeks').value||5),
        p_day_one:Number(document.getElementById('leagueDayOne').value),
        p_day_two:Number(document.getElementById('leagueDayTwo').value),
        p_time_one:document.getElementById('leagueTimeOne').value||'20:00',
        p_time_two:document.getElementById('leagueTimeTwo').value||'20:00',
        p_playoff_teams:Number(document.getElementById('playoffTeams').value||8)
      });
      if(r.error) throw r.error;
      status('League schedule generated. Matches created: '+r.data);
    }catch(e){ status('Generate league schedule error: '+e.message); }
  }

  function init(){ addPanel(); setTimeout(load,700); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init();
})();
