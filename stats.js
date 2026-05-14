import { supabase } from './app.js';

const rowsBox=document.getElementById('statsRows');
const searchInput=document.getElementById('searchInput');
const agentFilter=document.getElementById('agentFilter');
const sortBy=document.getElementById('sortBy');
let raw=[]; let grouped=[];

function safe(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function kd(k,d){return d>0?(k/d):k}
function avg(a,b){return b?Math.round(a/b):0}

async function loadStats(){
  const {data,error}=await supabase.from('player_match_stats').select('*').order('created_at',{ascending:false});
  if(error){rowsBox.innerHTML=`<div class="stats-empty">${safe(error.message)}</div>`;return}
  raw=data||[];
  buildAgentFilter();
  groupStats();
  render();
}

function buildAgentFilter(){
  const agents=[...new Set(raw.map(r=>r.agent).filter(Boolean))].sort();
  agentFilter.innerHTML='<option value="">All Agents</option>'+agents.map(a=>`<option value="${safe(a)}">${safe(a)}</option>`).join('');
}

function groupStats(){
  const map=new Map();
  raw.forEach(r=>{
    const key=(r.player_user_id||r.player_name||'Unknown').toLowerCase();
    if(!map.has(key)) map.set(key,{player_user_id:r.player_user_id,player_name:r.player_name||'Unknown',team_name:r.team_name||'Free Agent',maps:0,wins:0,losses:0,kills:0,deaths:0,assists:0,acsTotal:0,agents:{}});
    const p=map.get(key);
    p.maps++; if((r.result||'').toLowerCase()==='win')p.wins++; if((r.result||'').toLowerCase()==='loss')p.losses++;
    p.kills+=Number(r.kills||0); p.deaths+=Number(r.deaths||0); p.assists+=Number(r.assists||0); p.acsTotal+=Number(r.acs||0);
    if(r.agent)p.agents[r.agent]=(p.agents[r.agent]||0)+1;
  });
  grouped=[...map.values()].map(p=>({...p,kd:kd(p.kills,p.deaths),acs:avg(p.acsTotal,p.maps),mainAgent:Object.entries(p.agents).sort((a,b)=>b[1]-a[1])[0]?.[0]||'N/A'}));
}

function render(){
  const q=searchInput.value.toLowerCase().trim();
  const agent=agentFilter.value;
  let data=grouped.filter(p=>{
    const text=[p.player_name,p.team_name,p.mainAgent].join(' ').toLowerCase();
    if(q && !text.includes(q)) return false;
    if(agent && p.mainAgent!==agent && !(p.agents[agent])) return false;
    return true;
  });
  data.sort((a,b)=>{
    const s=sortBy.value;
    if(s==='acs')return b.acs-a.acs;
    if(s==='kills')return b.kills-a.kills;
    if(s==='wins')return b.wins-a.wins;
    return b.kd-a.kd;
  });

  document.getElementById('totalPlayers').textContent=grouped.length;
  document.getElementById('totalMaps').textContent=raw.length;
  document.getElementById('topKD').textContent=grouped.length?Math.max(...grouped.map(p=>p.kd)).toFixed(2):'0.00';
  document.getElementById('topACS').textContent=grouped.length?Math.max(...grouped.map(p=>p.acs)):0;

  if(!data.length){rowsBox.innerHTML='<div class="stats-empty">No approved player stats yet.</div>';return}
  rowsBox.innerHTML=data.map((p,i)=>{
    const profile=p.player_user_id?`profile.html?user=${encodeURIComponent(p.player_user_id)}`:`players.html`;
    const kdClass=p.kd>=1.2?'stat-good':p.kd>=1?'stat-warn':'stat-bad';
    return `<div class="stats-row"><span class="rank-num">${i+1}</span><span><a class="player-name" href="${profile}">${safe(p.player_name)}</a><small class="player-sub">Main Agent: ${safe(p.mainAgent)}</small></span><span>${safe(p.team_name)}</span><span>${p.maps}</span><span>${p.wins}</span><span>${p.kills}</span><span>${p.deaths}</span><span>${p.assists}</span><span class="${kdClass}">${p.kd.toFixed(2)}</span><span>${p.acs}</span></div>`;
  }).join('');
}

[searchInput,agentFilter,sortBy].forEach(el=>{el.addEventListener('input',render);el.addEventListener('change',render)});
loadStats();
