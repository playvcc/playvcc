const VCC_TZ = 'America/Chicago';
const VCC_ADMIN_CODES = ['VCC2026', 'SINVCC'];
const VCC_DATA_VERSION = 'official-clean-v3';
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
    if (d.version !== VCC_DATA_VERSION || hasOldDemo) {
      const fresh = cleanClone(DEFAULT_DATA);
      vccSave(fresh);
      return fresh;
    }
    return Object.assign(cleanClone(DEFAULT_DATA), d);
  } catch (e) {
    const fresh = cleanClone(DEFAULT_DATA);
    vccSave(fresh);
    return fresh;
  }
}
function vccId(prefix) { return prefix + '-' + Math.random().toString(36).slice(2, 8).toUpperCase(); }
function val(id) { return document.getElementById(id)?.value.trim() || ''; }
function fmtTime(v) {
  if (!v) return 'TBD';
  try {
    return new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(v));
  } catch (e) { return v; }
}
function isAdmin() { return localStorage.getItem('vcc_admin_unlocked') === 'true'; }
function unlockAdmin() { const code = val('adminCode'); if (VCC_ADMIN_CODES.includes(code)) { localStorage.setItem('vcc_admin_unlocked', 'true'); location.reload(); } else alert('Wrong admin code.'); }
function logoutAdmin() { localStorage.removeItem('vcc_admin_unlocked'); location.reload(); }
function esc(s) { return String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function renderTournaments() {
  const el = document.getElementById('tournamentList'); if (!el) return;
  const d = vccLoad();
  el.innerHTML = d.tournaments.map(t => `<div class="tournament-card"><div class="match-head"><div><span class="pill gold">${esc(t.status || 'Upcoming')}</span><h3>${esc(t.name)}</h3><p>${esc(t.description || '')}</p><p class="muted"><b>Category:</b> ${esc(t.category || t.division || 'Open')} · <b>Format:</b> ${esc(t.format || 'Single Elimination')} · <b>Starts:</b> ${fmtTime(t.startsAt)}</p><p class="muted"><b>Roster Lock:</b> ${fmtTime(t.rosterLock)} · <b>Teams:</b> ${(t.teamIds || []).length}</p></div><a class="btn primary" href="matches.html?tournament=${encodeURIComponent(t.id)}">View Bracket</a></div></div>`).join('') || '<div class="card"><h3>No tournaments posted yet.</h3><p class="muted">Once VCC staff creates an official tournament, it will appear here.</p></div>';
}

function renderMatches() {
  const el = document.getElementById('matchList'); if (!el) return;
  const d = vccLoad();
  const q = new URLSearchParams(location.search); const filter = q.get('tournament');
  const matches = d.matches.filter(m => !filter || m.tournamentId === filter);
  const tour = d.tournaments.find(t => t.id === filter);
  const header = tour ? `<div class="card"><h2>${esc(tour.name)}</h2><p class="muted">${esc(tour.category || 'Open')} · ${esc(tour.format || 'Single Elimination')} · ${esc(tour.status || 'Upcoming')}</p></div>` : '';
  el.innerHTML = header + (matches.map(m => `<div class="match-card"><div class="match-head"><div><span class="pill blue">${esc(m.status)}</span><div class="match-teams">${esc(m.teamA || 'TBD')} <span class="danger-text">vs</span> ${esc(m.teamB || 'TBD')}</div><p class="muted">${esc(m.round)} · ${esc(m.id)}</p><p><b>Time:</b> ${fmtTime(m.scheduledAt)} · <b>Server:</b> ${esc(m.server || 'TBD')} · <b>Map:</b> ${esc(m.map || 'TBD')}</p><p><b>Score:</b> ${esc(m.scoreA || '-')} - ${esc(m.scoreB || '-')} ${m.winner ? `· <b>Winner:</b> ${esc(m.winner)}` : ''}</p></div><div><a class="btn primary" href="match-room.html?id=${encodeURIComponent(m.id)}">Open Match Room</a></div></div></div>`).join('') || '<div class="card"><h3>No matches scheduled yet.</h3><p class="muted">Matches will appear after staff creates them or generates a bracket.</p></div>');
}

function adminInit() {
  const gate = document.getElementById('adminGate'), panel = document.getElementById('adminPanel'); if (!gate) return;
  if (!isAdmin()) { gate.hidden = false; panel.hidden = true; return; }
  gate.hidden = true; panel.hidden = false; hydrateAdminSelects(); renderAdminLists();
}
function hydrateAdminSelects() {
  const d = vccLoad();
  const tSel = document.getElementById('mTournament'); if (tSel) tSel.innerHTML = d.tournaments.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
  const rSel = document.getElementById('rMatch'); if (rSel) rSel.innerHTML = d.matches.map(m => `<option value="${esc(m.id)}">${esc(m.teamA || 'TBD')} vs ${esc(m.teamB || 'TBD')} — ${esc(m.id)}</option>`).join('');
  const gSel = document.getElementById('gTournament'); if (gSel) gSel.innerHTML = d.tournaments.map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
}
function renderAdminLists() {
  const d = vccLoad(); const t = document.getElementById('adminTournaments'), m = document.getElementById('adminMatches');
  if (t) t.innerHTML = d.tournaments.map(x => `<div class="card"><b>${esc(x.name)}</b><p class="muted">${esc(x.status)} · ${esc(x.category || x.division || 'Open')} · ${(x.teamIds || []).length} teams</p><button class="btn" onclick="loadTournamentForEdit('${x.id}')">Edit</button> <button class="btn danger" onclick="deleteTournament('${x.id}')">Delete</button></div>`).join('') || '<p class="muted">No tournaments created yet.</p>';
  if (m) m.innerHTML = d.matches.map(x => `<div class="card"><b>${esc(x.teamA || 'TBD')} vs ${esc(x.teamB || 'TBD')}</b><p class="muted">${esc(x.round)} · ${fmtTime(x.scheduledAt)} · ${esc(x.status)}</p><button class="btn danger" onclick="deleteMatch('${x.id}')">Delete</button></div>`).join('') || '<p class="muted">No matches created yet.</p>';
}
function parseTeams(raw) { return raw.split('\n').map(x => x.trim()).filter(Boolean); }
function seedPairings(teams) {
  const n = teams.length; const pow = Math.pow(2, Math.ceil(Math.log2(Math.max(2, n))));
  const seeded = [...teams]; while (seeded.length < pow) seeded.push('BYE');
  const pairs = [];
  for (let i = 0; i < pow / 2; i++) pairs.push([seeded[i], seeded[pow - 1 - i]]);
  return pairs;
}
function roundName(num) { return num === 1 ? 'Round 1' : `Round ${num}`; }
function addTournament() {
  const d = vccLoad();
  const teams = parseTeams(val('tTeams'));
  const id = val('editTournamentId') || vccId('T');
  const existing = d.tournaments.find(t => t.id === id);
  const data = { id, name: val('tName'), category: val('tCategory'), division: val('tCategory'), status: val('tStatus'), format: val('tFormat'), startsAt: val('tStart'), rosterLock: val('tRosterLock'), description: val('tDesc'), teamIds: teams };
  if (!data.name) return alert('Tournament name is required.');
  if (existing) Object.assign(existing, data); else d.tournaments.push(data);
  vccSave(d); location.reload();
}
function loadTournamentForEdit(id) {
  const d = vccLoad(); const t = d.tournaments.find(x => x.id === id); if (!t) return;
  document.getElementById('editTournamentId').value = t.id;
  document.getElementById('tName').value = t.name || '';
  document.getElementById('tCategory').value = t.category || t.division || 'Open Qualifier';
  document.getElementById('tStatus').value = t.status || 'Upcoming';
  document.getElementById('tFormat').value = t.format || 'Single Elimination';
  document.getElementById('tStart').value = (t.startsAt || '').slice(0,16);
  document.getElementById('tRosterLock').value = (t.rosterLock || '').slice(0,16);
  document.getElementById('tDesc').value = t.description || '';
  document.getElementById('tTeams').value = (t.teamIds || []).join('\n');
  document.getElementById('tName').scrollIntoView({behavior:'smooth', block:'center'});
}
function clearTournamentForm() { ['editTournamentId','tName','tStart','tRosterLock','tDesc','tTeams'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; }); }
function addMatch() {
  const d = vccLoad();
  if (!val('mA') || !val('mB')) return alert('Both teams are required.');
  d.matches.push({ id: vccId('VCC'), tournamentId: val('mTournament') || d.tournaments[0]?.id || '', teamA: val('mA'), teamB: val('mB'), round: val('mRound') || 'Round 1', roundNumber: 1, matchNumber: d.matches.length + 1, scheduledAt: val('mTime'), status: 'Scheduled', server: 'TBD', map: 'TBD', scoreA: '', scoreB: '', winner: '', nextMatchId: null, nextSlot: null });
  vccSave(d); location.reload();
}
function generateBracket() {
  const d = vccLoad(); const tid = val('gTournament'); const t = d.tournaments.find(x => x.id === tid); if (!t) return alert('Create/select a tournament first.');
  const teams = parseTeams(val('gTeams') || (t.teamIds || []).join('\n'));
  if (teams.length < 2) return alert('Add at least 2 teams to generate a bracket.');
  d.matches = d.matches.filter(m => m.tournamentId !== tid);
  t.teamIds = teams;
  const pairs = seedPairings(teams);
  const created = [];
  pairs.forEach((p, i) => {
    const match = { id: vccId('VCC'), tournamentId: tid, teamA: p[0] === 'BYE' ? 'TBD' : p[0], teamB: p[1] === 'BYE' ? 'TBD' : p[1], round: 'Round 1', roundNumber: 1, matchNumber: i + 1, scheduledAt: t.startsAt || '', status: (p[0] === 'BYE' || p[1] === 'BYE') ? 'Completed' : 'Scheduled', server: 'TBD', map: 'TBD', scoreA: '', scoreB: '', winner: '', nextMatchId: null, nextSlot: null };
    if (p[0] === 'BYE' || p[1] === 'BYE') match.winner = p[0] === 'BYE' ? p[1] : p[0];
    created.push(match); d.matches.push(match);
  });
  let current = created; let round = 2;
  while (current.length > 1) {
    const next = [];
    for (let i = 0; i < current.length; i += 2) {
      const nm = { id: vccId('VCC'), tournamentId: tid, teamA: 'TBD', teamB: 'TBD', round: current.length === 2 ? 'Grand Finals' : roundName(round), roundNumber: round, matchNumber: (i / 2) + 1, scheduledAt: '', status: 'Waiting', server: 'TBD', map: 'TBD', scoreA: '', scoreB: '', winner: '', nextMatchId: null, nextSlot: null };
      d.matches.push(nm); next.push(nm);
      current[i].nextMatchId = nm.id; current[i].nextSlot = 'A';
      if (current[i+1]) { current[i+1].nextMatchId = nm.id; current[i+1].nextSlot = 'B'; }
    }
    current = next; round++;
  }
  advanceByes(d, tid);
  vccSave(d); location.href = `matches.html?tournament=${encodeURIComponent(tid)}`;
}
function advanceByes(d, tid) {
  let changed = true;
  while (changed) {
    changed = false;
    d.matches.filter(m => m.tournamentId === tid && m.winner && m.nextMatchId).forEach(m => {
      const nxt = d.matches.find(x => x.id === m.nextMatchId); if (!nxt) return;
      const slot = m.nextSlot === 'A' ? 'teamA' : 'teamB';
      if (nxt[slot] !== m.winner) { nxt[slot] = m.winner; if (nxt.teamA !== 'TBD' && nxt.teamB !== 'TBD') nxt.status = 'Scheduled'; changed = true; }
    });
  }
}
function updateResult() {
  const d = vccLoad(); const id = val('rMatch'); const m = d.matches.find(x => x.id === id); if (!m) return alert('Match not found');
  m.scoreA = val('rA'); m.scoreB = val('rB'); m.winner = val('rWinner'); m.status = val('rStatus') || 'Completed';
  if (m.winner && m.nextMatchId) {
    const next = d.matches.find(x => x.id === m.nextMatchId);
    if (next) { if (m.nextSlot === 'A') next.teamA = m.winner; else next.teamB = m.winner; if (next.teamA !== 'TBD' && next.teamB !== 'TBD') next.status = 'Scheduled'; }
  }
  vccSave(d); location.reload();
}
function deleteTournament(id) { let d = vccLoad(); d.tournaments = d.tournaments.filter(x => x.id !== id); d.matches = d.matches.filter(x => x.tournamentId !== id); vccSave(d); location.reload(); }
function deleteMatch(id) { let d = vccLoad(); d.matches = d.matches.filter(x => x.id !== id); vccSave(d); location.reload(); }
function resetVccOpsData() { if (!confirm('This clears all local VCC tournaments, matches, chat, vetoes, and reports on this browser. Continue?')) return; vccSave(cleanClone(DEFAULT_DATA)); location.reload(); }

function roomInit() {
  const id = new URLSearchParams(location.search).get('id'); const d = vccLoad(); const m = d.matches.find(x => x.id === id);
  if (!m) { document.getElementById('roomTitle').textContent = 'Match Room'; document.getElementById('roomMeta').textContent = 'No match selected.'; return; }
  document.getElementById('roomTitle').textContent = `${m.teamA || 'TBD'} vs ${m.teamB || 'TBD'}`;
  document.getElementById('roomMeta').textContent = `${m.round} · ${m.id} · ${fmtTime(m.scheduledAt)}`;
  document.getElementById('roomServer').textContent = m.server || 'TBD';
  document.getElementById('roomMap').textContent = m.map || 'TBD';
  document.getElementById('roomScore').textContent = `${m.scoreA || '-'} - ${m.scoreB || '-'}`;
  countdown(m.scheduledAt); renderChat(m.id); renderVeto(m.id);
  document.getElementById('chatSend').onclick = () => sendChat(m.id);
  document.getElementById('saveVeto').onclick = () => saveVeto(m.id);
  document.getElementById('submitRoomScore').onclick = () => submitRoomScore(m.id);
}
function countdown(t) {
  const el = document.getElementById('countdown'); if (!el) return;
  if (!t) { el.textContent = 'TBD'; return; }
  function tick() { const diff = new Date(t) - new Date(); if (diff <= 0) { el.textContent = 'MATCH TIME'; return; } const h = Math.floor(diff / 36e5), min = Math.floor(diff % 36e5 / 6e4), s = Math.floor(diff % 6e4 / 1e3); el.textContent = `${h}h ${min}m ${s}s`; }
  tick(); setInterval(tick, 1000);
}
function renderChat(id) { const d = vccLoad(); const el = document.getElementById('chatBox'); if (!el) return; const msgs = d.chat[id] || []; el.innerHTML = msgs.map(x => `<div class="chat-msg"><b>${esc(x.name)}</b><br>${esc(x.msg)}<br><span class="muted">${fmtTime(x.time)}</span></div>`).join('') || '<p class="muted">No messages yet.</p>'; }
function sendChat(id) { const name = val('chatName') || 'Captain'; const msg = val('chatMsg'); if (!msg) return; const d = vccLoad(); d.chat[id] = d.chat[id] || []; d.chat[id].push({ name, msg, time: new Date().toISOString() }); vccSave(d); document.getElementById('chatMsg').value = ''; renderChat(id); }
function renderVeto(id) { const d = vccLoad(); const v = d.veto[id] || {}; const el = document.getElementById('vetoLog'); if (el) el.innerHTML = `<p><b>Map Ban/Pick:</b> ${esc(v.map || 'Not set')}</p><p><b>Server/Region:</b> ${esc(v.server || 'Not set')}</p><p class="muted">Use this for FACEIT/ESEA-style captain agreement.</p>`; }
function saveVeto(id) { const d = vccLoad(); d.veto[id] = { map: val('vetoMap'), server: val('vetoServer') }; const m = d.matches.find(x => x.id === id); if (m) { m.map = val('vetoMap') || m.map; m.server = val('vetoServer') || m.server; } vccSave(d); roomInit(); }
function submitRoomScore(id) { const d = vccLoad(); const m = d.matches.find(x => x.id === id); if (!m) return; m.scoreA = val('scoreA'); m.scoreB = val('scoreB'); m.status = 'Pending Admin Approval'; d.reports[id] = { scoreA: m.scoreA, scoreB: m.scoreB, proofUrl: val('proofUrl'), submittedAt: new Date().toISOString() }; vccSave(d); alert('Score submitted. Admin should verify proof before marking completed.'); roomInit(); }

document.addEventListener('DOMContentLoaded', () => { renderTournaments(); renderMatches(); adminInit(); if (document.body.dataset.page === 'room') roomInit(); });
