// VCC PFP Upload Only Fix
// This does NOT change your profile layout.
// Add before </body> on profile.html:
// <script src="profile-pfp-upload.js"></script>

(async function(){
  let supabase = null;
  let user = null;

  function findStatus(){
    return (
      document.getElementById('profileStatus') ||
      document.getElementById('status') ||
      document.querySelector('.log')
    );
  }

  function setStatus(message){
    const box = findStatus();
    if(box) box.textContent = message;
    else alert(message);
  }

  function findFileInput(){
    return (
      document.getElementById('profilePicInput') ||
      document.getElementById('avatarFile') ||
      document.getElementById('profileFile') ||
      document.getElementById('pfpFile') ||
      document.getElementById('profilePicture') ||
      document.querySelector('input[type="file"]')
    );
  }

  function findPreview(){
    return (
      document.getElementById('profilePreview') ||
      document.getElementById('avatarPreview') ||
      document.getElementById('profileImage') ||
      document.getElementById('pfpPreview') ||
      document.querySelector('.profile-avatar img') ||
      document.querySelector('img')
    );
  }

  function findUploadButtons(){
    const buttons = [];

    [
      'uploadProfilePicBtn',
      'uploadAvatarBtn',
      'uploadBtn',
      'uploadProfilePictureBtn'
    ].forEach(id => {
      const btn = document.getElementById(id);
      if(btn) buttons.push(btn);
    });

    document.querySelectorAll('button, a').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      if(text.includes('upload') && (text.includes('profile') || text.includes('picture') || text.includes('pfp') || text.includes('avatar'))){
        buttons.push(el);
      }
    });

    return [...new Set(buttons)];
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

  async function uploadPfp(event){
    if(event) event.preventDefault();

    try{
      if(!supabase) supabase = await getSupabase();

      const session = await supabase.auth.getSession();
      user = session?.data?.session?.user || null;

      if(!user){
        setStatus('Log in first before uploading a profile picture.');
        return;
      }

      const input = findFileInput();

      if(!input){
        setStatus('No profile picture file input found.');
        return;
      }

      const file = input.files?.[0];

      if(!file){
        setStatus('Choose a picture first.');
        return;
      }

      if(!file.type.startsWith('image/')){
        setStatus('Please choose an image file.');
        return;
      }

      if(file.size > 5 * 1024 * 1024){
        setStatus('Image too large. Use an image under 5MB.');
        return;
      }

      setStatus('Uploading profile picture...');

      const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
      const path = `${user.id}/pfp-${Date.now()}.${ext}`;

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

      const preview = findPreview();
      if(preview) preview.src = publicUrl;

      setStatus('Profile picture uploaded successfully. Refresh if it does not update everywhere.');

    }catch(error){
      setStatus('Profile picture upload error: ' + error.message);
    }
  }

  function setupPreview(){
    const input = findFileInput();
    if(!input) return;

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if(!file) return;

      const preview = findPreview();
      if(preview) preview.src = URL.createObjectURL(file);

      setStatus('Picture selected. Click Upload Profile Picture to save.');
    });
  }

  async function init(){
    try{
      supabase = await getSupabase();

      setupPreview();

      const buttons = findUploadButtons();

      if(!buttons.length){
        setStatus('PFP upload helper loaded, but no upload button was found.');
        return;
      }

      buttons.forEach(btn => {
        btn.addEventListener('click', uploadPfp);
      });

      console.log('VCC PFP upload helper loaded.');
    }catch(error){
      setStatus('PFP upload setup error: ' + error.message);
    }
  }

  init();
})();
