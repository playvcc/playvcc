// VCC Visible Sign Out Button Fix

(async function(){
  try{
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    const supabase = lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);

    const session = await supabase.auth.getSession();
    const user = session?.data?.session?.user || null;

    const nav = document.querySelector('.main-nav') || document.querySelector('.hub-rightbar') || document.querySelector('nav');
    if(!nav) return;

    document.querySelectorAll('#signOutBtn, #signInStateBtn').forEach(btn => btn.remove());

    if(user){
      const signOut = document.createElement('button');
      signOut.id = 'signOutBtn';
      signOut.textContent = 'Sign Out';
      signOut.className = 'btn secondary';
      signOut.style.marginLeft = '10px';
      signOut.style.cursor = 'pointer';

      signOut.addEventListener('click', async () => {
        await supabase.auth.signOut();
        alert('Signed out.');
        window.location.href = 'index.html';
      });

      nav.appendChild(signOut);
    }else{
      const signIn = document.createElement('a');
      signIn.id = 'signInStateBtn';
      signIn.textContent = 'Sign In';
      signIn.href = 'auth.html?mode=login';
      signIn.className = 'btn';
      signIn.style.marginLeft = '10px';
      nav.appendChild(signIn);
    }

    document.querySelectorAll('a,button').forEach(el => {
      const text = (el.textContent || '').trim().toLowerCase();

      if(user && (text === 'sign in' || text === 'login' || text === 'create account' || text === 'sign up')){
        if(el.id !== 'signOutBtn'){
          el.addEventListener('click', e => {
            e.preventDefault();
            window.location.href = 'profile.html';
          });
        }
      }

      const href = el.getAttribute?.('href') || '';
      if(!user && (href === 'profile.html' || href === './profile.html')){
        el.addEventListener('click', e => {
          e.preventDefault();
          window.location.href = 'auth.html?mode=login';
        });
      }
    });

  }catch(error){
    console.error('auth-nav.js error:', error);
  }
})();
