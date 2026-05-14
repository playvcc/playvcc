// ======================================================
// VCC Profile Edit/Public View JS
// - profile.html = edit your own profile
// - profile.html?user=PLAYER_ID = public read-only profile
// ======================================================

import { supabase } from './app.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const requestedUserId = params.get('user') || params.get('id') || '';

function setText(id, value){
  const el = $(id);
  if(el) el.textContent = value ?? '';
}

function setValue(id, value){
  const el = $(id);
  if(el) el.value = value || '';
}

function showEditMode(){
  $('editProfileControls')?.classList.remove('hidden');
  $('editImageControls')?.classList.remove('hidden');
  $('publicProfileView')?.classList.add('hidden');
  $('messagesPanel')?.classList.remove('hidden');
  setText('profileTitle', 'MY VCC PROFILE');
  setText('profileModeNotice', 'You are editing your own profile.');
}

function showPublicMode(){
  $('editProfileControls')?.classList.add('hidden');
  $('editImageControls')?.classList.add('hidden');
  $('publicProfileView')?.classList.remove('hidden');
  $('messagesPanel')?.classList.add('hidden');
  setText('profileTitle', 'VCC PLAYER PROFILE');
  setText('profileModeNotice', 'Public view only. You cannot edit another player profile.');
}

async function getLoggedInUser(){
  const sessionResult = await supabase.auth.getSession();
  if(sessionResult.error) throw sessionResult.error;
  if(sessionResult.data.session?.user) return sessionResult.data.session.user;

  const userResult = await supabase.auth.getUser();
  if(userResult.error) throw userResult.error;
  return userResult.data.user || null;
}

async function loadProfileById(userId){
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if(error && error.code !== 'PGRST116') throw error;
  return data;
}

async function ensureProfileRow(user){
  let profile = await loadProfileById(user.id);
  if(profile) return profile;

  const username = user.email ? user.email.split('@')[0] : 'VCC Player';

  const created = await supabase
    .from('profiles')
    .insert({
      id: user.id,
      email: user.email,
      username,
      display_name: username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if(created.error) throw created.error;
  return created.data;
}

function fillStats(profile){
  setText('winsText', profile?.wins || 0);
  setText('lossesText', profile?.losses || 0);
  setText('pointsText', profile?.pro_points || 0);
  setText('ratingText', profile?.rating || 1000);
}

function fillPublicProfile(profile){
  setText('publicName', profile?.display_name || profile?.username || 'VCC Player');
  setText('publicRiot', profile?.riot_id || 'Not set');
  setText('publicRank', profile?.rank || 'Not set');
  setText('publicPlatform', profile?.platform || 'Not set');
  setText('publicRegion', profile?.region || 'Not set');
  setText('publicRole', profile?.main_role || profile?.role || 'Not set');
  setText('publicAgents', profile?.main_agents || 'Not set');
  setText('publicBio', profile?.bio || 'No bio yet.');

  if(profile?.avatar_url) $('profileAvatar').src = profile.avatar_url;
  fillStats(profile);

  const q = [];
  if(profile?.id) q.push('user=' + encodeURIComponent(profile.id));
  if(profile?.email) q.push('email=' + encodeURIComponent(profile.email));
  $('messageBtn').href = 'message-player.html' + (q.length ? '?' + q.join('&') : '');
}

function fillEditProfile(profile){
  setValue('displayName', profile?.display_name || profile?.username || '');
  setValue('riotId', profile?.riot_id || '');
  setValue('rank', profile?.rank || '');
  setValue('platform', profile?.platform || '');
  setValue('region', profile?.region || '');
  setValue('mainRole', profile?.main_role || profile?.role || '');
  setValue('mainAgents', profile?.main_agents || '');
  setValue('bio', profile?.bio || '');

  if(profile?.avatar_url) $('profileAvatar').src = profile.avatar_url;
  fillStats(profile);
}

async function loadProfile(){
  const status = $('profileStatus');

  try{
    const user = await getLoggedInUser();

    // PUBLIC PROFILE VIEW FROM PLAYERS TAB
    if(requestedUserId && (!user || requestedUserId !== user.id)){
      showPublicMode();

      const profile = await loadProfileById(requestedUserId);

      if(!profile){
        // fallback from URL params if database row is unavailable
        fillPublicProfile({
          id: requestedUserId,
          display_name: params.get('name') || 'VCC Player',
          riot_id: params.get('riot') || '',
          rank: params.get('rank') || '',
          platform: params.get('platform') || '',
          region: params.get('region') || '',
          main_role: params.get('role') || '',
          avatar_url: params.get('avatar') || ''
        });
        status.textContent = 'Viewing public profile from player listing.';
        return;
      }

      fillPublicProfile(profile);
      status.textContent = 'Viewing public profile.';
      return;
    }

    // OWN PROFILE EDIT MODE
    if(!user){
      showEditMode();
      status.innerHTML = `
        You are not logged in.<br><br>
        <a class="btn" href="auth.html">Go to Login</a>
      `;
      return;
    }

    showEditMode();

    const profile = await ensureProfileRow(user);
    fillEditProfile(profile);

    const q = ['user=' + encodeURIComponent(user.id)];
    if(user.email) q.push('email=' + encodeURIComponent(user.email));
    $('messageBtn').href = 'message-player.html?' + q.join('&');

    await loadProfileMessages(user);

    status.textContent = 'Logged in as ' + (user.email || user.id);
  }catch(err){
    status.innerHTML = `
      Profile error:<br>
      ${err.message}
    `;
  }
}

async function saveProfile(){
  const status = $('profileStatus');

  try{
    const user = await getLoggedInUser();
    if(!user){
      status.innerHTML = `You must log in first. <a class="btn" href="auth.html">Login</a>`;
      return;
    }

    if(requestedUserId && requestedUserId !== user.id){
      status.textContent = 'You cannot edit another player profile.';
      return;
    }

    const displayName = $('displayName').value.trim();

    const patch = {
      id: user.id,
      email: user.email,
      username: displayName || (user.email ? user.email.split('@')[0] : 'VCC Player'),
      display_name: displayName,
      riot_id: $('riotId').value.trim(),
      rank: $('rank').value.trim(),
      platform: $('platform').value.trim(),
      region: $('region').value.trim(),
      main_role: $('mainRole').value.trim(),
      role: $('mainRole').value.trim(),
      main_agents: $('mainAgents').value.trim(),
      bio: $('bio').value.trim(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase.from('profiles').upsert(patch);
    if(error) throw error;

    status.textContent = 'Profile saved.';
  }catch(err){
    status.textContent = 'Save error: ' + err.message;
  }
}

async function uploadAvatar(){
  const status = $('profileStatus');

  try{
    const user = await getLoggedInUser();
    if(!user){
      status.innerHTML = `You must log in first. <a class="btn" href="auth.html">Login</a>`;
      return;
    }

    if(requestedUserId && requestedUserId !== user.id){
      status.textContent = 'You cannot edit another player profile.';
      return;
    }

    const file = $('avatarFile').files[0];
    if(!file){
      status.textContent = 'Choose an image first.';
      return;
    }

    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    status.textContent = 'Uploading profile picture...';

    const uploaded = await supabase.storage
      .from('profile-images')
      .upload(path, file, { upsert:true });

    if(uploaded.error) throw uploaded.error;

    const publicUrl = supabase.storage.from('profile-images').getPublicUrl(path);
    const url = publicUrl.data.publicUrl;

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      avatar_url: url,
      updated_at: new Date().toISOString()
    });

    if(error) throw error;

    $('profileAvatar').src = url;
    status.textContent = 'Profile picture uploaded.';
  }catch(err){
    status.textContent = 'Upload error: ' + err.message;
  }
}

async function loadProfileMessages(user){
  const box = $('profileMessages');
  if(!box) return;

  try{
    const { data, error } = await supabase
      .from('player_messages')
      .select('*')
      .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email}`)
      .order('created_at', { ascending:false })
      .limit(5);

    if(error) throw error;

    if(!data || !data.length){
      box.textContent = 'No messages yet.';
      return;
    }

    box.innerHTML = data.map(m => `
      <div>
        <strong>${m.title || 'Message'}</strong><br>
        ${m.body || ''}
        <hr>
      </div>
    `).join('');
  }catch(err){
    box.textContent = 'Messages unavailable: ' + err.message;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  $('saveProfileBtn')?.addEventListener('click', saveProfile);
  $('uploadAvatarBtn')?.addEventListener('click', uploadAvatar);

  $('avatarFile')?.addEventListener('change', () => {
    const file = $('avatarFile').files[0];
    if(file) $('profileAvatar').src = URL.createObjectURL(file);
  });

  loadProfile();
});
