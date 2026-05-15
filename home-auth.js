import { supabase } from './app.js';

let mode = 'login';

function openAuth(nextMode){
  mode = nextMode;
  document.getElementById('authTitle').textContent =
    mode === 'signup' ? 'Create Account' : 'Sign In';
  document.getElementById('authModal').classList.add('show');
}

document.getElementById('loginOpen')?.addEventListener('click', () => openAuth('login'));
document.getElementById('signupOpen')?.addEventListener('click', () => openAuth('signup'));

document.getElementById('authClose')?.addEventListener('click', () => {
  document.getElementById('authModal').classList.remove('show');
});

document.getElementById('authSubmit')?.addEventListener('click', async () => {
  const status = document.getElementById('authStatus');
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPass').value;

  if(!email || !password){
    status.textContent = 'Enter email and password.';
    return;
  }

  try{
    status.textContent = 'Working...';

    if(mode === 'signup'){
      const { error } = await supabase.auth.signUp({ email, password });
      if(error) throw error;
      status.textContent = 'Account created. Check email if required.';
    }else{
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if(error) throw error;
      status.textContent = 'Signed in. Redirecting...';
      setTimeout(() => location.href = 'profile.html', 800);
    }
  }catch(error){
    status.textContent = 'Error: ' + error.message;
  }
});
