// VCC Tournament Bracket Viewer
(async function(){
  let supabase = null, user = null, myTeamIds = [];

  const safe = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  async function getSupabase(){
    if(supabase) return supabase;
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    supabase = lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
    return supabase;
  }

  async function loadMe(){
    const db = await getSupabase();
    const session = await db.auth.getSession();
    user = session?.data?.session?.user || null;
    if(!user) return;

    const m = await db.from('team_memberships')
      .select('team_id')
      .or(`user_id.eq.${user.id},player_id.eq.${user.id}`)
      .eq('status','active');

    myTeamIds = (m.data || []).map(x => x.team_id);
  }

  function styles(){
    if(document.getElementById('vccBracketStyles')) return;
    const s = document.createElement('style');
    s.id = 'vccBracketStyles';
    s.textContent = `
      .vcc-bracket-wrap{margin-top:18px;overflow-x:auto;padding-bottom:10px}
      .vcc-bracket-rounds{display:flex;gap:28px;align-items:flex-start;min-width:720px}
      .vcc-bracket-round{min-width:260px}
      .vcc-bracket-round h3{color:#ff2b5f;letter-spacing:2px;text-transform:uppercase;font-size:15px;margin:0 0 12px}
      .vcc-bracket-match{background:#101014;border:1px solid rgba(255,255,255,.12);border-radius:14px;margin-bottom:18px;padding:12px}
      .vcc-bracket-team{display:flex;justify-content:space-between;gap:10px;background:#050506;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px;margin-bottom:8px}
      .vcc-bracket-team.viewer-team{border-color:#ffd23f;background:rgba(255,210,63,.18);box-shadow:0 0 16px rgba(255,210,63,.22)}
      .vcc-bracket-team.winner{border-color:#2cff73}
      .vcc-bracket-score{font-size:20px;font-weight:900;color:#fff;min-width:28px;text-align:right}
      .vcc-bracket-meta{font-size:12px;opacity:.7;margin-top:8px}
      .viewBracketBtn{margin-top:10px}
    `;
    document.head.appendChild(s);
  }

  async function teamMap(ids){
    const db = await getSupabase();
    ids = [...new Set(ids.filter(Boolean))];
    if(!ids.length) return {};
    const r = await db.from('teams').select('*').in('id', ids);
    const map = {};
    (r.data || []).forEach(t => map[t.id] = t);
    return map;
  }

  async function matches(tournamentId){
    const db = await getSupabase();

    let r = await db.from('tournament_matches')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round', {ascending:true})
      .order('match_number', {ascending:true});

    if(!r.error) return r.data || [];

    r = await db.from('match_rooms')
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('round', {ascending:true})
      .order('created_at', {ascending:true});

    if(r.error) throw r.error;
    return r.data || [];
  }

  function tName(id, map, fallback){
    const t = map[id];
    return t?.name || t?.team_name || t?.tag || fallback || 'TBD';
  }

  function score(m, side){
    return side === 'a'
      ? (m.team_a_score ?? m.score_a ?? m.home_score ?? 0)
      : (m.team_b_score ?? m.score_b ?? m.away_score ?? 0);
  }

  async function render(tournamentId, mount){
    mount.innerHTML = '<div class="log">Loading bracket...</div>';

    const rows = await matches(tournamentId);

    if(!rows.length){
      mount.innerHTML = '<div class="log">Bracket has not been generated yet.</div>';
      return;
    }

    const ids = [];
    rows.forEach(m => {
      ids.push(m.team_a_id || m.home_team_id);
      ids.push(m.team_b_id || m.away_team_id);
    });

    const teams = await teamMap(ids);
    const rounds = {};

    rows.forEach(m => {
      const r = m.round || m.round_number || 1;
      if(!rounds[r]) rounds[r] = [];
      rounds[r].push(m);
    });

    mount.innerHTML = `
      <div class="vcc-bracket-wrap">
        <div class="vcc-bracket-rounds">
          ${Object.keys(rounds).sort((a,b)=>Number(a)-Number(b)).map(round => `
            <section class="vcc-bracket-round">
              <h3>Round ${safe(round)}</h3>
              ${rounds[round].map(m => {
                const a = m.team_a_id || m.home_team_id;
                const b = m.team_b_id || m.away_team_id;
                const w = m.winner_team_id || m.winner_id;
                return `
                  <article class="vcc-bracket-match">
                    <div class="vcc-bracket-team ${myTeamIds.includes(a) ? 'viewer-team' : ''} ${w === a ? 'winner' : ''}">
                      <span>${safe(tName(a, teams, 'Team A'))}</span><strong class="vcc-bracket-score">${safe(score(m,'a'))}</strong>
                    </div>
                    <div class="vcc-bracket-team ${myTeamIds.includes(b) ? 'viewer-team' : ''} ${w === b ? 'winner' : ''}">
                      <span>${safe(tName(b, teams, 'Team B'))}</span><strong class="vcc-bracket-score">${safe(score(m,'b'))}</strong>
                    </div>
                    <div class="vcc-bracket-meta">${safe(m.status || 'pending')}</div>
                  </article>
                `;
              }).join('')}
            </section>
          `).join('')}
        </div>
      </div>
    `;
  }

  function addButtons(){
    document.querySelectorAll('[data-id], .signupBtn, .checkInBtn').forEach(el => {
      const card = el.closest('.vcc-card');
      if(!card || card.dataset.vccBracketButton === 'yes') return;
      const tid = el.dataset.id;
      if(!tid) return;

      card.dataset.vccBracketButton = 'yes';
      const btn = document.createElement('button');
      btn.className = 'viewBracketBtn secondary';
      btn.textContent = 'View Bracket';

      const mount = document.createElement('div');
      mount.className = 'vcc-bracket-mount';
      mount.style.display = 'none';

      btn.onclick = async () => {
        if(mount.style.display === 'none'){
          mount.style.display = 'block';
          btn.textContent = 'Hide Bracket';
          await render(tid, mount);
        }else{
          mount.style.display = 'none';
          btn.textContent = 'View Bracket';
        }
      };

      card.appendChild(btn);
      card.appendChild(mount);
    });
  }

  await getSupabase();
  await loadMe();
  styles();
  addButtons();
  setInterval(addButtons, 1000);
})();
