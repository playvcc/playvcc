// VCC Profile Data Fix
// Loads public profile by URL:
// profile.html?id=PLAYER_ID
// If no id is in URL, loads your own signed-in profile.

(async function(){
  let supabase = null;
  let viewer = null;
  let profile = null;

  function byId(id){ return document.getElementById(id); }

  function setText(id, value){
    const el = byId(id);
    if(el) el.textContent = value ?? el.textContent;
  }

  function setImage(id, src){
    const el = byId(id);
    if(el && src) el.src = src;
  }

  function setStatus(message){
    const box =
      byId('profileStatus') ||
      byId('status') ||
      document.querySelector('.log');

    if(box) box.textContent = message;
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  function profileIdFromUrl(){
    return new URLSearchParams(location.search).get('id');
  }

  function profileName(p){
    return p.display_name || p.username || p.riot_id || p.email || 'VCC Player';
  }

  function avatar(p){
    return p.avatar_url || p.profile_picture_url || p.pfp_url || 'VCC.png';
  }

  async function loadViewer(){
    const session = await supabase.auth.getSession();
    viewer = session?.data?.session?.user || null;
  }

  async function loadProfile(){
    const requestedId = profileIdFromUrl();

    if(requestedId){
      const result = await supabase
        .from('profiles')
        .select('*')
        .eq('id', requestedId)
        .maybeSingle();

      if(result.error) throw result.error;
      if(!result.data) throw new Error('Player profile not found.');

      profile = result.data;
      return;
    }

    if(!viewer){
      location.href = 'auth.html?mode=login';
      return;
    }

    const result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', viewer.id)
      .maybeSingle();

    if(result.error && result.error.code !== 'PGRST116') throw result.error;

    if(!result.data){
      const username = viewer.email ? viewer.email.split('@')[0] : 'VCC Player';

      const created = await supabase
        .from('profiles')
        .insert({
          id:viewer.id,
          email:viewer.email,
          username,
          display_name:username
        })
        .select()
        .single();

      if(created.error) throw created.error;
      profile = created.data;
    }else{
      profile = result.data;
    }
  }

  function loadStats(){
    const wins = profile.wins ?? 0;
    const losses = profile.losses ?? 0;
    const mapsWon = profile.maps_won ?? profile.mapsWon ?? 0;
    const mapsLost = profile.maps_lost ?? profile.mapsLost ?? 0;
    const proPoints = profile.pro_points ?? profile.proPoints ?? 0;
    const rating = profile.vcc_rating ?? profile.rating ?? 1000;

    setText('wins', wins);
    setText('losses', losses);
    setText('mapsWon', mapsWon);
    setText('mapsLost', mapsLost);
    setText('proPoints', proPoints);
    setText('vccRating', rating);

    const total = Number(wins) + Number(losses);
    const rate = total > 0 ? Math.round((Number(wins) / total) * 100) : 0;

    setText('overallRecord', `${wins}-${losses}`);
    setText('winRate', `${rate}% Win Rate`);
  }

  function applyProfile(){
    const name = profileName(profile);
    const isOwnProfile = viewer && viewer.id === profile.id;

    document.title = `${name} | VCC Player Profile`;

    setText('heroTitle', name);
    setText('profileTitle', name);

    setImage('profileAvatar', avatar(profile));
    setImage('profilePreview', avatar(profile));

    setText('heroRank', profile.rank || 'Unranked');
    setText('heroPlatform', profile.platform || 'Console');
    setText('heroRegion', profile.region || 'NA');

    setText('heroBio', profile.bio || 'Competitive console Valorant player competing in the VCC ecosystem.');

    setText('riotDisplay', profile.riot_id || 'Not set');
    setText('roleDisplay', profile.main_role || profile.role || 'Flex');
    setText('agentsDisplay', profile.main_agents || profile.agents || 'Not set');
    setText('platformDisplay', profile.platform || 'Console');
    setText('regionDisplay', profile.region || 'NA');
    setText('genderDisplay', profile.gender ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1) : 'Not set');

    const messageLinks = [...document.querySelectorAll('a,button')].filter(el =>
      (el.textContent || '').trim().toLowerCase().includes('message player')
    );

    messageLinks.forEach(el => {
      if(el.tagName.toLowerCase() === 'a'){
        el.href = `inbox.html?to=${encodeURIComponent(profile.id)}`;
      }else{
        el.onclick = () => location.href = `inbox.html?to=${encodeURIComponent(profile.id)}`;
      }
    });

    const editLinks = [...document.querySelectorAll('a,button')].filter(el =>
      (el.textContent || '').trim().toLowerCase().includes('edit profile')
    );

    editLinks.forEach(el => {
      if(isOwnProfile){
        if(el.tagName.toLowerCase() === 'a') el.href = 'edit-profile.html';
        el.style.display = '';
      }else{
        el.style.display = 'none';
      }
    });

    loadStats();

    setStatus(isOwnProfile ? 'Viewing your profile.' : `Viewing ${name}'s public profile.`);
  }

  async function init(){
    try{
      supabase = await getSupabase();
      await loadViewer();
      await loadProfile();
      applyProfile();
    }catch(error){
      setStatus('Profile load error: ' + error.message);
      console.error(error);
    }
  }

  init();
})();
