// VCC front-end admin code lock.
// This is only a page lock. Supabase RLS/admins table is still the real database security.

const VCC_ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';

function showAdminLock(){
  if(sessionStorage.getItem('vcc_admin_unlocked') === 'yes') return;

  const lock = document.createElement('div');
  lock.className = 'admin-lock';
  lock.id = 'adminLock';
  lock.innerHTML = `
    <div class="admin-lock-box">
      <div class="kicker">Secure Admin Access</div>
      <h1 style="font-size:42px">Admin Code</h1>
      <p class="lead">Enter the VCC admin access code to open this panel.</p>
      <input id="adminCodeInput" type="password" placeholder="Admin access code">
      <button id="adminCodeBtn">Unlock Admin</button>
      <a class="btn secondary" href="index.html">Back Home</a>
      <div id="adminCodeStatus" class="log">Admin panel locked.</div>
    </div>
  `;
  document.body.appendChild(lock);

  const input = document.getElementById('adminCodeInput');
  const btn = document.getElementById('adminCodeBtn');
  const status = document.getElementById('adminCodeStatus');

  function unlock(){
    const value = input.value.trim();

    if(value === VCC_ADMIN_CODE){
      sessionStorage.setItem('vcc_admin_unlocked', 'yes');
      lock.remove();
      window.dispatchEvent(new Event('vcc-admin-unlocked'));
    }else{
      status.textContent = 'Wrong admin code.';
    }
  }

  btn.addEventListener('click', unlock);
  input.addEventListener('keydown', e => {
    if(e.key === 'Enter') unlock();
  });

  setTimeout(() => input.focus(), 50);
}

document.addEventListener('DOMContentLoaded', showAdminLock);
