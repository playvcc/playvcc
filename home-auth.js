// VCC hard auth fix.
// This is NOT a module, so the homepage buttons will still work even if Supabase import/config has issues.

(function(){
  let mode = 'login';

  function $(id){ return document.getElementById(id); }

  function setMode(nextMode){
    mode = nextMode || 'login';

    const title = $('authTitle');
    const text = $('authText');
    const submit = $('authSubmit');
    const status = $('authStatus');

    if(mode === 'signup'){
      if(title) title.textContent = 'Create Account';
      if(text) text.textContent = 'Create your VCC account to build a profile, join teams, receive invites, and compete.';
      if(submit) submit.textContent = 'Create Account';
    }else{
      if(title) title.textContent = 'Sign In';
      if(text) text.textContent = 'Sign in to manage your VCC profile, teams, invites, and matches.';
      if(submit) submit.textContent = 'Sign In';
    }

    if(status) status.textContent = 'Ready.';
  }

  function openAuth(nextMode){
    const modal = $('authModal');
    if(!modal){
      // Fallback if modal is missing.
      window.location.href = 'auth.html?mode=' + encodeURIComponent(nextMode || 'login');
      return;
    }

    setMode(nextMode || 'login');
    modal.classList.add('show');
    setTimeout(function(){
      if($('authEmail')) $('authEmail').focus();
    }, 50);
  }

  function closeAuth(){
    const modal = $('authModal');
    if(modal) modal.classList.remove('show');
  }

  async function createSupabaseClient(){
    const cfg = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');

    if(!cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes('PASTE_') || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes('PASTE_')){
      throw new Error('Supabase keys are missing in supabase-config.js');
    }

    return lib.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  async function submitAuth(){
    const status = $('authStatus');
    const email = $('authEmail') ? $('authEmail').value.trim() : '';
    const password = $('authPass') ? $('authPass').value : '';

    if(!email || !password){
      if(status) status.textContent = 'Enter email and password.';
      return;
    }

    try{
      if(status) status.textContent = mode === 'signup' ? 'Creating account...' : 'Signing in...';

      const supabase = await createSupabaseClient();

      if(mode === 'signup'){
        const result = await supabase.auth.signUp({ email: email, password: password });
        if(result.error) throw result.error;

        if(status) status.textContent = 'Account created. Check email if required.';

        const login = await supabase.auth.signInWithPassword({ email: email, password: password });
        if(!login.error){
          setTimeout(function(){ window.location.href = 'profile.html'; }, 800);
        }
      }else{
        const result = await supabase.auth.signInWithPassword({ email: email, password: password });
        if(result.error) throw result.error;

        if(status) status.textContent = 'Signed in. Redirecting...';
        setTimeout(function(){ window.location.href = 'profile.html'; }, 800);
      }
    }catch(error){
      if(status) status.textContent = 'Error: ' + error.message;
    }
  }

  async function isLoggedIn(){
    try{
      const supabase = await createSupabaseClient();
      const session = await supabase.auth.getSession();
      return !!session?.data?.session?.user;
    }catch(error){
      return false;
    }
  }

  function wireButtons(){
    document.querySelectorAll('.auth-link, #loginOpen, #signupOpen').forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.preventDefault();
        const requestedMode = btn.getAttribute('data-mode') || (btn.id === 'signupOpen' ? 'signup' : 'login');
        openAuth(requestedMode);
      });
    });

    const close = $('authClose');
    if(close) close.addEventListener('click', closeAuth);

    const switchLogin = $('switchToLogin');
    if(switchLogin) switchLogin.addEventListener('click', function(){ setMode('login'); });

    const switchSignup = $('switchToSignup');
    if(switchSignup) switchSignup.addEventListener('click', function(){ setMode('signup'); });

    const submit = $('authSubmit');
    if(submit) submit.addEventListener('click', submitAuth);

    const modal = $('authModal');
    if(modal){
      modal.addEventListener('click', function(e){
        if(e.target.id === 'authModal') closeAuth();
      });
    }

    document.querySelectorAll('a[href="profile.html"], a[href="./profile.html"]').forEach(function(link){
      link.addEventListener('click', async function(e){
        const loggedIn = await isLoggedIn();
        if(!loggedIn){
          e.preventDefault();
          openAuth('login');
        }
      });
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', wireButtons);
  }else{
    wireButtons();
  }

  window.openVCCAuth = openAuth;
})();
