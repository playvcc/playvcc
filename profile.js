// VCC Profile Page + Working Profile Picture Upload

(function(){
  let supabase = null;
  let user = null;
  let profile = null;

  const statusBox =
    document.getElementById('profileStatus') ||
    document.getElementById('status') ||
    document.querySelector('.log');

  function setStatus(msg){
    if(statusBox) statusBox.textContent = msg;
    else console.log(msg);
  }

  function byId(id){ return document.getElementById(id); }

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

  function getInputValue(ids){
    for(const id of ids){
      const el = byId(id);
      if(el) return el.value || '';
    }
    return '';
  }

  function setInputValue(ids, value){
    for(const id of ids){
      const el = byId(id);
      if(el) el.value = value || '';
    }
  }

  function setImage(url){
    const fallback = 'assets/vcc-logo.png';
    const src = url || fallback;

    const ids = ['profilePreview','avatarPreview','profileImage','pfpPreview','avatarImg'];
    ids.forEach(id => {
      const el = byId(id);
      if(el) el.src = src;
    });

    document.querySelectorAll('img[data-profile-avatar]').forEach(img => img.src = src);
  }

  async function requireLogin(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      setStatus('Log in first.');
      setTimeout(() => location.href = 'auth.html?mode=login', 700);
      return false;
    }

    return true;
  }

  async function ensureProfile(){
    let res = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if(res.error && res.error.code !== 'PGRST116') throw res.error;

    if(!res.data){
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
    }else{
      profile = res.data;
    }
  }

  function fillProfileForm(){
    setImage(profile.avatar_url || profile.profile_picture_url || profile.pfp_url);

    setInputValue(['displayName','username','name'], profile.display_name || profile.username || '');
    setInputValue(['riotId','riot_id'], profile.riot_id || '');
    setInputValue(['rank','currentRank'], profile.rank || '');
    setInputValue(['platform'], profile.platform || '');
    setInputValue(['region'], profile.region || 'NA');
    setInputValue(['role','mainRole'], profile.role || profile.main_role || '');
    setInputValue(['agents','mainAgents'], profile.agents || profile.main_agents || '');
    setInputValue(['bio','profileBio'], profile.bio || '');

    const gender = byId('gender');
    if(gender && profile.gender){
      gender.value = profile.gender;
      if(profile.gender_locked){
        gender.disabled = true;
      }
    }

    const title =
      byId('profileTitle') ||
      document.querySelector('[data-profile-title]') ||
      document.querySelector('h1');

    if(title){
      title.textContent = (profile.display_name || profile.username || 'My VCC Profile');
    }
  }

  async function saveProfile(){
    try{
      if(!user) return;

      const updates = {
        id:user.id,
        email:user.email,
        display_name:getInputValue(['displayName','username','name']),
        username:getInputValue(['displayName','username','name']),
        riot_id:getInputValue(['riotId','riot_id']),
        rank:getInputValue(['rank','currentRank']),
        platform:getInputValue(['platform']),
        region:getInputValue(['region']) || 'NA',
        role:getInputValue(['role','mainRole']),
        main_role:getInputValue(['role','mainRole']),
        agents:getInputValue(['agents','mainAgents']),
        main_agents:getInputValue(['agents','mainAgents']),
        bio:getInputValue(['bio','profileBio'])
      };

      const genderEl = byId('gender');
      if(genderEl && genderEl.value && !genderEl.disabled){
        updates.gender = genderEl.value;
        updates.gender_locked = true;
        updates.gender_locked_at = new Date().toISOString();
      }

      setStatus('Saving profile...');

      const result = await supabase
        .from('profiles')
        .upsert(updates)
        .select()
        .single();

      if(result.error) throw result.error;

      profile = result.data;
      fillProfileForm();
      setStatus('Profile saved.');
    }catch(error){
      setStatus('Save profile error: ' + error.message);
    }
  }

  async function uploadProfilePicture(){
    try{
      if(!user){
        setStatus('Log in first.');
        return;
      }

      const fileInput =
        byId('profilePicInput') ||
        byId('avatarFile') ||
        byId('profileFile') ||
        byId('pfpFile') ||
        byId('profilePicture') ||
        document.querySelector('input[type="file"]');

      if(!fileInput){
        setStatus('No file input found on this page.');
        return;
      }

      const file = fileInput.files?.[0];

      if(!file){
        setStatus('Choose an image first.');
        return;
      }

      if(!file.type.startsWith('image/')){
        setStatus('Please choose an image file.');
        return;
      }

      if(file.size > 5 * 1024 * 1024){
        setStatus('Image is too large. Use an image under 5MB.');
        return;
      }

      setStatus('Uploading profile picture...');

      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/profile-${Date.now()}.${ext}`;

      const upload = await supabase.storage
        .from('profile-images')
        .upload(path, file, {
          upsert:true,
          contentType:file.type
        });

      if(upload.error) throw upload.error;

      const publicUrl = supabase.storage
        .from('profile-images')
        .getPublicUrl(path)
        .data
        .publicUrl;

      const update = await supabase
        .from('profiles')
        .upsert({
          id:user.id,
          email:user.email,
          avatar_url:publicUrl,
          profile_picture_url:publicUrl,
          pfp_url:publicUrl
        })
        .select()
        .single();

      if(update.error) throw update.error;

      profile = update.data;
      setImage(publicUrl);
      setStatus('Profile picture uploaded.');

    }catch(error){
      setStatus('Profile picture upload error: ' + error.message);
    }
  }

  function connectButtons(){
    const uploadBtns = [
      byId('uploadProfilePicBtn'),
      byId('uploadAvatarBtn'),
      byId('uploadBtn'),
      byId('uploadProfilePictureBtn')
    ].filter(Boolean);

    uploadBtns.forEach(btn => {
      btn.addEventListener('click', uploadProfilePicture);
    });

    const fileInput =
      byId('profilePicInput') ||
      byId('avatarFile') ||
      byId('profileFile') ||
      byId('pfpFile') ||
      byId('profilePicture') ||
      document.querySelector('input[type="file"]');

    if(fileInput){
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if(file){
          setImage(URL.createObjectURL(file));
          setStatus('Image selected. Click upload to save it.');
        }
      });
    }

    const saveBtns = [
      byId('saveProfileBtn'),
      byId('saveBtn'),
      byId('saveProfile')
    ].filter(Boolean);

    saveBtns.forEach(btn => {
      btn.addEventListener('click', saveProfile);
    });

    // If page has a button text "Upload Profile Picture", connect it too.
    document.querySelectorAll('button').forEach(btn => {
      const text = (btn.textContent || '').trim().toLowerCase();

      if(text.includes('upload') && text.includes('profile')){
        btn.addEventListener('click', uploadProfilePicture);
      }

      if(text.includes('save profile')){
        btn.addEventListener('click', saveProfile);
      }
    });
  }

  async function init(){
    try{
      supabase = await getSupabase();

      if(!await requireLogin()) return;

      await ensureProfile();
      fillProfileForm();
      connectButtons();

      setStatus('Profile loaded.');
    }catch(error){
      setStatus('Profile page error: ' + error.message);
    }
  }

  init();
})();
