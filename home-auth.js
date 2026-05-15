// VCC Sign In / Create Account Fix
// This version does NOT depend on app.js.
// It imports Supabase directly and uses supabase-config.js.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let authMode = 'login';

function get(id){
  return document.getElementById(id);
}

function ensureAuthModal(){
  let modal = get('authModal');

  if(modal) return modal;

  modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'auth-modal';
  modal.innerHTML = `
    <div class="auth-box">
      <h2 id="authTitle">Sign In</h2>
      <p class="muted" id="authText">Sign in to manage your VCC profile, teams, invites, and matches.</p>

      <input id="authEmail" type="email" placeholder="Email">
      <input id="authPass" type="password" placeholder="Password">

      <button type="button" id="authSubmit">Sign In</button>
      <button type="button" class="secondary" id="authClose">Close</button>

      <div style="margin-top:12px">
        <button type="button" class="secondary" id="switchToLogin">Sign In</button>
        <button type="button" class="secondary" id="switchToSignup">Create Account</button>
      </div>

      <div id="authStatus" class="log">Ready.</div>
    </div>
  `;

  document.body.appendChild(modal);

  get('authClose').addEventListener('click', closeAuthModal);
  get('switchToLogin').addEventListener('click', () => setAuthMode('login'));
  get('switchToSignup').addEventListener('click', () => setAuthMode('signup'));
  get('authSubmit').addEventListener('click', submitAuth);

  modal.addEventListener('click', e => {
    if(e.target.id === 'authModal') closeAuthModal();
  });

  return modal;
}

function setAuthMode(mode){
  authMode = mode;

  const title = get('authTitle');
  const text = get('authText');
  const submit = get('authSubmit');
  const status = get('authStatus');

  if(authMode === 'signup'){
    title.textContent = 'Create Account';
    text.textContent = 'Create your VCC account to build a profile, join teams, receive invites, and compete.';
    submit.textContent = 'Create Account';
  }else{
    title.textContent = 'Sign In';
    text.textContent = 'Sign in to manage your VCC profile, teams, invites, and matches.';
    submit.textContent = 'Sign In';
  }

  status.textContent = 'Ready.';
}

function openAuthModal(mode='login'){
  ensureAuthModal();
  setAuthMode(mode);
  get('authModal').classList.add('show');
  setTimeout(() => get('authEmail')?.focus(), 50);
}

function closeAuthModal(){
  get('authModal')?.classList.remove('show');
}

async function submitAuth(){
  const status = get('authStatus');
  const email = get('authEmail').value.trim();
  const password = get('authPass').value;

  if(!email || !password){
    status.textContent = 'Enter email and password.';
    return;
  }

  if(!SUPABASE_URL || SUPABASE_URL.includes('PASTE_') || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('PASTE_')){
    status.textContent = 'Supabase keys are missing in supabase-config.js.';
    return;
  }

  try{
    if(authMode === 'signup'){
      status.textContent = 'Creating account...';

      const { error } = await supabase.auth.signUp({
        email,
        password
      });

      if(error) throw error;

      status.textContent = 'Account created. Check your email if confirmation is required.';

      // If email confirmation is disabled, this will work and send them to profile.
      const login = await supabase.auth.signInWithPassword({ email, password });
      if(!login.error){
        setTimeout(() => location.href = 'profile.html', 800);
      }
    }else{
      status.textContent = 'Signing in...';

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if(error) throw error;

      status.textContent = 'Signed in. Redirecting...';
      setTimeout(() => location.href = 'profile.html', 800);
    }
  }catch(error){
    status.textContent = 'Error: ' + error.message;
  }
}

async function isLoggedIn(){
  try{
    const session = await supabase.auth.getSession();
    return !!session?.data?.session?.user;
  }catch{
    return false;
  }
}

function wireButtons(){
  const loginBtn = get('loginOpen');
  const signupBtn = get('signupOpen');

  if(loginBtn){
    loginBtn.addEventListener('click', e => {
      e.preventDefault();
      openAuthModal('login');
    });
  }

  if(signupBtn){
    signupBtn.addEventListener('click', e => {
      e.preventDefault();
      openAuthModal('signup');
    });
  }

  // Extra fallback: catches any button/link text on homepage.
  document.querySelectorAll('button,a').forEach(el => {
    const text = (el.textContent || '').trim().toLowerCase();

    if(text === 'sign in' || text === 'login'){
      el.addEventListener('click', e => {
        if(el.getAttribute('href') === 'profile.html') return;
        e.preventDefault();
        openAuthModal('login');
      });
    }

    if(text === 'create account' || text === 'sign up'){
      el.addEventListener('click', e => {
        e.preventDefault();
        openAuthModal('signup');
      });
    }
  });
}

function protectProfileLinks(){
  document.querySelectorAll('a[href="profile.html"], a[href="./profile.html"]').forEach(link => {
    link.addEventListener('click', async e => {
      const loggedIn = await isLoggedIn();

      if(!loggedIn){
        e.preventDefault();
        openAuthModal('login');
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  ensureAuthModal();
  wireButtons();
  protectProfileLinks();
});

window.openVCCAuth = openAuthModal;
