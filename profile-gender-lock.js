// VCC Gender Profile Add-On + Lock
// Add before </body> on profile.html:
// <script src="profile-gender-lock.js"></script>

(async function(){
  let supabase = null;
  let user = null;
  let profile = null;

  function findStatus(){
    return document.getElementById('profileStatus') || document.getElementById('status') || document.querySelector('.log');
  }

  function setStatus(message){
    const box = findStatus();
    if(box) box.textContent = message;
    else console.log(message);
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    if(!config.SUPABASE_URL || config.SUPABASE_URL.includes('PASTE_')) throw new Error('SUPABASE_URL missing in supabase-config.js');
    if(!config.SUPABASE_ANON_KEY || config.SUPABASE_ANON_KEY.includes('PASTE_')) throw new Error('SUPABASE_ANON_KEY missing in supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function loadUser(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      setStatus('Log in first.');
      return false;
    }

    const res = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if(res.error && res.error.code !== 'PGRST116') throw res.error;

    if(!res.data){
      const username = user.email ? user.email.split('@')[0] : 'VCC Player';
      const created = await supabase.from('profiles').insert({
        id:user.id,
        email:user.email,
        username,
        display_name:username
      }).select().single();

      if(created.error) throw created.error;
      profile = created.data;
    }else{
      profile = res.data;
    }
    return true;
  }

  function createGenderPanel(){
    if(document.getElementById('vccGenderPanel')) return;

    const panel = document.createElement('section');
    panel.id = 'vccGenderPanel';
    panel.className = 'vcc-card';
    panel.style.marginTop = '18px';

    const currentGender = profile?.gender || '';
    const locked = !!profile?.gender_locked;

    panel.innerHTML = `
      <div class="vcc-panel-title">
        <h2>Gender / Division Eligibility</h2>
        <span>${locked ? 'Locked' : 'Required'}</span>
      </div>

      <p class="lead" style="font-size:14px">
        Select your gender for WCC eligibility. Once saved, this is locked and cannot be changed by the player.
      </p>

      <select id="vccGenderSelect" ${locked ? 'disabled' : ''}>
        <option value="">Select Gender</option>
        <option value="male" ${currentGender === 'male' ? 'selected' : ''}>Male</option>
        <option value="female" ${currentGender === 'female' ? 'selected' : ''}>Female</option>
      </select>

      <button id="vccSaveGenderBtn" type="button" ${locked ? 'disabled' : ''}>
        ${locked ? 'Gender Locked' : 'Save Gender'}
      </button>

      <div class="log" id="vccGenderStatus">
        ${locked ? `Gender locked as ${currentGender}.` : 'Choose male or female, then save.'}
      </div>

      <div style="margin-top:12px">
        <span class="pill">Female: 1 regular team + 1 WCC team</span>
        <span class="pill">Male: 1 regular team only</span>
        <span class="pill">Male users blocked from WCC</span>
      </div>
    `;

    const anchor = document.querySelector('.competitive-identity') || document.querySelector('#competitiveIdentity') || document.querySelector('.vcc-wrap') || document.querySelector('main') || document.body;
    anchor.appendChild(panel);

    document.getElementById('vccSaveGenderBtn')?.addEventListener('click', saveGender);
  }

  async function saveGender(){
    try{
      const select = document.getElementById('vccGenderSelect');
      const status = document.getElementById('vccGenderStatus');

      if(profile?.gender_locked){
        status.textContent = 'Gender is already locked and cannot be changed.';
        return;
      }

      const gender = select.value;
      if(!gender){
        status.textContent = 'Select male or female first.';
        return;
      }

      if(!confirm(`Lock gender as ${gender}? You will not be able to change this after saving.`)) return;

      status.textContent = 'Saving gender...';

      const result = await supabase.from('profiles').update({
        gender,
        gender_locked:true,
        gender_locked_at:new Date().toISOString()
      }).eq('id', user.id).select().single();

      if(result.error) throw result.error;

      profile = result.data;
      select.disabled = true;
      document.getElementById('vccSaveGenderBtn').disabled = true;
      document.getElementById('vccSaveGenderBtn').textContent = 'Gender Locked';
      status.textContent = `Gender locked as ${gender}.`;
      setStatus('Gender saved and locked.');
    }catch(error){
      setStatus('Gender save error: ' + error.message);
      const status = document.getElementById('vccGenderStatus');
      if(status) status.textContent = 'Gender save error: ' + error.message;
    }
  }

  try{
    supabase = await getSupabase();
    if(await loadUser()) createGenderPanel();
  }catch(error){
    setStatus('Gender setup error: ' + error.message);
  }
})();
