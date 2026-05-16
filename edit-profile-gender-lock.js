// VCC Edit Profile Gender Lock Add-On
// Add before </body> in edit-profile.html:
// <script src="edit-profile-gender-lock.js"></script>

(async function(){
  let supabase = null;
  let user = null;
  let profile = null;

  function setStatus(message){
    const box =
      document.getElementById('editStatus') ||
      document.getElementById('profileStatus') ||
      document.getElementById('status') ||
      document.querySelector('.log');

    if(box) box.textContent = message;
    else console.log(message);
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function loadProfile(){
    const session = await supabase.auth.getSession();
    user = session?.data?.session?.user || null;

    if(!user){
      location.href = 'auth.html?mode=login';
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

    return true;
  }

  function addGenderToEditForm(){
    if(document.getElementById('editGenderPanel')) return;

    const locked = !!profile?.gender_locked;
    const current = profile?.gender || '';

    const panel = document.createElement('section');
    panel.id = 'editGenderPanel';
    panel.className = 'panel';
    panel.style.marginTop = '18px';

    panel.innerHTML = `
      <div class="panel-header">
        <h2>GENDER / DIVISION ELIGIBILITY</h2>
        <a href="#">${locked ? 'Locked' : 'Required'}</a>
      </div>

      <div class="identity-list">
        <div>
          <span>Gender</span>
          <strong>
            <select id="editGenderSelect" ${locked ? 'disabled' : ''}>
              <option value="">Select Gender</option>
              <option value="male" ${current === 'male' ? 'selected' : ''}>Male</option>
              <option value="female" ${current === 'female' ? 'selected' : ''}>Female</option>
            </select>
          </strong>
        </div>

        <div>
          <span>Rules</span>
          <strong>Female: 1 regular + 1 WCC | Male: 1 regular only</strong>
        </div>
      </div>

      <button id="saveGenderBtn" type="button" class="dark-btn" ${locked ? 'disabled' : ''}>
        ${locked ? 'Gender Locked' : 'Save Gender'}
      </button>

      <div id="genderSaveStatus" class="empty-box" style="margin-top:12px">
        ${locked ? `Gender locked as ${current}.` : 'Select gender and save once. This locks permanently.'}
      </div>
    `;

    const target =
      document.querySelector('.main-column') ||
      document.querySelector('main') ||
      document.body;

    target.appendChild(panel);

    document.getElementById('saveGenderBtn')?.addEventListener('click', saveGender);
  }

  async function saveGender(){
    const select = document.getElementById('editGenderSelect');
    const status = document.getElementById('genderSaveStatus');

    try{
      if(profile?.gender_locked){
        status.textContent = 'Gender is already locked.';
        return;
      }

      const gender = select.value;

      if(!gender){
        status.textContent = 'Select male or female first.';
        return;
      }

      if(!confirm(`Lock gender as ${gender}? Players cannot change it after saving.`)){
        return;
      }

      status.textContent = 'Saving gender...';

      const result = await supabase
        .from('profiles')
        .update({
          gender,
          gender_locked:true,
          gender_locked_at:new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single();

      if(result.error) throw result.error;

      profile = result.data;
      select.disabled = true;
      document.getElementById('saveGenderBtn').disabled = true;
      document.getElementById('saveGenderBtn').textContent = 'Gender Locked';
      status.textContent = `Gender locked as ${gender}.`;
      setStatus('Gender saved and locked.');
    }catch(error){
      status.textContent = 'Gender save error: ' + error.message;
      setStatus('Gender save error: ' + error.message);
    }
  }

  try{
    supabase = await getSupabase();
    if(await loadProfile()){
      addGenderToEditForm();
    }
  }catch(error){
    setStatus('Gender setup error: ' + error.message);
  }
})();
