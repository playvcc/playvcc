// ======================================================
// VCC Homepage Login/Create Account Modal
// Uses app.js exported Supabase client.
// ======================================================

import { supabase } from './app.js';

let mode = 'login';

function el(id){ return document.getElementById(id); }

function createModal(){
  if(el('vccAuthModalBackdrop')) return;

  const modal = document.createElement('div');
  modal.id = 'vccAuthModalBackdrop';
  modal.className = 'vcc-auth-modal-backdrop';
  modal.innerHTML = `
    <div class="vcc-auth-modal">
      <div class="vcc-auth-modal-top">
        <div>
          <h2 id="vccAuthTitle">Sign In</h2>
          <p id="vccAuthText">Sign in to manage your profile, teams, scrims, and tournament invites.</p>
        </div>
        <button class="vcc-auth-close" id="vccAuthClose">✕</button>
      </div>

      <input id="vccAuthEmail" type="email" placeholder="Email">
      <input id="vccAuthPassword" type="password" placeholder="Password">

      <button class="submit" id="vccAuthSubmit">Sign In</button>

      <div class="vcc-auth-switch">
        <span id="vccAuthSwitchText">Need an account?</span>
        <button id="vccAuthSwitchBtn">Create Account</button>
      </div>

      <div id="vccAuthStatus" class="vcc-auth-status">Ready.</div>
    </div>
  `;

  document.body.appendChild(modal);

  el('vccAuthClose').addEventListener('click', closeAuthModal);
  el('vccAuthSwitchBtn').addEventListener('click', () => {
    setAuthMode(mode === 'login' ? 'signup' : 'login');
  });
  el('vccAuthSubmit').addEventListener('click', submitAuth);

  modal.addEventListener('click', (e) => {
    if(e.target.id === 'vccAuthModalBackdrop') closeAuthModal();
  });
}

function setAuthMode(newMode){
  mode = newMode;

  if(mode === 'signup'){
    el('vccAuthTitle').textContent = 'Create Account';
    el('vccAuthText').textContent = 'Create your VCC account to build a profile, join teams, and compete.';
    el('vccAuthSubmit').textContent = 'Create Account';
    el('vccAuthSwitchText').textContent = 'Already have an account?';
    el('vccAuthSwitchBtn').textContent = 'Sign In';
  }else{
    el('vccAuthTitle').textContent = 'Sign In';
    el('vccAuthText').textContent = 'Sign in to manage your profile, teams, scrims, and tournament invites.';
    el('vccAuthSubmit').textContent = 'Sign In';
    el('vccAuthSwitchText').textContent = 'Need an account?';
    el('vccAuthSwitchBtn').textContent = 'Create Account';
  }

  el('vccAuthStatus').textContent = 'Ready.';
}

function openAuthModal(openMode='login'){
  createModal();
  setAuthMode(openMode);
  el('vccAuthModalBackdrop').classList.add('show');
  setTimeout(() => el('vccAuthEmail')?.focus(), 50);
}

function closeAuthModal(){
  el('vccAuthModalBackdrop')?.classList.remove('show');
}

async function submitAuth(){
  const status = el('vccAuthStatus');
  const email = el('vccAuthEmail').value.trim();
  const password = el('vccAuthPassword').value;

  if(!email || !password){
    status.textContent = 'Enter email and password.';
    return;
  }

  try{
    status.textContent = mode === 'signup' ? 'Creating account...' : 'Signing in...';

    if(mode === 'signup'){
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if(error) throw error;

      status.textContent = data?.user
        ? 'Account created. Check your email if confirmation is required.'
        : 'Check your email to confirm your account.';
    }else{
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if(error) throw error;

      status.textContent = 'Signed in. Refreshing...';
      setTimeout(() => location.reload(), 800);
    }
  }catch(err){
    status.textContent = 'Error: ' + err.message;
  }
}

async function renderHomepageAuthButtons(){
  const session = await supabase.auth.getSession();
  const user = session?.data?.session?.user || null;

  const existing = el('vccHomeAuthButtons');
  if(existing) existing.remove();

  const box = document.createElement('div');
  box.id = 'vccHomeAuthButtons';

  if(user){
    box.className = 'vcc-user-panel';
    box.innerHTML = `
      <strong>Logged in as ${user.email || 'VCC User'}</strong>
      <div class="vcc-auth-open-btns">
        <a class="vcc-auth-open-btn" href="profile.html">My Profile</a>
        <a class="vcc-auth-open-btn secondary" href="inbox.html">Inbox</a>
        <button class="vcc-auth-open-btn secondary" id="vccHomepageSignOut">Sign Out</button>
      </div>
    `;
  }else{
    box.className = 'vcc-auth-open-btns';
    box.innerHTML = `
      <button class="vcc-auth-open-btn" id="vccOpenLogin">Sign In</button>
      <button class="vcc-auth-open-btn secondary" id="vccOpenSignup">Create Account</button>
    `;
  }

  const target =
    document.querySelector('.hub-actions') ||
    document.querySelector('.hero-actions') ||
    document.querySelector('.hub-hero-copy') ||
    document.querySelector('main');

  if(target){
    target.appendChild(box);
  }else{
    document.body.prepend(box);
  }

  el('vccOpenLogin')?.addEventListener('click', () => openAuthModal('login'));
  el('vccOpenSignup')?.addEventListener('click', () => openAuthModal('signup'));
  el('vccHomepageSignOut')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  createModal();
  renderHomepageAuthButtons();

  // Also make any existing auth links open modal instead of leaving page
  document.querySelectorAll('a[href="auth.html"], a[href="auth.html?mode=signup"]').forEach(a => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal(a.href.includes('signup') ? 'signup' : 'login');
    });
  });
});
