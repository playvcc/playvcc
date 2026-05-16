// VCC Home Auth Redirect + Sign Out Fix
(async function(){
  try{
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    const supabase = lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

    const session = await supabase.auth.getSession();
    const user = session?.data?.session?.user || null;

    function goProfile(){ location.href = 'profile.html'; }
    function goLogin(){ location.href = 'auth.html?mode=login'; }
    function goSignup(){ location.href = 'auth.html?mode=signup'; }

    document.querySelectorAll('a,button').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      const href = el.getAttribute?.('href') || '';

      if(text === 'sign in' || text === 'login'){
        el.addEventListener('click', e => {
          e.preventDefault();
          user ? goProfile() : goLogin();
        });
      }

      if(text === 'create account' || text === 'sign up'){
        el.addEventListener('click', e => {
          e.preventDefault();
          user ? goProfile() : goSignup();
        });
      }

      if(href === 'profile.html' || href === './profile.html'){
        el.addEventListener('click', e => {
          if(!user){
            e.preventDefault();
            goLogin();
          }
        });
      }
    });
  }catch(error){
    console.error('home-auth.js error:', error);
  }
})();
