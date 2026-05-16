// VCC Auth Redirect + Sign Out Fix
// If already signed in: Sign In/Create Account/Profile goes to profile.
// If logged out: Sign In/Create Account goes to auth.html.
// Adds Sign Out button when signed in.

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

    function isSignInText(el){
      return (el.textContent || '').trim().toLowerCase() === 'sign in'
        || (el.textContent || '').trim().toLowerCase() === 'login';
    }

    function isCreateText(el){
      const text = (el.textContent || '').trim().toLowerCase();
      return text === 'create account' || text === 'sign up';
    }

    document.querySelectorAll('a,button').forEach(el => {
      const href = el.getAttribute('href') || '';

      if(el.id === 'loginOpen' || el.id === 'signInBtn' || el.classList.contains('signInBtn') || isSignInText(el)){
        el.addEventListener('click', e => {
          e.preventDefault();
          user ? goProfile() : goLogin();
        });
      }

      if(el.id === 'signupOpen' || el.id === 'createAccountBtn' || el.classList.contains('createAccountBtn') || isCreateText(el)){
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

    if(user){
      const nav = document.querySelector('.main-nav') || document.querySelector('.nav-wrap');
      if(nav && !document.getElementById('signOutBtn')){
        const btn = document.createElement('button');
        btn.id = 'signOutBtn';
        btn.textContent = 'Sign Out';
        btn.className = 'btn secondary';
        btn.onclick = async () => {
          await supabase.auth.signOut();
          alert('Signed out.');
          location.href = 'index.html';
        };
        nav.appendChild(btn);
      }
    }
  }catch(error){
    console.error('home-auth.js error', error);
  }
})();
