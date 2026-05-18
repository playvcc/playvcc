// VCC Latest profile-data.js
// Loads own profile or another player's profile using ?id=PLAYER_ID

(async function(){
  let supabase = null;
  let viewer = null;
  let profile = null;

  function byId(id){ return document.getElementById(id); }

  function setText(id, value){
    const el = byId(id);
    if(el) el.textContent = value ?? '';
  }

  function avatar(p){
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

  function setImage(id, src){
    const el = byId(id);
    if(!el) return;

    el.onerror = () => {
      el.onerror = null;
      el.src = 'assets/vcc-logo.png';
    };

    el.src = src || 'assets/vcc-logo.png';
  }

  function applyImages(src){
    [
      'profileAvatar',
      'profilePreview',
      'avatarPreview',
      'profileImage',
      'pfpPreview'
    ].forEach(id => setImage(id, src));

    document.querySelectorAll('.player-avatar, .profile-avatar img').forEach(img => {
      img.onerror = () => {
        img.onerror = null;
        img.src = 'assets/vcc-logo.png';
      };
      img.src = src || 'assets/vcc-logo.png';
    });
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

    if(result.error) throw result.error;

    profile = result.data;
  }

  function loadStats(){
    const wins = profile?.wins ?? 0;
    const losses = profile?.losses ?? 0;
    const mapsWon = profile?.maps_won ?? 0;
    const mapsLost = profile?.maps_lost ?? 0;
    const proPoints = profile?.pro_points ?? 0;
    const rating = profile?.vcc_rating ?? 1000;

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
    if(!profile) return;

    const name = profileName(profile);
    const img = avatar(profile);

    document.title = `${name} | VCC Player Profile`;

    setText('heroTitle', name);
    setText('profileTitle', name);

    applyImages(img);

    setText('heroRank', profile.rank || 'Unranked');
    setText('heroPlatform', profile.platform || 'Console');
    setText('heroRegion', profile.region || 'NA');

    setText(
      'heroBio',
      profile.bio || 'Competitive console Valorant player competing in the VCC ecosystem.'
    );

    setText('riotDisplay', profile.riot_id || 'Not set');
    setText('roleDisplay', profile.main_role || profile.role || 'Flex');
    setText('agentsDisplay', profile.main_agents || profile.agents || 'Not set');
    setText('platformDisplay', profile.platform || 'Console');
    setText('regionDisplay', profile.region || 'NA');
    setText(
      'genderDisplay',
      profile.gender
        ? profile.gender.charAt(0).toUpperCase() + profile.gender.slice(1)
        : 'Not set'
    );

    loadStats();
  }

  async function init(){
    try{
      supabase = await getSupabase();
      await loadViewer();
      await loadProfile();
      applyProfile();
    }catch(error){
      console.error(error);
    }
  }

  init();
})();
