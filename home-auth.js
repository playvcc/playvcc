// VCC Auth Link Fix
// Put this on index.html. It prevents bad 404 links and sends signed-in users to profile.

(async function(){
  try{
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    const supabase = lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

    const session = await supabase.auth.getSession();
    const user = session?.data?.session?.user || null;

    function goProfile(){ window.location.href = 'profile.html'; }
    function goLogin(){ window.location.href = 'auth.html?mode=login'; }
    function goSignup(){ window.location.href = 'auth.html?mode=signup'; }

    document.querySelectorAll('a,button').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      const href = el.getAttribute?.('href') || '';

      const isLogin =
        text === 'sign in' ||
        text === 'login' ||
        href.includes('auth.html?mode=login') ||
        href === 'login.html';

      const isSignup =
        text === 'create account' ||
        text === 'sign up' ||
        href.includes('auth.html?mode=signup') ||
        href === 'signup.html';

      if(isLogin){
        el.addEventListener('click', e => {
          e.preventDefault();
          user ? goProfile() : goLogin();
        });
      }

      if(isSignup){
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

    const nav = document.querySelector('.main-nav') || document.querySelector('nav');
    if(nav && user && !document.getElementById('signOutBtn')){
      const btn = document.createElement('button');
      btn.id = 'signOutBtn';
      btn.textContent = 'Sign Out';
      btn.className = 'btn secondary';
      btn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'index.html';
      });
      nav.appendChild(btn);
    }
  }catch(error){
    console.error('home-auth.js error:', error);
  }
})();
