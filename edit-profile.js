// VCC New User Profile Save Fix
// Replace edit-profile.js with this.

(function(){
  let supabase = null;
  let user = null;
  let profile = null;

  const statusBox = document.getElementById('editStatus') || document.getElementById('profileStatus') || document.getElementById('status') || document.querySelector('.log');

  function setStatus(message){
    if(statusBox) statusBox.textContent = message;
    console.log('[Edit Profile]', message);
  }

  function byId(id){ return document.getElementById(id); }
  function val(id){ return byId(id)?.value?.trim() || ''; }
  function setVal(id, value){ const el = byId(id); if(el) el.value = value || ''; }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function loadUser(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      setStatus('Please sign in first.');
      setTimeout(() => location.href = 'auth.html?mode=login', 700);
      return false;
    }

    return true;
  }

  async function ensureProfile(){
    const existing = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if(existing.error && existing.error.code !== 'PGRST116'){
      throw existing.error;
    }

    if(existing.data){
      profile = existing.data;
      return profile;
    }

    const username = user.email ? user.email.split('@')[0] : 'VCC Player';

    const created = await supabase
      .from('profiles')
      .upsert({
        id:user.id,
        email:user.email,
        username,
        display_name:username,
        rank:'Unranked',
        platform:'Console',
        region:'NA',
        main_role:'Flex',
        role:'Flex',
        bio:'Competitive console Valorant player competing in the VCC ecosystem.',
        wins:0,
        losses:0,
        maps_won:0,
        maps_lost:0,
        pro_points:0,
        vcc_rating:1000
      }, { onConflict:'id' })
      .select()
      .single();

    if(created.error) throw created.error;

    profile = created.data;
    return profile;
  }

  function fillForm(){
    if(!profile) return;

    setVal('displayNameInput', profile.display_name || profile.username || '');
    setVal('displayName', profile.display_name || profile.username || '');
    setVal('nameInput', profile.display_name || profile.username || '');

    setVal('riotInput', profile.riot_id || '');
    setVal('riotIdInput', profile.riot_id || '');
    setVal('riotId', profile.riot_id || '');

    setVal('rankInput', profile.rank || 'Unranked');
    setVal('rank', profile.rank || 'Unranked');

    setVal('platformInput', profile.platform || 'Console');
    setVal('platform', profile.platform || 'Console');

    setVal('regionInput', profile.region || 'NA');
    setVal('region', profile.region || 'NA');

    setVal('roleInput', profile.main_role || profile.role || 'Flex');
    setVal('mainRoleInput', profile.main_role || profile.role || 'Flex');
    setVal('mainRole', profile.main_role || profile.role || 'Flex');

    setVal('agentsInput', profile.main_agents || profile.agents || '');
    setVal('mainAgentsInput', profile.main_agents || profile.agents || '');
    setVal('mainAgents', profile.main_agents || profile.agents || '');

    setVal('bioInput', profile.bio || '');
    setVal('profileBio', profile.bio || '');
    setVal('bio', profile.bio || '');

    const genderEl = byId('genderInput') || byId('genderSelect') || byId('gender');

    if(genderEl && profile.gender){
      genderEl.value = profile.gender;
      genderEl.disabled = true;
    }
  }

  function readProfileForm(){
    const displayName = val('displayNameInput') || val('displayName') || val('nameInput') || profile?.display_name || profile?.username || (user.email ? user.email.split('@')[0] : 'VCC Player');
    const riotId = val('riotInput') || val('riotIdInput') || val('riotId') || profile?.riot_id || '';
    const rank = val('rankInput') || val('rank') || profile?.rank || 'Unranked';
    const platform = val('platformInput') || val('platform') || profile?.platform || 'Console';
    const region = val('regionInput') || val('region') || profile?.region || 'NA';
    const role = val('roleInput') || val('mainRoleInput') || val('mainRole') || profile?.main_role || profile?.role || 'Flex';
    const agents = val('agentsInput') || val('mainAgentsInput') || val('mainAgents') || profile?.main_agents || '';
    const bio = val('bioInput') || val('profileBio') || val('bio') || profile?.bio || '';

    const genderEl = byId('genderInput') || byId('genderSelect') || byId('gender');
    const newGender = genderEl?.value || '';

    const payload = {
      id:user.id,
      email:user.email,
      username:profile?.username || displayName,
      display_name:displayName,
      riot_id:riotId,
      rank,
      platform,
      region,
      main_role:role,
      role,
      main_agents:agents,
      agents,
      bio
    };

    if(profile?.gender){
      payload.gender = profile.gender;
      payload.gender_locked = true;
    }else if(newGender){
      payload.gender = newGender;
      payload.gender_locked = true;
    }

    return payload;
  }

  async function saveProfile(event){
    if(event) event.preventDefault();

    try{
      if(!user){
        const ok = await loadUser();
        if(!ok) return;
      }

      await ensureProfile();
      const payload = readProfileForm();

      setStatus('Saving profile...');

      const saved = await supabase
        .from('profiles')
        .upsert(payload, { onConflict:'id' })
        .select()
        .single();

      if(saved.error) throw saved.error;

      profile = saved.data;
      fillForm();

      setStatus('Profile saved successfully.');

      setTimeout(() => location.href = 'profile.html', 800);
    }catch(error){
      setStatus('Save profile error: ' + error.message);
    }
  }

  function bindSaveButtons(){
    const buttons = [];

    ['saveProfileBtn','saveBtn','submitBtn'].forEach(id => {
      const btn = byId(id);
      if(btn) buttons.push(btn);
    });

    document.querySelectorAll('button').forEach(btn => {
      const text = (btn.textContent || '').trim().toLowerCase();
      if(text.includes('save profile') || text === 'save') buttons.push(btn);
    });

    [...new Set(buttons)].forEach(btn => {
      if(btn.dataset.vccProfileSaveBound === 'yes') return;
      btn.dataset.vccProfileSaveBound = 'yes';
      btn.addEventListener('click', saveProfile);
    });

    document.querySelectorAll('form').forEach(form => {
      if(form.dataset.vccProfileFormBound === 'yes') return;
      form.dataset.vccProfileFormBound = 'yes';
      form.addEventListener('submit', saveProfile);
    });
  }

  async function init(){
    try{
      supabase = await getSupabase();
      const ok = await loadUser();
      if(!ok) return;
      await ensureProfile();
      fillForm();
      bindSaveButtons();
      setStatus('Profile loaded.');
    }catch(error){
      setStatus('Edit profile setup error: ' + error.message);
    }
  }

  init();
})();
