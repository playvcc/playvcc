import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const statusBox = document.getElementById('status');
const heading = document.getElementById('authHeading');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const submitBtn = document.getElementById('submitBtn');

let mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'login';

function setStatus(message){
  statusBox.textContent = message;
}

function setMode(nextMode){
  mode = nextMode;

  if(mode === 'signup'){
    heading.textContent = 'Create Account';
    submitBtn.textContent = 'Create Account';
    tabSignup.classList.add('active');
    tabLogin.classList.remove('active');
    tabLogin.classList.add('secondary');
    tabSignup.classList.remove('secondary');
  }else{
    heading.textContent = 'Sign In';
    submitBtn.textContent = 'Sign In';
    tabLogin.classList.add('active');
    tabSignup.classList.remove('active');
    tabSignup.classList.add('secondary');
    tabLogin.classList.remove('secondary');
  }

  setStatus('Ready.');
}

function validateConfig(){
  if(!SUPABASE_URL || SUPABASE_URL.includes('PASTE_')){
    throw new Error('SUPABASE_URL is missing in supabase-config.js');
  }

  if(!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PASTE_')){
    throw new Error('SUPABASE_ANON_KEY is missing in supabase-config.js');
  }
}

function getClient(){
  validateConfig();
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

async function submitAuth(){
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  if(!email){
    setStatus('Enter your email.');
    return;
  }

  if(!password || password.length < 6){
    setStatus('Password must be at least 6 characters.');
    return;
  }

  try{
    const supabase = getClient();

    if(mode === 'signup'){
      setStatus('Creating account...');

      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if(error) throw error;

      if(data?.session){
        setStatus('Account created and signed in. Redirecting...');
        setTimeout(() => location.href = 'profile.html', 900);
      }else{
        setStatus('Account created. Check your email to confirm, then sign in.');
      }
    }else{
      setStatus('Signing in...');

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if(error) throw error;

      if(!data?.session){
        setStatus('Sign in did not return a session. Check Supabase Auth settings.');
        return;
      }

      setStatus('Signed in. Redirecting...');
      setTimeout(() => location.href = 'profile.html', 900);
    }
  }catch(error){
    setStatus('Error: ' + error.message);
  }
}

tabLogin.addEventListener('click', () => setMode('login'));
tabSignup.addEventListener('click', () => setMode('signup'));
submitBtn.addEventListener('click', submitAuth);

document.addEventListener('keydown', event => {
  if(event.key === 'Enter'){
    submitAuth();
  }
});

setMode(mode);
