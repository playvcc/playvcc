const VCC_TZ = 'America/Chicago';
const VCC_ADMIN_CODE_HASH = '943c9968878f8b731aaeae560a0f272f31a57fc842dcf55efe06a96edcaec3b6';
const VCC_DATA_VERSION = 'official-preseason-v5-secure-admin';
const DEFAULT_DATA = {
  version: VCC_DATA_VERSION,
  tournaments: [],
  matches: [],
  teams: [],
  chat: {},
  veto: {},
  reports: {}
};

function cleanClone(obj) { return JSON.parse(JSON.stringify(obj)); }
function vccSave(d) { d.version = VCC_DATA_VERSION; localStorage.setItem('vcc_ops_data', JSON.stringify(d)); }
function vccLoad() {
  let raw = localStorage.getItem('vcc_ops_data');
  if (!raw) { const fresh = cleanClone(DEFAULT_DATA); vccSave(fresh); return fresh; }
  try {
    const d = JSON.parse(raw);
    const hasOldDemo = (d.tournaments || []).some(t => t.id === 'season-zero' || t.name === 'VCC Season Zero') ||
      (d.matches || []).some(m => m.teamA === 'Team A' || m.teamB === 'Team B');
    if (hasOldDemo) { const fresh = cleanClone(DEFAULT_DATA); vccSave(fresh); return fresh; }
    const merged = Object.assign(cleanClone(DEFAULT_DATA), d);
    merged.tournaments = merged.tournaments || [];
    merged.matches = merged.matches || [];
    merged.chat = merged.chat || {};
    merged.veto = merged.veto || {};
    merged.reports = merged.reports || {};
    return merged;
  } catch (e) {
    const fresh = cleanClone(DEFAULT_DATA);
    vccSave(fresh);
    return fresh;
  }
}
function vccId(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(); }
function val(id) { return document.getElementById(id)?.value.trim() || ''; }
function setVal(id, value) { const el = document.getElementById(id); if (el) el.value = value || ''; }
function fmtTime(v) {
  if (!v) return 'TBD';
  try { return new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(v)); }
  catch (e) { return v; }
}
function addDays(iso, days) { if (!iso) return ''; const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString(); }
async function vccSha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function isAdmin() { return sessionStorage.getItem('vcc_admin_unlocked') === 'true'; }
async function unlockAdmin() {
  const code = val('adminCode');
  const hashed = await vccSha256(code);
  if (hashed === VCC_ADMIN_CODE_HASH) {
    sessionStorage.setItem('vcc_admin_unlocked', 'true');
    alert('Admin unlocked for this browser session only.');
    location.reload();
  } else {
    alert('Wrong admin code.');
  }
}
function logoutAdmin() { sessionStorage.removeItem('vcc_admin_unlocked'); location.reload(); }
function esc(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function parseTeams(raw) { return raw.split('\n').map(x => x.trim()).filter(Boolean); }
function scoreNum(x) { const n = parseInt(x, 10); return Number.isFinite(n) ? n : 0; }
function getWinnerFromScores(m) { const a = scoreNum(m.scoreA), b = scoreNum(m.scoreB); if (a === b) return ''; return a > b ? m.teamA : m.teamB; }
function rematchKey(a, b) { return [a, b].sort().join('|||'); }
function completedMatchesForTournament(d, tid) { return d.matches.filter(m => m.tournamentId === tid && String(m.status).toLowerCase() === 'completed' && m.winner); }
function computeStandings(d, tid) {
  const t = d.tournaments.find(x => x.id === tid);
  const teams = [...new Set([...(t?.teamIds || []), ...d.matches.filter(m => m.tournamentId === tid).flatMap(m => [m.teamA, m.teamB]).filter(x => x && x !== 'TBD' && x !== 'BYE')])];
  const table = teams.map(name => ({ team: name, played: 0, wins: 0, losses: 0, pf: 0, pa: 0, diff: 0, points: 0, opponents: [] }));
  const byTeam = Object.fromEntries(table.map(r => [r.team, r]));
  completedMatchesForTournament(d, tid).forEach(m => {
    const a = byTeam[m.teamA], b = byTeam[m.teamB]; if (!a || !b) return;
    const sa = scoreNum(m.scoreA), sb = scoreNum(m.scoreB);
    a.played++; b.played++; a.pf += sa; a.pa += sb; b.pf += sb; b.pa += sa; a.opponents.push(m.teamB); b.opponents.push(m.teamA);
    if (m.winner === m.teamA) { a.wins++; b.losses++; a.points += 3; }
    else if (m.winner === m.teamB) { b.wins++; a.losses++; b.points += 3; }
  });
  table.forEach(r => r.diff = r.pf - r.pa);
  table.sort((a,b) => b.wins - a.wins || b.points - a.points || b.diff - a.diff || b.pf - a.pf || a.team.localeCompare(b.team));
  return table;
}
function renderStandingsTable(tid) {
  const d = vccLoad(); const rows = computeStandings(d, tid);
  if (!rows.length) return '<p class="muted">No standings yet.</p>';
  return `<div class="table-wrap"><table class="vcc-table"><thead><tr><th>#</th><th>Team</th><th>Record</th><th>PF</th><th>PA</th><th>Diff</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td>${esc(r.team)}</td><td>${r.wins}-${r.losses}</td><td>${r.pf}</td><td>${r.pa}</td><td>${r.diff > 0 ? '+' : ''}${r.diff}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderTournaments() {
  const el = document.getElementById('tournamentList'); if (!el) return;
  const d = vccLoad();
  el.innerHTML = d.tournaments.map(t => `<div class="tournament-card"><div class="match-head"><div><span class="pill gold">${esc(t.status || 'Upcoming')}</span><h3>${esc(t.name)}</h3><p>${esc(t.description || '')}</p><p class="muted"><b>Category:</b> ${esc(t.category || t.division || 'Open')} · <b>Format:</b> ${esc(t.format || 'Single Elimination')} · <b>Starts:</b> ${fmtTime(t.startsAt)}</p><p class="muted"><b>Roster Lock:</b> ${fmtTime(t.rosterLock)} · <b>Teams:</b> ${(t.teamIds || []).length}${t.format === 'Preseason League Mode' ? ` · <b>Week:</b> ${t.currentWeek || 0}/${t.totalWeeks || 5}` : ''}</p></div><a class="btn primary" href="matches.html?tournament=${encodeURIComponent(t.id)}">View Event</a></div></div>`).join('') || '<div class="card"><h3>No tournaments posted yet.</h3><p class="muted">Once VCC staff creates an official tournament, it will appear here.</p></div>';
}

function renderMatches() {
  const el = document.getElementById('matchList'); if (!el) return;
  const d = vccLoad();
  const q = new URLSearchParams(location.search); const filter = q.get('tournament');
  const matches = d.matches.filter(m => !filter || m.tournamentId === filter).sort((a,b)=>(a.roundNumber||0)-(b.roundNumber||0) || (a.matchNumber||0)-(b.matchNumber||0));
  const tour = d.tournaments.find(t => t.id === filter);
  const header = tour ? `<div class="card"><h2>${esc(tour.name)}</h2><p class="muted">${esc(tour.category || 'Open')} · ${esc(tour.format || 'Single Elimination')} · ${esc(tour.status || 'Upcoming')}</p>${tour.format === 'Preseason League Mode' ? `<h3>Preseason Standings</h3>${renderStandingsTable(tour.id)}` : ''}</div>` : '';
  el.innerHTML = header + (matches.map(m => `<div class="match-card"><div class="match-head"><div><span class="pill blue">${esc(m.status)}</span><div class="match-teams">${esc(m.teamA || 'TBD')} <span class="danger-text">vs</span> ${esc(m.teamB || 'TBD')}</div><p class="muted">${esc(m.round)} · ${esc(m.id)}</p><p><b>Time:</b> ${fmtTime(m.scheduledAt)} · <b>Server:</b> ${esc(m.server || 'TBD')} · <b>Map:</b> ${esc(m.map || 'TBD')}</p><p><b>Score:</b> ${esc(m.scoreA || '-')} - ${esc(m.scoreB || '-')} ${m.winner ? `· <b>Winner:</b> ${esc(m.winner)}` : ''}</p></div><div><a class="btn primary" href="match-room.html?id=${encodeURIComponent(m.id)}">Open Match Room</a></div></div></div>`).join('') || '<div class="card"><h3>No matches scheduled yet.</h3><p class="muted">Matches will appear after staff creates them, generates a bracket, or generates a preseason week.</p></div>');
}

function adminInit() {
  const gate = document.getElementById('adminGate'), panel = document.getElementById('adminPanel'); if (!gate) return;
  if (!isAdmin()) { gate.hidden = false; panel.hidden = true; return; }
  gate.hidden = true; panel.hidden = false; hydrateAdminSelects(); renderAdminLists();
}
function hydrateAdminSelects() {
  const d = vccLoad();
  const options = d.tournaments.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  ['mTournament','gTournament','pTournament'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = options; });
  const rSel = document.getElementById('rMatch'); if (rSel) rSel.innerHTML = d.matches.map(m => `<option value="${esc(m.id)}">${esc(m.teamA || 'TBD')} vs ${esc(m.teamB || 'TBD')} — ${esc(m.id)}</option>`).join('');
}
function renderAdminLists() {
  const d = vccLoad(); const t = document.getElementById('adminTournaments'), m = document.getElementById('adminMatches');
  if (t) t.innerHTML = d.tournaments.map(x => `<div class="card"><b>${esc(x.name)}</b><p class="muted">${esc(x.status)} · ${esc(x.category || x.division || 'Open')} · ${esc(x.format || 'Single Elimination')} · ${(x.teamIds || []).length} teams${x.format === 'Preseason League Mode' ? ` · Week ${x.currentWeek || 0}/${x.totalWeeks || 5}` : ''}</p><button class="btn" onclick="loadTournamentForEdit('${x.id}')">Edit</button> <button class="btn danger" onclick="deleteTournament('${x.id}')">Delete</button>${x.format === 'Preseason League Mode' ? `<div class="mini-standings"><h4>Standings</h4>${renderStandingsTable(x.id)}</div>` : ''}</div>`).join('') || '<p class="muted">No tournaments created yet.</p>';
  if (m) m.innerHTML = d.matches.map(x => `<div class="card"><b>${esc(x.teamA || 'TBD')} vs ${esc(x.teamB || 'TBD')}</b><p class="muted">${esc(x.round)} · ${fmtTime(x.scheduledAt)} · ${esc(x.status)}${x.winner ? ` · Winner: ${esc(x.winner)}` : ''}</p><button class="btn danger" onclick="deleteMatch('${x.id}')">Delete</button></div>`).join('') || '<p class="muted">No matches created yet.</p>';
}
function addTournament() {
  const d = vccLoad();
  const teams = parseTeams(val('tTeams'));
  const id = val('editTournamentId') || vccId('T');
  const existing = d.tournaments.find(t => t.id === id);
  const data = { id, name: val('tName'), category: val('tCategory'), division: val('tCategory'), status: val('tStatus'), format: val('tFormat'), startsAt: val('tStart'), rosterLock: val('tRosterLock'), description: val('tDesc'), teamIds: teams, totalWeeks: scoreNum(val('tWeeks')) || 5, currentWeek: existing?.currentWeek || 0 };
  if (!data.name) return alert('Tournament name is required.');
  if (existing) Object.assign(existing, data); else d.tournaments.push(data);
  vccSave(d); location.reload();
}
function loadTournamentForEdit(id) {
  const d = vccLoad(); const t = d.tournaments.find(x => x.id === id); if (!t) return;
  setVal('editTournamentId', t.id); setVal('tName', t.name); setVal('tCategory', t.category || t.division || 'Open Qualifier'); setVal('tStatus', t.status || 'Upcoming'); setVal('tFormat', t.format || 'Single Elimination');
  setVal('tStart', (t.startsAt || '').slice(0,16)); setVal('tRosterLock', (t.rosterLock || '').slice(0,16)); setVal('tDesc', t.description || ''); setVal('tTeams', (t.teamIds || []).join('\n')); setVal('tWeeks', String(t.totalWeeks || 5));
  document.getElementById('tName').scrollIntoView({behavior:'smooth', block:'center'});
}
function clearTournamentForm() { ['editTournamentId','tName','tStart','tRosterLock','tDesc','tTeams'].forEach(id => setVal(id,'')); setVal('tWeeks','5'); }
function addMatch() {
  const d = vccLoad();
  if (!val('mA') || !val('mB')) return alert('Both teams are required.');
  d.matches.push({ id: vccId('VCC'), tournamentId: val('mTournament') || d.tournaments[0]?.id || '', teamA: val('mA'), teamB: val('mB'), round: val('mRound') || 'Round 1', roundNumber: 1, matchNumber: d.matches.length + 1, scheduledAt: val('mTime'), status: 'Scheduled', server: 'TBD', map: 'TBD', scoreA: '', scoreB: '', winner: '', nextMatchId: null, nextSlot: null, reports: [] });
  vccSave(d); location.reload();
}
function seedPairings(teams) {
  const n = teams.length; const pow = Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
  const seeded = [...teams]; while (seeded.length < pow) seeded.push('BYE');
  const pairs = [];
  for (let i = 0; i < pow / 2; i++) pairs.push([seeded[i], seeded[pow - 1 - i]]);
  return pairs;
}
function roundName(num) { return num === 1 ? 'Round 1' : `Round ${num}`; }
function generateBracket() {
  const d = vccLoad(); const tid = val('gTournament'); const t = d.tournaments.find(x => x.id === tid); if (!t) return alert('Create/select a tournament first.');
  const teams = parseTeams(val('gTeams') || (t.teamIds || []).join('\n'));
  if (teams.length < 2) return alert('Add at least 2 teams to generate a bracket.');
  d.matches = d.matches.filter(m => m.tournamentId !== tid);
  t.teamIds = teams;
  const pairs = seedPairings(teams);
  const created = [];
  pairs.forEach((p, i) => {
    const match = { id: vccId('VCC'), tournamentId: tid, teamA: p[0] === 'BYE' ? 'TBD' : p[0], teamB: p[1] === 'BYE' ? 'TBD' : p[1], round: 'Round 1', roundNumber: 1, matchNumber: i + 1, scheduledAt: t.startsAt || '', status: (p[0] === 'BYE' || p[1] === 'BYE') ? 'Completed' : 'Scheduled', server: 'TBD', map: 'TBD', scoreA: '', scoreB: '', winner: '', nextMatchId: null, nextSlot: null, reports: [] };
    if (p[0] === 'BYE' || p[1] === 'BYE') match.winner = p[0] === 'BYE' ? p[1] : p[0];
    created.push(match); d.matches.push(match);
  });
  let current = created; let round = 2;
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const nm = { id: vccId('VCC'), tournamentId: tid, teamA: 'TBD', teamB: 'TBD', round: current.length === 2 ? 'Grand Finals' : roundName(round), roundNumber: round, matchNumber: (i / 2) + 1, scheduledAt: '', status: 'Waiting', server: 'TBD', map: 'TBD', scoreA: '', scoreB: '', winner: '', nextMatchId: null, nextSlot: null, reports: [] };
      d.matches.push(nm); next.push(nm);
      current[i].nextMatchId = nm.id; current[i].nextSlot = 'A';
      if (current[i+1]) { current[i+1].nextMatchId = nm.id; current[i+1].nextSlot = 'B'; }
    }
    current = next; round++;
  }
  advanceByes(d, tid); vccSave(d); location.href = `matches.html?tournament=${encodeURIComponent(tid)}`;
}
function advanceByes(d, tid) {
  let changed = true;
  while (changed) { changed = false; d.matches.filter(m => m.tournamentId === tid && m.winner && m.nextMatchId).forEach(m => { const nxt = d.matches.find(x => x.id === m.nextMatchId); if (!nxt) return; const slot = m.nextSlot === 'A' ? 'teamA' : 'teamB'; if (nxt[slot] !== m.winner) { nxt[slot] = m.winner; if (nxt.teamA !== 'TBD' && nxt.teamB !== 'TBD') nxt.status = 'Scheduled'; changed = true; } }); }
}
function pairedAlready(d, tid, a, b) { return d.matches.some(m => m.tournamentId === tid && rematchKey(m.teamA, m.teamB) === rematchKey(a,b)); }
function makePreseasonPairs(d, t) {
  const teams = [...(t.teamIds || [])];
  const standings = computeStandings(d, t.id);
  const order = standings.length ? standings.map(r => r.team).concat(teams.filter(x => !standings.some(r => r.team === x))) : teams;
  const remaining = [...order]; const pairs = [];
  while (remaining.length > 1) {
    const a = remaining.shift();
    let idx = remaining.findIndex(b => !pairedAlready(d, t.id, a, b));
    if (idx < 0) idx = 0;
    const b = remaining.splice(idx, 1)[0]; pairs.push([a,b]);
  }
  if (remaining.length) pairs.push([remaining[0], 'BYE']);
  return pairs;
}
function generatePreseasonWeek() {
  const d = vccLoad(); const tid = val('pTournament') || val('gTournament'); const t = d.tournaments.find(x => x.id === tid); if (!t) return alert('Select a preseason tournament first.');
  t.format = 'Preseason League Mode';
  const teams = parseTeams(val('pTeams') || (t.teamIds || []).join('\n'));
  if (teams.length < 2) return alert('Add at least 2 teams to the tournament first.');
  t.teamIds = teams;
  const nextWeek = (t.currentWeek || 0) + 1;
  if (nextWeek > (t.totalWeeks || 5)) return alert('All preseason weeks are already generated. Increase Total Weeks if needed.');
  const pairs = makePreseasonPairs(d, t);
  pairs.forEach((p, i) => {
    const isBye = p[0] === 'BYE' || p[1] === 'BYE';
    d.matches.push({ id: vccId('VCC'), tournamentId: tid, teamA: p[0] === 'BYE' ? 'TBD' : p[0], teamB: p[1] === 'BYE' ? 'TBD' : p[1], round: `Preseason Week ${nextWeek}`, roundNumber: nextWeek, matchNumber: i + 1, scheduledAt: val('pTime') || addDays(t.startsAt, (nextWeek - 1) * 7), status: isBye ? 'Completed' : 'Scheduled', server: 'TBD', map: 'TBD', scoreA: '', scoreB: '', winner: isBye ? (p[0] === 'BYE' ? p[1] : p[0]) : '', nextMatchId: null, nextSlot: null, reports: [] });
  });
  t.currentWeek = nextWeek;
  t.status = 'Live';
  vccSave(d); location.href = `matches.html?tournament=${encodeURIComponent(tid)}`;
}
function updateResult() {
  const d = vccLoad(); const id = val('rMatch'); const m = d.matches.find(x => x.id === id); if (!m) return alert('Match not found');
  m.scoreA = val('rA'); m.scoreB = val('rB'); m.winner = val('rWinner') || getWinnerFromScores(m); m.status = val('rStatus') || 'Completed';
  advanceWinner(d, m);
  vccSave(d); location.reload();
}
function advanceWinner(d, m) {
  if (m.winner && m.nextMatchId) { const next = d.matches.find(x => x.id === m.nextMatchId); if (next) { if (m.nextSlot === 'A') next.teamA = m.winner; else next.teamB = m.winner; if (next.teamA !== 'TBD' && next.teamB !== 'TBD') next.status = 'Scheduled'; } }
}
function deleteTournament(id) { let d = vccLoad(); d.tournaments = d.tournaments.filter(x => x.id !== id); d.matches = d.matches.filter(x => x.tournamentId !== id); vccSave(d); location.reload(); }
function deleteMatch(id) { let d = vccLoad(); d.matches = d.matches.filter(x => x.id !== id); vccSave(d); location.reload(); }
function resetVccOpsData() { if (!confirm('This clears all local VCC tournaments, matches, chat, vetoes, and reports on this browser. Continue?')) return; vccSave(cleanClone(DEFAULT_DATA)); location.reload(); }

function roomInit() {
  const id = new URLSearchParams(location.search).get('id'); const d = vccLoad(); const m = d.matches.find(x => x.id === id);
  if (!m) { document.getElementById('roomTitle').textContent = 'Match Room'; document.getElementById('roomMeta').textContent = 'No match selected.'; return; }
  document.getElementById('roomTitle').textContent = `${m.teamA || 'TBD'} vs ${m.teamB || 'TBD'}`;
  document.getElementById('roomMeta').textContent = `${m.round} · ${m.id} · ${fmtTime(m.scheduledAt)}`;
  document.getElementById('roomServer').textContent = m.server || 'TBD'; document.getElementById('roomMap').textContent = m.map || 'TBD'; document.getElementById('roomScore').textContent = `${m.scoreA || '-'} - ${m.scoreB || '-'}${m.winner ? ` · Winner: ${m.winner}` : ''}`;
  const teamSel = document.getElementById('reportingTeam'); if (teamSel) teamSel.innerHTML = [m.teamA, m.teamB].filter(x => x && x !== 'TBD').map(x => `<option>${esc(x)}</option>`).join('');
  countdown(m.scheduledAt); renderChat(m.id); renderVeto(m.id); renderReportStatus(m.id);
  document.getElementById('chatSend').onclick = () => sendChat(m.id);
  document.getElementById('saveVeto').onclick = () => saveVeto(m.id);
  document.getElementById('submitRoomScore').onclick = () => submitRoomScore(m.id);
}
function countdown(t) { const el = document.getElementById('countdown'); if (!el) return; if (!t) { el.textContent = 'TBD'; return; } function tick() { const diff = new Date(t) - new Date(); if (diff <= 0) { el.textContent = 'MATCH TIME'; return; } const h = Math.floor(diff / 36e5), min = Math.floor(diff % 36e5 / 6e4), s = Math.floor(diff % 6e4 / 1e3); el.textContent = `${h}h ${min}m ${s}s`; } tick(); setInterval(tick, 1000); }
function renderChat(id) { const d = vccLoad(); const el = document.getElementById('chatBox'); if (!el) return; const msgs = d.chat[id] || []; el.innerHTML = msgs.map(x => `<div class="chat-msg"><b>${esc(x.name)}</b><br>${esc(x.msg)}<br><span class="muted">${fmtTime(x.time)}</span></div>`).join('') || '<p class="muted">No messages yet.</p>'; }
function sendChat(id) { const name = val('chatName') || 'Captain'; const msg = val('chatMsg'); if (!msg) return; const d = vccLoad(); d.chat[id] = d.chat[id] || []; d.chat[id].push({ name, msg, time: new Date().toISOString() }); vccSave(d); setVal('chatMsg',''); renderChat(id); }
function renderVeto(id) { const d = vccLoad(); const v = d.veto[id] || {}; const el = document.getElementById('vetoLog'); if (el) el.innerHTML = `<p><b>Map Ban/Pick:</b> ${esc(v.map || 'Not set')}</p><p><b>Server/Region:</b> ${esc(v.server || 'Not set')}</p><p class="muted">Use this for FACEIT/ESEA-style captain agreement.</p>`; }
function saveVeto(id) { const d = vccLoad(); d.veto[id] = { map: val('vetoMap'), server: val('vetoServer') }; const m = d.matches.find(x => x.id === id); if (m) { m.map = val('vetoMap') || m.map; m.server = val('vetoServer') || m.server; } vccSave(d); roomInit(); }
function renderReportStatus(id) {
  const d = vccLoad(); const el = document.getElementById('reportStatus'); if (!el) return; const reports = d.reports[id] || [];
  if (!reports.length) { el.innerHTML = '<p class="muted">No captain reports submitted yet.</p>'; return; }
  el.innerHTML = reports.map(r => `<div class="chat-msg"><b>${esc(r.team)}</b> submitted ${esc(r.scoreA)}-${esc(r.scoreB)}<br><span class="muted">${fmtTime(r.submittedAt)}${r.proofUrl ? ` · Proof: ${esc(r.proofUrl)}` : ''}</span></div>`).join('') + `<p><b>Current Match Status:</b> ${esc((d.matches.find(m=>m.id===id)||{}).status || 'Scheduled')}</p>`;
}
function submitRoomScore(id) {
  const d = vccLoad(); const m = d.matches.find(x => x.id === id); if (!m) return;
  const team = val('reportingTeam'); if (!team) return alert('Select your team before submitting.');
  const report = { team, scoreA: val('scoreA'), scoreB: val('scoreB'), proofUrl: val('proofUrl'), submittedAt: new Date().toISOString() };
  d.reports[id] = (d.reports[id] || []).filter(r => r.team !== team); d.reports[id].push(report);
  const reports = d.reports[id];
  const otherReports = reports.filter(r => r.team !== team);
  if (otherReports.length) {
    const match = otherReports.find(r => String(r.scoreA) === String(report.scoreA) && String(r.scoreB) === String(report.scoreB));
    if (match) {
      m.scoreA = report.scoreA; m.scoreB = report.scoreB; m.winner = getWinnerFromScores(m); m.status = 'Completed'; advanceWinner(d, m); vccSave(d); alert('Scores matched. Result automatically approved and updated on the site.'); roomInit(); return;
    }
    m.status = 'Disputed'; vccSave(d); alert('Scores do not match. Match moved to Disputed for VCC staff review.'); roomInit(); return;
  }
  m.status = 'Awaiting Opponent Confirmation'; vccSave(d); alert('Score submitted. Once the other captain submits the same score, the match will auto-update.'); roomInit();
}

document.addEventListener('DOMContentLoaded', () => { renderTournaments(); renderMatches(); adminInit(); if (document.body.dataset.page === 'room') roomInit(); });
