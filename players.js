import { supabase, safe } from './app.js';

let players = [];

async function loadPlayers(){
  const box = document.getElementById('playersBox');

  try{
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending:false });

    if(error) throw error;

    players = data || [];
    renderPlayers();
  }catch(error){
    box.innerHTML = `<div class="log">Players error: ${safe(error.message)}</div>`;
  }
}

function renderPlayers(){
  const box = document.getElementById('playersBox');
  const q = document.getElementById('playerSearch').value.toLowerCase().trim();
  const rank = document.getElementById('rankFilter').value.toLowerCase();
  const platform = document.getElementById('platformFilter').value.toLowerCase();

  const filtered = players.filter(p => {
    const text = [
      p.display_name,
      p.username,
      p.riot_id,
      p.rank,
      p.platform,
      p.region,
      p.role,
      p.main_role,
      p.main_agents
    ].join(' ').toLowerCase();

    if(q && !text.includes(q)) return false;
    if(rank && !(p.rank || '').toLowerCase().includes(rank)) return false;
    if(platform && !(p.platform || '').toLowerCase().includes(platform)) return false;
    return true;
  });

  if(!filtered.length){
    box.innerHTML = `<div class="log">No players found.</div>`;
    return;
  }

  box.innerHTML = filtered.map(p => {
    const name = p.display_name || p.username || 'VCC Player';

    return `
      <a class="player-row" href="profile.html?user=${encodeURIComponent(p.id)}">
        <img src="${safe(p.avatar_url || 'assets/vcc-logo.png')}" alt="${safe(name)} avatar">
        <div>
          <strong>${safe(name)}</strong>
          <small>${safe(p.riot_id || 'Riot ID not set')}</small>
        </div>
        <div><span class="pill">${safe(p.rank || 'Unranked')}</span></div>
        <div>${safe(p.platform || 'Console')}</div>
        <div>${safe(p.main_role || p.role || 'Flex')}</div>
        <div>${safe(p.team_name || 'Free Agent')}</div>
        <div><span class="pill">View</span></div>
      </a>
    `;
  }).join('');
}

document.getElementById('playerSearch').addEventListener('input', renderPlayers);
document.getElementById('rankFilter').addEventListener('change', renderPlayers);
document.getElementById('platformFilter').addEventListener('change', renderPlayers);

loadPlayers();
