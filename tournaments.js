// VCC Tournaments Loading Fix
// Replace tournaments.js with this.
// Simple/clean display script: reads tournaments table and renders created events.

(async function(){
  const statusBox =
    document.getElementById('tournamentStatus') ||
    document.getElementById('status') ||
    document.querySelector('.log');

  const box =
    document.getElementById('tournamentsBox') ||
    document.getElementById('eventsBox') ||
    document.querySelector('[data-tournaments-box]') ||
    document.querySelector('.list');

  function setStatus(msg){
    if(statusBox) statusBox.textContent = msg;
    console.log('[VCC Tournaments]', msg);
  }

  function safe(value){
    return String(value ?? '').replace(/[&<>"']/g, function(c){
      return {
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#039;'
      }[c];
    });
  }

  function dateText(value){
    if(!value) return 'Not set';

    const date = new Date(value);

    if(Number.isNaN(date.getTime())){
      return 'Invalid date';
    }

    return date.toLocaleString();
  }

  function getStart(t){
    return t.start_date || t.start_time || t.starts_at || t.start_at || t.event_start || null;
  }

  function checkInOpen(startValue){
    if(!startValue) return null;

    const start = new Date(startValue);

    if(Number.isNaN(start.getTime())){
      return null;
    }

    return new Date(start.getTime() - 30 * 60 * 1000).toISOString();
  }

  function checkInStatus(startValue){
    if(!startValue) return 'No start time';

    const start = new Date(startValue).getTime();

    if(Number.isNaN(start)){
      return 'Invalid start time';
    }

    const mins = Math.floor((start - Date.now()) / 60000);

    if(mins > 30){
      return 'Check-in opens in ' + (mins - 30) + ' min';
    }

    if(mins > 0){
      return 'Check-in OPEN';
    }

    return 'Check-in closed';
  }

  async function getSupabase(){
    const config = await import('./supabase-config.js');
    const lib = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    return lib.createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  }

  async function main(){
    try{
      if(!box){
        setStatus('Error: tournamentsBox was not found in tournaments.html.');
        return;
      }

      box.innerHTML = '<div class="log">Loading tournaments...</div>';

      const supabase = await getSupabase();

      const session = await supabase.auth.getSession();
      const user = session?.data?.session?.user || null;

      if(user){
        setStatus('Signed in as ' + user.email + '.');
      }else{
        setStatus('Not signed in.');
      }

      const result = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending:false });

      if(result.error){
        throw result.error;
      }

      const tournaments = result.data || [];

      if(!tournaments.length){
        box.innerHTML = '<div class="log">No tournaments created yet.</div>';
        return;
      }

      const seen = new Set();
      const unique = tournaments.filter(function(t){
        if(!t.id) return false;
        if(seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });

      box.innerHTML = unique.map(function(t){
        const start = getStart(t);
        const checkOpen = checkInOpen(start);

        return `
          <article class="vcc-card">
            <div class="vcc-panel-title">
              <h2>${safe(t.name || 'Tournament')}</h2>
              <span>${safe(t.status || 'open')}</span>
            </div>

            <p>${safe(t.description || 'No description posted yet.')}</p>

            <p>
              <span class="pill">${safe(t.status || 'open')}</span>
              <span class="pill">Division: ${safe(t.division || 'open')}</span>
              <span class="pill">Format: ${safe(t.format || 'TBD')}</span>
              <span class="pill">${safe(checkInStatus(start))}</span>
            </p>

            <p>Start: ${safe(dateText(start))}</p>
            <p>Check-in: ${safe(dateText(checkOpen))} → ${safe(dateText(start))}</p>

            <button class="signupBtn" data-id="${safe(t.id)}">Sign Up</button>
          </article>
        `;
      }).join('');

      document.querySelectorAll('.signupBtn').forEach(function(btn){
        btn.addEventListener('click', function(){
          alert('Signup button loaded for tournament ID: ' + btn.dataset.id);
        });
      });

      setStatus('Loaded ' + unique.length + ' tournaments.');

    }catch(error){
      console.error(error);

      if(box){
        box.innerHTML = '<div class="log">Tournament load error: ' + safe(error.message) + '</div>';
      }

      setStatus('Tournament load error: ' + error.message);
    }
  }

  main();
})();
