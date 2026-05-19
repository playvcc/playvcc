// VCC Edit Profile Blank Fields Fix
// Replace edit-profile.js with this.
// Fixes fields going blank after save by reading/writing inputs by ID OR placeholder.
// Also prevents blank fields from overwriting existing profile data.

(function(){
  let supabase = null;
  let user = null;
  let profile = null;

  function getStatusBox(){
    return (
      document.getElementById('editStatus') ||
      document.getElementById('profileStatus') ||
      document.getElementById('status') ||
      document.querySelector('.log')
    );
  }

  function setStatus(message){
    const box = getStatusBox();
    if(box) box.textContent = message;
    console.log('[VCC Edit Profile]', message);
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  function normalize(text){
    return String(text || '').trim().toLowerCase();
  }

  function fieldByIds(ids){
    for(const id of ids){
      const el = document.getElementById(id);
      if(el) return el;
    }
    return null;
  }

  function fieldByPlaceholder(placeholders){
    const wanted = placeholders.map(normalize);

    const fields = [...document.querySelectorAll('input, textarea, select')];

    return fields.find(el => {
      const ph = normalize(el.getAttribute('placeholder'));
      const name = normalize(el.getAttribute('name'));
      const aria = normalize(el.getAttribute('aria-label'));
      const id = normalize(el.id);
      return wanted.includes(ph) || wanted.includes(name) || wanted.includes(aria) || wanted.includes(id);
    }) || null;
  }

  function field(ids, placeholders){
    return fieldByIds(ids) || fieldByPlaceholder(placeholders);
  }

  const FIELDS = {
    displayName: {
      ids:['displayNameInput','displayName','nameInput','usernameInput'],
      placeholders:['Display Name','Username','Name']
    },
    riotId: {
      ids:['riotInput','riotIdInput','riotId'],
      placeholders:['Riot ID','RiotId','Riot']
    },
    rank: {
      ids:['rankInput','rank'],
      placeholders:['Rank']
    },
    platform: {
      ids:['platformInput','platform'],
      placeholders:['Platform']
    },
    region: {
      ids:['regionInput','region'],
      placeholders:['Region']
    },
    mainRole: {
      ids:['roleInput','mainRoleInput','mainRole'],
      placeholders:['Main Role','Role']
    },
    mainAgents: {
      ids:['agentsInput','mainAgentsInput','mainAgents'],
      placeholders:['Main Agents','Agents']
    },
    bio: {
      ids:['bioInput','profileBio','bio'],
      placeholders:['Profile Bio','Bio']
    },
    gender: {
      ids:['genderInput','genderSelect','gender'],
      placeholders:['Gender']
    }
  };

  function getField(key){
    const cfg = FIELDS[key];
    return field(cfg.ids, cfg.placeholders);
  }

  function readField(key, fallback){
    const el = getField(key);
    if(!el) return fallback || '';

    const value = String(el.value || '').trim();

    // IMPORTANT:
    // If the user leaves a field blank, preserve the existing database value.
    return value || fallback || '';
  }

  function writeField(key, value){
    const el = getField(key);
    if(!el) return;
    el.value = value || '';
  }

  function avatarUrl(p){
    return (
      p?.avatar_url ||
      p?.profile_picture_url ||
      p?.profile_pic_url ||
      p?.profile_image_url ||
      p?.pfp_url ||
      p?.photo_url ||
      p?.image_url ||
      'assets/vcc-logo.png'
    );
  }

  function updateAvatarPreview(){
    const src = avatarUrl(profile);

    [
      'profileAvatar',
      'profilePreview',
      'avatarPreview',
      'profileImage',
      'pfpPreview',
      'editProfileAvatar',
      'currentPfp',
      'vccPfpPreview'
    ].forEach(id => {
      const img = document.getElementById(id);
      if(img){
        img.onerror = () => {
          img.onerror = null;
          img.src = 'assets/vcc-logo.png';
        };
        img.src = src;
      }
    });

    document.querySelectorAll('.player-avatar, .profile-avatar, img[data-profile-avatar]').forEach(img => {
      img.onerror = () => {
        img.onerror = null;
        img.src = 'assets/vcc-logo.png';
      };
      img.src = src;
    });
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

  async function getOrCreateProfile(){
    const result = await supabase.rpc('vcc_get_or_create_my_profile');

    if(result.error) throw result.error;

    profile = result.data;
    return profile;
  }

  function fillForm(){
    if(!profile) return;

    writeField('displayName', profile.display_name || profile.username || '');
    writeField('riotId', profile.riot_id || '');
    writeField('rank', profile.rank || 'Unranked');
    writeField('platform', profile.platform || 'Console');
    writeField('region', profile.region || 'NA');
    writeField('mainRole', profile.main_role || profile.role || 'Flex');
    writeField('mainAgents', profile.main_agents || profile.agents || '');
    writeField('bio', profile.bio || '');

    const genderEl = getField('gender');
    if(genderEl){
      if(profile.gender){
        genderEl.value = profile.gender;
        genderEl.disabled = true;
      }else{
        genderEl.disabled = false;
      }
    }

    updateAvatarPreview();
  }

  function buildPayload(){
    const fallbackName =
      profile?.display_name ||
      profile?.username ||
      (user.email ? user.email.split('@')[0] : 'VCC Player');

    const genderEl = getField('gender');
    const existingGender = profile?.gender || '';
    const selectedGender = genderEl?.value || '';

    return {
      p_display_name: readField('displayName', fallbackName),
      p_riot_id: readField('riotId', profile?.riot_id || ''),
      p_rank: readField('rank', profile?.rank || 'Unranked'),
      p_platform: readField('platform', profile?.platform || 'Console'),
      p_region: readField('region', profile?.region || 'NA'),
      p_main_role: readField('mainRole', profile?.main_role || profile?.role || 'Flex'),
      p_main_agents: readField('mainAgents', profile?.main_agents || profile?.agents || ''),
      p_bio: readField('bio', profile?.bio || ''),
      p_gender: existingGender || selectedGender || ''
    };
  }

  async function saveProfile(event){
    if(event) event.preventDefault();

    try{
      setStatus('Saving profile...');

      if(!user){
        const ok = await loadUser();
        if(!ok) return;
      }

      if(!profile){
        await getOrCreateProfile();
      }

      const payload = buildPayload();

      const saved = await supabase.rpc('vcc_save_my_profile', payload);

      if(saved.error) throw saved.error;

      profile = saved.data;

      fillForm();

      setStatus('Profile saved successfully.');

      // Stay on edit page so users can see it saved and fields do not look wiped.
      // User can click Back to Profile after confirming.
    }catch(error){
      setStatus('Save profile error: ' + error.message);
    }
  }

  function bindSaveButtons(){
    const buttons = [];

    ['saveProfileBtn','saveBtn','submitBtn','saveChangesBtn'].forEach(id => {
      const btn = document.getElementById(id);
      if(btn) buttons.push(btn);
    });

    document.querySelectorAll('button').forEach(btn => {
      const text = normalize(btn.textContent);
      if(text.includes('save profile') || text.includes('save changes') || text === 'save'){
        buttons.push(btn);
      }
    });

    [...new Set(buttons)].forEach(btn => {
      if(btn.dataset.vccSaveBound === 'yes') return;
      btn.dataset.vccSaveBound = 'yes';
      btn.type = 'button';
      btn.addEventListener('click', saveProfile);
    });

    document.querySelectorAll('form').forEach(form => {
      if(form.dataset.vccFormBound === 'yes') return;
      form.dataset.vccFormBound = 'yes';
      form.addEventListener('submit', saveProfile);
    });
  }

  async function init(){
    try{
      supabase = await getSupabase();

      const ok = await loadUser();
      if(!ok) return;

      await getOrCreateProfile();
      fillForm();
      bindSaveButtons();

      setStatus('Profile loaded.');
    }catch(error){
      setStatus('Edit profile setup error: ' + error.message);
    }
  }

  init();
})();
