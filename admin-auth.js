const VCC_ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';

(function(){
  function showLock(){
    if(sessionStorage.getItem('vcc_admin_unlocked') === 'yes') return;

    const lock = document.createElement('div');
    lock.className = 'admin-lock';
    lock.id = 'adminLock';
    lock.innerHTML = `
      <div class="admin-lock-box">
        <div class="kicker">Secure Admin Access</div>
        <h1 style="font-size:42px">Admin Code</h1>
        <p class="lead">Enter the VCC admin access code.</p>
        <input id="adminCodeInput" type="password" placeholder="Admin access code">
        <button id="adminCodeBtn">Unlock Admin</button>
        <a class="btn secondary" href="index.html">Back Home</a>
        <div id="adminCodeStatus" class="log">Admin panel locked.</div>
      </div>
    `;

    document.body.appendChild(lock);

    const input = document.getElementById('adminCodeInput');
    const status = document.getElementById('adminCodeStatus');

    function unlock(){
      if(input.value.trim() === VCC_ADMIN_CODE){
        sessionStorage.setItem('vcc_admin_unlocked', 'yes');
        lock.remove();
      }else{
        status.textContent = 'Wrong admin code.';
      }
    }

    document.getElementById('adminCodeBtn').addEventListener('click', unlock);
    input.addEventListener('keydown', e => {
      if(e.key === 'Enter') unlock();
    });

    setTimeout(() => input.focus(), 50);
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showLock);
  else showLock();
})();
