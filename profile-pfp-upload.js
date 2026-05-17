// VCC Custom PFP Upload + Display Fix
// Add to edit-profile.html before </body>:
// <script src="profile-pfp-upload.js"></script>
// This saves uploaded PFP to Supabase Storage and updates every common profile image column.

(async function(){
  let supabase = null;
  let user = null;
  let profile = null;

  function byId(id){ return document.getElementById(id); }

  function setStatus(message){
    const box =
      byId('editStatus') ||
      byId('profileStatus') ||
      byId('status') ||
      document.querySelector('.log');

    if(box) box.textContent = message;
    console.log('[PFP]', message);
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
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

  function updatePreviews(url){
    const ids = [
      'profileAvatar',
      'profilePreview',
      'avatarPreview',
      'profileImage',
      'pfpPreview',
      'editProfileAvatar',
      'currentPfp'
    ];

    ids.forEach(id => {
      const img = byId(id);
      if(img){
        img.onerror = () => {
          img.onerror = null;
          img.src = 'assets/vcc-logo.png';
        };
        img.src = url;
      }
    });

    document.querySelectorAll('.player-avatar, .profile-avatar, img[data-profile-avatar]').forEach(img => {
      img.onerror = () => {
        img.onerror = null;
        img.src = 'assets/vcc-logo.png';
      };
      img.src = url;
    });
  }

  function ensurePfpUploader(){
    if(byId('vccPfpUploader')) return;

    const target =
      document.querySelector('.main-column') ||
      document.querySelector('form') ||
      document.querySelector('main') ||
      document.body;

    const panel = document.createElement('section');
    panel.id = 'vccPfpUploader';
    panel.className = 'panel vcc-card';
    panel.style.marginTop = '18px';

    panel.innerHTML = `
      <div class="panel-header vcc-panel-title">
        <h2>PROFILE PICTURE</h2>
        <a href="#">Custom PFP</a>
      </div>

      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        <img
          id="vccPfpPreview"
          src="${avatarUrl(profile)}"
          alt="Profile Picture"
          style="width:96px;height:96px;border-radius:18px;object-fit:cover;border:2px solid rgba(255,215,0,.55);background:#111;"
          onerror="this.onerror=null;this.src='assets/vcc-logo.png';"
        >

        <div style="flex:1;min-width:240px;">
          <input id="vccPfpFile" type="file" accept="image/*">
          <button id="vccUploadPfpBtn" type="button" class="gold-btn">Upload Profile Picture</button>
          <div id="vccPfpStatus" class="empty-box log" style="margin-top:12px;">Choose an image, then upload.</div>
        </div>
      </div>
    `;

    target.appendChild(panel);

    byId('vccPfpFile')?.addEventListener('change', previewFile);
    byId('vccUploadPfpBtn')?.addEventListener('click', uploadPfp);
  }

  function previewFile(){
    const file = byId('vccPfpFile')?.files?.[0];
    if(!file) return;

    if(!file.type.startsWith('image/')){
      setStatus('Choose an image file.');
      return;
    }

    const preview = byId('vccPfpPreview');
    if(preview) preview.src = URL.createObjectURL(file);

    setStatus('Image selected. Click Upload Profile Picture.');
    const pfpStatus = byId('vccPfpStatus');
    if(pfpStatus) pfpStatus.textContent = 'Image selected. Click Upload Profile Picture.';
  }

  async function loadUser(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      setStatus('Log in first before uploading a profile picture.');
      return false;
    }

    const res = await supabase
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

    updatePreviews(avatarUrl(profile));
    return true;
  }

  async function uploadPfp(){
    try{
      const file = byId('vccPfpFile')?.files?.[0];
      const pfpStatus = byId('vccPfpStatus');

      if(!file){
        if(pfpStatus) pfpStatus.textContent = 'Choose an image first.';
        setStatus('Choose an image first.');
        return;
      }

      if(!file.type.startsWith('image/')){
        if(pfpStatus) pfpStatus.textContent = 'File must be an image.';
        setStatus('File must be an image.');
        return;
      }

      if(file.size > 5 * 1024 * 1024){
        if(pfpStatus) pfpStatus.textContent = 'Image must be under 5MB.';
        setStatus('Image must be under 5MB.');
        return;
      }

      if(pfpStatus) pfpStatus.textContent = 'Uploading profile picture...';
      setStatus('Uploading profile picture...');

      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g,'') || 'png';
      const path = `${user.id}/pfp-${Date.now()}.${ext}`;

      const upload = await supabase.storage
        .from('profile-images')
        .upload(path, file, {
          cacheControl:'3600',
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
        .update({
          avatar_url:publicUrl,
          profile_picture_url:publicUrl,
          profile_pic_url:publicUrl,
          profile_image_url:publicUrl,
          pfp_url:publicUrl,
          photo_url:publicUrl,
          image_url:publicUrl
        })
        .eq('id', user.id)
        .select()
        .single();

      if(update.error) throw update.error;

      profile = update.data;

      updatePreviews(publicUrl);

      if(pfpStatus) pfpStatus.textContent = 'Profile picture uploaded and saved.';
      setStatus('Profile picture uploaded and saved.');

    }catch(error){
      const pfpStatus = byId('vccPfpStatus');
      if(pfpStatus) pfpStatus.textContent = 'PFP upload error: ' + error.message;
      setStatus('PFP upload error: ' + error.message);
    }
  }

  async function init(){
    try{
      supabase = await getSupabase();

      const ok = await loadUser();
      if(!ok) return;

      ensurePfpUploader();

    }catch(error){
      setStatus('PFP setup error: ' + error.message);
    }
  }

  init();
})();
