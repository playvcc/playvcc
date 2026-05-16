// VCC Home Auth/Profile Redirect + Sign Out Fix

(async function(){
  try{
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');

    const supabase = lib.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_ANON_KEY
    );

    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user || null;

    const signInBtns = document.querySelectorAll('.signInBtn, #signInBtn');
    const createBtns = document.querySelectorAll('.createAccountBtn, #createAccountBtn');
    const profileBtns = document.querySelectorAll('.profileBtn, #profileBtn');

    function goProfile(){
      location.href = 'profile.html';
    }

    function goLogin(){
      location.href = 'auth.html?mode=login';
    }

    function goSignup(){
      location.href = 'auth.html?mode=signup';
    }

    signInBtns.forEach(btn => {
      btn.onclick = () => {
        if(user){
          goProfile();
        }else{
          goLogin();
        }
      };
    });

    createBtns.forEach(btn => {
      btn.onclick = () => {
        if(user){
          goProfile();
        }else{
          goSignup();
        }
      };
    });

    profileBtns.forEach(btn => {
      btn.onclick = () => {
        if(user){
          goProfile();
        }else{
          goLogin();
        }
      };
    });

    // Create sign out button dynamically.
    if(user){
      const nav = document.querySelector('.main-nav') || document.querySelector('.nav-wrap');

      if(nav && !document.getElementById('signOutBtn')){
        const btn = document.createElement('button');
        btn.id = 'signOutBtn';
        btn.textContent = 'Sign Out';
        btn.className = 'btn secondary';

        btn.style.marginLeft = '10px';

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
