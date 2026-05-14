import { supabase } from './app.js';

let currentReview = null;
let currentScreenshotUrl = null;

const $ = (id) => document.getElementById(id);

async function getUser(){
  const session = await supabase.auth.getSession();
  return session?.data?.session?.user || null;
}

async function uploadScreenshot(){
  const status = $('uploadStatus');
  try{
    const user = await getUser();
    if(!user){ status.textContent = 'You must be logged in.'; return; }

    const file = $('screenshotFile').files[0];
    if(!file){ status.textContent = 'Choose a screenshot first.'; return; }

    const ext = file.name.split('.').pop();
    const path = `${user.id}/${Date.now()}-scoreboard.${ext}`;

    status.textContent = 'Uploading screenshot...';

    const uploaded = await supabase.storage.from('match-screenshots').upload(path, file, { upsert:true });
    if(uploaded.error) throw uploaded.error;

    const publicUrl = supabase.storage.from('match-screenshots').getPublicUrl(path);
    currentScreenshotUrl = publicUrl.data.publicUrl;
    $('screenshotPreview').src = currentScreenshotUrl;

    const review = await supabase.from('stat_review_queue').insert({
      match_id: $('matchId').value.trim() || null,
      submitted_by: user.id,
      team_id: $('teamId').value.trim() || null,
      team_name: $('teamName').value.trim(),
      screenshot_url: currentScreenshotUrl,
      scan_status: 'needs_review',
      status: 'pending',
      ai_notes: 'AI scan not connected yet. Admin must review manually.'
    }).select().single();

    if(review.error) throw review.error;

    currentReview = review.data;
    status.textContent = 'Screenshot uploaded for review.\nReview ID: ' + currentReview.id;
    $('approveStatus').textContent = 'Review selected: ' + currentReview.id;
  }catch(err){
    status.textContent = 'Upload error: ' + err.message;
  }
}

function addStatRow(data = {}){
  const row = document.createElement('div');
  row.className = 'stat-row';
  row.innerHTML = `
    <input class="playerName" placeholder="Player" value="${data.player_name || ''}">
    <input class="teamNameRow" placeholder="Team" value="${data.team_name || $('teamName').value || ''}">
    <input class="agent" placeholder="Agent" value="${data.agent || ''}">
    <input class="kills" type="number" placeholder="K" value="${data.kills || 0}">
    <input class="deaths" type="number" placeholder="D" value="${data.deaths || 0}">
    <input class="assists" type="number" placeholder="A" value="${data.assists || 0}">
    <input class="acs" type="number" placeholder="ACS" value="${data.acs || 0}">
    <select class="result">
      <option value="win">Win</option>
      <option value="loss">Loss</option>
    </select>
  `;
  $('statRows').appendChild(row);
}

async function approveStats(){
  const status = $('approveStatus');
  try{
    const user = await getUser();
    if(!user){ status.textContent = 'You must be logged in.'; return; }
    if(!currentReview){ status.textContent = 'Upload or select a review first.'; return; }

    const rows = Array.from(document.querySelectorAll('.stat-row')).map(row => ({
      review_id: currentReview.id,
      player_name: row.querySelector('.playerName').value.trim(),
      team_name: row.querySelector('.teamNameRow').value.trim(),
      agent: row.querySelector('.agent').value.trim(),
      kills: Number(row.querySelector('.kills').value || 0),
      deaths: Number(row.querySelector('.deaths').value || 0),
      assists: Number(row.querySelector('.assists').value || 0),
      acs: Number(row.querySelector('.acs').value || 0),
      result: row.querySelector('.result').value,
      map_name: ''
    })).filter(r => r.player_name);

    if(!rows.length){ status.textContent = 'Add at least one player row.'; return; }

    const reviewRows = await supabase.from('stat_review_rows').insert(rows);
    if(reviewRows.error) throw reviewRows.error;

    const statsRows = rows.map(r => ({
      match_id: currentReview.match_id || null,
      player_name: r.player_name,
      team_name: r.team_name,
      agent: r.agent,
      kills: r.kills,
      deaths: r.deaths,
      assists: r.assists,
      acs: r.acs,
      result: r.result,
      screenshot_url: currentReview.screenshot_url,
      approved_by: user.id,
      approved_at: new Date().toISOString()
    }));

    const stats = await supabase.from('player_match_stats').insert(statsRows);
    if(stats.error) throw stats.error;

    const updated = await supabase.from('stat_review_queue').update({
      status: 'approved',
      scan_status: 'admin_approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', currentReview.id);

    if(updated.error) throw updated.error;

    status.textContent = 'Stats approved and added to player stat history.';
  }catch(err){
    status.textContent = 'Approve error: ' + err.message;
  }
}

async function loadPendingReviews(){
  const box = $('reviewList');
  try{
    const { data, error } = await supabase
      .from('stat_review_queue')
      .select('*')
      .eq('status','pending')
      .order('created_at', { ascending:false });

    if(error) throw error;

    if(!data || !data.length){
      box.textContent = 'No pending reviews.';
      return;
    }

    box.innerHTML = data.map(r => `
      <div style="margin-bottom:12px">
        <strong>${r.team_name || 'Unknown Team'}</strong><br>
        Review: ${r.id}<br>
        Match: ${r.match_id || 'N/A'}<br>
        <a href="${r.screenshot_url}" target="_blank">Open Screenshot</a><br>
        <button data-review="${r.id}" class="selectReviewBtn">Select Review</button>
      </div>
      <hr>
    `).join('');

    document.querySelectorAll('.selectReviewBtn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentReview = data.find(x => x.id === btn.dataset.review);
        currentScreenshotUrl = currentReview.screenshot_url;
        $('screenshotPreview').src = currentScreenshotUrl;
        $('matchId').value = currentReview.match_id || '';
        $('teamName').value = currentReview.team_name || '';
        $('teamId').value = currentReview.team_id || '';
        $('approveStatus').textContent = 'Review selected: ' + currentReview.id;
      });
    });
  }catch(err){
    box.textContent = 'Load error: ' + err.message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('screenshotFile').addEventListener('change', () => {
    const file = $('screenshotFile').files[0];
    if(file) $('screenshotPreview').src = URL.createObjectURL(file);
  });

  $('uploadBtn').addEventListener('click', uploadScreenshot);
  $('addRowBtn').addEventListener('click', () => addStatRow());
  $('approveStatsBtn').addEventListener('click', approveStats);
  $('loadReviewsBtn').addEventListener('click', loadPendingReviews);

  addStatRow();
});
