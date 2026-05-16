// VCC Start Time Source-of-Truth Admin Patch
// Add after admin.js:
// <script src="admin-start-time-patch.js"></script>

(function(){
  const ADMIN_CODE = 'VCC-SiN-9Q7M-4K2X-8R5P-2026!';

  function getAdminCode(){
    return sessionStorage.getItem('vcc_admin_code') || document.getElementById('adminCode')?.value || '';
  }

  function status(msg){
    const box = document.getElementById('adminStatus') || document.querySelector('.log');
    if(box) box.textContent = msg;
    else alert(msg);
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  function localInputToIso(value){
    if(!value) return null;
    const d = new Date(value);
    if(Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function findTournamentId(card){
    const text = card.innerText || '';
    const match = text.match(/ID:\s*([0-9a-fA-F-]{36})/);
    return match ? match[1] : null;
  }

  function addForceButtons(){
    document.querySelectorAll('.vcc-card').forEach(card => {
      if(card.dataset.startPatchAdded === 'yes') return;

      const id = findTournamentId(card);
      if(!id) return;

      card.dataset.startPatchAdded = 'yes';

      const btn = document.createElement('button');
      btn.textContent = 'Set Start Time';
      btn.className = 'gold';
      btn.style.marginLeft = '8px';

      btn.addEventListener('click', async () => {
        try{
          const adminCode = getAdminCode();

          if(adminCode !== ADMIN_CODE){
            status('Unlock admin first.');
            return;
          }

          const value = prompt(
            'Enter NEW tournament start time in this format:\nYYYY-MM-DDTHH:MM\n\nExample:\n2026-05-16T20:00'
          );

          if(!value) return;

          const iso = localInputToIso(value);

          if(!iso){
            status('Invalid date/time. Use YYYY-MM-DDTHH:MM');
            return;
          }

          status('Saving real start time...');

          const supabase = await getSupabase();

          const result = await supabase.rpc('set_tournament_start_time_admin', {
            admin_code:adminCode,
            p_tournament_id:id,
            p_start_date:iso
          });

          if(result.error) throw result.error;

          status('Start time saved. Check-in was recalculated automatically.');
          setTimeout(() => window.location.reload(), 800);

        }catch(error){
          status('Set start time error: ' + error.message);
        }
      });

      const generateBtn = card.querySelector('.generateBtn') || card.querySelector('button.gold') || card.querySelector('button:last-of-type');
      if(generateBtn && generateBtn.parentNode){
        generateBtn.parentNode.insertBefore(btn, generateBtn.nextSibling);
      }else{
        card.appendChild(btn);
      }
    });
  }

  function init(){
    addForceButtons();
    setInterval(addForceButtons, 1000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
