import { supabase, safe } from './app.js';

let rawStats = [];
let groupedStats = [];

function kd(kills, deaths){
  return deaths > 0 ? kills / deaths : kills;
}

async function loadStats(){
  const rows = document.getElementById('statsRows');

  try{
    const { data, error } = await supabase
      .from('player_match_stats')
      .select('*')
      .order('created_at', { ascending:false });

    if(error) throw error;

    rawStats = data || [];
    buildAgentFilter();
    groupStats();
    renderStats();
  }catch(error){
    rows.innerHTML = `<div class="log">Stats error: ${safe(error.message)}</div>`;
  }
}

function buildAgentFilter(){
  const agents = [...new Set(rawStats.map(r => r.agent).filter(Boolean))].sort();
  document.getElementById('agentFilter').innerHTML =
    `<option value="">All Agents</option>` +
    agents.map(a => `<option value="${safe(a)}">${safe(a)}</option>`).join('');
}

function groupStats(){
  const map = new Map();

  rawStats.forEach(r => {
    const key = (r.player_user_id || r.player_name || 'Unknown').toLowerCase();

    if(!map.has(key)){
      map.set(key, {
        player_user_id:r.player_user_id,
        player_name:r.player_name || 'Unknown',
        team_name:r.team_name || 'Free Agent',
        maps:0,
        wins:0,
        kills:0,
        deaths:0,
        assists:0,
        acsTotal:0,
        agents:{}
      });
    }

    const p = map.get(key);
    p.maps++;
    if((r.result || '').toLowerCase() === 'win') p.wins++;
    p.kills += Number(r.kills || 0);
    p.deaths += Number(r.deaths || 0);
    p.assists += Number(r.assists || 0);
    p.acsTotal += Number(r.acs || 0);
    if(r.agent) p.agents[r.agent] = (p.agents[r.agent] || 0) + 1;
  });

  groupedStats = [...map.values()].map(p => ({
    ...p,
    kd:kd(p.kills, p.deaths),
    acs:p.maps ? Math.round(p.acsTotal / p.maps) : 0,
    mainAgent:Object.entries(p.agents).sort((a,b) => b[1]-a[1])[0]?.[0] || 'N/A'
  }));
}

function renderStats(){
  const rows = document.getElementById('statsRows');
  const q = document.getElementById('statsSearch').value.toLowerCase().trim();
  const sort = document.getElementById('sortBy').value;
  const agent = document.getElementById('agentFilter').value;

  let data = groupedStats.filter(p => {
    const text = [p.player_name, p.team_name, p.mainAgent].join(' ').toLowerCase();
    if(q && !text.includes(q)) return false;
    if(agent && !p.agents[agent]) return false;
    return true;
  });

  data.sort((a,b) => {
    if(sort === 'acs') return b.acs - a.acs;
    if(sort === 'kills') return b.kills - a.kills;
    if(sort === 'wins') return b.wins - a.wins;
    return b.kd - a.kd;
  });

  if(!data.length){
    rows.innerHTML = `<div class="log">No approved stats yet.</div>`;
    return;
  }

  rows.innerHTML = data.map((p, index) => {
    const kdClass = p.kd >= 1.2 ? 'good' : p.kd >= 1 ? 'warn' : 'bad';
    const profileUrl = p.player_user_id ? `profile.html?user=${encodeURIComponent(p.player_user_id)}` : 'players.html';

    return `
      <div class="stats-row">
        <span>${index + 1}</span>
        <span>
          <a href="${profileUrl}">${safe(p.player_name)}</a>
          <small style="display:block;color:var(--vcc-muted)">Main Agent: ${safe(p.mainAgent)}</small>
        </span>
        <span>${safe(p.team_name)}</span>
        <span>${p.maps}</span>
        <span>${p.wins}</span>
        <span>${p.kills}</span>
        <span>${p.deaths}</span>
        <span>${p.assists}</span>
        <span class="${kdClass}">${p.kd.toFixed(2)}</span>
        <span>${p.acs}</span>
      </div>
    `;
  }).join('');
}

document.getElementById('statsSearch').addEventListener('input', renderStats);
document.getElementById('sortBy').addEventListener('change', renderStats);
document.getElementById('agentFilter').addEventListener('change', renderStats);

loadStats();
