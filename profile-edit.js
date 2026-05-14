// ======================================================
// VCC Profile Edit JS - FINAL AUTH FIX
// Uses the same Supabase client exported by app.js.
// ======================================================

import { supabase } from './app.js';

const $ = (id) => document.getElementById(id);

async function getLoggedInUser(){
  const sessionResult = await supabase.auth.getSession();

  if(sessionResult.error){
    throw sessionResult.error;
  }

  const session = sessionResult.data.session;

  if(session && session.user){
    return session.user;
  }

  const userResult = await supabase.auth.getUser();

  if(userResult.error){
    throw userResult.error;
  }

  return userResult.data.user || null;
}

async function ensureProfileRow(user){
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if(error && error.code !== 'PGRST116'){
    throw error;
  }

  if(data){
    return data;
  }

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

  if(created.error){
    throw created.error;
  }

  return created.data;
}

async function uploadFile(bucket, path, file){
  const uploaded = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert:true });

  if(uploaded.error){
    throw uploaded.error;
  }

  const publicUrl = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return publicUrl.data.publicUrl;
}

function setValue(id, value){
  const el = $(id);
  if(el) el.value = value || '';
}

function setText(id, value){
  const el = $(id);
  if(el) el.textContent = value ?? '';
}

async function loadProfile(){
  const status = $('profileStatus');

  try{
    const user = await getLoggedInUser();

    if(!user){
      status.innerHTML = `
        You are not logged in.<br><br>
        <a class="btn" href="auth.html">Go to Login</a>
      `;
      return;
    }

    const profile = await ensureProfileRow(user);

    setValue('displayName', profile.display_name || profile.username || '');
    setValue('riotId', profile.riot_id || '');
    setValue('rank', profile.rank || '');
    setValue('platform', profile.platform || '');
    setValue('region', profile.region || '');
    setValue('mainRole', profile.main_role || profile.role || '');
    setValue('mainAgents', profile.main_agents || '');
    setValue('bio', profile.bio || '');

    if(profile.avatar_url){
      $('profileAvatar').src = profile.avatar_url;
    }

    setText('winsText', profile.wins || 0);
    setText('lossesText', profile.losses || 0);
    setText('pointsText', profile.pro_points || 0);
    setText('ratingText', profile.rating || 1000);

    const q = [];
    q.push('user=' + encodeURIComponent(user.id));
    if(user.email) q.push('email=' + encodeURIComponent(user.email));
    $('messageBtn').href = 'message-player.html?' + q.join('&');

    await loadProfileMessages(user);

    status.textContent = 'Logged in as ' + (user.email || user.id);
  }catch(err){
    status.innerHTML = `
      Profile error:<br>
      ${err.message}<br><br>
      Make sure you uploaded this file and are using the live website, not opening files locally.
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

    const { error } = await supabase
      .from('profiles')
      .upsert(patch);

    if(error){
      throw error;
    }

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

    const file = $('avatarFile').files[0];

    if(!file){
      status.textContent = 'Choose an image first.';
      return;
    }

    const ext = file.name.split('.').pop();
    const path = `${user.id}/avatar.${ext}`;

    status.textContent = 'Uploading profile picture...';

    const url = await uploadFile('profile-images', path, file);

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        avatar_url: url,
        updated_at: new Date().toISOString()
      });

    if(error){
      throw error;
    }

    $('profileAvatar').src = url;
    status.textContent = 'Profile picture uploaded.';
  }catch(err){
    status.textContent = 'Upload error: ' + err.message;
  }
}

async function loadProfileMessages(user){
  const box = $('profileMessages');

  try{
    const { data, error } = await supabase
      .from('player_messages')
      .select('*')
      .or(`recipient_user_id.eq.${user.id},recipient_email.eq.${user.email}`)
      .order('created_at', { ascending:false })
      .limit(5);

    if(error){
      throw error;
    }

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
    if(file){
      $('profileAvatar').src = URL.createObjectURL(file);
    }
  });

  loadProfile();
});
