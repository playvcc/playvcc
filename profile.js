import { supabase, safe } from './app.js';

const params = new URLSearchParams(location.search);
const viewId = params.get('user') || '';

async function getUser(){
  const session = await supabase.auth.getSession();
  return session?.data?.session?.user || null;
}

async function loadProfileById(id){
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();
  if(error && error.code !== 'PGRST116') throw error;
  return data;
}

async function ensureOwnProfile(user){
  let profile = await loadProfileById(user.id);
  if(profile) return profile;

  const username = user.email ? user.email.split('@')[0] : 'VCC Player';
  const { data, error } = await supabase
    .from('profiles')
    .insert({
      id:user.id,
      email:user.email,
      username,
      display_name:username,
      created_at:new Date().toISOString(),
      updated_at:new Date().toISOString()
    })
    .select()
    .single();

  if(error) throw error;
  return data;
}

function setText(id, value){
  const el = document.getElementById(id);
  if(el) el.textContent = value ?? '';
}

function setValue(id, value){
  const el = document.getElementById(id);
  if(el) el.value = value || '';
}

function fillProfile(profile){
  const name = profile?.display_name || profile?.username || 'VCC Player';
  const wins = Number(profile?.wins || 0);
  const losses = Number(profile?.losses || 0);
  const total = wins + losses;
  const winPct = total ? Math.round((wins / total) * 100) : 0;

  document.title = `${name} — VCC Profile`;
  setText('profileName', name);
  setText('profileRank', profile?.rank || 'Unranked');
  setText('profilePlatform', profile?.platform || 'Console');
  setText('profileRegion', profile?.region || 'NA');
  setText('profileBio', profile?.bio || 'Competitive console Valorant player competing in the VCC ecosystem.');

  setText('recordWins', wins);
  setText('recordLosses', losses);
  setText('winRate', `${winPct}% Win Rate`);

  setText('winsText', wins);
  setText('lossesText', losses);
  setText('mapsWonText', profile?.maps_won || wins);
  setText('mapsLostText', profile?.maps_lost || losses);
  setText('pointsText', profile?.pro_points || 0);
  setText('ratingText', profile?.rating || 1000);

  setText('identityRiot', profile?.riot_id || 'Not set');
  setText('identityRole', profile?.main_role || profile?.role || 'Flex');
  setText('identityAgents', profile?.main_agents || 'Not set');
  setText('identityTeam', profile?.team_name || 'Free Agent');

  if(profile?.avatar_url){
    document.getElementById('profileAvatar').src = profile.avatar_url;
  }

  setValue('displayName', name);
  setValue('riotId', profile?.riot_id || '');
  setValue('rank', profile?.rank || '');
  setValue('platform', profile?.platform || '');
  setValue('region', profile?.region || '');
  setValue('mainRole', profile?.main_role || profile?.role || '');
  setValue('mainAgents', profile?.main_agents || '');
  setValue('bio', profile?.bio || '');

  document.getElementById('messageBtn').href =
    `message-player.html?user=${encodeURIComponent(profile?.id || '')}&email=${encodeURIComponent(profile?.email || '')}`;
}

async function getCaptainTeam(userId){
  const { data } = await supabase.from('teams').select('*').eq('captain_id', userId).maybeSingle();
  return data;
}

async function enableInviteButton(viewedProfile, currentUser){
  const btn = document.getElementById('inviteBtn');
  if(!currentUser || !viewedProfile?.id || viewedProfile.id === currentUser.id) return;

  const team = await getCaptainTeam(currentUser.id);
  if(!team) return;

  btn.classList.remove('hidden');
  btn.addEventListener('click', async () => {
    const message = await supabase.from('player_messages').insert({
      sender_user_id:currentUser.id,
      recipient_user_id:viewedProfile.id,
      recipient_email:viewedProfile.email || null,
      title:`Invite to ${team.name}`,
      body:`You have been invited to join ${team.name} on VCC.`,
      message_type:'team_invite',
      related_team_id:team.id,
      status:'unread'
    }).select().single();

    if(message.error){
      alert(message.error.message);
      return;
    }

    const invite = await supabase.from('team_invites').insert({
      team_id:team.id,
      invited_user_id:viewedProfile.id,
      invited_email:viewedProfile.email || null,
      invited_by:currentUser.id,
      role:'player',
      status:'pending',
      message_id:message.data.id
    });

    alert(invite.error ? invite.error.message : 'Invite sent.');
  });
}

async function loadProfile(){
  const status = document.getElementById('profileStatus');

  try{
    const user = await getUser();
    const targetId = viewId || user?.id;

    if(!targetId){
      document.getElementById('editProfileCard').classList.remove('hidden');
      status.innerHTML = 'Log in first.<br><br><a class="btn" href="index.html">Go to Login</a>';
      return;
    }

    let profile;

    if(user && targetId === user.id){
      profile = await ensureOwnProfile(user);
      document.getElementById('editProfileCard').classList.remove('hidden');
      document.getElementById('editImageControls').style.display = 'block';
      status.textContent = `Logged in as ${user.email || user.id}`;
    }else{
      profile = await loadProfileById(targetId);
      document.getElementById('editProfileCard').classList.add('hidden');
      document.getElementById('editImageControls').style.display = 'none';
    }

    if(!profile){
      profile = { id:targetId, display_name:'VCC Player' };
    }

    fillProfile(profile);
    await enableInviteButton(profile, user);

  }catch(error){
    status.textContent = 'Profile error: ' + error.message;
  }
}

async function saveProfile(){
  const status = document.getElementById('profileStatus');

  try{
    const user = await getUser();
    if(!user){
      status.textContent = 'Log in first.';
      return;
    }

    const patch = {
      id:user.id,
      email:user.email,
      username:document.getElementById('displayName').value.trim(),
      display_name:document.getElementById('displayName').value.trim(),
      riot_id:document.getElementById('riotId').value.trim(),
      rank:document.getElementById('rank').value.trim(),
      platform:document.getElementById('platform').value.trim(),
      region:document.getElementById('region').value.trim(),
      role:document.getElementById('mainRole').value.trim(),
      main_role:document.getElementById('mainRole').value.trim(),
      main_agents:document.getElementById('mainAgents').value.trim(),
      bio:document.getElementById('bio').value.trim(),
      updated_at:new Date().toISOString()
    };

    const { error } = await supabase.from('profiles').upsert(patch);
    if(error) throw error;

    status.textContent = 'Profile saved.';
    fillProfile(patch);
  }catch(error){
    status.textContent = 'Save error: ' + error.message;
  }
}

async function uploadAvatar(){
  const status = document.getElementById('profileStatus');

  try{
    const user = await getUser();
    const file = document.getElementById('avatarFile').files[0];

    if(!user || !file){
      status.textContent = 'Log in and choose an image first.';
      return;
    }

    const path = `${user.id}/avatar-${Date.now()}.png`;
    const upload = await supabase.storage.from('profile-images').upload(path, file, { upsert:true });
    if(upload.error) throw upload.error;

    const url = supabase.storage.from('profile-images').getPublicUrl(path).data.publicUrl;

    const { error } = await supabase.from('profiles').upsert({
      id:user.id,
      email:user.email,
      avatar_url:url,
      updated_at:new Date().toISOString()
    });

    if(error) throw error;

    document.getElementById('profileAvatar').src = url;
    status.textContent = 'Profile picture uploaded.';
  }catch(error){
    status.textContent = 'Upload error: ' + error.message;
  }
}

document.getElementById('saveProfileBtn')?.addEventListener('click', saveProfile);
document.getElementById('uploadAvatarBtn')?.addEventListener('click', uploadAvatar);
document.getElementById('avatarFile')?.addEventListener('change', () => {
  const file = document.getElementById('avatarFile').files[0];
  if(file) document.getElementById('profileAvatar').src = URL.createObjectURL(file);
});

loadProfile();
