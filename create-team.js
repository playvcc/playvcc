import { supabase } from './app.js';

async function getUser(){
  const session = await supabase.auth.getSession();
  return session?.data?.session?.user || null;
}

async function getProfile(userId){
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data;
}

async function getMyTeams(userId){
  const { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('captain_id', userId);

  if(error) throw error;
  return data || [];
}

function isWccDivision(value){
  return value === 'wcc';
}

document.getElementById('create').addEventListener('click', async () => {
  const status = document.getElementById('status');

  try{
    const user = await getUser();

    if(!user){
      status.textContent = 'Log in first.';
      location.href = 'auth.html?mode=login';
      return;
    }

    const profile = await getProfile(user.id);

    if(!profile?.gender){
      status.textContent = 'Complete your profile and select gender before creating a team.';
      location.href = 'profile.html';
      return;
    }

    const division = document.getElementById('teamDivision').value;

    if(isWccDivision(division) && profile.gender !== 'female'){
      status.textContent = 'Only female users can create WCC teams.';
      return;
    }

    const existingTeams = await getMyTeams(user.id);
    const alreadyOpen = existingTeams.some(t => (t.division || 'open') !== 'wcc');
    const alreadyWcc = existingTeams.some(t => (t.division || '') === 'wcc');

    if(division === 'wcc' && alreadyWcc){
      status.textContent = 'You already created a WCC team.';
      return;
    }

    if(division !== 'wcc' && alreadyOpen){
      status.textContent = 'You already created a regular VCC team.';
      return;
    }

    let logo_url = null;
    const file = document.getElementById('logoFile').files[0];

    if(file){
      const path = `${user.id}/team-logo-${Date.now()}.png`;
      const upload = await supabase.storage.from('team-logos').upload(path, file, { upsert:true });
      if(upload.error) throw upload.error;
      logo_url = supabase.storage.from('team-logos').getPublicUrl(path).data.publicUrl;
    }

    const teamInsert = await supabase
      .from('teams')
      .insert({
        name:document.getElementById('name').value.trim(),
        tag:document.getElementById('tag').value.trim(),
        bio:document.getElementById('bio').value.trim(),
        logo_url,
        captain_id:user.id,
        division,
        team_type:division,
        gender_restriction:division === 'wcc' ? 'female_only' : 'none'
      })
      .select()
      .single();

    if(teamInsert.error) throw teamInsert.error;

    const membership = await supabase.from('team_memberships').insert({
      team_id:teamInsert.data.id,
      user_id:user.id,
      role:'captain',
      status:'active'
    });

    if(membership.error) throw membership.error;

    status.textContent = 'Team created.';
    setTimeout(() => location.href = 'manage-team.html', 800);
  }catch(error){
    status.textContent = 'Error: ' + error.message;
  }
});

document.getElementById('logoFile').addEventListener('change', () => {
  const file = document.getElementById('logoFile').files[0];
  if(file) document.getElementById('preview').src = URL.createObjectURL(file);
});
