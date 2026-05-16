// VCC Create Team Hard Fix
// Does not depend on app.js. Shows exact errors on page.

(function(){
  const statusBox = document.getElementById('teamStatus');

  function setStatus(msg){
    statusBox.textContent = msg;
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');

    if(!config.SUPABASE_URL || config.SUPABASE_URL.includes('PASTE_')){
      throw new Error('SUPABASE_URL missing in supabase-config.js');
    }

    if(!config.SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY.includes('PASTE_')){
      throw new Error('SUPABASE_ANON_KEY missing in supabase-config.js');
    }

    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function getUserAndProfile(supabase){
    const session = await supabase.auth.getSession();
    const user = session?.data?.session?.user || null;

    if(!user) return { user:null, profile:null };

    let { data:profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if(error && error.code !== 'PGRST116') throw error;

    if(!profile){
      const username = user.email ? user.email.split('@')[0] : 'VCC Player';

      const created = await supabase
        .from('profiles')
        .insert({
          id:user.id,
          email:user.email,
          username,
          display_name:username
        })
        .select()
        .single();

      if(created.error) throw created.error;
      profile = created.data;
    }

    return { user, profile };
  }

  async function uploadLogo(supabase, user){
    const file = document.getElementById('logoFile').files[0];
    if(!file) return null;

    const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const path = `${user.id}/team-logo-${Date.now()}-${safeName}`;

    const upload = await supabase.storage
      .from('team-logos')
      .upload(path, file, { upsert:true });

    if(upload.error) throw upload.error;

    return supabase.storage.from('team-logos').getPublicUrl(path).data.publicUrl;
  }

  async function createTeam(){
    try{
      setStatus('Loading Supabase...');

      const supabase = await getSupabase();

      setStatus('Checking login...');

      const { user, profile } = await getUserAndProfile(supabase);

      if(!user){
        setStatus('You must sign in first. Redirecting...');
        setTimeout(() => location.href = 'auth.html?mode=login', 600);
        return;
      }

      const teamName = document.getElementById('teamName').value.trim();
      const teamTag = document.getElementById('teamTag').value.trim();
      const division = document.getElementById('teamDivision').value;
      const teamBio = document.getElementById('teamBio').value.trim();

      if(!teamName){
        setStatus('Enter a team name.');
        return;
      }

      if(!profile?.gender){
        setStatus('You must complete your profile and select gender before creating a team.');
        return;
      }

      if(division === 'wcc' && profile.gender !== 'female'){
        setStatus('Only female users can create WCC teams.');
        return;
      }

      setStatus('Checking existing teams...');

      const existing = await supabase
        .from('teams')
        .select('*')
        .eq('captain_id', user.id);

      if(existing.error) throw existing.error;

      const existingTeams = existing.data || [];
      const hasRegular = existingTeams.some(t => (t.division || 'open') !== 'wcc');
      const hasWcc = existingTeams.some(t => (t.division || 'open') === 'wcc');

      if(division === 'wcc' && hasWcc){
        setStatus('You already created a WCC team.');
        return;
      }

      if(division !== 'wcc' && hasRegular){
        setStatus('You already created a regular VCC team.');
        return;
      }

      setStatus('Uploading logo if selected...');

      const logoUrl = await uploadLogo(supabase, user);

      setStatus('Creating team...');

      const insert = await supabase
        .from('teams')
        .insert({
          name:teamName,
          tag:teamTag,
          bio:teamBio,
          logo_url:logoUrl,
          captain_id:user.id,
          division:division,
          team_type:division,
          gender_restriction:division === 'wcc' ? 'female_only' : 'none'
        })
        .select()
        .single();

      if(insert.error) throw insert.error;

      setStatus('Adding captain to roster...');

      const membership = await supabase
        .from('team_memberships')
        .insert({
          team_id:insert.data.id,
          user_id:user.id,
          role:'captain',
          status:'active'
        });

      if(membership.error) throw membership.error;

      setStatus(`Team created successfully.\nTeam ID: ${insert.data.id}\nRedirecting...`);
      setTimeout(() => location.href = 'manage-team.html', 1000);

    }catch(error){
      setStatus('Create team error: ' + error.message);
    }
  }

  document.getElementById('createTeamBtn')?.addEventListener('click', createTeam);

  document.getElementById('logoFile')?.addEventListener('change', () => {
    const file = document.getElementById('logoFile').files[0];
    if(file) document.getElementById('preview').src = URL.createObjectURL(file);
  });

  setStatus('Create team page loaded. Button connected. Ready.');
})();
